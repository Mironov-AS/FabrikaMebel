const express = require('express');
const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { readConfig } = require('./llmConfig');

const router = express.Router();
router.use(authenticate);

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);

  const counterparties = db.prepare('SELECT * FROM counterparties ORDER BY name').all();

  const contracts = db.prepare(`
    SELECT c.id, c.number, c.status, c.amount, c.date, c.valid_until, c.subject,
           c.payment_delay, c.penalty_rate, cp.name AS counterparty_name
    FROM contracts c
    LEFT JOIN counterparties cp ON c.counterparty_id = cp.id
    ORDER BY c.date DESC
  `).all();

  const orders = db.prepare(`
    SELECT o.id, o.number, o.status, o.total_amount, o.date, o.shipment_deadline, o.priority,
           c.number AS contract_number, cp.name AS counterparty_name
    FROM orders o
    LEFT JOIN contracts c ON o.contract_id = c.id
    LEFT JOIN counterparties cp ON o.counterparty_id = cp.id
    ORDER BY o.date DESC
  `).all();

  const payments = db.prepare(`
    SELECT p.id, p.amount, p.due_date, p.paid_date, p.status,
           p.invoice_number, p.penalty_days, p.penalty_amount,
           cp.name AS counterparty_name
    FROM payments p
    LEFT JOIN counterparties cp ON p.counterparty_id = cp.id
    ORDER BY p.due_date DESC
  `).all();

  const shipments = db.prepare(`
    SELECT s.id, s.order_number, s.date, s.invoice_number, s.amount,
           s.status, s.payment_due_date, s.paid_amount, s.paid_date,
           cp.name AS counterparty_name
    FROM shipments s
    LEFT JOIN counterparties cp ON s.counterparty_id = cp.id
    ORDER BY s.date DESC
  `).all();

  const claims = db.prepare(`
    SELECT cl.id, cl.number, cl.date, cl.deadline, cl.description,
           cl.status, cl.responsible, cl.resolution,
           c.number AS contract_number, cp.name AS counterparty_name
    FROM claims cl
    LEFT JOIN contracts c ON cl.contract_id = c.id
    LEFT JOIN counterparties cp ON cl.counterparty_id = cp.id
    ORDER BY cl.date DESC
  `).all();

  const production = db.prepare(`
    SELECT pt.id, pt.name, pt.status, pt.start_date, pt.end_date,
           pt.progress, pt.responsible, pt.priority, pt.order_number,
           cp.name AS counterparty_name
    FROM production_tasks pt
    LEFT JOIN orders o ON pt.order_id = o.id
    LEFT JOIN counterparties cp ON o.counterparty_id = cp.id
    ORDER BY pt.end_date ASC
  `).all();

  const statusLabels = {
    active: 'активен', completed: 'выполнен', suspended: 'приостановлен', draft: 'черновик',
    planned: 'запланирован', in_production: 'в производстве',
    ready_for_shipment: 'готов к отгрузке', scheduled_for_shipment: 'отгрузка запланирована', shipped: 'отгружен',
    paid: 'оплачен', overdue: 'просрочен', pending: 'ожидает оплаты',
    open: 'открыта', in_review: 'на рассмотрении', resolved: 'решена', closed: 'закрыта',
    high: 'высокий', medium: 'средний', low: 'низкий',
  };
  const t = (v) => statusLabels[v] || v || '—';
  const rub = (v) => v != null ? `${Number(v).toLocaleString('ru-RU')} ₽` : '—';

  const overduePayments = payments.filter(p => p.status === 'overdue');
  const overdueTotal = overduePayments.reduce((s, p) => s + (p.amount || 0), 0);
  const activeContracts = contracts.filter(c => c.status === 'active');
  const openClaims = claims.filter(c => c.status === 'open' || c.status === 'in_review');
  const upcomingShipments = orders.filter(o =>
    o.status !== 'completed' && o.status !== 'shipped' && o.shipment_deadline &&
    new Date(o.shipment_deadline) >= new Date(today)
  ).sort((a, b) => new Date(a.shipment_deadline) - new Date(b.shipment_deadline));

  // Contract files with extracted text
  const contractFiles = db.prepare(`
    SELECT cf.contract_id, cf.original_name, cf.mimetype, cf.content_text,
           c.number AS contract_number
    FROM contract_files cf
    LEFT JOIN contracts c ON cf.contract_id = c.id
    WHERE cf.content_text IS NOT NULL AND cf.content_text != ''
    ORDER BY cf.uploaded_at DESC
  `).all();

  // Group files by contract
  const filesByContract = {};
  for (const f of contractFiles) {
    if (!filesByContract[f.contract_number]) filesByContract[f.contract_number] = [];
    filesByContract[f.contract_number].push(f);
  }

  const contractFilesSection = Object.keys(filesByContract).length > 0
    ? Object.entries(filesByContract).map(([num, files]) =>
        files.map(f => {
          const preview = (f.content_text || '').slice(0, 3000);
          return `### Договор №${num} — файл: ${f.original_name}\n${preview}${f.content_text.length > 3000 ? '\n...[текст обрезан]' : ''}`;
        }).join('\n\n')
      ).join('\n\n---\n\n')
    : 'Нет загруженных файлов с извлечённым текстом';

  return `Ты — ИИ-ассистент системы управления договорами ContractPro.
Помогаешь сотрудникам находить информацию по клиентам, договорам, заказам, платежам, отгрузкам и рекламациям.
Отвечай на русском языке, чётко и по существу. Используй маркированные списки и структуру там, где это улучшает читаемость.
При ответе опирайся ТОЛЬКО на данные ниже. Если данных нет — так и скажи.
Сегодняшняя дата: ${today}

=== СВОДКА ===
- Активных договоров: ${activeContracts.length}, на сумму ${rub(activeContracts.reduce((s, c) => s + (c.amount || 0), 0))}
- Просроченных платежей: ${overduePayments.length}${overduePayments.length ? `, общая сумма ${rub(overdueTotal)}` : ''}
- Открытых рекламаций: ${openClaims.length}
- Ближайший срок отгрузки: ${upcomingShipments[0] ? `Заказ №${upcomingShipments[0].number} до ${upcomingShipments[0].shipment_deadline}` : 'нет'}

=== ДАННЫЕ СИСТЕМЫ ===

## КОНТРАГЕНТЫ (${counterparties.length})
${counterparties.map(c =>
  `- ${c.name} | ИНН: ${c.inn || '—'} | Тел: ${c.phone || '—'} | Email: ${c.email || '—'} | Приоритет: ${t(c.priority)}`
).join('\n') || 'Нет данных'}

## ДОГОВОРЫ (${contracts.length})
${contracts.map(c =>
  `- №${c.number} | ${c.counterparty_name || '—'} | Статус: ${t(c.status)} | Сумма: ${rub(c.amount)} | Дата: ${c.date || '—'} | До: ${c.valid_until || '—'} | Предмет: ${c.subject || '—'}`
).join('\n') || 'Нет данных'}

## ЗАКАЗЫ (${orders.length})
${orders.map(o =>
  `- №${o.number} | ${o.counterparty_name || '—'} | Договор №${o.contract_number || '—'} | Статус: ${t(o.status)} | Сумма: ${rub(o.total_amount)} | Дедлайн отгрузки: ${o.shipment_deadline || '—'} | Приоритет: ${t(o.priority)}`
).join('\n') || 'Нет данных'}

## ПЛАТЕЖИ (${payments.length})
${payments.map(p =>
  `- ID:${p.id} | ${p.counterparty_name || '—'} | Счёт: ${p.invoice_number || '—'} | Сумма: ${rub(p.amount)} | Статус: ${t(p.status)} | Срок оплаты: ${p.due_date || '—'} | Оплачено: ${p.paid_date || '—'}${p.penalty_days ? ` | Просрочка: ${p.penalty_days} дн, штраф: ${rub(p.penalty_amount)}` : ''}`
).join('\n') || 'Нет данных'}

## ОТГРУЗКИ (${shipments.length})
${shipments.map(s =>
  `- Заказ №${s.order_number || s.id} | ${s.counterparty_name || '—'} | Счёт: ${s.invoice_number || '—'} | Сумма: ${rub(s.amount)} | Дата: ${s.date || '—'} | Статус: ${t(s.status)} | Срок оплаты: ${s.payment_due_date || '—'} | Оплачено: ${rub(s.paid_amount)}`
).join('\n') || 'Нет данных'}

## РЕКЛАМАЦИИ (${claims.length})
${claims.map(c =>
  `- №${c.number} | ${c.counterparty_name || '—'} | Договор №${c.contract_number || '—'} | Статус: ${t(c.status)} | Срок: ${c.deadline || '—'} | Ответственный: ${c.responsible || '—'} | Описание: ${c.description || '—'}`
).join('\n') || 'Нет данных'}

## ПРОИЗВОДСТВО (${production.length} задач)
${production.map(p =>
  `- ${p.name} | Заказ №${p.order_number || '—'} | ${p.counterparty_name || '—'} | Статус: ${t(p.status)} | Прогресс: ${p.progress ?? 0}% | Срок: ${p.end_date || '—'} | Ответственный: ${p.responsible || '—'} | Приоритет: ${t(p.priority)}`
).join('\n') || 'Нет данных'}

## СОДЕРЖИМОЕ ФАЙЛОВ ДОГОВОРОВ
Ниже приведён текст, извлечённый из загруженных документов (PDF, Word, TXT). Используй эту информацию при ответах на вопросы о содержании договоров.

${contractFilesSection}`;
}

// ── Yandex GPT streaming ──────────────────────────────────────────────────────
function buildYandexMessages(systemPrompt, history, userMessage) {
  const messages = [{ role: 'system', text: systemPrompt }];
  for (const m of history) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.content });
  }
  messages.push({ role: 'user', text: userMessage });
  return messages;
}

function yandexStream(apiKey, folderId, modelUri, messages, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      modelUri,
      completionOptions: { stream: true, temperature, maxTokens },
      messages,
    });

    const req = https.request({
      hostname: 'llm.api.cloud.yandex.net',
      path: '/foundationModels/v1/completion',
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => { resolve(res); });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function yandexOpenAIStream(apiKey, folderId, modelUri, messages, temperature, maxTokens) {
  // OpenAI-compatible endpoint for models not supported by gRPC API (e.g. DeepSeek)
  const openAIMessages = messages.map((m) => ({ role: m.role, content: m.text }));
  const body = JSON.stringify({
    model: modelUri,
    messages: openAIMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'llm.api.cloud.yandex.net',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => { resolve(res); });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function pipeYandexOpenAIStream(httpRes, res) {
  let buffer = '';
  httpRes.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      try {
        const json = JSON.parse(jsonStr);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      } catch (_) {}
    }
  });
  httpRes.on('end', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });
  httpRes.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });
}

async function handleYandex(res, pCfg, systemPrompt, history, message) {
  if (!pCfg.apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'YANDEX_API_KEY не задан' })}\n\n`);
    return res.end();
  }

  let folderId = pCfg.folderId || '';
  let modelUri;

  // Model can be stored as a full gpt:// URI (new format from custom model management)
  if (pCfg.model && pCfg.model.startsWith('gpt://')) {
    modelUri = pCfg.model;
    folderId = pCfg.model.slice(6).split('/')[0];
  } else {
    // Legacy: parse folderId — user may have accidentally entered a full gpt:// URI
    if (folderId.startsWith('gpt://')) {
      const parts = folderId.slice(6).split('/');
      folderId = parts[0];
    }
    if (!folderId) {
      res.write(`data: ${JSON.stringify({ error: 'YANDEX_FOLDER_ID не задан' })}\n\n`);
      return res.end();
    }
    const modelPath = pCfg.model || 'yandexgpt/latest';
    modelUri = `gpt://${folderId}/${modelPath}`;
  }
  const messages = buildYandexMessages(systemPrompt, history, message);
  const httpRes = await yandexStream(
    pCfg.apiKey, folderId, modelUri, messages,
    pCfg.temperature ?? 0.6, pCfg.maxTokens ?? 4000
  );

  if (httpRes.statusCode !== 200) {
    let errBody = '';
    httpRes.on('data', (c) => { errBody += c; });
    httpRes.on('end', async () => {
      let errMsg = 'Ошибка Yandex API';
      let isGrpcError = false;
      try {
        const parsed = JSON.parse(errBody);
        errMsg = parsed.error?.message || parsed.message || errMsg;
        // Detect gRPC-only error — fall back to OpenAI-compatible endpoint
        if (errMsg && (errMsg.toLowerCase().includes('grpc') || errMsg.toLowerCase().includes('openai'))) {
          isGrpcError = true;
        }
      } catch (_) {
        if (errBody.toLowerCase().includes('grpc') || errBody.toLowerCase().includes('openai')) {
          isGrpcError = true;
        }
      }

      if (isGrpcError) {
        try {
          const fallbackRes = await yandexOpenAIStream(
            pCfg.apiKey, folderId, modelUri, messages,
            pCfg.temperature ?? 0.6, pCfg.maxTokens ?? 4000
          );
          if (fallbackRes.statusCode !== 200) {
            let fb = '';
            fallbackRes.on('data', (c) => { fb += c; });
            fallbackRes.on('end', () => {
              let msg = 'Ошибка Yandex OpenAI API';
              try { msg = JSON.parse(fb).error?.message || msg; } catch (_) {}
              res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
              res.end();
            });
          } else {
            pipeYandexOpenAIStream(fallbackRes, res);
          }
        } catch (fbErr) {
          res.write(`data: ${JSON.stringify({ error: fbErr.message })}\n\n`);
          res.end();
        }
        return;
      }

      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.end();
    });
    return;
  }

  let prevText = '';
  let buffer = '';

  httpRes.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed);
        const currentText = json.result?.alternatives?.[0]?.message?.text ?? '';
        const delta = currentText.slice(prevText.length);
        if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        prevText = currentText;
      } catch (_) {}
    }
  });

  httpRes.on('end', () => {
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim());
        const currentText = json.result?.alternatives?.[0]?.message?.text ?? '';
        const delta = currentText.slice(prevText.length);
        if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      } catch (_) {}
    }
    res.write('data: [DONE]\n\n');
    res.end();
  });

  httpRes.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });
}

// ── Anthropic Claude streaming ────────────────────────────────────────────────
async function handleAnthropic(res, pCfg, systemPrompt, history, message) {
  if (!pCfg.apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'Anthropic API Key не задан' })}\n\n`);
    return res.end();
  }

  const client = new Anthropic({ apiKey: pCfg.apiKey });
  const messages = [];
  for (const m of history) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: message });

  const stream = client.messages.stream({
    model: pCfg.model || 'claude-sonnet-4-6',
    max_tokens: pCfg.maxTokens ?? 4000,
    system: systemPrompt,
    messages,
    temperature: pCfg.temperature ?? 0.7,
  });

  stream.on('text', (text) => {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  });

  stream.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message || 'Ошибка Anthropic API' })}\n\n`);
    res.end();
  });

  stream.on('end', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });
}

// ── OpenAI-compatible streaming ───────────────────────────────────────────────
function openAIStream(apiKey, baseUrl, model, messages, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const url = new URL((baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions');
    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => { resolve(res); });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleOpenAI(res, pCfg, systemPrompt, history, message) {
  if (!pCfg.apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'OpenAI API Key не задан' })}\n\n`);
    return res.end();
  }

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: message });

  const httpRes = await openAIStream(
    pCfg.apiKey,
    pCfg.baseUrl,
    pCfg.model || 'gpt-4o',
    messages,
    pCfg.temperature ?? 0.7,
    pCfg.maxTokens ?? 4000
  );

  if (httpRes.statusCode !== 200) {
    let errBody = '';
    httpRes.on('data', (c) => { errBody += c; });
    httpRes.on('end', () => {
      let errMsg = `OpenAI API HTTP ${httpRes.statusCode}`;
      try { errMsg = JSON.parse(errBody).error?.message || errMsg; } catch (_) {}
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.end();
    });
    return;
  }

  let buffer = '';

  httpRes.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      const dataPart = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      try {
        const json = JSON.parse(dataPart);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      } catch (_) {}
    }
  });

  httpRes.on('end', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });

  httpRes.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });
}

// ── GET /api/ai-chat/status ───────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const config = readConfig();
  const provider = config.activeProvider || 'yandex';
  const pCfg = config.providers?.[provider] || {};

  let configured = false;
  if (provider === 'yandex') configured = !!(pCfg.apiKey?.trim() && pCfg.folderId?.trim());
  else if (provider === 'anthropic') configured = !!(pCfg.apiKey?.trim());
  else if (provider === 'openai') configured = !!(pCfg.apiKey?.trim());

  res.json({ configured, provider, model: pCfg.model });
});

// ── POST /api/ai-chat — streaming SSE ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Сообщение обязательно' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const config = readConfig();
    const provider = config.activeProvider || 'yandex';
    const pCfg = config.providers?.[provider] || {};
    const systemPrompt = buildSystemPrompt();

    if (provider === 'yandex') {
      await handleYandex(res, pCfg, systemPrompt, history, message);
    } else if (provider === 'anthropic') {
      await handleAnthropic(res, pCfg, systemPrompt, history, message);
    } else if (provider === 'openai') {
      await handleOpenAI(res, pCfg, systemPrompt, history, message);
    } else {
      res.write(`data: ${JSON.stringify({ error: `Провайдер "${provider}" не поддерживается` })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error('AI Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'Неизвестная ошибка' })}\n\n`);
    res.end();
  }
});

module.exports = router;
