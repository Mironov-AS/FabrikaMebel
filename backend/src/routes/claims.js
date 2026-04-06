const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildClaim(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    contractId: row.contract_id,
    shipmentId: row.shipment_id,
    counterpartyId: row.counterparty_id,
    specItemId: row.order_item_id,
    date: row.date,
    deadline: row.deadline,
    description: row.description,
    status: row.status,
    responsible: row.responsible,
    resolution: row.resolution,
    pausePayments: !!row.pause_payments,
    affectedPaymentId: row.affected_payment_id,
  };
}

// GET /api/claims
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM claims ORDER BY created_at DESC').all();
  res.json(rows.map(buildClaim));
});

// GET /api/claims/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Рекламация не найдена' });
  res.json(buildClaim(row));
});

// POST /api/claims
router.post('/', requireRole('admin', 'sales_manager', 'director', 'production_head'), (req, res) => {
  const { number, contractId, shipmentId, counterpartyId, specItemId, date, deadline, description, responsible, pausePayments, affectedPaymentId } = req.body;
  if (!number) return res.status(400).json({ error: 'Номер рекламации обязателен' });

  const result = db.prepare(`
    INSERT INTO claims (number, contract_id, shipment_id, counterparty_id, order_item_id, date, deadline, description, status, responsible, pause_payments, affected_payment_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
  `).run(number, contractId || null, shipmentId || null, counterpartyId || null, specItemId || null, date, deadline || null, description, responsible || null, pausePayments ? 1 : 0, affectedPaymentId || null, req.user.id);

  logAudit(req.user.id, req.user.name, `Создана рекламация ${number}`, 'Рекламация', result.lastInsertRowid, req.ip);
  res.status(201).json(buildClaim(db.prepare('SELECT * FROM claims WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/claims/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head', 'production_specialist'), (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Рекламация не найдена' });

  const { status, resolution, responsible, pausePayments, deadline } = req.body;

  db.prepare(`
    UPDATE claims SET
      status = COALESCE(?, status),
      resolution = COALESCE(?, resolution),
      responsible = COALESCE(?, responsible),
      pause_payments = COALESCE(?, pause_payments),
      deadline = COALESCE(?, deadline)
    WHERE id = ?
  `).run(status, resolution, responsible, pausePayments !== undefined ? (pausePayments ? 1 : 0) : null, deadline, req.params.id);

  logAudit(req.user.id, req.user.name, `Обновлена рекламация ${claim.number}`, 'Рекламация', claim.id, req.ip);
  res.json(buildClaim(db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id)));
});

module.exports = router;
