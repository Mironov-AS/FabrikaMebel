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
router.get('/', requireRole('admin', 'director'), (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, position, active, mfa_enabled, last_login FROM users ORDER BY id').all();
  res.json(rows.map(buildUser));
});

// GET /api/users/:id — admin or self
router.get('/:id', (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.role !== 'director' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  const row = db.prepare('SELECT id, name, email, role, position, active, mfa_enabled, last_login FROM users WHERE id = ?').get(targetId);
  if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(buildUser(row));
});

// POST /api/users — admin only
router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, password, role, position } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Имя, email, пароль и роль обязательны' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, position, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name, email, passwordHash, role, position || null);

  logAudit(req.user.id, req.user.name, `Создан пользователь ${name}`, 'Пользователь', result.lastInsertRowid, req.ip);
  res.status(201).json(buildUser(db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/users/:id — admin or self (limited)
router.put('/:id', (req, res) => {
  const targetId = parseInt(req.params.id);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const { name, email, password, role, position, active } = req.body;

  // Non-admins can only change their own name and password
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

  db.prepare(`
    UPDATE users SET
      name = ?,
      email = ?,
      role = ?,
      position = ?,
      active = ?
      ${password ? ', password_hash = ?' : ''}
    WHERE id = ?
  `).run(
    updates.name,
    updates.email || user.email,
    updates.role || user.role,
    updates.position,
    updates.active !== undefined ? updates.active : user.active,
    ...(password ? [updates.password_hash] : []),
    targetId
  );

  logAudit(req.user.id, req.user.name, `Обновлён пользователь ${user.name}`, 'Пользователь', targetId, req.ip);
  res.json(buildUser(db.prepare('SELECT * FROM users WHERE id = ?').get(targetId)));
});

// DELETE /api/users/:id — admin only
router.delete('/:id', requireRole('admin'), (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Нельзя удалить самого себя' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  // Soft delete — deactivate
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(targetId);
  logAudit(req.user.id, req.user.name, `Деактивирован пользователь ${user.name}`, 'Пользователь', targetId, req.ip);
  res.json({ message: 'Пользователь деактивирован' });
});

// GET /api/users/counterparties — list counterparties for dropdowns
router.get('/data/counterparties', (req, res) => {
  const rows = db.prepare('SELECT * FROM counterparties ORDER BY name').all();
  res.json(rows);
});

module.exports = router;
