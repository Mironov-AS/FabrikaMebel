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

describe('GET /api/payments', () => {
  it('returns an empty array when no payments exist', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns payments sorted by due_date ascending', async () => {
    db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(1000, '2026-03-01', 'INV-LATE');
    db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(2000, '2026-01-01', 'INV-EARLY');

    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].invoiceNumber).toBe('INV-EARLY');
    expect(res.body[1].invoiceNumber).toBe('INV-LATE');
  });
});

describe('GET /api/payments/:id', () => {
  it('returns 404 for non-existent payment', async () => {
    const res = await request(app).get('/api/payments/9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns payment for existing id', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(5000, '2026-06-01', 'INV-001');

    const res = await request(app).get(`/api/payments/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe('INV-001');
    expect(res.body.amount).toBe(5000);
    expect(res.body.status).toBe('pending');
  });
});

describe('POST /api/payments', () => {
  it('creates a payment and returns 201', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({ amount: 3000, dueDate: '2026-05-01', invoiceNumber: 'INV-NEW' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.amount).toBe(3000);
    expect(res.body.status).toBe('pending');
    expect(res.body.invoiceNumber).toBe('INV-NEW');
  });

  it('creates a payment with minimal data (all fields optional)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.amount).toBe(0);
    expect(res.body.status).toBe('pending');
  });
});

describe('PUT /api/payments/:id/register', () => {
  it('registers a payment and updates status to paid', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(5000, '2026-06-01', 'INV-REG');

    const res = await request(app)
      .put(`/api/payments/${lastInsertRowid}/register`)
      .send({ paidAmount: 5000, paidDate: '2026-05-25' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.paidDate).toBe('2026-05-25');
    expect(res.body.penaltyDays).toBe(0);
    expect(res.body.penaltyAmount).toBe(0);
  });

  it('returns 400 when paidAmount is missing', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(1000, '2026-06-01', 'INV-NO-AMT');

    const res = await request(app)
      .put(`/api/payments/${lastInsertRowid}/register`)
      .send({ paidDate: '2026-05-25' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when paidDate is missing', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(1000, '2026-06-01', 'INV-NO-DATE');

    const res = await request(app)
      .put(`/api/payments/${lastInsertRowid}/register`)
      .send({ paidAmount: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent payment', async () => {
    const res = await request(app)
      .put('/api/payments/9999/register')
      .send({ paidAmount: 1000, paidDate: '2026-05-25' });

    expect(res.status).toBe(404);
  });

  it('auto-completes linked order when all shipments are paid', async () => {
    // Create order in 'shipped' status
    const { lastInsertRowid: orderId } = db.prepare(
      "INSERT INTO orders (number, status, priority, created_by) VALUES (?, 'shipped', 'medium', 1)"
    ).run('ORD-COMPLETE');

    // Create shipment linked to the order
    const { lastInsertRowid: shipmentId } = db.prepare(
      "INSERT INTO shipments (order_id, order_number, invoice_number, amount, status) VALUES (?, ?, 'INV-COMP', 5000, 'shipped')"
    ).run(orderId, 'ORD-COMPLETE');

    // Create payment linked to the shipment
    const { lastInsertRowid: paymentId } = db.prepare(
      "INSERT INTO payments (shipment_id, amount, due_date, status, invoice_number) VALUES (?, 5000, '2026-06-01', 'pending', 'INV-COMP')"
    ).run(shipmentId);

    const res = await request(app)
      .put(`/api/payments/${paymentId}/register`)
      .send({ paidAmount: 5000, paidDate: '2026-05-25' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');

    // Order should now be 'completed'
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('completed');
  });
});

describe('PUT /api/payments/:id', () => {
  it('updates payment status and penalty info', async () => {
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES (?, ?, 'pending', ?)"
    ).run(2000, '2026-01-01', 'INV-UPD');

    const res = await request(app)
      .put(`/api/payments/${lastInsertRowid}`)
      .send({ status: 'overdue', penaltyDays: 10, penaltyAmount: 200 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('overdue');
    expect(res.body.penaltyDays).toBe(10);
    expect(res.body.penaltyAmount).toBe(200);
  });

  it('returns 404 for non-existent payment', async () => {
    const res = await request(app)
      .put('/api/payments/9999')
      .send({ status: 'overdue' });

    expect(res.status).toBe(404);
  });
});
