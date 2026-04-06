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
router.get('/', (req, res) => {
  const { contractId } = req.query;
  const rows = contractId
    ? db.prepare('SELECT * FROM chat_messages WHERE contract_id = ? ORDER BY date').all(contractId)
    : db.prepare('SELECT * FROM chat_messages ORDER BY date DESC').all();
  res.json(rows.map(buildMessage));
});

// POST /api/chat
router.post('/', (req, res) => {
  const { contractId, counterpartyId, from, author, text } = req.body;
  if (!text) return res.status(400).json({ error: 'Текст сообщения обязателен' });

  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const result = db.prepare(`
    INSERT INTO chat_messages (contract_id, counterparty_id, from_type, author, text, date, read)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(contractId || null, counterpartyId || null, from || 'manager', author || req.user.name, text, date);

  res.status(201).json(buildMessage(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/chat/:id/read
router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE chat_messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'OK' });
});

module.exports = router;
