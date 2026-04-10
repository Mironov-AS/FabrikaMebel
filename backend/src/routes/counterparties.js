const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr, checkLengths } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// GET /api/counterparties
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM counterparties ORDER BY name').all();
  res.json(rows);
});

// GET /api/counterparties/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM counterparties WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Контрагент не найден' });
  res.json(row);
});

// POST /api/counterparties — admin, sales_manager
router.post('/', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const { name, inn, kpp, address, delivery_address, contact, phone, email, priority } = req.body;
  if (!name) return res.status(400).json({ error: 'Название обязательно' });

  const safeName = sanitizeStr(name);
  const lenErr = checkLengths({ 'Название': safeName, ...(address ? { 'Адрес': sanitizeStr(address) } : {}) }, 255);
  if (lenErr) return res.status(400).json({ error: lenErr });

  const result = db.prepare(`
    INSERT INTO counterparties (name, inn, kpp, address, delivery_address, contact, phone, email, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(safeName, inn || null, kpp || null, address ? sanitizeStr(address) : null, delivery_address ? sanitizeStr(delivery_address) : null, contact ? sanitizeStr(contact) : null, phone || null, email || null, priority || 'medium');

  logAudit(req.user.id, req.user.name, `Создан контрагент ${name}`, 'Контрагент', result.lastInsertRowid, req.ip);
  res.status(201).json(db.prepare('SELECT * FROM counterparties WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/counterparties/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const cp = db.prepare('SELECT * FROM counterparties WHERE id = ?').get(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Контрагент не найден' });

  const { name, inn, kpp, address, delivery_address, contact, phone, email, priority } = req.body;

  db.prepare(`
    UPDATE counterparties SET
      name = COALESCE(?, name),
      inn = COALESCE(?, inn),
      kpp = COALESCE(?, kpp),
      address = COALESCE(?, address),
      delivery_address = ?,
      contact = COALESCE(?, contact),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      priority = COALESCE(?, priority)
    WHERE id = ?
  `).run(name, inn, kpp, address, delivery_address || null, contact, phone, email, priority, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлён контрагент ${cp.name}`, 'Контрагент', cp.id, req.ip);
  res.json(db.prepare('SELECT * FROM counterparties WHERE id = ?').get(req.params.id));
});

// DELETE /api/counterparties/:id
router.delete('/:id', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const cp = db.prepare('SELECT * FROM counterparties WHERE id = ?').get(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Контрагент не найден' });

  // Check if counterparty is linked to any contracts
  const linked = db.prepare('SELECT COUNT(*) as count FROM contracts WHERE counterparty_id = ?').get(req.params.id);
  if (linked.count > 0) {
    return res.status(409).json({ error: 'Нельзя удалить контрагента, у которого есть договоры' });
  }

  db.prepare('DELETE FROM counterparties WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.name, `Удалён контрагент ${cp.name}`, 'Контрагент', cp.id, req.ip);
  res.json({ success: true });
});

module.exports = router;
