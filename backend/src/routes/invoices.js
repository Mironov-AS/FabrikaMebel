const express = require('express');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

function buildInvoice(row) {
  if (!row) return null;
  const installments = db.prepare(
    'SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_date ASC'
  ).all(row.id);
  return {
    id: row.id,
    orderId: row.order_id,
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    paidAmount: row.paid_amount,
    status: row.status,
    dueDate: row.due_date,
    counterpartyId: row.counterparty_id,
    notes: row.notes,
    createdAt: row.created_at,
    installments: installments.map(buildInstallment),
  };
}

function buildInstallment(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: row.amount,
    paidDate: row.paid_date,
    status: row.status,
    notes: row.invoice_number, // reuse invoice_number field for notes on installment
  };
}

function recalcInvoiceStatus(invoiceId) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!inv) return;
  let status;
  if (inv.paid_amount >= inv.amount && inv.amount > 0) {
    status = 'paid';
  } else if (inv.due_date && new Date(inv.due_date) < new Date() && inv.paid_amount < inv.amount) {
    status = 'overdue';
  } else if (inv.paid_amount > 0) {
    status = 'partial';
  } else {
    status = 'pending';
  }
  db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, invoiceId);
  return status;
}

// GET /api/invoices
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
  res.json(rows.map(buildInvoice));
});

// GET /api/invoices/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Счёт не найден' });
  res.json(buildInvoice(row));
});

// POST /api/invoices — create invoice for an order
router.post('/', requireRole('admin', 'accountant', 'director', 'sales_manager'), (req, res) => {
  const { orderId, invoiceNumber, amount, dueDate, notes } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId обязателен' });
  if (!invoiceNumber) return res.status(400).json({ error: 'Номер счёта обязателен' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  // Only one invoice per order
  const existing = db.prepare('SELECT id FROM invoices WHERE order_id = ?').get(orderId);
  if (existing) return res.status(400).json({ error: 'Счёт на этот заказ уже существует' });

  const safeInvoiceNumber = sanitizeStr(invoiceNumber);
  const safeNotes = notes ? sanitizeStr(notes) : null;

  // Auto-calculate due_date from contract.payment_delay if not provided
  let resolvedDueDate = dueDate || null;
  if (!resolvedDueDate && order.contract_id && order.date) {
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(order.contract_id);
    if (contract && contract.payment_delay != null) {
      const orderDate = new Date(order.date);
      orderDate.setDate(orderDate.getDate() + contract.payment_delay);
      resolvedDueDate = orderDate.toISOString().slice(0, 10);
    }
  }

  const invoiceAmount = amount != null ? amount : (order.total_amount || 0);

  const result = db.prepare(`
    INSERT INTO invoices (order_id, invoice_number, amount, paid_amount, status, due_date, counterparty_id, notes)
    VALUES (?, ?, ?, 0, 'pending', ?, ?, ?)
  `).run(orderId, safeInvoiceNumber, invoiceAmount, resolvedDueDate, order.counterparty_id || null, safeNotes);

  logAudit(req.user.id, req.user.name, `Создан счёт ${safeInvoiceNumber} для заказа #${order.number}`, 'Счёт', result.lastInsertRowid, req.ip);
  res.status(201).json(buildInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid)));
});

// PUT /api/invoices/:id — update invoice (number, dueDate, amount, notes)
router.put('/:id', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Счёт не найден' });
  if (inv.status === 'paid') return res.status(400).json({ error: 'Нельзя редактировать оплаченный счёт' });

  const { invoiceNumber, dueDate, amount, notes } = req.body;
  const safeNum = invoiceNumber !== undefined ? sanitizeStr(invoiceNumber) : undefined;
  const safeNotes = notes !== undefined ? sanitizeStr(notes) : undefined;

  db.prepare(`
    UPDATE invoices SET
      invoice_number = COALESCE(?, invoice_number),
      due_date = COALESCE(?, due_date),
      amount = COALESCE(?, amount),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(safeNum, dueDate, amount, safeNotes, req.params.id);

  recalcInvoiceStatus(req.params.id);
  res.json(buildInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)));
});

// POST /api/invoices/:id/payments — register a partial payment installment
router.post('/:id/payments', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Счёт не найден' });
  if (inv.status === 'paid') return res.status(400).json({ error: 'Счёт уже полностью оплачен' });

  const { amount, paidDate, notes } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Сумма оплаты должна быть больше 0' });
  if (!paidDate) return res.status(400).json({ error: 'Дата оплаты обязательна' });

  const payAmount = Number(amount);
  const remaining = inv.amount - inv.paid_amount;
  if (payAmount > remaining + 0.001) {
    return res.status(400).json({ error: `Сумма превышает остаток по счёту (${remaining.toFixed(2)} ₽)` });
  }

  // Create payment installment record
  const safeNotes = notes ? sanitizeStr(notes) : null;
  const installResult = db.prepare(`
    INSERT INTO payments (invoice_id, counterparty_id, amount, paid_date, status, invoice_number)
    VALUES (?, ?, ?, ?, 'paid', ?)
  `).run(inv.id, inv.counterparty_id || null, payAmount, paidDate, safeNotes);

  // Update invoice paid_amount
  const newPaidAmount = inv.paid_amount + payAmount;
  db.prepare('UPDATE invoices SET paid_amount = ? WHERE id = ?').run(newPaidAmount, inv.id);
  const newStatus = recalcInvoiceStatus(inv.id);

  // If invoice fully paid → move order to 'completed'
  if (newStatus === 'paid' && inv.order_id) {
    db.prepare("UPDATE orders SET status = 'completed' WHERE id = ? AND status NOT IN ('completed')").run(inv.order_id);
  }

  logAudit(req.user.id, req.user.name, `Оплата ${payAmount} ₽ по счёту ${inv.invoice_number}`, 'Счёт', inv.id, req.ip);
  res.status(201).json(buildInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id)));
});

// DELETE /api/invoices/:id/payments/:paymentId — cancel a payment installment
router.delete('/:id/payments/:paymentId', requireRole('admin', 'accountant', 'director'), (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Счёт не найден' });

  const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND invoice_id = ?').get(req.params.paymentId, inv.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  db.prepare('DELETE FROM payments WHERE id = ?').run(payment.id);

  const newPaidAmount = Math.max(0, inv.paid_amount - payment.amount);
  db.prepare('UPDATE invoices SET paid_amount = ? WHERE id = ?').run(newPaidAmount, inv.id);
  recalcInvoiceStatus(inv.id);

  // Revert order status if it was completed
  if (inv.order_id) {
    db.prepare("UPDATE orders SET status = 'shipped' WHERE id = ? AND status = 'completed'").run(inv.order_id);
  }

  res.json(buildInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id)));
});

module.exports = router;
