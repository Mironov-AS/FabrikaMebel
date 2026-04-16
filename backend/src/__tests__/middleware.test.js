const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

beforeAll(async () => {
  await db.query(`
    INSERT INTO users (id, name, email, password_hash, role, active)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hash', 'admin', 1)
    ON CONFLICT (id) DO NOTHING
  `);
});

describe('authenticate', () => {
  it('attaches an active user to req', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.active).toBeTruthy();
  });

  it('attaches a user with admin role', async () => {
    const req = {};
    const next = jest.fn();

    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('admin');
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
  it('inserts a row into audit_log without throwing', async () => {
    const before = await db.get('SELECT COUNT(*)::int as cnt FROM audit_log');
    const beforeCount = parseInt(before.cnt);

    logAudit(1, 'Test Admin', 'Test action', 'Contract', 42, '127.0.0.1');

    // Wait briefly for the fire-and-forget insert to complete
    await new Promise(r => setTimeout(r, 100));

    const after = await db.get('SELECT COUNT(*)::int as cnt FROM audit_log');
    const afterCount = parseInt(after.cnt);
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('stores the correct values', async () => {
    logAudit(1, 'Alice', 'Created', 'Order', 7, '10.0.0.1');

    await new Promise(r => setTimeout(r, 100));

    const row = await db.get(
      "SELECT * FROM audit_log WHERE user_name = 'Alice' ORDER BY id DESC LIMIT 1"
    );
    expect(row).not.toBeNull();
    expect(row.action).toBe('Created');
    expect(row.entity_type).toBe('Order');
  });

  it('handles null entityId and ip without throwing', async () => {
    expect(() => logAudit(1, 'Bob', 'Viewed', 'Dashboard', null, null)).not.toThrow();
  });
});
