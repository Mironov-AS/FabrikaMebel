const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr, checkLengths } = require('../middleware/validate');
const { readConfig } = require('./llmConfig');

// ─── Text extraction helpers ───────────────────────────────────────────────────
async function extractText(filePath, mimetype) {
  try {
    if (mimetype === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8').slice(0, 50000);
    }
    if (mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return (data.text || '').slice(0, 50000);
    }
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return (result.value || '').slice(0, 50000);
    }
  } catch (err) {
    console.warn('Text extraction failed:', err.message);
  }
  return null;
}

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/contracts');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── AI contract analysis ──────────────────────────────────────────────────────
async function analyzeContractWithAI(text) {
  const cfg = readConfig();
  const active = cfg.activeProvider || 'anthropic';
  const pCfg = cfg.providers?.[active] || {};

  const prompt = `Ты — специалист по анализу договоров. Проанализируй текст договора и верни JSON строго следующей структуры (без пояснений, только JSON):
{
  "number": "номер договора или null",
  "date": "дата в формате YYYY-MM-DD или null",
  "validUntil": "дата окончания действия в формате YYYY-MM-DD или null",
  "amount": число или null,
  "subject": "предмет договора (краткое описание) или null",
  "paymentDelay": число (дней отсрочки) или null,
  "penaltyRate": число (процент штрафа за день) или null,
  "counterparty": {
    "name": "полное название контрагента (не нашей компании) или null",
    "inn": "ИНН контрагента или null",
    "kpp": "КПП контрагента или null",
    "address": "юридический адрес контрагента или null",
    "delivery_address": null,
    "contact": "контактное лицо или null",
    "phone": "телефон или null",
    "email": "email или null"
  }
}

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
      const body = JSON.stringify({
        model: pCfg.model || (active === 'yandex' ? 'yandexgpt/latest' : 'gpt-4o'),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
        stream: false,
      });
      const raw = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname, path: urlPath, method: 'POST',
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
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      const json = JSON.parse(raw);
      const content = json.choices?.[0]?.message?.content || '';
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  },
});

const VALID_CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'completed'];

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Helper: build full contract object with relations
function buildContract(row) {
  if (!row) return null;
  const conditions = db.prepare('SELECT * FROM contract_conditions WHERE contract_id = ?').all(row.id);
  const obligations = db.prepare('SELECT * FROM contract_obligations WHERE contract_id = ?').all(row.id);
  const versions = db.prepare('SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version_num').all(row.id);
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

// GET /api/contracts/files/all — all files across all contracts (file repository)
router.get('/files/all', (req, res) => {
  const files = db.prepare(`
    SELECT cf.id, cf.contract_id, cf.original_name, cf.mimetype, cf.size,
           cf.uploaded_by_name, cf.uploaded_at,
           c.number AS contract_number, cp.name AS counterparty_name
    FROM contract_files cf
    LEFT JOIN contracts c ON cf.contract_id = c.id
    LEFT JOIN counterparties cp ON c.counterparty_id = cp.id
    ORDER BY cf.uploaded_at DESC
  `).all();
  res.json(files);
});

// POST /api/contracts/analyze-file — upload + AI extraction (before contract creation)
router.post('/analyze-file', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой (максимум 20 МБ)' });
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    const filePath = path.join(UPLOADS_DIR, req.file.filename);
    const contentText = await extractText(filePath, req.file.mimetype);

    const fileInfo = {
      storedFileName: req.file.filename,
      originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      mimetype: req.file.mimetype,
      size: req.file.size,
    };

    // AI analysis
    let extracted = null;
    if (contentText && contentText.trim().length >= 30) {
      extracted = await analyzeContractWithAI(contentText.slice(0, 15000));
    }

    // Find matching counterparty
    let matchedCounterparty = null;
    if (extracted?.counterparty) {
      const all = db.prepare('SELECT * FROM counterparties').all();
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
  });
});

// GET /api/contracts
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM contracts ORDER BY created_at DESC').all();
  res.json(rows.map(buildContract));
});

// GET /api/contracts/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Договор не найден' });
  res.json(buildContract(row));
});

// POST /api/contracts — sales_manager, admin
router.post('/', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
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

  const existing = db.prepare('SELECT id FROM contracts WHERE number = ?').get(safeNumber);
  if (existing) return res.status(409).json({ error: 'Договор с таким номером уже существует' });

  const result = db.prepare(`
    INSERT INTO contracts (number, counterparty_id, date, valid_until, status, amount, subject, payment_delay, penalty_rate, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(safeNumber, counterpartyId, date, validUntil, status || 'draft', amount || 0, safeSubject, paymentDelay || 30, penaltyRate || 0.1, req.user.id);

  const contractId = result.lastInsertRowid;

  // Insert conditions
  for (const c of conditions) {
    db.prepare('INSERT INTO contract_conditions (contract_id, text, fulfilled) VALUES (?, ?, ?)').run(contractId, c.text, c.fulfilled ? 1 : 0);
  }
  // Insert obligations
  for (const o of obligations) {
    db.prepare('INSERT INTO contract_obligations (contract_id, party, text, deadline, status) VALUES (?, ?, ?, ?, ?)').run(contractId, o.party, o.text, o.deadline || null, o.status || 'pending');
  }
  // Create version 1
  db.prepare('INSERT INTO contract_versions (contract_id, version_num, date, author, changes) VALUES (?, 1, ?, ?, ?)').run(contractId, date || new Date().toISOString().slice(0, 10), req.user.name, 'Создание договора');

  logAudit(req.user.id, req.user.name, `Создан договор ${number}`, 'Договор', contractId, req.ip);

  // Link pre-uploaded file from import if provided
  if (tempFile?.storedFileName) {
    const filePath = path.join(UPLOADS_DIR, tempFile.storedFileName);
    if (fs.existsSync(filePath)) {
      try {
        const fileText = await extractText(filePath, tempFile.mimetype);
        db.prepare(`
          INSERT INTO contract_files (contract_id, original_name, stored_name, mimetype, size, uploaded_by, uploaded_by_name, content_text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(contractId, tempFile.originalName, tempFile.storedFileName, tempFile.mimetype, tempFile.size || 0, req.user.id, req.user.name, fileText || null);
      } catch (e) {
        console.warn('Failed to link temp file to contract:', e.message);
      }
    }
  }

  const contract = buildContract(db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId));
  res.status(201).json(contract);
});

// PUT /api/contracts/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
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

  db.prepare(`
    UPDATE contracts SET
      number = COALESCE(?, number),
      counterparty_id = COALESCE(?, counterparty_id),
      date = COALESCE(?, date),
      valid_until = COALESCE(?, valid_until),
      status = COALESCE(?, status),
      amount = COALESCE(?, amount),
      subject = COALESCE(?, subject),
      payment_delay = COALESCE(?, payment_delay),
      penalty_rate = COALESCE(?, penalty_rate),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(safeNumber, counterpartyId, date, validUntil, status, amount, safeSubject, paymentDelay, penaltyRate, req.params.id);

  // Update conditions if provided
  if (conditions !== undefined) {
    db.prepare('DELETE FROM contract_conditions WHERE contract_id = ?').run(req.params.id);
    for (const c of conditions) {
      db.prepare('INSERT INTO contract_conditions (contract_id, text, fulfilled) VALUES (?, ?, ?)').run(req.params.id, c.text, c.fulfilled ? 1 : 0);
    }
  }

  // Update obligations if provided
  if (obligations !== undefined) {
    db.prepare('DELETE FROM contract_obligations WHERE contract_id = ?').run(req.params.id);
    for (const o of obligations) {
      db.prepare('INSERT INTO contract_obligations (contract_id, party, text, deadline, status) VALUES (?, ?, ?, ?, ?)').run(req.params.id, o.party, o.text, o.deadline || null, o.status || 'pending');
    }
  }

  // Add new version
  const maxVersion = db.prepare('SELECT MAX(version_num) as max FROM contract_versions WHERE contract_id = ?').get(req.params.id);
  const nextVersion = (maxVersion.max || 0) + 1;
  db.prepare('INSERT INTO contract_versions (contract_id, version_num, date, author, changes) VALUES (?, ?, ?, ?, ?)').run(
    req.params.id, nextVersion, new Date().toISOString().slice(0, 10), req.user.name, changeDescription || 'Изменение договора'
  );

  logAudit(req.user.id, req.user.name, `Изменён договор ${contract.number}`, 'Договор', contract.id, req.ip);

  const updated = buildContract(db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id));
  res.json(updated);
});

// DELETE /api/contracts/:id — admin only
router.delete('/:id', requireRole('admin'), (req, res) => {
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) return res.status(404).json({ error: 'Договор не найден' });

  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.name, `Удалён договор ${contract.number}`, 'Договор', contract.id, req.ip);
  res.json({ message: 'Договор удалён' });
});

// GET /api/contracts/:id/counterparty
router.get('/:id/counterparty', (req, res) => {
  const contract = db.prepare('SELECT counterparty_id FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) return res.status(404).json({ error: 'Договор не найден' });
  const cp = db.prepare('SELECT * FROM counterparties WHERE id = ?').get(contract.counterparty_id);
  res.json(cp);
});

// ─── Contract Files ───────────────────────────────────────────────────────────

// GET /api/contracts/:id/files
router.get('/:id/files', (req, res) => {
  const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) return res.status(404).json({ error: 'Договор не найден' });
  const files = db.prepare(
    'SELECT id, original_name, mimetype, size, uploaded_by_name, uploaded_at FROM contract_files WHERE contract_id = ? ORDER BY uploaded_at DESC'
  ).all(req.params.id);
  res.json(files);
});

// POST /api/contracts/:id/files — upload a file
router.post('/:id/files', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const contract = db.prepare('SELECT id, number FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) return res.status(404).json({ error: 'Договор не найден' });

  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой (максимум 20 МБ)' });
      }
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    // Extract text content for AI assistant
    const filePath = path.join(UPLOADS_DIR, req.file.filename);
    const contentText = await extractText(filePath, req.file.mimetype);

    const result = db.prepare(`
      INSERT INTO contract_files (contract_id, original_name, stored_name, mimetype, size, uploaded_by, uploaded_by_name, content_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contract.id,
      Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      req.user.id,
      req.user.name,
      contentText || null,
    );

    logAudit(req.user.id, req.user.name, `Загружен файл к договору ${contract.number}`, 'Договор', contract.id, req.ip);

    const file = db.prepare('SELECT id, original_name, mimetype, size, uploaded_by_name, uploaded_at FROM contract_files WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(file);
  });
});

// GET /api/contracts/:id/files/:fileId/download — download a file
router.get('/:id/files/:fileId/download', (req, res) => {
  const file = db.prepare('SELECT * FROM contract_files WHERE id = ? AND contract_id = ?').get(req.params.fileId, req.params.id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден на диске' });

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
  res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
  res.sendFile(filePath);
});

// DELETE /api/contracts/:id/files/:fileId
router.delete('/:id/files/:fileId', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const file = db.prepare('SELECT * FROM contract_files WHERE id = ? AND contract_id = ?').get(req.params.fileId, req.params.id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM contract_files WHERE id = ?').run(file.id);

  const contract = db.prepare('SELECT number FROM contracts WHERE id = ?').get(req.params.id);
  logAudit(req.user.id, req.user.name, `Удалён файл "${file.original_name}" из договора ${contract?.number}`, 'Договор', req.params.id, req.ip);

  res.json({ message: 'Файл удалён' });
});

module.exports = router;
