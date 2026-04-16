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

// POST /api/payments — create a new payment record
router.post('/', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const { invoiceId, shipmentId, counterpartyId, amount, dueDate, invoiceNumber } = req.body;

  const result = db.prepare(`
    INSERT INTO payments (invoice_id, shipment_id, counterparty_id, amount, due_date, status, invoice_number)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    invoiceId || null,
    shipmentId || null,
    counterpartyId || null,
    amount || 0,
    dueDate ? sanitizeStr(dueDate) : null,
    invoiceNumber ? sanitizeStr(invoiceNumber) : null
  );

  logAudit(req.user.id, req.user.name, `Создан платёж`, 'Платёж', result.lastInsertRowid, req.ip);
  res.status(201).json(buildPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/payments/:id/register — register actual payment (mark as paid, calc penalties)
router.put('/:id/register', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  const { paidAmount, paidDate } = req.body;
  if (paidAmount === undefined || paidAmount === null) {
    return res.status(400).json({ error: 'Поле paidAmount обязательно' });
  }
  if (!paidDate) {
    return res.status(400).json({ error: 'Поле paidDate обязательно' });
  }

  // Calculate penalty days (positive if paid after due date)
  let penaltyDays = 0;
  let penaltyAmount = 0;
  if (payment.due_date && paidDate > payment.due_date) {
    const due = new Date(payment.due_date);
    const paid = new Date(paidDate);
    penaltyDays = Math.round((paid - due) / (1000 * 60 * 60 * 24));
  }

  db.prepare(`
    UPDATE payments SET status = 'paid', paid_date = ?, penalty_days = ?, penalty_amount = ?
    WHERE id = ?
  `).run(sanitizeStr(paidDate), penaltyDays, penaltyAmount, req.params.id);

  // Auto-complete linked order when all its shipments' payments are paid
  if (payment.shipment_id) {
    const shipment = db.prepare('SELECT order_id FROM shipments WHERE id = ?').get(payment.shipment_id);
    if (shipment && shipment.order_id) {
      const { cnt } = db.prepare(`
        SELECT COUNT(*) as cnt FROM payments
        WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id = ?)
          AND status != 'paid'
          AND id != ?
      `).get(shipment.order_id, req.params.id);
      if (cnt === 0) {
        db.prepare("UPDATE orders SET status = 'completed' WHERE id = ? AND status = 'shipped'").run(shipment.order_id);
      }
    }
  }

  logAudit(req.user.id, req.user.name, `Зарегистрирован платёж #${payment.id}`, 'Платёж', payment.id, req.ip);
  res.json(buildPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)));
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
