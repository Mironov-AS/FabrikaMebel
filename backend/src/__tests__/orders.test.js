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
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
});

describe('GET /api/orders', () => {
  it('returns an empty array when no orders exist', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing orders with specification array', async () => {
    await db.query(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-001', 'planned', 'medium', 1)"
    );

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe('ORD-001');
    expect(Array.isArray(res.body[0].specification)).toBe(true);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns 404 for non-existent order', async () => {
    const res = await request(app).get('/api/orders/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns order with specification for existing id', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-002', 'planned', 'medium', 1)"
    );

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
    expect(res.body.totalAmount).toBe(3200);
  });
});

describe('PUT /api/orders/:id', () => {
  it('updates an order and returns updated record', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, total_amount, created_by) VALUES ('ORD-UPD', 'planned', 'medium', 500, 1)"
    );

    const res = await request(app)
      .put(`/api/orders/${lastInsertRowid}`)
      .send({ status: 'in_production', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_production');
    expect(res.body.priority).toBe('high');
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .put('/api/orders/999999')
      .send({ status: 'in_production' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-UPD2', 'planned', 'medium', 1)"
    );

    const res = await request(app)
      .put(`/api/orders/${lastInsertRowid}`)
      .send({ status: 'bad_status' });

    expect(res.status).toBe(400);
  });

  it('replaces specification when provided and recalculates total', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-RESPEC', 'planned', 'low', 1)"
    );
    await db.query(
      'INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES ($1, $2, $3, $4, $5, $6)',
      [lastInsertRowid, 'Old Item', 1, 100, 'planned', 0]
    );

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

describe('PUT /api/orders/:id/items/:itemId', () => {
  let orderId, itemId;

  beforeEach(async () => {
    const { lastInsertRowid: oid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-ITEMS', 'in_production', 'medium', 1)"
    );
    orderId = oid;
    const { lastInsertRowid: iid } = await db.runReturning(
      "INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES ($1, 'Диван', 1, 2000, 'planned', 0)",
      [orderId]
    );
    itemId = iid;
  });

  it('updates order item status', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${itemId}`)
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.specification.some(i => i.status === 'done')).toBe(true);
  });

  it('returns 404 when order does not exist', async () => {
    const res = await request(app)
      .put(`/api/orders/999999/items/${itemId}`)
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when item does not belong to the order', async () => {
    const { lastInsertRowid: otherId } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-OTHER', 'planned', 'medium', 1)"
    );

    const res = await request(app)
      .put(`/api/orders/${otherId}/items/${itemId}`)
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it('updates item name and price', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${itemId}`)
      .send({ name: 'Кресло', price: 3500 });

    expect(res.status).toBe(200);
    const item = res.body.specification.find(i => i.id === itemId);
    expect(item.name).toBe('Кресло');
    expect(item.price).toBe(3500);
  });
});

describe('DELETE /api/orders/:id', () => {
  it('deletes an existing order', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-DEL', 'planned', 'medium', 1)"
    );

    const res = await request(app).delete(`/api/orders/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const gone = await db.get('SELECT id FROM orders WHERE id = $1', [lastInsertRowid]);
    expect(gone).toBeNull();
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app).delete('/api/orders/999999');
    expect(res.status).toBe(404);
  });
});
