const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

async function buildRoute(row) {
  if (!row) return null;
  const driver = row.driver_id ? await db.get('SELECT * FROM drivers WHERE id = $1', [row.driver_id]) : null;
  const shipmentLinks = await db.all('SELECT * FROM route_shipments WHERE route_id = $1 ORDER BY delivery_order', [row.id]);
  const shipments = (await Promise.all(shipmentLinks.map(async (link) => {
    const s = await db.get('SELECT * FROM shipments WHERE id = $1', [link.shipment_id]);
    if (!s) return null;
    const items = await db.all('SELECT * FROM shipment_items WHERE shipment_id = $1', [s.id]);
    const cp = s.counterparty_id ? await db.get('SELECT * FROM counterparties WHERE id = $1', [s.counterparty_id]) : null;
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
  }))).filter(Boolean);
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
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const rows = date
      ? await db.all('SELECT * FROM delivery_routes WHERE route_date = $1 ORDER BY created_at DESC', [date])
      : await db.all('SELECT * FROM delivery_routes ORDER BY route_date DESC');
    const routes = await Promise.all(rows.map(buildRoute));
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery-routes
router.post('/', async (req, res) => {
  try {
    const { driverId, routeDate, shipmentIds = [], notes } = req.body;
    if (!routeDate) return res.status(400).json({ error: 'Дата маршрута обязательна' });

    const result = await db.runReturning(
      'INSERT INTO delivery_routes (driver_id, route_date, notes) VALUES ($1, $2, $3)',
      [driverId || null, routeDate, notes || null]
    );
    const routeId = result.lastInsertRowid;

    for (let idx = 0; idx < shipmentIds.length; idx++) {
      await db.run(
        'INSERT INTO route_shipments (route_id, shipment_id, delivery_order) VALUES ($1, $2, $3)',
        [routeId, shipmentIds[idx], idx + 1]
      );
    }

    const newRoute = await db.get('SELECT * FROM delivery_routes WHERE id = $1', [routeId]);
    res.status(201).json(await buildRoute(newRoute));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/delivery-routes/:id
router.put('/:id', async (req, res) => {
  try {
    const { driverId, status, shipmentIds, notes } = req.body;
    await db.run(
      'UPDATE delivery_routes SET driver_id = COALESCE($1, driver_id), status = COALESCE($2, status), notes = COALESCE($3, notes) WHERE id = $4',
      [driverId, status, notes, req.params.id]
    );

    if (shipmentIds) {
      await db.run('DELETE FROM route_shipments WHERE route_id = $1', [req.params.id]);
      for (let idx = 0; idx < shipmentIds.length; idx++) {
        await db.run(
          'INSERT INTO route_shipments (route_id, shipment_id, delivery_order) VALUES ($1, $2, $3)',
          [req.params.id, shipmentIds[idx], idx + 1]
        );
      }
    }

    const updated = await db.get('SELECT * FROM delivery_routes WHERE id = $1', [req.params.id]);
    res.json(await buildRoute(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
