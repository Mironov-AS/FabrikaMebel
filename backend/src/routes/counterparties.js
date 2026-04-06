const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

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
  const { name, inn, kpp, address, contact, phone, email, priority } = req.body;
  if (!name) return res.status(400).json({ error: 'Название обязательно' });

  const result = db.prepare(`
    INSERT INTO counterparties (name, inn, kpp, address, contact, phone, email, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, inn || null, kpp || null, address || null, contact || null, phone || null, email || null, priority || 'medium');

  logAudit(req.user.id, req.user.name, `Создан контрагент ${name}`, 'Контрагент', result.lastInsertRowid, req.ip);
  res.status(201).json(db.prepare('SELECT * FROM counterparties WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/counterparties/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const cp = db.prepare('SELECT * FROM counterparties WHERE id = ?').get(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Контрагент не найден' });

  const { name, inn, kpp, address, contact, phone, email, priority } = req.body;

  db.prepare(`
    UPDATE counterparties SET
      name = COALESCE(?, name),
      inn = COALESCE(?, inn),
      kpp = COALESCE(?, kpp),
      address = COALESCE(?, address),
      contact = COALESCE(?, contact),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      priority = COALESCE(?, priority)
    WHERE id = ?
  `).run(name, inn, kpp, address, contact, phone, email, priority, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлён контрагент ${cp.name}`, 'Контрагент', cp.id, req.ip);
  res.json(db.prepare('SELECT * FROM counterparties WHERE id = ?').get(req.params.id));
});

module.exports = router;
