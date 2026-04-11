const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
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
  const rows = db.prepare('SELECT * FROM payments ORDER BY due_date ASC').all();
  res.json(rows.map(buildPayment));
});

// GET /api/payments/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Платёж не найден' });
  res.json(buildPayment(row));
});

// POST /api/payments — accountant, admin
router.post('/', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const { shipmentId, counterpartyId, amount, dueDate, invoiceNumber } = req.body;

  const result = db.prepare(`
    INSERT INTO payments (shipment_id, counterparty_id, amount, due_date, status, invoice_number)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(shipmentId || null, counterpartyId || null, amount || 0, dueDate, invoiceNumber || null);

  logAudit(req.user.id, req.user.name, `Создан платёж ${invoiceNumber}`, 'Платёж', result.lastInsertRowid, req.ip);
  res.status(201).json(buildPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/payments/:id/register — register payment (accountant, admin)
router.put('/:id/register', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  const { paidAmount, paidDate } = req.body;
  if (!paidAmount || !paidDate) return res.status(400).json({ error: 'Сумма и дата оплаты обязательны' });

  db.prepare(`
    UPDATE payments SET paid_date = ?, status = 'paid', penalty_days = 0, penalty_amount = 0
    WHERE id = ?
  `).run(paidDate, req.params.id);

  // Also update the related shipment
  if (payment.shipment_id) {
    db.prepare('UPDATE shipments SET paid_amount = ?, paid_date = ? WHERE id = ?').run(paidAmount, paidDate, payment.shipment_id);

    // If all payments for this order are now paid → move order to 'completed'
    const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(payment.shipment_id);
    if (shipment && shipment.order_id) {
      const allShipmentIds = db.prepare('SELECT id FROM shipments WHERE order_id = ?').all(shipment.order_id).map(s => s.id);
      if (allShipmentIds.length > 0) {
        const placeholders = allShipmentIds.map(() => '?').join(',');
        const unpaid = db.prepare(
          `SELECT COUNT(*) as cnt FROM payments WHERE shipment_id IN (${placeholders}) AND status != 'paid'`
        ).get(...allShipmentIds);
        if (unpaid.cnt === 0) {
          db.prepare("UPDATE orders SET status = 'completed' WHERE id = ? AND status = 'shipped'").run(shipment.order_id);
        }
      }
    }
  }

  logAudit(req.user.id, req.user.name, `Зарегистрирован платёж по счёту ${payment.invoice_number}`, 'Платёж', payment.id, req.ip);
  res.json(buildPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)));
});

// PUT /api/payments/:id
router.put('/:id', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  const { status, paidDate, penaltyDays, penaltyAmount } = req.body;

  db.prepare(`
    UPDATE payments SET
      status = COALESCE(?, status),
      paid_date = COALESCE(?, paid_date),
      penalty_days = COALESCE(?, penalty_days),
      penalty_amount = COALESCE(?, penalty_amount)
    WHERE id = ?
  `).run(status, paidDate, penaltyDays, penaltyAmount, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлён платёж ${payment.invoice_number}`, 'Платёж', payment.id, req.ip);
  res.json(buildPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)));
});

module.exports = router;
