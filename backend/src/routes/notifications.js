const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications — get current user's notifications
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      text: n.text,
      date: n.date,
      read: !!n.read,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Уведомление прочитано' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Все уведомления прочитаны' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
