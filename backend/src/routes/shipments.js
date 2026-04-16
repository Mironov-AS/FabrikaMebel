const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr } = require('../middleware/validate');

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

  const safeInvoiceNumber = invoiceNumber ? sanitizeStr(invoiceNumber) : null;
  const safeOrderNumber = orderNumber ? sanitizeStr(orderNumber) : null;
  const safeDeliveryAddress = deliveryAddress ? sanitizeStr(deliveryAddress) : null;

  // invoiceNumber is required
  if (!safeInvoiceNumber) {
    return res.status(400).json({ error: 'Поле invoiceNumber обязательно' });
  }

  // Validate orderId exists if provided
  let order = null;
  if (orderId) {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    // Block new shipment if all order items are already fully shipped
    const orderItems = db.prepare('SELECT id, quantity, shipped FROM order_items WHERE order_id = ?').all(orderId);
    if (orderItems.length > 0) {
      const hasUnshipped = orderItems.some(i => (i.shipped || 0) < i.quantity);
      if (!hasUnshipped) {
        return res.status(400).json({ error: 'Все позиции заказа уже отгружены. Регистрация новой отгрузки невозможна.' });
      }
    }
  }

  const effectiveDate = scheduledDate || date;

  // Auto-calculate paymentDueDate from contract.payment_delay if not provided
  let effectivePaymentDueDate = paymentDueDate ? sanitizeStr(paymentDueDate) : null;
  if (!effectivePaymentDueDate && order && order.contract_id) {
    const contract = db.prepare('SELECT payment_delay FROM contracts WHERE id = ?').get(order.contract_id);
    if (contract && contract.payment_delay && effectiveDate) {
      const d = new Date(effectiveDate);
      d.setDate(d.getDate() + contract.payment_delay);
      effectivePaymentDueDate = d.toISOString().split('T')[0];
    }
  }

  const result = db.prepare(`
    INSERT INTO shipments (order_id, order_number, counterparty_id, date, scheduled_date, invoice_number, amount, status, paid_amount, delivery_type, delivery_address, payment_due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 0, ?, ?, ?)
  `).run(
    orderId || null, safeOrderNumber, counterpartyId || null,
    effectiveDate, scheduledDate || null,
    safeInvoiceNumber, amount || 0,
    deliveryType || 'pickup', safeDeliveryAddress, effectivePaymentDueDate
  );

  const shipmentId = result.lastInsertRowid;

  // Auto-create a pending payment record for this shipment
  db.prepare(`
    INSERT INTO payments (shipment_id, counterparty_id, amount, due_date, status, invoice_number)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(shipmentId, counterpartyId || null, amount || 0, effectivePaymentDueDate, safeInvoiceNumber);

  for (const item of items) {
    db.prepare('INSERT INTO shipment_items (shipment_id, order_item_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)').run(
      shipmentId, item.specItemId || null, item.name, item.quantity || 0, item.price || 0
    );
    // Update order item shipped count
    if (item.specItemId) {
      db.prepare('UPDATE order_items SET shipped = shipped + ? WHERE id = ?').run(item.quantity || 0, item.specItemId);
    }
  }

  // Update linked order status based on remaining unshipped items
  if (orderId) {
    const allOrderItems = db.prepare('SELECT quantity, shipped FROM order_items WHERE order_id = ?').all(orderId);
    const allFullyShipped = allOrderItems.length > 0 && allOrderItems.every(i => (i.shipped || 0) >= i.quantity);
    if (allFullyShipped) {
      db.prepare("UPDATE orders SET status = 'shipped' WHERE id = ? AND status NOT IN ('shipped', 'completed')").run(orderId);
    } else {
      db.prepare("UPDATE orders SET status = 'scheduled_for_shipment' WHERE id = ? AND status = 'ready_for_shipment'").run(orderId);
    }
  }

  logAudit(req.user.id, req.user.name, `Зарегистрирована отгрузка ${safeInvoiceNumber}`, 'Отгрузка', shipmentId, req.ip);
  res.status(201).json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId)));
});

// PUT /api/shipments/:id/confirm — logistician confirms actual delivery/shipment
router.put('/:id/confirm', requireRole('admin', 'sales_manager', 'director', 'production_head', 'warehouse'), (req, res) => {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Отгрузка не найдена' });
  if (shipment.status === 'shipped') return res.status(400).json({ error: 'Отгрузка уже подтверждена' });

  db.prepare("UPDATE shipments SET status = 'shipped' WHERE id = ?").run(req.params.id);

  // Move linked order to 'shipped' — check all items are fully shipped
  if (shipment.order_id) {
    const allOrderItems = db.prepare('SELECT quantity, shipped FROM order_items WHERE order_id = ?').all(shipment.order_id);
    const allFullyShipped = allOrderItems.length === 0 || allOrderItems.every(i => (i.shipped || 0) >= i.quantity);
    if (allFullyShipped) {
      db.prepare("UPDATE orders SET status = 'shipped' WHERE id = ? AND status NOT IN ('shipped', 'completed')").run(shipment.order_id);
    }
  }

  logAudit(req.user.id, req.user.name, `Подтверждена отгрузка ${shipment.invoice_number}`, 'Отгрузка', shipment.id, req.ip);
  res.json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id)));
});

// PUT /api/shipments/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head'), (req, res) => {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Отгрузка не найдена' });

  const { status, paidAmount, paidDate, paymentDueDate } = req.body;

  const safeStatus = status !== undefined ? sanitizeStr(status) : undefined;
  const safePaidDate = paidDate !== undefined ? sanitizeStr(paidDate) : undefined;
  const safePaymentDueDate = paymentDueDate !== undefined ? sanitizeStr(paymentDueDate) : undefined;

  db.prepare(`
    UPDATE shipments SET
      status = COALESCE(?, status),
      paid_amount = COALESCE(?, paid_amount),
      paid_date = COALESCE(?, paid_date),
      payment_due_date = COALESCE(?, payment_due_date)
    WHERE id = ?
  `).run(safeStatus, paidAmount, safePaidDate, safePaymentDueDate, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлена отгрузка ${shipment.invoice_number}`, 'Отгрузка', shipment.id, req.ip);
  res.json(buildShipment(db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id)));
});

module.exports = router;
