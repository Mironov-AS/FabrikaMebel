const express = require('express');
const path = require('path');
const https = require('https');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr, checkLengths } = require('../middleware/validate');
const { readConfig } = require('./llmConfig');

// ─── S3 client setup ───────────────────────────────────────────────────────────
let s3Client = null;
function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT ? `https://${process.env.S3_ENDPOINT}` : undefined,
      region: process.env.S3_REGION || 'ru-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

const S3_BUCKET = () => process.env.S3_BUCKET || '';
const S3_PREFIX = 'contracts/';

async function getFileBuffer(s3Key) {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET(), Key: s3Key });
  const response = await getS3Client().send(cmd);
  const chunks = [];
  for await (const chunk of response.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ─── Text extraction helpers ───────────────────────────────────────────────────
async function extractText(bufferOrPath, mimetype) {
  try {
    const buffer = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : require('fs').readFileSync(bufferOrPath);
    if (mimetype === 'text/plain') return buffer.toString('utf8').slice(0, 50000);
    if (mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return (data.text || '').slice(0, 50000);
    }
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').slice(0, 50000);
    }
  } catch (err) {
    console.warn('Text extraction failed:', err.message);
  }
  return null;
}

// ─── AI contract analysis ──────────────────────────────────────────────────────
async function analyzeContractWithAI(text, myCompanyName) {
  const cfg = readConfig();
  const active = cfg.activeProvider || 'anthropic';
  const pCfg = cfg.providers?.[active] || {};

  const companyHint = myCompanyName
    ? `ВАЖНО: Наша компания называется "${myCompanyName}". Контрагентом является ДРУГАЯ сторона договора — не наша компания.\n`
    : 'Контрагентом является та сторона договора, которая не является поставщиком/производителем (т.е. покупатель, заказчик или клиент).\n';

  const prompt = `Ты — специалист по анализу договоров. Проанализируй текст договора и верни JSON строго следующей структуры (без пояснений, только JSON):
{
  "number": "номер договора или null",
  "date": "дата в формате YYYY-MM-DD или null",
  "validUntil": "дата окончания действия в формате YYYY-MM-DD или null. Если договор заключён на 1 год от даты подписания — вычисли дату окончания как дата+1год",
  "amount": число или null,
  "subject": "предмет договора (краткое описание, 5-10 слов) или null",
  "paymentDelay": число (календарных дней отсрочки платежа) или null,
  "penaltyRate": число (процент штрафа за день просрочки оплаты, например 0.01) или null,
  "counterparty": {
    "name": "полное официальное название контрагента (не нашей компании) или null",
    "inn": "ИНН контрагента (только цифры, 10 или 12 знаков) или null",
    "kpp": "КПП контрагента (только цифры, 9 знаков) или null",
    "address": "юридический/почтовый адрес контрагента или null",
    "delivery_address": "адрес доставки или склада контрагента, если указан отдельно, иначе null",
    "contact": "контактное лицо контрагента или null",
    "phone": "телефон контрагента или null",
    "email": "email контрагента или null"
  }
}

${companyHint}
Дополнительные правила:
- paymentDelay: если указаны рабочие дни (например "14 рабочих дней"), умножь на 1.4 и округли до целого (14 рабочих дней ≈ 20 календарных дней)
- penaltyRate: используй ставку штрафа за просрочку ОПЛАТЫ (со стороны покупателя/контрагента), не штраф за просрочку поставки
- validUntil: если договор "действует в течение 1 года" от даты подписания — прибавь 1 год к дате договора
- counterparty.name: если наша компания является Поставщиком, то контрагент — это Покупатель. Если наша компания является Покупателем, то контрагент — Поставщик.

Текст договора:
${text}`;

  try {
    if (active === 'anthropic' && pCfg.apiKey) {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: pCfg.apiKey });
      const msg = await client.messages.create({
        model: pCfg.model || 'claude-sonnet-4-6',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = msg.content[0]?.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    }

    if ((active === 'openai' || active === 'yandex') && pCfg.apiKey) {
      let hostname, urlPath, authHeader, extraHeaders = {};
      if (active === 'yandex') {
        hostname = 'llm.api.cloud.yandex.net';
        urlPath = '/v1/chat/completions';
        authHeader = `Api-Key ${pCfg.apiKey}`;
        if (pCfg.folderId) extraHeaders['x-folder-id'] = pCfg.folderId;
      } else {
        const base = new URL((pCfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''));
        hostname = base.hostname;
        urlPath = base.pathname + '/chat/completions';
        authHeader = `Bearer ${pCfg.apiKey}`;
      }
      let modelId;
      if (active === 'yandex') {
        const baseModel = pCfg.model || 'yandexgpt/latest';
        // If model already contains a full URI (gpt://...), use it as-is
        modelId = baseModel.startsWith('gpt://') ? baseModel
          : pCfg.folderId ? `gpt://${pCfg.folderId}/${baseModel}` : baseModel;
      } else {
        modelId = pCfg.model || 'gpt-4o';
      }
      const body = JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
        stream: false,
      });
      const raw = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname, path: urlPath, method: 'POST',
          timeout: 55000,
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...extraHeaders,
          },
        }, (httpRes) => {
          let data = '';
          httpRes.on('data', c => { data += c; });
          httpRes.on('end', () => resolve(data));
          httpRes.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('AI request timeout')); });
        req.write(body);
        req.end();
      });
      const json = JSON.parse(raw);
      // DeepSeek models return answer in reasoning_content when content is null
      const content = json.choices?.[0]?.message?.content
        || json.choices?.[0]?.message?.reasoning_content
        || '';
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    }
  } catch (err) {
    console.warn('AI contract analysis error:', err.message);
  }
  return null;
}

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Недопустимый тип файла'));
  },
});

const VALID_CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'completed'];

const router = express.Router();
router.use(authenticate);

// Helper: build full contract object with relations
async function buildContract(row) {
  if (!row) return null;
  const conditions = await db.all('SELECT * FROM contract_conditions WHERE contract_id = $1', [row.id]);
  const obligations = await db.all('SELECT * FROM contract_obligations WHERE contract_id = $1', [row.id]);
  const versions = await db.all('SELECT * FROM contract_versions WHERE contract_id = $1 ORDER BY version_num', [row.id]);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    date: row.date,
    amount: row.amount,
    subject: row.subject,
    counterpartyId: row.counterparty_id,
    validUntil: row.valid_until,
    paymentDelay: row.payment_delay,
    penaltyRate: row.penalty_rate,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    file: row.file_name,
    conditions: conditions.map(c => ({ id: c.id, text: c.text, fulfilled: !!c.fulfilled })),
    obligations: obligations.map(o => ({ id: o.id, party: o.party, text: o.text, deadline: o.deadline, status: o.status })),
    versions: versions.map(v => ({ version: v.version_num, date: v.date, author: v.author, changes: v.changes })),
  };
}

// GET /api/contracts/files/all
router.get('/files/all', async (req, res) => {
  try {
    const files = await db.all(`
      SELECT cf.id, cf.contract_id, cf.original_name, cf.mimetype, cf.size,
             cf.uploaded_by_name, cf.uploaded_at,
             c.number AS contract_number, cp.name AS counterparty_name
      FROM contract_files cf
      LEFT JOIN contracts c ON cf.contract_id = c.id
      LEFT JOIN counterparties cp ON c.counterparty_id = cp.id
      ORDER BY cf.uploaded_at DESC
    `);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts/analyze-file — upload + AI extraction (before contract creation)
router.post('/analyze-file', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой (максимум 20 МБ)' });
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    try {
      const contentText = await extractText(req.file.buffer, req.file.mimetype);

      // Upload to S3 (optional — if S3 is not configured, skip gracefully)
      let s3Key = null;
      const s3Configured = S3_BUCKET() && S3_BUCKET() !== 'your_bucket_name' &&
        process.env.S3_ACCESS_KEY && process.env.S3_ACCESS_KEY !== 'your_access_key';
      if (s3Configured) {
        try {
          s3Key = `${S3_PREFIX}${uuidv4()}${path.extname(req.file.originalname)}`;
          await getS3Client().send(new PutObjectCommand({
            Bucket: S3_BUCKET(),
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          }));
        } catch (s3Err) {
          console.warn('S3 upload failed, continuing without file storage:', s3Err.message);
          s3Key = null;
        }
      }

      const fileInfo = {
        storedFileName: s3Key,
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      let extracted = null;
      if (contentText && contentText.trim().length >= 30) {
        const companySetting = await db.get("SELECT value FROM app_settings WHERE key = 'company_name'");
        const myCompanyName = companySetting?.value?.trim() || '';
        // Keep text compact: first 2500 chars (header/parties/dates) + last 3000 chars (requisites/INN)
        let textForAI = contentText;
        if (contentText.length > 5000) {
          const head = contentText.slice(0, 2500);
          const tail = contentText.slice(-3000);
          textForAI = head + '\n\n[...]\n\n' + tail;
        }
        extracted = await analyzeContractWithAI(textForAI, myCompanyName);
      }

      let matchedCounterparty = null;
      if (extracted?.counterparty) {
        const all = await db.all('SELECT * FROM counterparties');
        const cp = extracted.counterparty;
        if (cp.inn) {
          matchedCounterparty = all.find(c => c.inn && c.inn.trim() === cp.inn.trim()) || null;
        }
        if (!matchedCounterparty && cp.name) {
          const nl = cp.name.toLowerCase().replace(/[«»"']/g, '').trim();
          matchedCounterparty = all.find(c => {
            const cl = c.name.toLowerCase().replace(/[«»"']/g, '').trim();
            return cl === nl || cl.includes(nl) || nl.includes(cl);
          }) || null;
        }
      }

      res.json({ ...fileInfo, extracted, matchedCounterparty: matchedCounterparty || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// GET /api/contracts
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM contracts ORDER BY created_at DESC');
    const contracts = await Promise.all(rows.map(buildContract));
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contracts/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Договор не найден' });
    res.json(await buildContract(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts
router.post('/', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const {
      number, counterpartyId, date, validUntil, status, amount, subject,
      paymentDelay, penaltyRate, conditions = [], obligations = [],
      tempFile,
    } = req.body;

    if (!number) return res.status(400).json({ error: 'Номер договора обязателен' });
    if (!counterpartyId) return res.status(400).json({ error: 'Контрагент обязателен' });
    if (!date) return res.status(400).json({ error: 'Дата договора обязательна' });
    if (!subject) return res.status(400).json({ error: 'Предмет договора обязателен' });

    if (status !== undefined && !VALID_CONTRACT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_CONTRACT_STATUSES.join(', ')}` });
    }

    const safeNumber = sanitizeStr(number);
    const safeSubject = sanitizeStr(subject);

    const lenErr = checkLengths({ 'Номер договора': safeNumber, 'Предмет договора': safeSubject }, 500);
    if (lenErr) return res.status(400).json({ error: lenErr });

    const existing = await db.get('SELECT id FROM contracts WHERE number = $1', [safeNumber]);
    if (existing) return res.status(409).json({ error: 'Договор с таким номером уже существует' });

    const result = await db.runReturning(`
      INSERT INTO contracts (number, counterparty_id, date, valid_until, status, amount, subject, payment_delay, penalty_rate, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [safeNumber, counterpartyId, date, validUntil, status || 'draft', amount || 0, safeSubject, paymentDelay || 30, penaltyRate || 0.1, req.user.id]);

    const contractId = result.lastInsertRowid;

    for (const c of conditions) {
      await db.run('INSERT INTO contract_conditions (contract_id, text, fulfilled) VALUES ($1, $2, $3)', [contractId, c.text, c.fulfilled ? 1 : 0]);
    }
    for (const o of obligations) {
      await db.run('INSERT INTO contract_obligations (contract_id, party, text, deadline, status) VALUES ($1, $2, $3, $4, $5)', [contractId, o.party, o.text, o.deadline || null, o.status || 'pending']);
    }
    await db.run('INSERT INTO contract_versions (contract_id, version_num, date, author, changes) VALUES ($1, 1, $2, $3, $4)', [contractId, date || new Date().toISOString().slice(0, 10), req.user.name, 'Создание договора']);

    logAudit(req.user.id, req.user.name, `Создан договор ${number}`, 'Договор', contractId, req.ip);

    if (tempFile?.storedFileName) {
      try {
        // tempFile.storedFileName is now an S3 key
        const fileBuffer = await getFileBuffer(tempFile.storedFileName);
        const fileText = await extractText(fileBuffer, tempFile.mimetype);
        await db.run(`
          INSERT INTO contract_files (contract_id, original_name, stored_name, mimetype, size, uploaded_by, uploaded_by_name, content_text)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [contractId, tempFile.originalName, tempFile.storedFileName, tempFile.mimetype, tempFile.size || 0, req.user.id, req.user.name, fileText || null]);
      } catch (e) {
        console.warn('Failed to link temp file to contract:', e.message);
      }
    }

    const contract = await buildContract(await db.get('SELECT * FROM contracts WHERE id = $1', [contractId]));
    res.status(201).json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contracts/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const contract = await db.get('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (!contract) return res.status(404).json({ error: 'Договор не найден' });

    const {
      number, counterpartyId, date, validUntil, status, amount, subject,
      paymentDelay, penaltyRate, conditions, obligations, changeDescription,
    } = req.body;

    if (status !== undefined && !VALID_CONTRACT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_CONTRACT_STATUSES.join(', ')}` });
    }

    const safeNumber = number !== undefined ? sanitizeStr(number) : undefined;
    const safeSubject = subject !== undefined ? sanitizeStr(subject) : undefined;

    const lenErr = checkLengths({
      ...(safeNumber !== undefined ? { 'Номер договора': safeNumber } : {}),
      ...(safeSubject !== undefined ? { 'Предмет договора': safeSubject } : {}),
    }, 500);
    if (lenErr) return res.status(400).json({ error: lenErr });

    await db.run(`
      UPDATE contracts SET
        number = COALESCE($1, number),
        counterparty_id = COALESCE($2, counterparty_id),
        date = COALESCE($3, date),
        valid_until = COALESCE($4, valid_until),
        status = COALESCE($5, status),
        amount = COALESCE($6, amount),
        subject = COALESCE($7, subject),
        payment_delay = COALESCE($8, payment_delay),
        penalty_rate = COALESCE($9, penalty_rate),
        updated_at = NOW()
      WHERE id = $10
    `, [safeNumber, counterpartyId, date, validUntil, status, amount, safeSubject, paymentDelay, penaltyRate, req.params.id]);

    if (conditions !== undefined) {
      await db.run('DELETE FROM contract_conditions WHERE contract_id = $1', [req.params.id]);
      for (const c of conditions) {
        await db.run('INSERT INTO contract_conditions (contract_id, text, fulfilled) VALUES ($1, $2, $3)', [req.params.id, c.text, c.fulfilled ? 1 : 0]);
      }
    }

    if (obligations !== undefined) {
      await db.run('DELETE FROM contract_obligations WHERE contract_id = $1', [req.params.id]);
      for (const o of obligations) {
        await db.run('INSERT INTO contract_obligations (contract_id, party, text, deadline, status) VALUES ($1, $2, $3, $4, $5)', [req.params.id, o.party, o.text, o.deadline || null, o.status || 'pending']);
      }
    }

    const maxVersion = await db.get('SELECT MAX(version_num) as max FROM contract_versions WHERE contract_id = $1', [req.params.id]);
    const nextVersion = (maxVersion.max || 0) + 1;
    await db.run('INSERT INTO contract_versions (contract_id, version_num, date, author, changes) VALUES ($1, $2, $3, $4, $5)', [
      req.params.id, nextVersion, new Date().toISOString().slice(0, 10), req.user.name, changeDescription || 'Изменение договора',
    ]);

    logAudit(req.user.id, req.user.name, `Изменён договор ${contract.number}`, 'Договор', contract.id, req.ip);

    const updated = await buildContract(await db.get('SELECT * FROM contracts WHERE id = $1', [req.params.id]));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contracts/:id — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const contract = await db.get('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (!contract) return res.status(404).json({ error: 'Договор не найден' });

    await db.run('DELETE FROM contracts WHERE id = $1', [req.params.id]);
    logAudit(req.user.id, req.user.name, `Удалён договор ${contract.number}`, 'Договор', contract.id, req.ip);
    res.json({ message: 'Договор удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contracts/:id/counterparty
router.get('/:id/counterparty', async (req, res) => {
  try {
    const contract = await db.get('SELECT counterparty_id FROM contracts WHERE id = $1', [req.params.id]);
    if (!contract) return res.status(404).json({ error: 'Договор не найден' });
    const cp = await db.get('SELECT * FROM counterparties WHERE id = $1', [contract.counterparty_id]);
    res.json(cp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Contract Files ───────────────────────────────────────────────────────────

// GET /api/contracts/:id/files
router.get('/:id/files', async (req, res) => {
  try {
    const contract = await db.get('SELECT id FROM contracts WHERE id = $1', [req.params.id]);
    if (!contract) return res.status(404).json({ error: 'Договор не найден' });
    const files = await db.all(
      'SELECT id, original_name, mimetype, size, uploaded_by_name, uploaded_at FROM contract_files WHERE contract_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts/:id/files — upload a file
router.post('/:id/files', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой (максимум 20 МБ)' });
      }
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    try {
      const contract = await db.get('SELECT id, number FROM contracts WHERE id = $1', [req.params.id]);
      if (!contract) return res.status(404).json({ error: 'Договор не найден' });

      const contentText = await extractText(req.file.buffer, req.file.mimetype);

      const s3Key = `${S3_PREFIX}${uuidv4()}${path.extname(req.file.originalname)}`;
      await getS3Client().send(new PutObjectCommand({
        Bucket: S3_BUCKET(),
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));

      const result = await db.runReturning(`
        INSERT INTO contract_files (contract_id, original_name, stored_name, mimetype, size, uploaded_by, uploaded_by_name, content_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        contract.id,
        Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        s3Key,
        req.file.mimetype,
        req.file.size,
        req.user.id,
        req.user.name,
        contentText || null,
      ]);

      logAudit(req.user.id, req.user.name, `Загружен файл к договору ${contract.number}`, 'Договор', contract.id, req.ip);

      const file = await db.get('SELECT id, original_name, mimetype, size, uploaded_by_name, uploaded_at FROM contract_files WHERE id = $1', [result.lastInsertRowid]);
      res.status(201).json(file);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// GET /api/contracts/:id/files/:fileId/download — stream file from S3
router.get('/:id/files/:fileId/download', async (req, res) => {
  try {
    const file = await db.get('SELECT * FROM contract_files WHERE id = $1 AND contract_id = $2', [req.params.fileId, req.params.id]);
    if (!file) return res.status(404).json({ error: 'Файл не найден' });

    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET(), Key: file.stored_name });
    const s3Response = await getS3Client().send(cmd);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }

    s3Response.Body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contracts/:id/files/:fileId
router.delete('/:id/files/:fileId', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const file = await db.get('SELECT * FROM contract_files WHERE id = $1 AND contract_id = $2', [req.params.fileId, req.params.id]);
    if (!file) return res.status(404).json({ error: 'Файл не найден' });

    await getS3Client().send(new DeleteObjectCommand({
      Bucket: S3_BUCKET(),
      Key: file.stored_name,
    }));

    await db.run('DELETE FROM contract_files WHERE id = $1', [file.id]);

    const contract = await db.get('SELECT number FROM contracts WHERE id = $1', [req.params.id]);
    logAudit(req.user.id, req.user.name, `Удалён файл "${file.original_name}" из договора ${contract?.number}`, 'Договор', req.params.id, req.ip);

    res.json({ message: 'Файл удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
