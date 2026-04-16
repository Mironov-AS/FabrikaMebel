const express = require('express');
const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { readConfig } = require('./llmConfig');

const router = express.Router();
router.use(authenticate);

// ─── System prompt for address normalization ─────────────────────────────────
const SYSTEM_PROMPT = `Ты — специалист по нормализации российских адресов для геокодирования через OpenStreetMap Nominatim.

Твоя задача: получить список адресов и вернуть нормализованную версию каждого.

Правила нормализации:
- Раскрывай сокращения: "ул." → "улица", "пр-кт" / "пр-т" / "пр." → "проспект", "пер." → "переулок", "наб." → "набережная", "ш." → "шоссе", "б-р" → "бульвар", "пл." → "площадь", "туп." → "тупик"
- Убирай "г." / "город" перед названием города
- Убирай "д." перед номером дома
- Раскрывай "к." / "корп." → "корпус", "стр." → "строение"
- Сохраняй название города в начале адреса
- Если в строке только название организации/компании — оставь как есть
- Не придумывай детали, которых нет в исходном адресе
- Результат строго в формате JSON без пояснений: {"results":[{"original":"...","normalized":"..."}]}`;

// ─── Helpers to call each provider synchronously ─────────────────────────────

function httpPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, method: 'POST' }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          let errMsg = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(data);
            errMsg = parsed?.error?.message || parsed?.message || errMsg;
          } catch (_) {}
          reject(new Error(errMsg));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function callAnthropic(pCfg, userMessage) {
  if (!pCfg.apiKey) throw new Error('Anthropic API Key не задан');
  const client = new Anthropic({ apiKey: pCfg.apiKey });
  const response = await client.messages.create({
    model: pCfg.model || 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.1,
  });
  return response.content[0].text;
}

async function callOpenAI(pCfg, userMessage) {
  if (!pCfg.apiKey) throw new Error('OpenAI API Key не задан');
  const baseUrl = new URL((pCfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''));
  const body = JSON.stringify({
    model: pCfg.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });
  const raw = await httpPost({
    hostname: baseUrl.hostname,
    path: baseUrl.pathname.replace(/\/$/, '') + '/chat/completions',
    headers: {
      'Authorization': `Bearer ${pCfg.apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  const json = JSON.parse(raw);
  return json.choices?.[0]?.message?.content || '';
}

async function callYandex(pCfg, userMessage) {
  if (!pCfg.apiKey) throw new Error('Yandex API Key не задан');

  let folderId = pCfg.folderId || '';
  let modelUri;
  if (pCfg.model && pCfg.model.startsWith('gpt://')) {
    modelUri = pCfg.model;
    folderId = pCfg.model.slice(6).split('/')[0];
  } else {
    if (folderId.startsWith('gpt://')) folderId = folderId.slice(6).split('/')[0];
    if (!folderId) throw new Error('Yandex Folder ID не задан');
    modelUri = `gpt://${folderId}/${pCfg.model || 'yandexgpt/latest'}`;
  }

  // Try native Yandex API first
  const body = JSON.stringify({
    modelUri,
    completionOptions: { stream: false, temperature: 0.1, maxTokens: 2000 },
    messages: [
      { role: 'system', text: SYSTEM_PROMPT },
      { role: 'user', text: userMessage },
    ],
  });

  let raw;
  try {
    raw = await httpPost({
      hostname: 'llm.api.cloud.yandex.net',
      path: '/foundationModels/v1/completion',
      headers: {
        'Authorization': `Api-Key ${pCfg.apiKey}`,
        'x-folder-id': folderId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, body);
    const json = JSON.parse(raw);
    return json.result?.alternatives?.[0]?.message?.text || '';
  } catch (_) {
    // Fallback to OpenAI-compatible endpoint
    const openaiBody = JSON.stringify({
      model: modelUri,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });
    raw = await httpPost({
      hostname: 'llm.api.cloud.yandex.net',
      path: '/v1/chat/completions',
      headers: {
        'Authorization': `Api-Key ${pCfg.apiKey}`,
        'x-folder-id': folderId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(openaiBody),
      },
    }, openaiBody);
    const json = JSON.parse(raw);
    return json.choices?.[0]?.message?.content || '';
  }
}

// ─── Extract JSON from LLM response (handles markdown code fences) ────────────
function parseJsonResponse(text) {
  // Strip markdown fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── POST /api/geocode-llm ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { addresses } = req.body;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: 'Поле addresses обязательно (массив строк)' });
  }
  if (addresses.length > 50) {
    return res.status(400).json({ error: 'Максимум 50 адресов за один запрос' });
  }

  const config = readConfig();
  const provider = config.activeProvider || 'yandex';
  const pCfg = config.providers?.[provider] || {};

  const userMessage = `Нормализуй адреса для геокодирования:\n${JSON.stringify(addresses, null, 2)}`;

  try {
    let rawText;
    if (provider === 'anthropic') {
      rawText = await callAnthropic(pCfg, userMessage);
    } else if (provider === 'openai') {
      rawText = await callOpenAI(pCfg, userMessage);
    } else if (provider === 'yandex') {
      rawText = await callYandex(pCfg, userMessage);
    } else {
      return res.status(400).json({ error: `Провайдер "${provider}" не поддерживается` });
    }

    let parsed;
    try {
      parsed = parseJsonResponse(rawText);
    } catch {
      // LLM returned non-JSON — return originals unchanged
      return res.json({
        results: addresses.map(a => ({ original: a, normalized: a })),
        warning: 'LLM вернула неожиданный формат, использованы исходные адреса',
      });
    }

    // Validate shape
    if (!Array.isArray(parsed?.results)) {
      return res.json({
        results: addresses.map(a => ({ original: a, normalized: a })),
        warning: 'LLM вернула неверную структуру, использованы исходные адреса',
      });
    }

    // Ensure all addresses are present (LLM may have skipped some)
    const resultMap = new Map(parsed.results.map(r => [r.original, r.normalized]));
    const finalResults = addresses.map(a => ({
      original: a,
      normalized: resultMap.get(a) || a,
    }));

    res.json({ results: finalResults, provider });
  } catch (err) {
    console.error('geocode-llm error:', err);
    res.status(500).json({ error: err.message || 'Ошибка LLM при геокодировании' });
  }
});

// ─── GET /api/geocode-llm/status ─────────────────────────────────────────────
router.get('/status', (req, res) => {
  const config = readConfig();
  const provider = config.activeProvider || 'yandex';
  const pCfg = config.providers?.[provider] || {};

  let configured = false;
  if (provider === 'yandex') configured = !!(pCfg.apiKey?.trim() && (pCfg.folderId?.trim() || pCfg.model?.startsWith('gpt://')));
  else if (provider === 'anthropic') configured = !!(pCfg.apiKey?.trim());
  else if (provider === 'openai') configured = !!(pCfg.apiKey?.trim());

  res.json({ configured, provider, model: pCfg.model });
});

module.exports = router;
