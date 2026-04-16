const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr } = require('../middleware/validate');

const VALID_PAYMENT_STATUSES = ['pending', 'overdue', 'paid', 'partial'];

const router = express.Router();
router.use(authenticate);

function buildPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    shipmentId: row.shipment_id,
    counterpartyId: row.counterparty_id,
    amount: row.amount,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    status: row.status,
    invoiceNumber: row.invoice_number,
    penaltyDays: row.penalty_days,
    penaltyAmount: row.penalty_amount,
  };
}

// GET /api/payments
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM payments ORDER BY paid_date DESC, due_date ASC');
    res.json(rows.map(buildPayment));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Платёж не найден' });
    res.json(buildPayment(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments — create a new payment record
router.post('/', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const { invoiceId, shipmentId, counterpartyId, amount, dueDate, invoiceNumber } = req.body;

    const result = await db.runReturning(`
      INSERT INTO payments (invoice_id, shipment_id, counterparty_id, amount, due_date, status, invoice_number)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
    `, [
      invoiceId || null,
      shipmentId || null,
      counterpartyId || null,
      amount || 0,
      dueDate ? sanitizeStr(dueDate) : null,
      invoiceNumber ? sanitizeStr(invoiceNumber) : null,
    ]);

    logAudit(req.user.id, req.user.name, `Создан платёж`, 'Платёж', result.lastInsertRowid, req.ip);
    const newPayment = await db.get('SELECT * FROM payments WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(buildPayment(newPayment));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id/register — register actual payment (mark as paid, calc penalties)
router.put('/:id/register', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const payment = await db.get('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    const { paidAmount, paidDate } = req.body;
    if (paidAmount === undefined || paidAmount === null) {
      return res.status(400).json({ error: 'Поле paidAmount обязательно' });
    }
    if (!paidDate) {
      return res.status(400).json({ error: 'Поле paidDate обязательно' });
    }

    let penaltyDays = 0;
    let penaltyAmount = 0;
    if (payment.due_date && paidDate > payment.due_date) {
      const due = new Date(payment.due_date);
      const paid = new Date(paidDate);
      penaltyDays = Math.round((paid - due) / (1000 * 60 * 60 * 24));
    }

    await db.run(`
      UPDATE payments SET status = 'paid', paid_date = $1, penalty_days = $2, penalty_amount = $3
      WHERE id = $4
    `, [sanitizeStr(paidDate), penaltyDays, penaltyAmount, req.params.id]);

    if (payment.shipment_id) {
      const shipment = await db.get('SELECT order_id FROM shipments WHERE id = $1', [payment.shipment_id]);
      if (shipment && shipment.order_id) {
        const { cnt } = await db.get(`
          SELECT COUNT(*) as cnt FROM payments
          WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id = $1)
            AND status != 'paid'
            AND id != $2
        `, [shipment.order_id, req.params.id]);
        if (parseInt(cnt) === 0) {
          await db.run("UPDATE orders SET status = 'completed' WHERE id = $1 AND status = 'shipped'", [shipment.order_id]);
        }
      }
    }

    logAudit(req.user.id, req.user.name, `Зарегистрирован платёж #${payment.id}`, 'Платёж', payment.id, req.ip);
    const updated = await db.get('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    res.json(buildPayment(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id — update status/penalty (admin use)
router.put('/:id', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const payment = await db.get('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    const { status, paidDate, penaltyDays, penaltyAmount } = req.body;

    if (status !== undefined && !VALID_PAYMENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_PAYMENT_STATUSES.join(', ')}` });
    }

    const safePaidDate = paidDate !== undefined ? sanitizeStr(paidDate) : undefined;

    await db.run(`
      UPDATE payments SET
        status = COALESCE($1, status),
        paid_date = COALESCE($2, paid_date),
        penalty_days = COALESCE($3, penalty_days),
        penalty_amount = COALESCE($4, penalty_amount)
      WHERE id = $5
    `, [status, safePaidDate, penaltyDays, penaltyAmount, req.params.id]);

    logAudit(req.user.id, req.user.name, `Обновлён платёж #${payment.id}`, 'Платёж', payment.id, req.ip);
    const updated = await db.get('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    res.json(buildPayment(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
