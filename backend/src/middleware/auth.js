const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Verify access token and attach user to request
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(payload.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Неверный токен' });
  }
}

// Role-based access control middleware factory
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }
    next();
  };
}

// Write audit log helper
function logAudit(userId, userName, action, entityType, entityId, ip) {
  db.prepare(`
    INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, action, entityType, entityId || null, ip || null);
}

module.exports = { authenticate, requireRole, logAudit };
