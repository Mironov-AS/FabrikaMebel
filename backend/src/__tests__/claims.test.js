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
  await db.query('DELETE FROM claims');
});

describe('GET /api/claims', () => {
  it('returns an empty array when no claims exist', async () => {
    const res = await request(app).get('/api/claims');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing claims', async () => {
    await db.query(
      "INSERT INTO claims (number, status, created_by) VALUES ('REC-001', 'open', 1)"
    );

    const res = await request(app).get('/api/claims');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe('REC-001');
    expect(res.body[0].status).toBe('open');
  });
});

describe('GET /api/claims/:id', () => {
  it('returns 404 for non-existent claim', async () => {
    const res = await request(app).get('/api/claims/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns claim for existing id', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO claims (number, status, description, created_by) VALUES ('REC-GET', 'open', 'Описание', 1)"
    );

    const res = await request(app).get(`/api/claims/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.number).toBe('REC-GET');
    expect(res.body.description).toBe('Описание');
  });
});

describe('POST /api/claims', () => {
  it('creates a claim and returns 201', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({
        number: 'REC-NEW',
        description: 'Бракованный товар',
        responsible: 'Иванов',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.number).toBe('REC-NEW');
    expect(res.body.status).toBe('open');
    expect(res.body.description).toBe('Бракованный товар');
  });

  it('returns 400 when number is missing', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({ description: 'Без номера' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('creates claim with pausePayments flag', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({ number: 'REC-PAUSE', pausePayments: true });

    expect(res.status).toBe(201);
    expect(res.body.pausePayments).toBe(true);
  });

  it('creates claim without pausePayments (defaults false)', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({ number: 'REC-NOPAUSE' });

    expect(res.status).toBe(201);
    expect(res.body.pausePayments).toBe(false);
  });
});

describe('PUT /api/claims/:id', () => {
  it('updates claim status and resolution', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO claims (number, status, created_by) VALUES ('REC-UPD', 'open', 1)"
    );

    const res = await request(app)
      .put(`/api/claims/${lastInsertRowid}`)
      .send({ status: 'resolved', resolution: 'Замена произведена' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.resolution).toBe('Замена произведена');
  });

  it('returns 404 for non-existent claim', async () => {
    const res = await request(app)
      .put('/api/claims/999999')
      .send({ status: 'closed' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO claims (number, status, created_by) VALUES ('REC-BAD', 'open', 1)"
    );

    const res = await request(app)
      .put(`/api/claims/${lastInsertRowid}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/статус/i);
  });

  it('transitions through all valid statuses', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO claims (number, status, created_by) VALUES ('REC-FLOW', 'open', 1)"
    );

    for (const status of ['in_review', 'resolved', 'closed']) {
      const res = await request(app)
        .put(`/api/claims/${lastInsertRowid}`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it('updates responsible person', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO claims (number, status, created_by) VALUES ('REC-RESP', 'open', 1)"
    );

    const res = await request(app)
      .put(`/api/claims/${lastInsertRowid}`)
      .send({ responsible: 'Петров А.В.' });

    expect(res.status).toBe(200);
    expect(res.body.responsible).toBe('Петров А.В.');
  });
});
