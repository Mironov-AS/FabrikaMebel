const request = require('supertest');
const app = require('../server');
const db = require('../db');

beforeAll(async () => {
  await db.query(`
    INSERT INTO users (id, name, email, password_hash, role, active)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hash', 'admin', 1)
    ON CONFLICT (id) DO NOTHING
  `);
});

beforeEach(async () => {
  await db.query('DELETE FROM contract_versions');
  await db.query('DELETE FROM contract_conditions');
  await db.query('DELETE FROM contract_obligations');
  await db.query('DELETE FROM contracts WHERE id > 0');
  await db.query('DELETE FROM counterparties');
});

describe('GET /api/counterparties', () => {
  it('returns an empty array when no counterparties exist', async () => {
    const res = await request(app).get('/api/counterparties');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns counterparties sorted by name', async () => {
    await db.query("INSERT INTO counterparties (name, priority) VALUES ('Zebra LLC', 'medium')");
    await db.query("INSERT INTO counterparties (name, priority) VALUES ('Alpha Corp', 'medium')");

    const res = await request(app).get('/api/counterparties');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Alpha Corp');
    expect(res.body[1].name).toBe('Zebra LLC');
  });
});

describe('GET /api/counterparties/:id', () => {
  it('returns 404 for non-existent counterparty', async () => {
    const res = await request(app).get('/api/counterparties/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns counterparty for existing id', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO counterparties (name, inn, priority) VALUES ('Test Co', '123456789', 'high')"
    );

    const res = await request(app).get(`/api/counterparties/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Co');
    expect(res.body.inn).toBe('123456789');
  });
});

describe('POST /api/counterparties', () => {
  it('creates a counterparty and returns 201', async () => {
    const res = await request(app)
      .post('/api/counterparties')
      .send({
        name: 'New Supplier',
        inn: '9876543210',
        phone: '+7-999-000-0000',
        priority: 'high',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('New Supplier');
    expect(res.body.inn).toBe('9876543210');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/counterparties')
      .send({ inn: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /api/counterparties/:id', () => {
  it('updates counterparty fields', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO counterparties (name, priority) VALUES ('Old Name', 'medium')"
    );

    const res = await request(app)
      .put(`/api/counterparties/${lastInsertRowid}`)
      .send({ name: 'New Name', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.priority).toBe('high');
  });

  it('does not null out delivery_address on partial update (COALESCE fix)', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO counterparties (name, delivery_address, priority) VALUES ('Addr Co', '123 Main St', 'medium')"
    );

    const res = await request(app)
      .put(`/api/counterparties/${lastInsertRowid}`)
      .send({ name: 'Addr Co Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Addr Co Updated');
    expect(res.body.delivery_address).toBe('123 Main St');
  });

  it('returns 404 for non-existent counterparty', async () => {
    const res = await request(app)
      .put('/api/counterparties/999999')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/counterparties/:id', () => {
  it('deletes a counterparty with no linked contracts', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO counterparties (name, priority) VALUES ('To Delete', 'low')"
    );

    const res = await request(app).delete(`/api/counterparties/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const gone = await db.get('SELECT id FROM counterparties WHERE id = $1', [lastInsertRowid]);
    expect(gone).toBeNull();
  });

  it('returns 409 when counterparty has linked contracts', async () => {
    const { lastInsertRowid: cpId } = await db.runReturning(
      "INSERT INTO counterparties (name, priority) VALUES ('Linked CP', 'medium')"
    );
    await db.query(
      'INSERT INTO contracts (number, counterparty_id, status, amount, created_by) VALUES ($1, $2, $3, $4, $5)',
      ['C-LINKED', cpId, 'active', 1000, 1]
    );

    const res = await request(app).delete(`/api/counterparties/${cpId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent counterparty', async () => {
    const res = await request(app).delete('/api/counterparties/999999');
    expect(res.status).toBe(404);
  });
});
