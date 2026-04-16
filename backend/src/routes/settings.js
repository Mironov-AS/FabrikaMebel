const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/settings — get all settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// PUT /api/settings — update settings (admin only)
router.put('/', requireRole('admin', 'director'), (req, res) => {
  const allowed = ['company_name'];
  const stmt = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
  const upsert = db.transaction((updates) => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        stmt.run(key, String(value ?? ''));
      }
    }
  });
  upsert(req.body);
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

module.exports = router;
