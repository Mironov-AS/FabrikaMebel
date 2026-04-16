const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr, checkLengths } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// GET /api/counterparties
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM counterparties ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/counterparties/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM counterparties WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Контрагент не найден' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/counterparties — admin, sales_manager
router.post('/', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const { name, inn, kpp, address, delivery_address, contact, phone, email, priority } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });

    const safeName = sanitizeStr(name);
    const lenErr = checkLengths({ 'Название': safeName, ...(address ? { 'Адрес': sanitizeStr(address) } : {}) }, 255);
    if (lenErr) return res.status(400).json({ error: lenErr });

    const result = await db.runReturning(`
      INSERT INTO counterparties (name, inn, kpp, address, delivery_address, contact, phone, email, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [safeName, inn || null, kpp || null, address ? sanitizeStr(address) : null, delivery_address ? sanitizeStr(delivery_address) : null, contact ? sanitizeStr(contact) : null, phone || null, email || null, priority || 'medium']);

    logAudit(req.user.id, req.user.name, `Создан контрагент ${name}`, 'Контрагент', result.lastInsertRowid, req.ip);
    const newCp = await db.get('SELECT * FROM counterparties WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(newCp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/counterparties/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const cp = await db.get('SELECT * FROM counterparties WHERE id = $1', [req.params.id]);
    if (!cp) return res.status(404).json({ error: 'Контрагент не найден' });

    const { name, inn, kpp, address, delivery_address, contact, phone, email, priority } = req.body;

    await db.run(`
      UPDATE counterparties SET
        name = COALESCE($1, name),
        inn = COALESCE($2, inn),
        kpp = COALESCE($3, kpp),
        address = COALESCE($4, address),
        delivery_address = COALESCE($5, delivery_address),
        contact = COALESCE($6, contact),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email),
        priority = COALESCE($9, priority)
      WHERE id = $10
    `, [name, inn, kpp, address, delivery_address || null, contact, phone, email, priority, req.params.id]);

    logAudit(req.user.id, req.user.name, `Обновлён контрагент ${cp.name}`, 'Контрагент', cp.id, req.ip);
    const updated = await db.get('SELECT * FROM counterparties WHERE id = $1', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/counterparties/:id
router.delete('/:id', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const cp = await db.get('SELECT * FROM counterparties WHERE id = $1', [req.params.id]);
    if (!cp) return res.status(404).json({ error: 'Контрагент не найден' });

    const linked = await db.get('SELECT COUNT(*) as count FROM contracts WHERE counterparty_id = $1', [req.params.id]);
    if (parseInt(linked.count) > 0) {
      return res.status(409).json({ error: 'Нельзя удалить контрагента, у которого есть договоры' });
    }

    await db.run('DELETE FROM counterparties WHERE id = $1', [req.params.id]);
    logAudit(req.user.id, req.user.name, `Удалён контрагент ${cp.name}`, 'Контрагент', cp.id, req.ip);
    res.json({ message: 'Контрагент удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
