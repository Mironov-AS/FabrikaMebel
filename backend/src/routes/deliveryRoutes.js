const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildRoute(row) {
  if (!row) return null;
  const driver = row.driver_id ? db.prepare('SELECT * FROM drivers WHERE id = ?').get(row.driver_id) : null;
  const shipmentLinks = db.prepare('SELECT * FROM route_shipments WHERE route_id = ? ORDER BY delivery_order').all(row.id);
  const shipments = shipmentLinks.map(link => {
    const s = db.prepare('SELECT * FROM shipments WHERE id = ?').get(link.shipment_id);
    if (!s) return null;
    const items = db.prepare('SELECT * FROM shipment_items WHERE shipment_id = ?').all(s.id);
    const cp = s.counterparty_id ? db.prepare('SELECT * FROM counterparties WHERE id = ?').get(s.counterparty_id) : null;
    return {
      id: s.id,
      orderNumber: s.order_number,
      invoiceNumber: s.invoice_number,
      counterpartyName: cp?.name || '',
      counterpartyPhone: cp?.phone || '',
      deliveryAddress: s.delivery_address || cp?.address || '',
      deliveryOrder: link.delivery_order,
      items: items.map(i => ({ name: i.name, quantity: i.quantity })),
    };
  }).filter(Boolean);
  return {
    id: row.id,
    driverId: row.driver_id,
    driver,
    routeDate: row.route_date,
    status: row.status,
    notes: row.notes,
    shipments,
    createdAt: row.created_at,
  };
}

// GET /api/delivery-routes?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const { date } = req.query;
  const rows = date
    ? db.prepare('SELECT * FROM delivery_routes WHERE route_date = ? ORDER BY created_at DESC').all(date)
    : db.prepare('SELECT * FROM delivery_routes ORDER BY route_date DESC').all();
  res.json(rows.map(buildRoute));
});

// POST /api/delivery-routes
router.post('/', (req, res) => {
  const { driverId, routeDate, shipmentIds = [], notes } = req.body;
  if (!routeDate) return res.status(400).json({ error: 'Дата маршрута обязательна' });

  const result = db.prepare('INSERT INTO delivery_routes (driver_id, route_date, notes) VALUES (?, ?, ?)').run(driverId || null, routeDate, notes || null);
  const routeId = result.lastInsertRowid;

  shipmentIds.forEach((shipmentId, idx) => {
    db.prepare('INSERT INTO route_shipments (route_id, shipment_id, delivery_order) VALUES (?, ?, ?)').run(routeId, shipmentId, idx + 1);
  });

  res.status(201).json(buildRoute(db.prepare('SELECT * FROM delivery_routes WHERE id = ?').get(routeId)));
});

// PUT /api/delivery-routes/:id
router.put('/:id', (req, res) => {
  const { driverId, status, shipmentIds, notes } = req.body;
  db.prepare('UPDATE delivery_routes SET driver_id = COALESCE(?, driver_id), status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?')
    .run(driverId, status, notes, req.params.id);

  if (shipmentIds) {
    db.prepare('DELETE FROM route_shipments WHERE route_id = ?').run(req.params.id);
    shipmentIds.forEach((shipmentId, idx) => {
      db.prepare('INSERT INTO route_shipments (route_id, shipment_id, delivery_order) VALUES (?, ?, ?)').run(req.params.id, shipmentId, idx + 1);
    });
  }

  res.json(buildRoute(db.prepare('SELECT * FROM delivery_routes WHERE id = ?').get(req.params.id)));
});

module.exports = router;
