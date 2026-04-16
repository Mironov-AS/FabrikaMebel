const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/audit — admin and director only
router.get('/', requireRole('admin', 'director', 'analyst'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const rows = await db.all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const totalRow = await db.get('SELECT COUNT(*) as cnt FROM audit_log');
    const total = parseInt(totalRow.cnt);

    res.json({
      data: rows.map(r => ({
        id: r.id,
        user: r.user_name,
        action: r.action,
        entity: r.entity_type,
        entityId: r.entity_id,
        date: r.created_at,
        ip: r.ip,
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/counterparties
router.get('/counterparties', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM counterparties ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
