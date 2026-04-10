const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { clamp } = require('../middleware/validate');

const VALID_TASK_STATUSES = ['planned', 'in_progress', 'done'];

const router = express.Router();
router.use(authenticate);

function buildTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    name: row.name,
    lineId: row.line_id,
    start: row.start_date,
    end: row.end_date,
    progress: row.progress,
    status: row.status,
    responsible: row.responsible,
    priority: row.priority,
    color: row.color,
  };
}

// GET /api/production/tasks
router.get('/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM production_tasks ORDER BY start_date').all();
  res.json(rows.map(buildTask));
});

// GET /api/production/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM production_tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Задача не найдена' });
  res.json(buildTask(row));
});

// POST /api/production/tasks
router.post('/tasks', requireRole('admin', 'production_head', 'director'), (req, res) => {
  const { orderId, orderNumber, name, lineId, start, end, progress, status, responsible, priority, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Название задачи обязательно' });

  if (status !== undefined && !VALID_TASK_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_TASK_STATUSES.join(', ')}` });
  }

  const safeProgress = clamp(progress ?? 0, 0, 100);

  const result = db.prepare(`
    INSERT INTO production_tasks (order_id, order_number, name, line_id, start_date, end_date, progress, status, responsible, priority, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orderId || null, orderNumber || null, name, lineId || null, start, end, safeProgress, status || 'planned', responsible || null, priority || 'medium', color || '#3b82f6');

  logAudit(req.user.id, req.user.name, `Создана производственная задача: ${name}`, 'Производство', result.lastInsertRowid, req.ip);
  res.status(201).json(buildTask(db.prepare('SELECT * FROM production_tasks WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/production/tasks/:id
router.put('/tasks/:id', requireRole('admin', 'production_head', 'production_specialist', 'director'), (req, res) => {
  const task = db.prepare('SELECT * FROM production_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задача не найдена' });

  const { name, lineId, start, end, progress, status, responsible, priority, color } = req.body;

  if (status !== undefined && !VALID_TASK_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_TASK_STATUSES.join(', ')}` });
  }

  const safeProgress = progress !== undefined ? clamp(progress, 0, 100) : undefined;

  db.prepare(`
    UPDATE production_tasks SET
      name = COALESCE(?, name),
      line_id = COALESCE(?, line_id),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      progress = COALESCE(?, progress),
      status = COALESCE(?, status),
      responsible = COALESCE(?, responsible),
      priority = COALESCE(?, priority),
      color = COALESCE(?, color)
    WHERE id = ?
  `).run(name, lineId, start, end, safeProgress, status, responsible, priority, color, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлена задача производства: ${task.name}`, 'Производство', task.id, req.ip);
  res.json(buildTask(db.prepare('SELECT * FROM production_tasks WHERE id = ?').get(req.params.id)));
});

// GET /api/production/orders — orders in production pipeline
router.get('/orders', (req, res) => {
  const rows = db.prepare(`
    SELECT
      o.*,
      c.number AS contract_number,
      c.payment_delay,
      cp.name AS counterparty_name
    FROM orders o
    LEFT JOIN contracts c ON o.contract_id = c.id
    LEFT JOIN counterparties cp ON o.counterparty_id = cp.id
    WHERE o.status IN ('planned', 'in_production')
    ORDER BY o.created_at DESC
  `).all();

  const items = {};
  for (const row of rows) {
    items[row.id] = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(row.id);
  }

  res.json(rows.map(row => ({
    id: row.id,
    number: row.number,
    date: row.date,
    status: row.status,
    priority: row.priority,
    shipmentDeadline: row.shipment_deadline,
    totalAmount: row.total_amount,
    notes: row.notes,
    contractId: row.contract_id,
    contractNumber: row.contract_number,
    paymentDelay: row.payment_delay,
    counterpartyId: row.counterparty_id,
    counterpartyName: row.counterparty_name,
    specification: (items[row.id] || []).map(i => ({
      id: i.id,
      name: i.name,
      article: i.article,
      quantity: i.quantity,
      price: i.price,
      category: i.category,
      status: i.status,
      shipped: i.shipped,
    })),
  })));
});

// PUT /api/production/orders/:id/ready — mark order as ready_for_shipment
router.put('/orders/:id/ready', requireRole('admin', 'production_head', 'production_specialist', 'director'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  db.prepare("UPDATE orders SET status = 'ready_for_shipment' WHERE id = ?").run(req.params.id);

  logAudit(req.user.id, req.user.name, `Заказ ${order.number} готов к отгрузке`, 'Заказ', order.id, req.ip);
  res.json({ message: 'Заказ помечен как готов к отгрузке', orderId: order.id, status: 'ready_for_shipment' });
});

// PUT /api/production/orders/:id/items/:itemId — update order item status
router.put('/orders/:id/items/:itemId', requireRole('admin', 'production_head', 'production_specialist'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Позиция заказа не найдена' });

  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Статус обязателен' });

  const validStatuses = ['planned', 'in_production', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${validStatuses.join(', ')}` });
  }

  db.prepare('UPDATE order_items SET status = ? WHERE id = ?').run(status, req.params.itemId);

  logAudit(req.user.id, req.user.name, `Обновлён статус позиции заказа ${order.number}: ${status}`, 'Заказ', order.id, req.ip);
  res.json({
    id: item.id,
    orderId: order.id,
    name: item.name,
    article: item.article,
    quantity: item.quantity,
    price: item.price,
    category: item.category,
    status,
    shipped: item.shipped,
  });
});

// GET /api/production/lines
router.get('/lines', (req, res) => {
  res.json([
    { id: 1, name: 'Линия А (корпусная)', capacity: 120, type: 'corpus', shifts: 2 },
    { id: 2, name: 'Линия Б (мягкая)', capacity: 60, type: 'soft', shifts: 2 },
    { id: 3, name: 'Линия В (столярка)', capacity: 80, type: 'woodwork', shifts: 1 },
    { id: 4, name: 'Сборочный цех', capacity: 200, type: 'assembly', shifts: 2 },
  ]);
});

module.exports = router;
