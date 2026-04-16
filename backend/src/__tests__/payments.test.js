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
  await db.query('DELETE FROM payments WHERE shipment_id IS NOT NULL OR invoice_id IS NULL');
  await db.query('DELETE FROM payments');
  await db.query('DELETE FROM shipment_items');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
});

describe('GET /api/payments', () => {
  it('returns an empty array when no payments exist', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns payments sorted by due_date ascending', async () => {
    await db.query(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [1000, '2026-03-01', 'INV-LATE']
    );
    await db.query(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [2000, '2026-01-01', 'INV-EARLY']
    );

    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].invoiceNumber).toBe('INV-EARLY');
    expect(res.body[1].invoiceNumber).toBe('INV-LATE');
  });
});

describe('GET /api/payments/:id', () => {
  it('returns 404 for non-existent payment', async () => {
    const res = await request(app).get('/api/payments/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns payment for existing id', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [5000, '2026-06-01', 'INV-001']
    );

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
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [5000, '2026-06-01', 'INV-REG']
    );

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
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [1000, '2026-06-01', 'INV-NO-AMT']
    );

    const res = await request(app)
      .put(`/api/payments/${lastInsertRowid}/register`)
      .send({ paidDate: '2026-05-25' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when paidDate is missing', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [1000, '2026-06-01', 'INV-NO-DATE']
    );

    const res = await request(app)
      .put(`/api/payments/${lastInsertRowid}/register`)
      .send({ paidAmount: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent payment', async () => {
    const res = await request(app)
      .put('/api/payments/999999/register')
      .send({ paidAmount: 1000, paidDate: '2026-05-25' });

    expect(res.status).toBe(404);
  });

  it('auto-completes linked order when all shipments are paid', async () => {
    const { lastInsertRowid: orderId } = await db.runReturning(
      "INSERT INTO orders (number, status, priority, created_by) VALUES ('ORD-COMPLETE', 'shipped', 'medium', 1)"
    );
    const { lastInsertRowid: shipmentId } = await db.runReturning(
      "INSERT INTO shipments (order_id, order_number, invoice_number, amount, status) VALUES ($1, 'ORD-COMPLETE', 'INV-COMP', 5000, 'shipped')",
      [orderId]
    );
    const { lastInsertRowid: paymentId } = await db.runReturning(
      "INSERT INTO payments (shipment_id, amount, due_date, status, invoice_number) VALUES ($1, 5000, '2026-06-01', 'pending', 'INV-COMP')",
      [shipmentId]
    );

    const res = await request(app)
      .put(`/api/payments/${paymentId}/register`)
      .send({ paidAmount: 5000, paidDate: '2026-05-25' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');

    const order = await db.get('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.status).toBe('completed');
  });
});

describe('PUT /api/payments/:id', () => {
  it('updates payment status and penalty info', async () => {
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO payments (amount, due_date, status, invoice_number) VALUES ($1, $2, 'pending', $3)",
      [2000, '2026-01-01', 'INV-UPD']
    );

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
      .put('/api/payments/999999')
      .send({ status: 'overdue' });

    expect(res.status).toBe(404);
  });
});
