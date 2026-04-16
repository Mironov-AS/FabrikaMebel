const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/drivers
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM drivers WHERE active = 1 ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drivers
router.post('/', async (req, res) => {
  try {
    const { name, phone, vehicle, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Имя водителя обязательно' });
    const result = await db.runReturning(
      'INSERT INTO drivers (name, phone, vehicle, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [name, phone || null, vehicle || null, license || null, vehicle_brand || null, vehicle_model || null, vehicle_year || null, vehicle_notes || null]
    );
    const driver = await db.get('SELECT * FROM drivers WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/drivers/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, vehicle, active, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes } = req.body;
    await db.run(
      `UPDATE drivers SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        vehicle = COALESCE($3, vehicle),
        active = COALESCE($4, active),
        license = COALESCE($5, license),
        vehicle_brand = COALESCE($6, vehicle_brand),
        vehicle_model = COALESCE($7, vehicle_model),
        vehicle_year = COALESCE($8, vehicle_year),
        vehicle_notes = COALESCE($9, vehicle_notes)
      WHERE id = $10`,
      [name, phone, vehicle, active, license, vehicle_brand, vehicle_model, vehicle_year, vehicle_notes, req.params.id]
    );
    const driver = await db.get('SELECT * FROM drivers WHERE id = $1', [req.params.id]);
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
