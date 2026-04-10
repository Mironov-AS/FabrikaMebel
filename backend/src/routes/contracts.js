const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr, checkLengths } = require('../middleware/validate');

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
    ...row,
    counterpartyId: row.counterparty_id,
    validUntil: row.valid_until,
    paymentDelay: row.payment_delay,
    penaltyRate: row.penalty_rate,
    conditions: conditions.map(c => ({ id: c.id, text: c.text, fulfilled: !!c.fulfilled })),
    obligations: obligations.map(o => ({ id: o.id, party: o.party, text: o.text, deadline: o.deadline, status: o.status })),
    versions: versions.map(v => ({ version: v.version_num, date: v.date, author: v.author, changes: v.changes })),
    file: row.file_name,
  };
}

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
router.post('/', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const {
    number, counterpartyId, date, validUntil, status, amount, subject,
    paymentDelay, penaltyRate, conditions = [], obligations = [],
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

module.exports = router;
