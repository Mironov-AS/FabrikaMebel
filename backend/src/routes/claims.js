const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr } = require('../middleware/validate');

const VALID_CLAIM_STATUSES = ['open', 'in_review', 'resolved', 'closed'];

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
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM claims ORDER BY created_at DESC');
    res.json(rows.map(buildClaim));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/claims/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM claims WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Рекламация не найдена' });
    res.json(buildClaim(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/claims
router.post('/', requireRole('admin', 'sales_manager', 'director', 'production_head'), async (req, res) => {
  try {
    const { number, contractId, shipmentId, counterpartyId, specItemId, date, deadline, description, responsible, pausePayments, affectedPaymentId } = req.body;
    if (!number) return res.status(400).json({ error: 'Номер рекламации обязателен' });

    const result = await db.runReturning(`
      INSERT INTO claims (number, contract_id, shipment_id, counterparty_id, order_item_id, date, deadline, description, status, responsible, pause_payments, affected_payment_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, $11, $12)
    `, [sanitizeStr(number), contractId || null, shipmentId || null, counterpartyId || null, specItemId || null, date, deadline || null, description ? sanitizeStr(description) : null, responsible || null, pausePayments ? 1 : 0, affectedPaymentId || null, req.user.id]);

    logAudit(req.user.id, req.user.name, `Создана рекламация ${number}`, 'Рекламация', result.lastInsertRowid, req.ip);
    const newClaim = await db.get('SELECT * FROM claims WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(buildClaim(newClaim));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/claims/:id
router.put('/:id', requireRole('admin', 'sales_manager', 'director', 'production_head', 'production_specialist'), async (req, res) => {
  try {
    const claim = await db.get('SELECT * FROM claims WHERE id = $1', [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Рекламация не найдена' });

    const { status, resolution, responsible, pausePayments, deadline } = req.body;

    if (status !== undefined && !VALID_CLAIM_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимый статус. Допустимые значения: ${VALID_CLAIM_STATUSES.join(', ')}` });
    }

    await db.run(`
      UPDATE claims SET
        status = COALESCE($1, status),
        resolution = COALESCE($2, resolution),
        responsible = COALESCE($3, responsible),
        pause_payments = COALESCE($4, pause_payments),
        deadline = COALESCE($5, deadline)
      WHERE id = $6
    `, [status, resolution ? sanitizeStr(resolution) : resolution, responsible, pausePayments !== undefined ? (pausePayments ? 1 : 0) : null, deadline, req.params.id]);

    logAudit(req.user.id, req.user.name, `Обновлена рекламация ${claim.number}`, 'Рекламация', claim.id, req.ip);
    const updated = await db.get('SELECT * FROM claims WHERE id = $1', [req.params.id]);
    res.json(buildClaim(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
