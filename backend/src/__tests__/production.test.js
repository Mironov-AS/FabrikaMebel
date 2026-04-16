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
  await db.query('DELETE FROM production_tasks');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
});

describe('GET /api/production/tasks', () => {
  it('returns an empty array when no tasks exist', async () => {
    const res = await request(app).get('/api/production/tasks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing tasks', async () => {
    await db.query(
      "INSERT INTO production_tasks (name, status, priority) VALUES ('Сборка стола', 'planned', 'medium')"
    );

    const res = await request(app).get('/api/production/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Сборка стола');
    expect(res.body[0].status).toBe('planned');
  });
});

describe('GET /api/production/tasks/:id', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app).get('/api/production/tasks/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns task for existing id', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO production_tasks (name, status, priority, progress) VALUES ('Покраска', 'in_progress', 'high', 50)"
    );

    const res = await request(app).get(`/api/production/tasks/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Покраска');
    expect(res.body.progress).toBe(50);
    expect(res.body.priority).toBe('high');
  });
});

describe('POST /api/production/tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/api/production/tasks')
      .send({
        name: 'Фрезеровка',
        status: 'planned',
        priority: 'high',
        start: '2026-05-01',
        end: '2026-05-10',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Фрезеровка');
    expect(res.body.status).toBe('planned');
    expect(res.body.priority).toBe('high');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/production/tasks')
      .send({ status: 'planned' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post('/api/production/tasks')
      .send({ name: 'Задача', status: 'wrong_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/статус/i);
  });

  it('clamps progress above 100 to 100', async () => {
    const res = await request(app)
      .post('/api/production/tasks')
      .send({ name: 'Задача 100', progress: 150 });

    expect(res.status).toBe(201);
    expect(res.body.progress).toBe(100);
  });

  it('clamps progress below 0 to 0', async () => {
    const res = await request(app)
      .post('/api/production/tasks')
      .send({ name: 'Задача 0', progress: -10 });

    expect(res.status).toBe(201);
    expect(res.body.progress).toBe(0);
  });

  it('defaults status to planned when omitted', async () => {
    const res = await request(app)
      .post('/api/production/tasks')
      .send({ name: 'Дефолт статус' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('planned');
  });
});

describe('PUT /api/production/tasks/:id', () => {
  it('updates task status and progress', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO production_tasks (name, status, priority, progress) VALUES ('Шлифовка', 'planned', 'medium', 0)"
    );

    const res = await request(app)
      .put(`/api/production/tasks/${lastInsertRowid}`)
      .send({ status: 'in_progress', progress: 60 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.progress).toBe(60);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .put('/api/production/tasks/999999')
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO production_tasks (name, status, priority) VALUES ('Задача', 'planned', 'medium')"
    );

    const res = await request(app)
      .put(`/api/production/tasks/${lastInsertRowid}`)
      .send({ status: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/статус/i);
  });
});

describe('GET /api/production/orders', () => {
  it('returns orders in production pipeline (planned/in_production)', async () => {
    await db.query(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('PROD-001', 'in_production', 'high', 1)"
    );
    await db.query(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('PROD-002', 'shipped', 'low', 1)"
    );

    const res = await request(app).get('/api/production/orders');
    expect(res.status).toBe(200);
    expect(res.body.some(o => o.number === 'PROD-001')).toBe(true);
    expect(res.body.some(o => o.number === 'PROD-002')).toBe(false);
  });

  it('includes specification array for each order', async () => {
    const { lastInsertRowid: orderId } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('PROD-SPEC', 'planned', 'medium', 1)"
    );
    await db.query(
      "INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES ($1, 'Шкаф', 2, 500, 'planned', 0)",
      [orderId]
    );

    const res = await request(app).get('/api/production/orders');
    expect(res.status).toBe(200);
    const order = res.body.find(o => o.number === 'PROD-SPEC');
    expect(order).toBeDefined();
    expect(Array.isArray(order.specification)).toBe(true);
    expect(order.specification).toHaveLength(1);
    expect(order.specification[0].name).toBe('Шкаф');
  });
});

describe('PUT /api/production/orders/:id/ready', () => {
  it('marks order as ready_for_shipment', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('PROD-READY', 'in_production', 'medium', 1)"
    );

    const res = await request(app).put(`/api/production/orders/${lastInsertRowid}/ready`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready_for_shipment');

    const order = await db.get('SELECT status FROM orders WHERE id = $1', [lastInsertRowid]);
    expect(order.status).toBe('ready_for_shipment');
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app).put('/api/production/orders/999999/ready');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/production/orders/:id/items/:itemId', () => {
  let orderId, itemId;

  beforeEach(async () => {
    const { lastInsertRowid: oid } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('PROD-ITEM', 'in_production', 'medium', 1)"
    );
    orderId = oid;
    const { lastInsertRowid: iid } = await db.runReturning(
      "INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES ($1, 'Стол', 1, 1000, 'planned', 0)",
      [orderId]
    );
    itemId = iid;
  });

  it('updates order item status', async () => {
    const res = await request(app)
      .put(`/api/production/orders/${orderId}/items/${itemId}`)
      .send({ status: 'in_production' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_production');
  });

  it('returns 400 when status is missing', async () => {
    const res = await request(app)
      .put(`/api/production/orders/${orderId}/items/${itemId}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid item status', async () => {
    const res = await request(app)
      .put(`/api/production/orders/${orderId}/items/${itemId}`)
      .send({ status: 'flying' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/статус/i);
  });

  it('returns 404 when order does not exist', async () => {
    const res = await request(app)
      .put(`/api/production/orders/999999/items/${itemId}`)
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when item does not belong to the order', async () => {
    const { lastInsertRowid: otherId } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('PROD-OTHER', 'planned', 'medium', 1)"
    );

    const res = await request(app)
      .put(`/api/production/orders/${otherId}/items/${itemId}`)
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/production/lines', () => {
  it('returns production lines list', async () => {
    const res = await request(app).get('/api/production/lines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });
});
