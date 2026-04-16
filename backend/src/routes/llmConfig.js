const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const CONFIG_PATH = path.join(__dirname, '../../data/llm-config.json');

function getDefaultConfig() {
  return {
    activeProvider: process.env.YANDEX_API_KEY ? 'yandex'
      : process.env.ANTHROPIC_API_KEY ? 'anthropic'
      : 'yandex',
    providers: {
      yandex: {
        apiKey: process.env.YANDEX_API_KEY || '',
        folderId: process.env.YANDEX_FOLDER_ID || '',
        model: 'yandexgpt/latest',
        customModels: [],
        temperature: 0.6,
        maxTokens: 4000,
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: 'claude-sonnet-4-6',
        temperature: 0.7,
        maxTokens: 4000,
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4000,
        baseUrl: 'https://api.openai.com/v1',
      },
    },
  };
}

function readConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      return getDefaultConfig();
    }
  }
  return getDefaultConfig();
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function maskKey(key) {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 6) + '••••••••' + key.slice(-4);
}

// GET /api/llm-config — return config with masked keys
router.get('/', (req, res) => {
  const config = readConfig();
  const safe = { activeProvider: config.activeProvider, providers: {} };
  for (const [id, p] of Object.entries(config.providers)) {
    safe.providers[id] = { ...p, apiKey: '' };
    safe.providers[id].apiKeySet = !!p.apiKey;
    if (p.apiKey) safe.providers[id].apiKeyMasked = maskKey(p.apiKey);
  }
  res.json(safe);
});

// PUT /api/llm-config — save config
router.put('/', (req, res) => {
  const { activeProvider, providers } = req.body;
  const existing = readConfig();
  const updated = { ...existing };

  if (activeProvider) updated.activeProvider = activeProvider;

  if (providers && typeof providers === 'object') {
    for (const [id, p] of Object.entries(providers)) {
      if (!updated.providers[id]) updated.providers[id] = {};
      updated.providers[id] = { ...updated.providers[id], ...p };
      // Preserve existing key if empty string is sent (user didn't change it)
      if (p.apiKey === '' && existing.providers[id]?.apiKey) {
        updated.providers[id].apiKey = existing.providers[id].apiKey;
      }
    }
  }

  writeConfig(updated);
  res.json({ ok: true });
});

// POST /api/llm-config/test/:provider — check connectivity
router.post('/test/:provider', async (req, res) => {
  const { provider } = req.params;
  const config = readConfig();
  const pCfg = config.providers[provider];

  if (!pCfg) return res.status(400).json({ ok: false, error: 'Неизвестный провайдер' });

  try {
    if (provider === 'yandex') {
      if (!pCfg.apiKey || !pCfg.folderId) {
        return res.json({ ok: false, error: 'Требуются API Key и Folder ID' });
      }
      // Parse folderId — user may have accidentally entered a full gpt:// URI
      let folderId = pCfg.folderId;
      if (folderId.startsWith('gpt://')) {
        folderId = folderId.slice(6).split('/')[0];
      }
      // Use the configured model URI (or fallback to lite for basic connectivity check)
      let testModelUri;
      if (pCfg.model && pCfg.model.startsWith('gpt://')) {
        testModelUri = pCfg.model;
        // Override folderId from model URI to ensure consistency
        folderId = pCfg.model.slice(6).split('/')[0];
      } else {
        const modelPath = pCfg.model || 'yandexgpt-lite/latest';
        testModelUri = `gpt://${folderId}/${modelPath}`;
      }
      const body = JSON.stringify({
        modelUri: testModelUri,
        completionOptions: { stream: false, temperature: 0.1, maxTokens: 5 },
        messages: [{ role: 'user', text: 'тест' }],
      });
      try {
        await httpPost({
          hostname: 'llm.api.cloud.yandex.net',
          path: '/foundationModels/v1/completion',
          headers: {
            'Authorization': `Api-Key ${pCfg.apiKey}`,
            'x-folder-id': folderId,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        }, body);
      } catch (primaryErr) {
        // Fallback to OpenAI-compatible endpoint (used by some models like deepseek)
        const openAIBody = JSON.stringify({
          model: testModelUri,
          messages: [{ role: 'user', content: 'тест' }],
          temperature: 0.1,
          max_tokens: 5,
          stream: false,
        });
        await httpPost({
          hostname: 'llm.api.cloud.yandex.net',
          path: '/v1/chat/completions',
          headers: {
            'Authorization': `Api-Key ${pCfg.apiKey}`,
            'x-folder-id': folderId,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(openAIBody),
          },
        }, openAIBody);
      }

    } else if (provider === 'anthropic') {
      if (!pCfg.apiKey) return res.json({ ok: false, error: 'Требуется API Key' });
      const body = JSON.stringify({
        model: pCfg.model || 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }],
      });
      await httpPost({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        headers: {
          'x-api-key': pCfg.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, body);

    } else if (provider === 'openai') {
      if (!pCfg.apiKey) return res.json({ ok: false, error: 'Требуется API Key' });
      const rawBaseUrl = pCfg.baseUrl || 'https://api.openai.com/v1';
      const baseUrl = new URL(rawBaseUrl);
      const body = JSON.stringify({
        model: pCfg.model || 'gpt-4o-mini',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }],
      });
      await httpPost({
        hostname: baseUrl.hostname,
        path: (baseUrl.pathname.replace(/\/$/, '')) + '/chat/completions',
        headers: {
          'Authorization': `Bearer ${pCfg.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, body);

    } else {
      return res.json({ ok: false, error: 'Провайдер не поддерживается' });
    }

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message || 'Ошибка подключения' });
  }
});

function httpPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, method: 'POST' }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
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

module.exports = router;
module.exports.readConfig = readConfig;
