const request = require('supertest');
const app = require('../server');
const db = require('../db');

beforeAll(() => {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, active)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hash', 'admin', 1)
  `).run();
});

beforeEach(() => {
  db.prepare('DELETE FROM contract_versions').run();
  db.prepare('DELETE FROM contract_conditions').run();
  db.prepare('DELETE FROM contract_obligations').run();
  db.prepare('DELETE FROM contracts').run();
  db.prepare('DELETE FROM counterparties').run();
});

describe('GET /api/counterparties', () => {
  it('returns an empty array when no counterparties exist', async () => {
    const res = await request(app).get('/api/counterparties');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns counterparties sorted by name', async () => {
    db.prepare("INSERT INTO counterparties (name, priority) VALUES (?, 'medium')").run('Zebra LLC');
    db.prepare("INSERT INTO counterparties (name, priority) VALUES (?, 'medium')").run('Alpha Corp');

    const res = await request(app).get('/api/counterparties');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Alpha Corp');
    expect(res.body[1].name).toBe('Zebra LLC');
  });
});

describe('GET /api/counterparties/:id', () => {
  it('returns 404 for non-existent counterparty', async () => {
    const res = await request(app).get('/api/counterparties/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns counterparty for existing id', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO counterparties (name, inn, priority) VALUES (?, ?, 'high')"
    ).run('Test Co', '123456789');

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
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO counterparties (name, priority) VALUES ('Old Name', 'medium')"
    ).run();

    const res = await request(app)
      .put(`/api/counterparties/${lastInsertRowid}`)
      .send({ name: 'New Name', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.priority).toBe('high');
  });

  it('does not null out delivery_address on partial update (COALESCE fix)', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO counterparties (name, delivery_address, priority) VALUES ('Addr Co', '123 Main St', 'medium')"
    ).run();

    // Update only the name — delivery_address must be preserved
    const res = await request(app)
      .put(`/api/counterparties/${lastInsertRowid}`)
      .send({ name: 'Addr Co Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Addr Co Updated');
    expect(res.body.delivery_address).toBe('123 Main St');
  });

  it('returns 404 for non-existent counterparty', async () => {
    const res = await request(app)
      .put('/api/counterparties/9999')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/counterparties/:id', () => {
  it('deletes a counterparty with no linked contracts', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO counterparties (name, priority) VALUES ('To Delete', 'low')"
    ).run();

    const res = await request(app).delete(`/api/counterparties/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const gone = db.prepare('SELECT id FROM counterparties WHERE id = ?').get(lastInsertRowid);
    expect(gone).toBeUndefined();
  });

  it('returns 409 when counterparty has linked contracts', async () => {
    const { lastInsertRowid: cpId } = db.prepare(
      "INSERT INTO counterparties (name, priority) VALUES ('Linked CP', 'medium')"
    ).run();
    db.prepare(
      'INSERT INTO contracts (number, counterparty_id, status, amount, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run('C-LINKED', cpId, 'active', 1000, 1);

    const res = await request(app).delete(`/api/counterparties/${cpId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent counterparty', async () => {
    const res = await request(app).delete('/api/counterparties/9999');
    expect(res.status).toBe(404);
  });
});
