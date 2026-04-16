const db = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// No authentication required — attach a default system user
async function authenticate(req, res, next) {
  try {
    const systemUser = await db.get('SELECT id, name, email, role, active FROM users WHERE active = $1 LIMIT 1', [1]);
    req.user = systemUser || { id: 1, name: 'Система', email: 'system@local', role: 'admin', active: 1 };
    next();
  } catch (err) {
    next(err);
  }
}

// Role check is disabled — always pass through
function requireRole(..._roles) {
  return (_req, _res, next) => next();
}

// Write audit log helper (fire-and-forget)
function logAudit(userId, userName, action, entityType, entityId, ip) {
  db.run(
    'INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, ip) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, userName, action, entityType, entityId || null, ip || null]
  ).catch(err => console.warn('Audit log failed:', err.message));
}

module.exports = { authenticate, requireRole, logAudit };
