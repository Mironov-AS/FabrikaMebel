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
  db.prepare('DELETE FROM payments').run();
  db.prepare('DELETE FROM shipment_items').run();
  db.prepare('DELETE FROM shipments').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
});

describe('GET /api/shipments', () => {
  it('returns an empty array when no shipments exist', async () => {
    const res = await request(app).get('/api/shipments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing shipments with items array', async () => {
    db.prepare(
      "INSERT INTO shipments (invoice_number, amount, status) VALUES (?, ?, 'scheduled')"
    ).run('INV-LIST', 1000);

    const res = await request(app).get('/api/shipments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].invoiceNumber).toBe('INV-LIST');
    expect(Array.isArray(res.body[0].items)).toBe(true);
  });
});

describe('GET /api/shipments/:id', () => {
  it('returns 404 for non-existent shipment', async () => {
    const res = await request(app).get('/api/shipments/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns shipment for existing id', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO shipments (invoice_number, amount, status) VALUES (?, ?, 'scheduled')"
    ).run('INV-GET', 2500);

    const res = await request(app).get(`/api/shipments/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe('INV-GET');
    expect(res.body.amount).toBe(2500);
  });
});

describe('POST /api/shipments', () => {
  it('creates a shipment and auto-creates payment, returns 201', async () => {
    const res = await request(app)
      .post('/api/shipments')
      .send({
        invoiceNumber: 'INV-NEW',
        amount: 5000,
        date: '2026-04-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.invoiceNumber).toBe('INV-NEW');
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('scheduled');

    // Payment should be auto-created
    const payment = db.prepare('SELECT * FROM payments WHERE shipment_id = ?').get(res.body.id);
    expect(payment).toBeDefined();
    expect(payment.amount).toBe(5000);
    expect(payment.status).toBe('pending');
  });

  it('returns 400 when invoiceNumber is missing', async () => {
    const res = await request(app)
      .post('/api/shipments')
      .send({ amount: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 when orderId references non-existent order', async () => {
    const res = await request(app)
      .post('/api/shipments')
      .send({ invoiceNumber: 'INV-NO-ORD', orderId: 9999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/заказ/i);
  });

  it('blocks shipment when all order items are already shipped', async () => {
    const { lastInsertRowid: orderId } = db.prepare(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-FULL', 'ready_for_shipment', 'medium', 1)"
    ).run();
    db.prepare(
      'INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(orderId, 'Table', 2, 500, 'done', 2);

    const res = await request(app)
      .post('/api/shipments')
      .send({ invoiceNumber: 'INV-FULL', orderId, amount: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/отгружены/i);
  });

  it('auto-calculates paymentDueDate from contract.payment_delay', async () => {
    // Create contract with payment_delay = 30
    const { lastInsertRowid: contractId } = db.prepare(
      "INSERT INTO contracts (number, status, amount, payment_delay, created_by) VALUES ('C-DELAY', 'active', 10000, 30, 1)"
    ).run();
    // Create order linked to that contract
    const { lastInsertRowid: orderId } = db.prepare(
      "INSERT INTO orders (number, contract_id, status, priority, created_by) VALUES ('ORD-DELAY', ?, 'ready_for_shipment', 'medium', 1)"
    ).run(contractId);
    // Add at least one unshipped item so the order isn't blocked
    db.prepare(
      'INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(orderId, 'Chair', 1, 300, 'planned', 0);

    const res = await request(app)
      .post('/api/shipments')
      .send({ invoiceNumber: 'INV-DELAY', orderId, date: '2026-04-01', amount: 300 });

    expect(res.status).toBe(201);
    // 2026-04-01 + 30 days = 2026-05-01
    expect(res.body.paymentDueDate).toBe('2026-05-01');
  });

  it('moves linked order to scheduled_for_shipment on create', async () => {
    const { lastInsertRowid: orderId } = db.prepare(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-SCHED', 'ready_for_shipment', 'medium', 1)"
    ).run();
    db.prepare(
      'INSERT INTO order_items (order_id, name, quantity, price, status, shipped) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(orderId, 'Desk', 1, 1000, 'planned', 0);

    const res = await request(app)
      .post('/api/shipments')
      .send({ invoiceNumber: 'INV-SCHED', orderId, amount: 1000 });

    expect(res.status).toBe(201);

    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('scheduled_for_shipment');
  });
});

describe('PUT /api/shipments/:id/confirm', () => {
  it('confirms a shipment and moves linked order to shipped', async () => {
    const { lastInsertRowid: orderId } = db.prepare(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-CONF', 'scheduled_for_shipment', 'medium', 1)"
    ).run();
    const { lastInsertRowid: shipmentId } = db.prepare(
      "INSERT INTO shipments (order_id, order_number, invoice_number, amount, status) VALUES (?, 'ORD-CONF', 'INV-CONF', 1000, 'scheduled')"
    ).run(orderId);

    const res = await request(app).put(`/api/shipments/${shipmentId}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('shipped');

    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('shipped');
  });

  it('returns 400 when shipment is already confirmed', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO shipments (invoice_number, amount, status) VALUES ('INV-DONE', 500, 'shipped')"
    ).run();

    const res = await request(app).put(`/api/shipments/${lastInsertRowid}/confirm`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent shipment', async () => {
    const res = await request(app).put('/api/shipments/9999/confirm');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/shipments/:id', () => {
  it('updates shipment status and payment info', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO shipments (invoice_number, amount, status) VALUES ('INV-UPD', 1000, 'scheduled')"
    ).run();

    const res = await request(app)
      .put(`/api/shipments/${lastInsertRowid}`)
      .send({ status: 'shipped', paidAmount: 1000, paidDate: '2026-05-10' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('shipped');
    expect(res.body.paidAmount).toBe(1000);
    expect(res.body.paidDate).toBe('2026-05-10');
  });

  it('returns 404 for non-existent shipment', async () => {
    const res = await request(app)
      .put('/api/shipments/9999')
      .send({ status: 'shipped' });

    expect(res.status).toBe(404);
  });
});
