const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/audit — admin and director only
router.get('/', requireRole('admin', 'director', 'analyst'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const rows = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get().cnt;

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
});

// GET /api/counterparties
router.get('/counterparties', (req, res) => {
  const rows = db.prepare('SELECT * FROM counterparties ORDER BY name').all();
  res.json(rows);
});

module.exports = router;
