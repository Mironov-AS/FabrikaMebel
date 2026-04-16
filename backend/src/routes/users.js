const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    position: row.position,
    active: !!row.active,
    mfaEnabled: !!row.mfa_enabled,
    lastLogin: row.last_login,
  };
}

// GET /api/users — admin only
router.get('/', requireRole('admin', 'director'), async (req, res) => {
  try {
    const rows = await db.all('SELECT id, name, email, role, position, active, mfa_enabled, last_login FROM users ORDER BY id');
    res.json(rows.map(buildUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id — admin or self
router.get('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.role !== 'admin' && req.user.role !== 'director' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    const row = await db.get('SELECT id, name, email, role, position, active, mfa_enabled, last_login FROM users WHERE id = $1', [targetId]);
    if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(buildUser(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — admin only
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, position } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Имя, email, пароль и роль обязательны' });

    const existing = await db.get('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.runReturning(`
      INSERT INTO users (name, email, password_hash, role, position, active)
      VALUES ($1, $2, $3, $4, $5, 1)
    `, [name, email, passwordHash, role, position || null]);

    logAudit(req.user.id, req.user.name, `Создан пользователь ${name}`, 'Пользователь', result.lastInsertRowid, req.ip);
    const newUser = await db.get('SELECT * FROM users WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(buildUser(newUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — admin or self (limited)
router.put('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = $1', [targetId]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { name, email, password, role, position, active } = req.body;

    const updates = { name: name || user.name };
    if (isAdmin) {
      updates.email = email || user.email;
      updates.role = role || user.role;
      updates.position = position !== undefined ? position : user.position;
      updates.active = active !== undefined ? (active ? 1 : 0) : user.active;
    }

    if (password) {
      updates.password_hash = bcrypt.hashSync(password, 10);
    }

    await db.run(`
      UPDATE users SET
        name = $1,
        email = $2,
        role = $3,
        position = $4,
        active = $5
        ${password ? ', password_hash = $6' : ''}
      WHERE id = ${password ? '$7' : '$6'}
    `, [
      updates.name,
      updates.email || user.email,
      updates.role || user.role,
      updates.position,
      updates.active !== undefined ? updates.active : user.active,
      ...(password ? [updates.password_hash] : []),
      targetId,
    ]);

    logAudit(req.user.id, req.user.name, `Обновлён пользователь ${user.name}`, 'Пользователь', targetId, req.ip);
    const updated = await db.get('SELECT * FROM users WHERE id = $1', [targetId]);
    res.json(buildUser(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) return res.status(400).json({ error: 'Нельзя удалить самого себя' });

    const user = await db.get('SELECT * FROM users WHERE id = $1', [targetId]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    await db.run('UPDATE users SET active = 0 WHERE id = $1', [targetId]);
    logAudit(req.user.id, req.user.name, `Деактивирован пользователь ${user.name}`, 'Пользователь', targetId, req.ip);
    res.json({ message: 'Пользователь деактивирован' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/data/counterparties — list counterparties for dropdowns
router.get('/data/counterparties', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM counterparties ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
