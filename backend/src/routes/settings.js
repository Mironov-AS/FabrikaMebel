const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/settings — get all settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM app_settings');
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update settings (admin only)
router.put('/', requireRole('admin', 'director'), async (req, res) => {
  try {
    const allowed = ['company_name'];
    await db.transaction(async (client) => {
      for (const [key, value] of Object.entries(req.body)) {
        if (allowed.includes(key)) {
          await client.run(
            'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [key, String(value ?? '')]
          );
        }
      }
    });
    const rows = await db.all('SELECT key, value FROM app_settings');
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
