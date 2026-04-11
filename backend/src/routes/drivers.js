const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/drivers
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM drivers WHERE active = 1 ORDER BY name').all();
  res.json(rows);
});

// POST /api/drivers
router.post('/', (req, res) => {
  const { name, phone, vehicle } = req.body;
  if (!name) return res.status(400).json({ error: 'Имя водителя обязательно' });
  const result = db.prepare('INSERT INTO drivers (name, phone, vehicle) VALUES (?, ?, ?)').run(name, phone || null, vehicle || null);
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(driver);
});

// PUT /api/drivers/:id
router.put('/:id', (req, res) => {
  const { name, phone, vehicle, active } = req.body;
  db.prepare('UPDATE drivers SET name = COALESCE(?, name), phone = COALESCE(?, phone), vehicle = COALESCE(?, vehicle), active = COALESCE(?, active) WHERE id = ?')
    .run(name, phone, vehicle, active, req.params.id);
  res.json(db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id));
});

module.exports = router;
