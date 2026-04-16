const request = require('supertest');
const app = require('../server');
const db = require('../db');

let counterpartyId;

beforeAll(async () => {
  await db.query(`
    INSERT INTO users (id, name, email, password_hash, role, active)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hash', 'admin', 1)
    ON CONFLICT (id) DO NOTHING
  `);

  const cp = await db.runReturning(
    "INSERT INTO counterparties (name, priority) VALUES ('Test Counterparty', 'medium')"
  );
  counterpartyId = cp.lastInsertRowid;
});

// Helper to build a minimal valid contract payload
function contractPayload(overrides = {}) {
  return {
    number: `C-${Date.now()}`,
    counterpartyId,
    date: '2026-01-01',
    subject: 'Тестовый предмет договора',
    status: 'draft',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.query('DELETE FROM contract_versions');
  await db.query('DELETE FROM contract_conditions');
  await db.query('DELETE FROM contract_obligations');
  await db.query('DELETE FROM contracts WHERE id > 0');
});

afterAll(async () => {
  await db.query('DELETE FROM counterparties WHERE id = $1', [counterpartyId]);
});

describe('GET /api/contracts', () => {
  it('returns an empty array when no contracts exist', async () => {
    const res = await request(app).get('/api/contracts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing contracts', async () => {
    await db.query(
      'INSERT INTO contracts (number, status, amount, created_by) VALUES ($1, $2, $3, $4)',
      ['C-001', 'active', 5000, 1]
    );

    const res = await request(app).get('/api/contracts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe('C-001');
  });
});

describe('GET /api/contracts/:id', () => {
  it('returns 404 for non-existent contract', async () => {
    const res = await request(app).get('/api/contracts/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns contract for existing id', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO contracts (number, status, amount, created_by) VALUES ('C-GET', 'active', 1000, 1)"
    );

    const res = await request(app).get(`/api/contracts/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.number).toBe('C-GET');
  });
});

describe('POST /api/contracts', () => {
  it('creates a contract and returns 201', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .send(contractPayload({ number: 'C-NEW-001' }));

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

  it('returns 400 when counterpartyId is missing', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .send({ number: 'C-NO-CP', date: '2026-01-01', subject: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /api/contracts/:id', () => {
  it('updates a contract and returns updated record', async () => {
    // Create via API to ensure all required fields are set properly
    const createRes = await request(app)
      .post('/api/contracts')
      .send(contractPayload({ number: 'C-UPD' }));
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .put(`/api/contracts/${createRes.body.id}`)
      .send({ status: 'active', amount: 10000 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.amount).toBe(10000);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .put('/api/contracts/999999')
      .send({ status: 'active' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/contracts/:id', () => {
  it('deletes an existing contract', async () => {
    const createRes = await request(app)
      .post('/api/contracts')
      .send(contractPayload({ number: 'C-DEL' }));
    expect(createRes.status).toBe(201);

    const res = await request(app).delete(`/api/contracts/${createRes.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app).delete('/api/contracts/999999');
    expect(res.status).toBe(404);
  });
});
