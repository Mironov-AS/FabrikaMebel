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
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM payments ORDER BY paid_date DESC, due_date ASC').all();
  res.json(rows.map(buildPayment));
});

// GET /api/payments/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Платёж не найден' });
  res.json(buildPayment(row));
});

// PUT /api/payments/:id — update status/penalty (admin use)
router.put('/:id', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  const { status, paidDate, penaltyDays, penaltyAmount } = req.body;

  if (status !== undefined && !VALID_PAYMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_PAYMENT_STATUSES.join(', ')}` });
  }

  const safePaidDate = paidDate !== undefined ? sanitizeStr(paidDate) : undefined;

  db.prepare(`
    UPDATE payments SET
      status = COALESCE(?, status),
      paid_date = COALESCE(?, paid_date),
      penalty_days = COALESCE(?, penalty_days),
      penalty_amount = COALESCE(?, penalty_amount)
    WHERE id = ?
  `).run(status, safePaidDate, penaltyDays, penaltyAmount, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлён платёж #${payment.id}`, 'Платёж', payment.id, req.ip);
  res.json(buildPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)));
});

module.exports = router;
