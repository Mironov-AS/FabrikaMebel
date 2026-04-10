const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildOrder(row) {
  if (!row) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(row.id);
  return {
    ...row,
    contractId: row.contract_id,
    counterpartyId: row.counterparty_id,
    shipmentDeadline: row.shipment_deadline,
    totalAmount: row.total_amount,
    specification: items.map(i => ({
      id: i.id,
      name: i.name,
      article: i.article,
      quantity: i.quantity,
      price: i.price,
      category: i.category,
      status: i.status,
      shipped: i.shipped,
    })),
  };
}

// GET /api/orders
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(rows.map(buildOrder));
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(buildOrder(row));
});

// POST /api/orders
router.post('/', requireRole('admin', 'sales_manager', 'director'), (req, res) => {
  const { number, contractId, counterpartyId, date, shipmentDeadline, priority, status, totalAmount, notes, specification = [] } = req.body;
  if (!number) return res.status(400).json({ error: 'Номер заказа обязателен' });

  const computedTotal = specification.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
  const resolvedTotal = computedTotal > 0 ? computedTotal : (totalAmount || 0);

  const result = db.prepare(`
    INSERT INTO orders (number, contract_id, counterparty_id, date, shipment_deadline, priority, status, total_amount, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(number, contractId || null, counterpartyId || null, date, shipmentDeadline, priority || 'medium', status || 'planned', resolvedTotal, notes || null, req.user.id);

  const orderId = result.lastInsertRowid;
  for (const item of specification) {
    db.prepare(`
      INSERT INTO order_items (order_id, name, article, quantity, price, category, status, shipped)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, item.name, item.article || null, item.quantity || 0, item.price || 0, item.category || null, item.status || 'planned', item.shipped || 0);
  }

  logAudit(req.user.id, req.user.name, `Создан заказ ${number}`, 'Заказ', orderId, req.ip);
  res.status(201).json(buildOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)));
});

// PUT /api/orders/:id/items/:itemId
router.put('/:id/items/:itemId', requireRole('admin', 'sales_manager', 'director', 'production_head', 'production_specialist'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Позиция заказа не найдена' });

  const { name, article, quantity, price, category, status, shipped } = req.body;

  db.prepare(`
    UPDATE order_items SET
      name = COALESCE(?, name),
      article = COALESCE(?, article),
      quantity = COALESCE(?, quantity),
      price = COALESCE(?, price),
      category = COALESCE(?, category),
      status = COALESCE(?, status),
      shipped = COALESCE(?, shipped)
    WHERE id = ?
  `).run(name, article, quantity, price, category, status, shipped, req.params.itemId);

  logAudit(req.user.id, req.user.name, `Изменена позиция заказа ${order.number}`, 'Заказ', order.id, req.ip);
  res.json(buildOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)));
});

// PUT /api/orders/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head', 'production_specialist'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const { number, contractId, counterpartyId, date, shipmentDeadline, priority, status, totalAmount, notes, specification } = req.body;

  db.prepare(`
    UPDATE orders SET
      number = COALESCE(?, number),
      contract_id = COALESCE(?, contract_id),
      counterparty_id = COALESCE(?, counterparty_id),
      date = COALESCE(?, date),
      shipment_deadline = COALESCE(?, shipment_deadline),
      priority = COALESCE(?, priority),
      status = COALESCE(?, status),
      total_amount = COALESCE(?, total_amount),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(number, contractId, counterpartyId, date, shipmentDeadline, priority, status, totalAmount, notes, req.params.id);

  if (specification !== undefined) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
    for (const item of specification) {
      db.prepare(`
        INSERT INTO order_items (order_id, name, article, quantity, price, category, status, shipped)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.params.id, item.name, item.article || null, item.quantity || 0, item.price || 0, item.category || null, item.status || 'planned', item.shipped || 0);
    }
    if (totalAmount === undefined) {
      const specTotal = specification.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
      db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(specTotal, req.params.id);
    }
  }

  logAudit(req.user.id, req.user.name, `Изменён заказ ${order.number}`, 'Заказ', order.id, req.ip);
  res.json(buildOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)));
});

// DELETE /api/orders/:id — admin only
router.delete('/:id', requireRole('admin'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.name, `Удалён заказ ${order.number}`, 'Заказ', order.id, req.ip);
  res.json({ message: 'Заказ удалён' });
});

module.exports = router;
