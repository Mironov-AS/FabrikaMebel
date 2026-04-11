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
    scheduledDate: row.scheduled_date,
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    status: row.status,
    deliveryType: row.delivery_type || 'pickup',
    deliveryAddress: row.delivery_address || '',
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
  const { orderId, orderNumber, counterpartyId, date, scheduledDate, invoiceNumber, amount, paymentDueDate, deliveryType, deliveryAddress, items = [] } = req.body;
  if (!invoiceNumber) return res.status(400).json({ error: 'Номер счёта обязателен' });

  // Validate orderId exists if provided
  let order = null;
  if (orderId) {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  }

  const effectiveDate = scheduledDate || date;

  // Auto-calculate payment_due_date from contract.payment_delay if not provided manually
  let resolvedPaymentDueDate = paymentDueDate || null;
  if (!resolvedPaymentDueDate && order) {
    if (order.contract_id) {
      const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(order.contract_id);
      if (contract && contract.payment_delay != null && effectiveDate) {
        const shipmentDate = new Date(effectiveDate);
        shipmentDate.setDate(shipmentDate.getDate() + contract.payment_delay);
        resolvedPaymentDueDate = shipmentDate.toISOString().slice(0, 10);
      }
    }
  }

  const result = db.prepare(`
    INSERT INTO shipments (order_id, order_number, counterparty_id, date, scheduled_date, invoice_number, amount, status, payment_due_date, paid_amount, delivery_type, delivery_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, 0, ?, ?)
  `).run(
    orderId || null, orderNumber || null, counterpartyId || null,
    effectiveDate, scheduledDate || null,
    invoiceNumber, amount || 0,
    resolvedPaymentDueDate,
    deliveryType || 'pickup', deliveryAddress || null
  );

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
  `).run(shipmentId, counterpartyId || null, amount || 0, resolvedPaymentDueDate, invoiceNumber);

  logAudit(req.user.id, req.user.name, `Зарегистрирована отгрузка ${invoiceNumber}`, 'Отгрузка', shipmentId, req.ip);
  res.status(201).json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId)));
});

// PUT /api/shipments/:id/confirm — logistician confirms actual delivery/shipment
router.put('/:id/confirm', requireRole('admin', 'sales_manager', 'director', 'production_head', 'warehouse'), (req, res) => {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Отгрузка не найдена' });
  if (shipment.status === 'shipped') return res.status(400).json({ error: 'Отгрузка уже подтверждена' });

  db.prepare("UPDATE shipments SET status = 'shipped' WHERE id = ?").run(req.params.id);

  // Move linked order to 'shipped' — awaiting payment
  if (shipment.order_id) {
    db.prepare("UPDATE orders SET status = 'shipped' WHERE id = ? AND status NOT IN ('shipped', 'completed')").run(shipment.order_id);
  }

  logAudit(req.user.id, req.user.name, `Подтверждена отгрузка ${shipment.invoice_number}`, 'Отгрузка', shipment.id, req.ip);
  res.json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id)));
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
