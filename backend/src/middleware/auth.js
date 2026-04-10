const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// No authentication required — attach a default system user
function authenticate(req, res, next) {
  const systemUser = db.prepare('SELECT id, name, email, role, active FROM users WHERE active = 1 LIMIT 1').get();
  req.user = systemUser || { id: 1, name: 'Система', email: 'system@local', role: 'admin', active: 1 };
  next();
}

// Role check is disabled — always pass through
function requireRole(..._roles) {
  return (_req, _res, next) => next();
}

// Write audit log helper
function logAudit(userId, userName, action, entityType, entityId, ip) {
  db.prepare(`
    INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, action, entityType, entityId || null, ip || null);
}

module.exports = { authenticate, requireRole, logAudit };
