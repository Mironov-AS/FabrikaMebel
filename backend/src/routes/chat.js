const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildMessage(row) {
  return {
    id: row.id,
    contractId: row.contract_id,
    counterpartyId: row.counterparty_id,
    from: row.from_type,
    author: row.author,
    text: row.text,
    date: row.date,
    read: !!row.read,
  };
}

// GET /api/chat — all messages (or filter by contractId)
router.get('/', async (req, res) => {
  try {
    const { contractId } = req.query;
    const rows = contractId
      ? await db.all('SELECT * FROM chat_messages WHERE contract_id = $1 ORDER BY date', [contractId])
      : await db.all('SELECT * FROM chat_messages ORDER BY date DESC');
    res.json(rows.map(buildMessage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { contractId, counterpartyId, from, author, text } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст сообщения обязателен' });

    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const result = await db.runReturning(`
      INSERT INTO chat_messages (contract_id, counterparty_id, from_type, author, text, date, read)
      VALUES ($1, $2, $3, $4, $5, $6, 1)
    `, [contractId || null, counterpartyId || null, from || 'manager', author || req.user.name, text, date]);

    const newMsg = await db.get('SELECT * FROM chat_messages WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(buildMessage(newMsg));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chat/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await db.run('UPDATE chat_messages SET read = 1 WHERE id = $1', [req.params.id]);
    res.json({ message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
