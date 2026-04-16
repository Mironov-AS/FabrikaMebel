const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

async function buildShipment(row) {
  if (!row) return null;
  const items = await db.all('SELECT * FROM shipment_items WHERE shipment_id = $1', [row.id]);
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
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM shipments ORDER BY date DESC');
    const shipments = await Promise.all(rows.map(buildShipment));
    res.json(shipments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipments/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Отгрузка не найдена' });
    res.json(await buildShipment(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments
router.post('/', requireRole('admin', 'sales_manager', 'director', 'production_head'), async (req, res) => {
  try {
    const { orderId, orderNumber, counterpartyId, date, scheduledDate, invoiceNumber, amount, paymentDueDate, deliveryType, deliveryAddress, items = [] } = req.body;

    const safeInvoiceNumber = invoiceNumber ? sanitizeStr(invoiceNumber) : null;
    const safeOrderNumber = orderNumber ? sanitizeStr(orderNumber) : null;
    const safeDeliveryAddress = deliveryAddress ? sanitizeStr(deliveryAddress) : null;

    if (!safeInvoiceNumber) {
      return res.status(400).json({ error: 'Поле invoiceNumber обязательно' });
    }

    let order = null;
    if (orderId) {
      order = await db.get('SELECT * FROM orders WHERE id = $1', [orderId]);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });

      const orderItems = await db.all('SELECT id, quantity, shipped FROM order_items WHERE order_id = $1', [orderId]);
      if (orderItems.length > 0) {
        const hasUnshipped = orderItems.some(i => (i.shipped || 0) < i.quantity);
        if (!hasUnshipped) {
          return res.status(400).json({ error: 'Все позиции заказа уже отгружены. Регистрация новой отгрузки невозможна.' });
        }
      }
    }

    const effectiveDate = scheduledDate || date;

    let effectivePaymentDueDate = paymentDueDate ? sanitizeStr(paymentDueDate) : null;
    if (!effectivePaymentDueDate && order && order.contract_id) {
      const contract = await db.get('SELECT payment_delay FROM contracts WHERE id = $1', [order.contract_id]);
      if (contract && contract.payment_delay && effectiveDate) {
        const d = new Date(effectiveDate);
        d.setDate(d.getDate() + contract.payment_delay);
        effectivePaymentDueDate = d.toISOString().split('T')[0];
      }
    }

    const result = await db.runReturning(`
      INSERT INTO shipments (order_id, order_number, counterparty_id, date, scheduled_date, invoice_number, amount, status, paid_amount, delivery_type, delivery_address, payment_due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', 0, $8, $9, $10)
    `, [
      orderId || null, safeOrderNumber, counterpartyId || null,
      effectiveDate, scheduledDate || null,
      safeInvoiceNumber, amount || 0,
      deliveryType || 'pickup', safeDeliveryAddress, effectivePaymentDueDate,
    ]);

    const shipmentId = result.lastInsertRowid;

    await db.run(`
      INSERT INTO payments (shipment_id, counterparty_id, amount, due_date, status, invoice_number)
      VALUES ($1, $2, $3, $4, 'pending', $5)
    `, [shipmentId, counterpartyId || null, amount || 0, effectivePaymentDueDate, safeInvoiceNumber]);

    for (const item of items) {
      await db.run('INSERT INTO shipment_items (shipment_id, order_item_id, name, quantity, price) VALUES ($1, $2, $3, $4, $5)', [
        shipmentId, item.specItemId || null, item.name, item.quantity || 0, item.price || 0,
      ]);
      if (item.specItemId) {
        await db.run('UPDATE order_items SET shipped = shipped + $1 WHERE id = $2', [item.quantity || 0, item.specItemId]);
      }
    }

    if (orderId) {
      const allOrderItems = await db.all('SELECT quantity, shipped FROM order_items WHERE order_id = $1', [orderId]);
      const allFullyShipped = allOrderItems.length > 0 && allOrderItems.every(i => (i.shipped || 0) >= i.quantity);
      if (allFullyShipped) {
        await db.run("UPDATE orders SET status = 'shipped' WHERE id = $1 AND status NOT IN ('shipped', 'completed')", [orderId]);
      } else {
        await db.run("UPDATE orders SET status = 'scheduled_for_shipment' WHERE id = $1 AND status = 'ready_for_shipment'", [orderId]);
      }
    }

    logAudit(req.user.id, req.user.name, `Зарегистрирована отгрузка ${safeInvoiceNumber}`, 'Отгрузка', shipmentId, req.ip);
    const newShipment = await db.get('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    res.status(201).json(await buildShipment(newShipment));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shipments/:id/confirm
router.put('/:id/confirm', requireRole('admin', 'sales_manager', 'director', 'production_head', 'warehouse'), async (req, res) => {
  try {
    const shipment = await db.get('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
    if (!shipment) return res.status(404).json({ error: 'Отгрузка не найдена' });
    if (shipment.status === 'shipped') return res.status(400).json({ error: 'Отгрузка уже подтверждена' });

    await db.run("UPDATE shipments SET status = 'shipped' WHERE id = $1", [req.params.id]);

    if (shipment.order_id) {
      const allOrderItems = await db.all('SELECT quantity, shipped FROM order_items WHERE order_id = $1', [shipment.order_id]);
      const allFullyShipped = allOrderItems.length === 0 || allOrderItems.every(i => (i.shipped || 0) >= i.quantity);
      if (allFullyShipped) {
        await db.run("UPDATE orders SET status = 'shipped' WHERE id = $1 AND status NOT IN ('shipped', 'completed')", [shipment.order_id]);
      }
    }

    logAudit(req.user.id, req.user.name, `Подтверждена отгрузка ${shipment.invoice_number}`, 'Отгрузка', shipment.id, req.ip);
    const updated = await db.get('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
    res.json(await buildShipment(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shipments/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head'), async (req, res) => {
  try {
    const shipment = await db.get('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
    if (!shipment) return res.status(404).json({ error: 'Отгрузка не найдена' });

    const { status, paidAmount, paidDate, paymentDueDate } = req.body;

    const safeStatus = status !== undefined ? sanitizeStr(status) : undefined;
    const safePaidDate = paidDate !== undefined ? sanitizeStr(paidDate) : undefined;
    const safePaymentDueDate = paymentDueDate !== undefined ? sanitizeStr(paymentDueDate) : undefined;

    await db.run(`
      UPDATE shipments SET
        status = COALESCE($1, status),
        paid_amount = COALESCE($2, paid_amount),
        paid_date = COALESCE($3, paid_date),
        payment_due_date = COALESCE($4, payment_due_date)
      WHERE id = $5
    `, [safeStatus, paidAmount, safePaidDate, safePaymentDueDate, req.params.id]);

    logAudit(req.user.id, req.user.name, `Обновлена отгрузка ${shipment.invoice_number}`, 'Отгрузка', shipment.id, req.ip);
    const updated = await db.get('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
    res.json(await buildShipment(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
