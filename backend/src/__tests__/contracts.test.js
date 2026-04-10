const request = require('supertest');
const app = require('../server');
const db = require('../db');

// Seed the test database once before all contract tests
beforeAll(() => {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, active)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hash', 'admin', 1)
  `).run();
});

// Clean contracts table before each test for isolation
beforeEach(() => {
  db.prepare('DELETE FROM contract_versions').run();
  db.prepare('DELETE FROM contract_conditions').run();
  db.prepare('DELETE FROM contract_obligations').run();
  db.prepare('DELETE FROM contracts').run();
});

describe('GET /api/contracts', () => {
  it('returns an empty array when no contracts exist', async () => {
    const res = await request(app).get('/api/contracts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing contracts', async () => {
    db.prepare(
      'INSERT INTO contracts (number, status, amount, created_by) VALUES (?, ?, ?, ?)'
    ).run('C-001', 'active', 5000, 1);

    const res = await request(app).get('/api/contracts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe('C-001');
  });
});

describe('GET /api/contracts/:id', () => {
  it('returns 404 for a non-existent contract', async () => {
    const res = await request(app).get('/api/contracts/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns the contract with relations for an existing id', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO contracts (number, status, amount, created_by) VALUES (?, ?, ?, ?)'
    ).run('C-002', 'draft', 1000, 1);

    const res = await request(app).get(`/api/contracts/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.number).toBe('C-002');
    expect(Array.isArray(res.body.conditions)).toBe(true);
    expect(Array.isArray(res.body.obligations)).toBe(true);
    expect(Array.isArray(res.body.versions)).toBe(true);
  });
});

describe('POST /api/contracts', () => {
  it('creates a contract and returns 201', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .send({ number: 'C-NEW-001', status: 'draft', amount: 10000 });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe('C-NEW-001');
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when number is missing', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .send({ status: 'draft' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 409 for duplicate contract number', async () => {
    db.prepare(
      'INSERT INTO contracts (number, status, amount, created_by) VALUES (?, ?, ?, ?)'
    ).run('C-DUP', 'active', 0, 1);

    const res = await request(app)
      .post('/api/contracts')
      .send({ number: 'C-DUP' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it('creates contract with conditions and obligations', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .send({
        number: 'C-WITH-CONDS',
        status: 'draft',
        conditions: [{ text: 'Condition A', fulfilled: false }],
        obligations: [{ party: 'buyer', text: 'Pay on time', status: 'pending' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.conditions).toHaveLength(1);
    expect(res.body.conditions[0].text).toBe('Condition A');
    expect(res.body.obligations).toHaveLength(1);
    expect(res.body.obligations[0].party).toBe('buyer');
  });
});

describe('PUT /api/contracts/:id', () => {
  it('updates a contract and returns the updated record', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO contracts (number, status, amount, created_by) VALUES (?, ?, ?, ?)'
    ).run('C-UPD', 'draft', 500, 1);
    db.prepare(
      "INSERT INTO contract_versions (contract_id, version_num, date, author, changes) VALUES (?, 1, date('now'), ?, ?)"
    ).run(lastInsertRowid, 'Admin', 'Initial');

    const res = await request(app)
      .put(`/api/contracts/${lastInsertRowid}`)
      .send({ status: 'active', amount: 9999 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.amount).toBe(9999);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await request(app)
      .put('/api/contracts/9999')
      .send({ status: 'active' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/contracts/:id', () => {
  it('deletes an existing contract and returns success message', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO contracts (number, status, amount, created_by) VALUES (?, ?, ?, ?)'
    ).run('C-DEL', 'draft', 0, 1);

    const res = await request(app).delete(`/api/contracts/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const gone = db.prepare('SELECT id FROM contracts WHERE id = ?').get(lastInsertRowid);
    expect(gone).toBeUndefined();
  });

  it('returns 404 for a non-existent contract', async () => {
    const res = await request(app).delete('/api/contracts/9999');
    expect(res.status).toBe(404);
  });
});
