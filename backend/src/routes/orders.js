const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr, checkLengths } = require('../middleware/validate');

const VALID_ORDER_STATUSES = ['planned', 'in_production', 'ready_for_shipment', 'scheduled_for_shipment', 'shipped', 'completed'];

function validateItems(specification) {
  for (const item of specification) {
    if (item.quantity !== undefined && item.quantity <= 0) {
      return 'Количество должно быть положительным числом';
    }
    if (item.price !== undefined && item.price < 0) {
      return 'Цена не может быть отрицательной';
    }
  }
  return null;
}

const router = express.Router();
router.use(authenticate);

async function buildOrder(row) {
  if (!row) return null;
  const items = await db.all('SELECT * FROM order_items WHERE order_id = $1', [row.id]);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    date: row.date,
    priority: row.priority,
    notes: row.notes,
    contractId: row.contract_id,
    counterpartyId: row.counterparty_id,
    shipmentDeadline: row.shipment_deadline,
    totalAmount: row.total_amount,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = await Promise.all(rows.map(buildOrder));
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Заказ не найден' });
    res.json(await buildOrder(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
router.post('/', requireRole('admin', 'sales_manager', 'director'), async (req, res) => {
  try {
    const { number, contractId, counterpartyId, date, shipmentDeadline, priority, status, totalAmount, notes, specification = [] } = req.body;
    if (!number) return res.status(400).json({ error: 'Номер заказа обязателен' });

    if (status !== undefined && !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_ORDER_STATUSES.join(', ')}` });
    }

    const itemsErr = validateItems(specification);
    if (itemsErr) return res.status(400).json({ error: itemsErr });

    const safeNumber = sanitizeStr(number);
    const lenErr = checkLengths({ 'Номер заказа': safeNumber, ...(notes ? { 'Примечания': sanitizeStr(notes) } : {}) }, 500);
    if (lenErr) return res.status(400).json({ error: lenErr });

    const computedTotal = specification.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
    const resolvedTotal = computedTotal > 0 ? computedTotal : (totalAmount || 0);

    const result = await db.runReturning(`
      INSERT INTO orders (number, contract_id, counterparty_id, date, shipment_deadline, priority, status, total_amount, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [safeNumber, contractId || null, counterpartyId || null, date, shipmentDeadline, priority || 'medium', status || 'planned', resolvedTotal, notes ? sanitizeStr(notes) : null, req.user.id]);

    const orderId = result.lastInsertRowid;
    for (const item of specification) {
      await db.run(`
        INSERT INTO order_items (order_id, name, article, quantity, price, category, status, shipped)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [orderId, item.name, item.article || null, item.quantity || 0, item.price || 0, item.category || null, item.status || 'planned', item.shipped || 0]);
    }

    logAudit(req.user.id, req.user.name, `Создан заказ ${number}`, 'Заказ', orderId, req.ip);
    const newOrder = await db.get('SELECT * FROM orders WHERE id = $1', [orderId]);
    res.status(201).json(await buildOrder(newOrder));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/items/:itemId
router.put('/:id/items/:itemId', requireRole('admin', 'sales_manager', 'director', 'production_head', 'production_specialist'), async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const item = await db.get('SELECT * FROM order_items WHERE id = $1 AND order_id = $2', [req.params.itemId, req.params.id]);
    if (!item) return res.status(404).json({ error: 'Позиция заказа не найдена' });

    const { name, article, quantity, price, category, status, shipped } = req.body;

    await db.run(`
      UPDATE order_items SET
        name = COALESCE($1, name),
        article = COALESCE($2, article),
        quantity = COALESCE($3, quantity),
        price = COALESCE($4, price),
        category = COALESCE($5, category),
        status = COALESCE($6, status),
        shipped = COALESCE($7, shipped)
      WHERE id = $8
    `, [name, article, quantity, price, category, status, shipped, req.params.itemId]);

    logAudit(req.user.id, req.user.name, `Изменена позиция заказа ${order.number}`, 'Заказ', order.id, req.ip);
    const updatedOrder = await db.get('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    res.json(await buildOrder(updatedOrder));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head', 'production_specialist'), async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const { number, contractId, counterpartyId, date, shipmentDeadline, priority, status, totalAmount, notes, specification } = req.body;

    if (status !== undefined && !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_ORDER_STATUSES.join(', ')}` });
    }

    if (specification !== undefined) {
      const itemsErr = validateItems(specification);
      if (itemsErr) return res.status(400).json({ error: itemsErr });
    }

    const safeNumber = number !== undefined ? sanitizeStr(number) : undefined;

    await db.run(`
      UPDATE orders SET
        number = COALESCE($1, number),
        contract_id = COALESCE($2, contract_id),
        counterparty_id = COALESCE($3, counterparty_id),
        date = COALESCE($4, date),
        shipment_deadline = COALESCE($5, shipment_deadline),
        priority = COALESCE($6, priority),
        status = COALESCE($7, status),
        total_amount = COALESCE($8, total_amount),
        notes = COALESCE($9, notes)
      WHERE id = $10
    `, [safeNumber, contractId, counterpartyId, date, shipmentDeadline, priority, status, totalAmount, notes !== undefined ? sanitizeStr(notes) : undefined, req.params.id]);

    if (specification !== undefined) {
      await db.run('DELETE FROM order_items WHERE order_id = $1', [req.params.id]);
      for (const item of specification) {
        await db.run(`
          INSERT INTO order_items (order_id, name, article, quantity, price, category, status, shipped)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [req.params.id, item.name, item.article || null, item.quantity || 0, item.price || 0, item.category || null, item.status || 'planned', item.shipped || 0]);
      }
      if (totalAmount === undefined) {
        const specTotal = specification.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
        await db.run('UPDATE orders SET total_amount = $1 WHERE id = $2', [specTotal, req.params.id]);
      }
    }

    logAudit(req.user.id, req.user.name, `Изменён заказ ${order.number}`, 'Заказ', order.id, req.ip);
    const updatedOrder = await db.get('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    res.json(await buildOrder(updatedOrder));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orders/:id — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    await db.run('DELETE FROM orders WHERE id = $1', [req.params.id]);
    logAudit(req.user.id, req.user.name, `Удалён заказ ${order.number}`, 'Заказ', order.id, req.ip);
    res.json({ message: 'Заказ удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
