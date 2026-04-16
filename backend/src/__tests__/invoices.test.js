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
  await db.query('DELETE FROM payments WHERE invoice_id IS NOT NULL');
  await db.query('DELETE FROM invoices');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
});

async function createOrder(number = 'ORD-INV', totalAmount = 10000) {
  const { lastInsertRowid } = await db.runReturning(
    'INSERT INTO orders (number, status, priority, total_amount, created_by) VALUES ($1, $2, $3, $4, $5)',
    [number, 'planned', 'medium', totalAmount, 1]
  );
  return lastInsertRowid;
}

describe('GET /api/invoices', () => {
  it('returns an empty array when no invoices exist', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns existing invoices with installments array', async () => {
    const orderId = await createOrder();
    await db.query(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, status) VALUES ($1, 'INV-LIST', '2026-04-01', 5000, 'pending')",
      [orderId]
    );

    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].invoiceNumber).toBe('INV-LIST');
    expect(Array.isArray(res.body[0].installments)).toBe(true);
  });
});

describe('GET /api/invoices/:id', () => {
  it('returns 404 for non-existent invoice', async () => {
    const res = await request(app).get('/api/invoices/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns invoice for existing id', async () => {
    const orderId = await createOrder();
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, status) VALUES ($1, 'INV-GET', '2026-04-01', 8000, 'pending')",
      [orderId]
    );

    const res = await request(app).get(`/api/invoices/${lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe('INV-GET');
    expect(res.body.amount).toBe(8000);
    expect(res.body.isActive).toBe(true);
  });
});

describe('POST /api/invoices', () => {
  it('creates an invoice and returns 201', async () => {
    const orderId = await createOrder('ORD-INV-NEW', 5000);

    const res = await request(app)
      .post('/api/invoices')
      .send({
        orderId,
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-04-10',
        amount: 5000,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.invoiceNumber).toBe('INV-001');
    expect(res.body.amount).toBe(5000);
    expect(res.body.status).toBe('pending');
    expect(res.body.isActive).toBe(true);
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({ invoiceNumber: 'INV-002', invoiceDate: '2026-04-10' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/orderId/i);
  });

  it('returns 400 when invoiceNumber is missing', async () => {
    const orderId = await createOrder('ORD-NO-NUM');
    const res = await request(app)
      .post('/api/invoices')
      .send({ orderId, invoiceDate: '2026-04-10' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/номер/i);
  });

  it('returns 400 when invoiceDate is missing', async () => {
    const orderId = await createOrder('ORD-NO-DATE');
    const res = await request(app)
      .post('/api/invoices')
      .send({ orderId, invoiceNumber: 'INV-003' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/дата/i);
  });

  it('returns 404 when order does not exist', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({ orderId: 999999, invoiceNumber: 'INV-X', invoiceDate: '2026-04-10' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when active invoice already exists for the order', async () => {
    const orderId = await createOrder('ORD-DUP');
    await request(app)
      .post('/api/invoices')
      .send({ orderId, invoiceNumber: 'INV-DUP-1', invoiceDate: '2026-04-10', amount: 100 });

    const res = await request(app)
      .post('/api/invoices')
      .send({ orderId, invoiceNumber: 'INV-DUP-2', invoiceDate: '2026-04-11', amount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/активный счёт/i);
  });

  it('uses order total_amount when amount is not provided', async () => {
    const orderId = await createOrder('ORD-AMT', 7500);
    const res = await request(app)
      .post('/api/invoices')
      .send({ orderId, invoiceNumber: 'INV-AMT', invoiceDate: '2026-04-10' });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(7500);
  });
});

describe('PATCH /api/invoices/:id/deactivate', () => {
  it('deactivates an active pending invoice', async () => {
    const orderId = await createOrder('ORD-DEACT');
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, status, is_active) VALUES ($1, 'INV-DEACT', '2026-04-01', 1000, 'pending', 1)",
      [orderId]
    );

    const res = await request(app).patch(`/api/invoices/${lastInsertRowid}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('returns 400 when already deactivated', async () => {
    const orderId = await createOrder('ORD-DEACT2');
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, status, is_active) VALUES ($1, 'INV-ALREADY', '2026-04-01', 1000, 'pending', 0)",
      [orderId]
    );

    const res = await request(app).patch(`/api/invoices/${lastInsertRowid}/deactivate`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when invoice is fully paid', async () => {
    const orderId = await createOrder('ORD-PAID-DEACT');
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, paid_amount, status, is_active) VALUES ($1, 'INV-PAID', '2026-04-01', 1000, 1000, 'paid', 1)",
      [orderId]
    );

    const res = await request(app).patch(`/api/invoices/${lastInsertRowid}/deactivate`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/оплачен/i);
  });

  it('returns 404 for non-existent invoice', async () => {
    const res = await request(app).patch('/api/invoices/999999/deactivate');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/invoices/:id/payments — partial payment installments', () => {
  let invoiceId;

  beforeEach(async () => {
    const orderId = await createOrder('ORD-PAY', 10000);
    const { lastInsertRowid } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, paid_amount, status, is_active) VALUES ($1, 'INV-PAY', '2026-04-01', 10000, 0, 'pending', 1)",
      [orderId]
    );
    invoiceId = lastInsertRowid;
  });

  it('registers a partial payment and updates paid_amount', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .send({ amount: 3000, paidDate: '2026-05-10' });

    expect(res.status).toBe(201);
    expect(res.body.paidAmount).toBe(3000);
    expect(res.body.status).toBe('partial');
    expect(res.body.installments).toHaveLength(1);
    expect(res.body.installments[0].amount).toBe(3000);
  });

  it('marks invoice as paid when full amount is paid', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .send({ amount: 10000, paidDate: '2026-05-10' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('paid');
    expect(res.body.paidAmount).toBe(10000);
  });

  it('returns 400 when amount is missing', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .send({ paidDate: '2026-05-10' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .send({ amount: 0, paidDate: '2026-05-10' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when paidDate is missing', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .send({ amount: 1000 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when payment exceeds remaining balance', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .send({ amount: 99999, paidDate: '2026-05-10' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/остаток/i);
  });

  it('returns 404 for non-existent invoice', async () => {
    const res = await request(app)
      .post('/api/invoices/999999/payments')
      .send({ amount: 1000, paidDate: '2026-05-10' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/invoices/:id/payments/:paymentId', () => {
  it('cancels a payment installment and reduces paid_amount', async () => {
    const orderId = await createOrder('ORD-CANCEL-PAY', 5000);
    const { lastInsertRowid: invId } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, paid_amount, status, is_active) VALUES ($1, 'INV-CANCEL', '2026-04-01', 5000, 2000, 'partial', 1)",
      [orderId]
    );

    const { lastInsertRowid: payId } = await db.runReturning(
      'INSERT INTO payments (invoice_id, amount, paid_date, status) VALUES ($1, 2000, $2, $3)',
      [invId, '2026-05-01', 'paid']
    );

    const res = await request(app).delete(`/api/invoices/${invId}/payments/${payId}`);
    expect(res.status).toBe(200);
    expect(res.body.paidAmount).toBe(0);
  });

  it('returns 404 when payment does not belong to the invoice', async () => {
    const orderId = await createOrder('ORD-WRONG-PAY', 5000);
    const { lastInsertRowid: invId } = await db.runReturning(
      "INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, paid_amount, status, is_active) VALUES ($1, 'INV-WRONG', '2026-04-01', 5000, 0, 'pending', 1)",
      [orderId]
    );

    const res = await request(app).delete(`/api/invoices/${invId}/payments/999999`);
    expect(res.status).toBe(404);
  });
});
