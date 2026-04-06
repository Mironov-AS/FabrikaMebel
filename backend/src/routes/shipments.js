const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildShipment(row) {
  if (!row) return null;
  const items = db.prepare('SELECT * FROM shipment_items WHERE shipment_id = ?').all(row.id);
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    counterpartyId: row.counterparty_id,
    date: row.date,
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    status: row.status,
    paymentDueDate: row.payment_due_date,
    paidAmount: row.paid_amount,
    paidDate: row.paid_date,
    items: items.map(i => ({ specItemId: i.order_item_id, name: i.name, quantity: i.quantity, price: i.price })),
  };
}

// GET /api/shipments
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM shipments ORDER BY date DESC').all();
  res.json(rows.map(buildShipment));
});

// GET /api/shipments/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Отгрузка не найдена' });
  res.json(buildShipment(row));
});

// POST /api/shipments
router.post('/', requireRole('admin', 'sales_manager', 'director', 'production_head'), (req, res) => {
  const { orderId, orderNumber, counterpartyId, date, invoiceNumber, amount, paymentDueDate, items = [] } = req.body;
  if (!invoiceNumber) return res.status(400).json({ error: 'Номер счёта обязателен' });

  const result = db.prepare(`
    INSERT INTO shipments (order_id, order_number, counterparty_id, date, invoice_number, amount, status, payment_due_date, paid_amount)
    VALUES (?, ?, ?, ?, ?, ?, 'shipped', ?, 0)
  `).run(orderId || null, orderNumber || null, counterpartyId || null, date, invoiceNumber, amount || 0, paymentDueDate || null);

  const shipmentId = result.lastInsertRowid;

  for (const item of items) {
    db.prepare('INSERT INTO shipment_items (shipment_id, order_item_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)').run(
      shipmentId, item.specItemId || null, item.name, item.quantity || 0, item.price || 0
    );
    // Update order item shipped count
    if (item.specItemId) {
      db.prepare('UPDATE order_items SET shipped = shipped + ? WHERE id = ?').run(item.quantity || 0, item.specItemId);
    }
  }

  // Auto-create payment record
  db.prepare(`
    INSERT INTO payments (shipment_id, counterparty_id, amount, due_date, status, invoice_number)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(shipmentId, counterpartyId || null, amount || 0, paymentDueDate || null, invoiceNumber);

  logAudit(req.user.id, req.user.name, `Зарегистрирована отгрузка ${invoiceNumber}`, 'Отгрузка', shipmentId, req.ip);
  res.status(201).json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId)));
});

// PUT /api/shipments/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head'), (req, res) => {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Отгрузка не найдена' });

  const { status, paidAmount, paidDate, paymentDueDate } = req.body;

  db.prepare(`
    UPDATE shipments SET
      status = COALESCE(?, status),
      paid_amount = COALESCE(?, paid_amount),
      paid_date = COALESCE(?, paid_date),
      payment_due_date = COALESCE(?, payment_due_date)
    WHERE id = ?
  `).run(status, paidAmount, paidDate, paymentDueDate, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлена отгрузка ${shipment.invoice_number}`, 'Отгрузка', shipment.id, req.ip);
  res.json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id)));
});

module.exports = router;
