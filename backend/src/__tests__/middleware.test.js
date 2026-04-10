const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

// Seed a test user before running middleware tests
beforeAll(() => {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, active)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hash', 'admin', 1)
  `).run();
});

describe('authenticate', () => {
  it('attaches the first active user to req', () => {
    const req = {};
    const res = {};
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe('admin@test.com');
    expect(req.user.active).toBe(1);
  });

  it('attaches fallback system user when no users exist', () => {
    // Use a fresh in-memory db instance via module reload — instead just
    // verify that when authenticate finds nothing it falls back gracefully.
    // We achieve this by temporarily removing all users.
    db.prepare('UPDATE users SET active = 0').run();

    const req = {};
    const next = jest.fn();
    authenticate(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('admin'); // fallback has role admin

    // Restore
    db.prepare('UPDATE users SET active = 1').run();
  });
});

describe('requireRole', () => {
  it('calls next regardless of roles (auth is open)', () => {
    const middleware = requireRole('admin', 'director');
    const next = jest.fn();
    middleware({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next even when no roles are passed', () => {
    const middleware = requireRole();
    const next = jest.fn();
    middleware({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('logAudit', () => {
  it('inserts a row into audit_log', () => {
    const before = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get().cnt;
    logAudit(1, 'Test Admin', 'Test action', 'Contract', 42, '127.0.0.1');
    const after = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get().cnt;
    expect(after).toBe(before + 1);
  });

  it('stores the correct values', () => {
    logAudit(1, 'Alice', 'Created', 'Order', 7, '10.0.0.1');
    const row = db.prepare(
      'SELECT * FROM audit_log WHERE user_name = ? ORDER BY id DESC LIMIT 1'
    ).get('Alice');
    expect(row.action).toBe('Created');
    expect(row.entity_type).toBe('Order');
    expect(row.entity_id).toBe(7);
    expect(row.ip).toBe('10.0.0.1');
  });

  it('handles null entityId and ip', () => {
    expect(() => logAudit(1, 'Bob', 'Viewed', 'Dashboard', null, null)).not.toThrow();
  });
});
