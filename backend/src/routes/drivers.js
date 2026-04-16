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
  const { name, phone, vehicle, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Имя водителя обязательно' });
  const result = db.prepare(
    'INSERT INTO drivers (name, phone, vehicle, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, phone || null, vehicle || null, license || null, vehicle_brand || null, vehicle_model || null, vehicle_year || null, vehicle_notes || null);
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(driver);
});

// PUT /api/drivers/:id
router.put('/:id', (req, res) => {
  const { name, phone, vehicle, active, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes } = req.body;
  db.prepare(
    `UPDATE drivers SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      vehicle = COALESCE(?, vehicle),
      active = COALESCE(?, active),
      license = COALESCE(?, license),
      vehicle_brand = COALESCE(?, vehicle_brand),
      vehicle_model = COALESCE(?, vehicle_model),
      vehicle_year = COALESCE(?, vehicle_year),
      vehicle_notes = COALESCE(?, vehicle_notes)
    WHERE id = ?`
  ).run(name, phone, vehicle, active, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes, req.params.id);
  res.json(db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id));
});

module.exports = router;
