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
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
});

describe('GET /api/orders', () => {
  it('returns an empty array when no orders exist', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing orders with specification array', async () => {
    db.prepare(
      'INSERT INTO orders (number, status, priority, created_by) VALUES (?, ?, ?, ?)'
    ).run('ORD-001', 'planned', 'medium', 1);

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe('ORD-001');
    expect(Array.isArray(res.body[0].specification)).toBe(true);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns 404 for non-existent order', async () => {
    const res = await request(app).get('/api/orders/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns order with specification for existing id', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO orders (number, status, priority, created_by) VALUES (?, ?, ?, ?)'
    ).run('ORD-002', 'planned', 'medium', 1);

    const res = await request(app).get(`/api/orders/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.number).toBe('ORD-002');
    expect(Array.isArray(res.body.specification)).toBe(true);
  });
});

describe('POST /api/orders', () => {
  it('creates an order and returns 201', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ number: 'ORD-NEW-001', priority: 'high', status: 'planned' });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe('ORD-NEW-001');
    expect(res.body.id).toBeDefined();
    expect(Array.isArray(res.body.specification)).toBe(true);
  });

  it('returns 400 when number is missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ status: 'planned' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ number: 'ORD-BAD', status: 'flying' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/статус/i);
  });

  it('returns 400 when specification item has non-positive quantity', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        number: 'ORD-QTY',
        specification: [{ name: 'Table', quantity: 0, price: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/количество/i);
  });

  it('returns 400 when specification item has negative price', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        number: 'ORD-PRICE',
        specification: [{ name: 'Chair', quantity: 1, price: -50 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/цена/i);
  });

  it('creates order with specification and computes total', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        number: 'ORD-SPEC',
        specification: [
          { name: 'Table', quantity: 2, price: 1000 },
          { name: 'Chair', quantity: 4, price: 300 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.specification).toHaveLength(2);
    // total = 2*1000 + 4*300 = 3200
    expect(res.body.totalAmount).toBe(3200);
  });
});

describe('PUT /api/orders/:id', () => {
  it('updates an order and returns updated record', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO orders (number, status, priority, total_amount, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run('ORD-UPD', 'planned', 'medium', 500, 1);

    const res = await request(app)
      .put(`/api/orders/${lastInsertRowid}`)
      .send({ status: 'in_production', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_production');
    expect(res.body.priority).toBe('high');
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .put('/api/orders/9999')
      .send({ status: 'in_production' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO orders (number, status, priority, created_by) VALUES (?, ?, ?, ?)'
    ).run('ORD-UPD2', 'planned', 'medium', 1);

    const res = await request(app)
      .put(`/api/orders/${lastInsertRowid}`)
      .send({ status: 'bad_status' });

    expect(res.status).toBe(400);
  });

  it('replaces specification when provided and recalculates total', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO orders (number, status, priority, created_by) VALUES (?, ?, ?, ?)'
    ).run('ORD-RESPEC', 'planned', 'low', 1);
    db.prepare('INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES (?, ?, ?, ?, ?, ?)')
      .run(lastInsertRowid, 'Old Item', 1, 100, 'planned', 0);

    const res = await request(app)
      .put(`/api/orders/${lastInsertRowid}`)
      .send({
        specification: [{ name: 'New Item', quantity: 3, price: 500 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.specification).toHaveLength(1);
    expect(res.body.specification[0].name).toBe('New Item');
    expect(res.body.totalAmount).toBe(1500);
  });
});

describe('DELETE /api/orders/:id', () => {
  it('deletes an existing order', async () => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO orders (number, status, priority, created_by) VALUES (?, ?, ?, ?)'
    ).run('ORD-DEL', 'planned', 'medium', 1);

    const res = await request(app).delete(`/api/orders/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const gone = db.prepare('SELECT id FROM orders WHERE id = ?').get(lastInsertRowid);
    expect(gone).toBeUndefined();
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app).delete('/api/orders/9999');
    expect(res.status).toBe(404);
  });
});
