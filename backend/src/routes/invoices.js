const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { sanitizeStr } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function buildInvoice(row) {
  if (!row) return null;
  const installments = await db.all(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY paid_date ASC',
    [row.id]
  );
  return {
    id: row.id,
    orderId: row.order_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    amount: row.amount,
    paidAmount: row.paid_amount,
    status: row.status,
    dueDate: row.due_date,
    counterpartyId: row.counterparty_id,
    notes: row.notes,
    createdAt: row.created_at,
    isActive: row.is_active !== 0,
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

async function recalcInvoiceStatus(invoiceId) {
  const inv = await db.get('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
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
  await db.run('UPDATE invoices SET status = $1 WHERE id = $2', [status, invoiceId]);
  return status;
}

// POST /api/invoices/import — import paid invoices from accountant file (Excel/CSV)
router.post('/import', requireRole('admin', 'accountant', 'director'), uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const { buffer, originalname, mimetype } = req.file;
    const ext = (originalname || '').split('.').pop().toLowerCase();

    // Parse workbook
    let workbook;
    if (ext === 'csv' || mimetype === 'text/csv' || mimetype === 'text/plain') {
      workbook = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ error: 'Файл не содержит листов' });

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'Файл пустой или не содержит данных' });

    // Normalize column names: find invoice number, amount, date, notes columns
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    function findKey(candidates) {
      return keys.find(k => candidates.some(c => k.toLowerCase().replace(/\s+/g, '').includes(c)));
    }

    const numKey = findKey(['номерсчёт', 'номерсчет', 'счёт', 'счет', 'invoice', '№счёт', '№счет', 'номер']);
    const amtKey = findKey(['суммаоплат', 'суммапл', 'сумма', 'оплата', 'amount', 'payment']);
    const dateKey = findKey(['датаоплат', 'датапл', 'дата', 'date', 'paid']);
    const notesKey = findKey(['примечани', 'коммент', 'note', 'comment', 'описани']);

    if (!numKey) return res.status(400).json({ error: 'Не найдена колонка с номером счёта. Ожидаются заголовки: "Номер счёта", "Счёт", "Invoice" и т.п.' });
    if (!amtKey) return res.status(400).json({ error: 'Не найдена колонка с суммой оплаты. Ожидаются заголовки: "Сумма", "Сумма оплаты", "Amount" и т.п.' });
    if (!dateKey) return res.status(400).json({ error: 'Не найдена колонка с датой оплаты. Ожидаются заголовки: "Дата", "Дата оплаты", "Date" и т.п.' });

    const results = { processed: 0, skipped: 0, errors: [] };
    const updatedInvoiceIds = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2: 1 for header, 1 for 1-based

      const invoiceNumber = String(row[numKey] || '').trim();
      if (!invoiceNumber) continue; // skip empty rows

      const rawAmount = String(row[amtKey] || '').replace(/[^\d.,]/g, '').replace(',', '.');
      const amount = parseFloat(rawAmount);
      if (!amount || amount <= 0) {
        results.errors.push({ row: rowNum, invoiceNumber, error: 'Некорректная сумма оплаты' });
        results.skipped++;
        continue;
      }

      // Parse date: Excel serial number or string
      let paidDate;
      const rawDate = row[dateKey];
      if (typeof rawDate === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(rawDate);
        paidDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } else {
        const ds = String(rawDate || '').trim();
        // Try common Russian date formats: DD.MM.YYYY, YYYY-MM-DD
        const matchDMY = ds.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
        const matchYMD = ds.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
        if (matchDMY) {
          paidDate = `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
        } else if (matchYMD) {
          paidDate = `${matchYMD[1]}-${matchYMD[2].padStart(2, '0')}-${matchYMD[3].padStart(2, '0')}`;
        } else if (ds) {
          const parsed = new Date(ds);
          if (!isNaN(parsed)) {
            paidDate = parsed.toISOString().slice(0, 10);
          }
        }
      }

      if (!paidDate) {
        results.errors.push({ row: rowNum, invoiceNumber, error: 'Некорректная дата оплаты' });
        results.skipped++;
        continue;
      }

      const notes = notesKey ? sanitizeStr(String(row[notesKey] || '').trim()) : null;

      // Find invoice by number (active ones)
      const inv = await db.get(
        "SELECT * FROM invoices WHERE invoice_number = $1 AND is_active = 1",
        [invoiceNumber]
      );

      if (!inv) {
        results.errors.push({ row: rowNum, invoiceNumber, error: 'Счёт не найден в системе' });
        results.skipped++;
        continue;
      }

      if (inv.status === 'paid') {
        results.errors.push({ row: rowNum, invoiceNumber, error: 'Счёт уже полностью оплачен' });
        results.skipped++;
        continue;
      }

      const remaining = inv.amount - inv.paid_amount;
      const payAmount = Math.min(amount, remaining); // cap at remaining balance

      await db.run(
        `INSERT INTO payments (invoice_id, counterparty_id, amount, paid_date, status, invoice_number)
         VALUES ($1, $2, $3, $4, 'paid', $5)`,
        [inv.id, inv.counterparty_id || null, payAmount, paidDate, notes || 'Импорт от бухгалтера']
      );

      const newPaidAmount = inv.paid_amount + payAmount;
      await db.run('UPDATE invoices SET paid_amount = $1 WHERE id = $2', [newPaidAmount, inv.id]);
      const newStatus = await recalcInvoiceStatus(inv.id);

      if (newStatus === 'paid' && inv.order_id) {
        await db.run("UPDATE orders SET status = 'completed' WHERE id = $1 AND status NOT IN ('completed')", [inv.order_id]);
      }

      updatedInvoiceIds.add(inv.id);
      results.processed++;
    }

    logAudit(
      req.user.id, req.user.name,
      `Импорт оплат из файла: обработано ${results.processed}, пропущено ${results.skipped}`,
      'Финансы', null, req.ip
    );

    res.json({ ...results, totalRows: rows.length, updatedInvoiceIds: [...updatedInvoiceIds] });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM invoices ORDER BY created_at DESC');
    const invoices = await Promise.all(rows.map(buildInvoice));
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Счёт не найден' });
    res.json(await buildInvoice(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices — create invoice for an order
router.post('/', requireRole('admin', 'accountant', 'director', 'sales_manager'), async (req, res) => {
  try {
    const { orderId, invoiceNumber, invoiceDate, amount, dueDate, notes } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId обязателен' });
    if (!invoiceNumber) return res.status(400).json({ error: 'Номер счёта обязателен' });
    if (!invoiceDate) return res.status(400).json({ error: 'Дата счёта обязательна' });

    const order = await db.get('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const existing = await db.get('SELECT id FROM invoices WHERE order_id = $1 AND is_active = 1', [orderId]);
    if (existing) return res.status(400).json({ error: 'Активный счёт на этот заказ уже существует. Деактивируйте текущий счёт перед выставлением нового.' });

    const safeInvoiceNumber = sanitizeStr(invoiceNumber);
    const safeNotes = notes ? sanitizeStr(notes) : null;

    let resolvedDueDate = dueDate || null;
    if (!resolvedDueDate && order.contract_id) {
      const contract = await db.get('SELECT * FROM contracts WHERE id = $1', [order.contract_id]);
      if (contract && contract.payment_delay != null) {
        const base = new Date(invoiceDate);
        base.setDate(base.getDate() + contract.payment_delay);
        resolvedDueDate = base.toISOString().slice(0, 10);
      }
    }

    const invoiceAmount = amount != null ? amount : (order.total_amount || 0);

    const result = await db.runReturning(`
      INSERT INTO invoices (order_id, invoice_number, invoice_date, amount, paid_amount, status, due_date, counterparty_id, notes)
      VALUES ($1, $2, $3, $4, 0, 'pending', $5, $6, $7)
    `, [orderId, safeInvoiceNumber, invoiceDate, invoiceAmount, resolvedDueDate, order.counterparty_id || null, safeNotes]);

    logAudit(req.user.id, req.user.name, `Создан счёт ${safeInvoiceNumber} для заказа #${order.number}`, 'Счёт', result.lastInsertRowid, req.ip);
    const newInvoice = await db.get('SELECT * FROM invoices WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(await buildInvoice(newInvoice));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:id/deactivate
router.patch('/:id/deactivate', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const inv = await db.get('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Счёт не найден' });
    if (inv.is_active === 0) return res.status(400).json({ error: 'Счёт уже деактивирован' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Нельзя деактивировать полностью оплаченный счёт' });

    await db.run('UPDATE invoices SET is_active = 0 WHERE id = $1', [inv.id]);
    logAudit(req.user.id, req.user.name, `Деактивирован счёт ${inv.invoice_number} (заказ #${inv.order_id})`, 'Счёт', inv.id, req.ip);
    const updated = await db.get('SELECT * FROM invoices WHERE id = $1', [inv.id]);
    res.json(await buildInvoice(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id — update invoice
router.put('/:id', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const inv = await db.get('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Счёт не найден' });
    if (inv.is_active === 0) return res.status(400).json({ error: 'Нельзя редактировать деактивированный счёт' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Нельзя редактировать оплаченный счёт' });

    const { invoiceNumber, invoiceDate, dueDate, amount, notes } = req.body;
    const safeNum = invoiceNumber !== undefined ? sanitizeStr(invoiceNumber) : undefined;
    const safeNotes = notes !== undefined ? sanitizeStr(notes) : undefined;

    await db.run(`
      UPDATE invoices SET
        invoice_number = COALESCE($1, invoice_number),
        invoice_date = COALESCE($2, invoice_date),
        due_date = COALESCE($3, due_date),
        amount = COALESCE($4, amount),
        notes = COALESCE($5, notes)
      WHERE id = $6
    `, [safeNum, invoiceDate, dueDate, amount, safeNotes, req.params.id]);

    await recalcInvoiceStatus(req.params.id);
    const updated = await db.get('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    res.json(await buildInvoice(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/:id/payments — register a partial payment installment
router.post('/:id/payments', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const inv = await db.get('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Счёт не найден' });
    if (inv.is_active === 0) return res.status(400).json({ error: 'Нельзя добавить оплату к деактивированному счёту' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Счёт уже полностью оплачен' });

    const { amount, paidDate, notes } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Сумма оплаты должна быть больше 0' });
    if (!paidDate) return res.status(400).json({ error: 'Дата оплаты обязательна' });

    const payAmount = Number(amount);
    const remaining = inv.amount - inv.paid_amount;
    if (payAmount > remaining + 0.001) {
      return res.status(400).json({ error: `Сумма превышает остаток по счёту (${remaining.toFixed(2)} ₽)` });
    }

    const safeNotes = notes ? sanitizeStr(notes) : null;
    await db.run(`
      INSERT INTO payments (invoice_id, counterparty_id, amount, paid_date, status, invoice_number)
      VALUES ($1, $2, $3, $4, 'paid', $5)
    `, [inv.id, inv.counterparty_id || null, payAmount, paidDate, safeNotes]);

    const newPaidAmount = inv.paid_amount + payAmount;
    await db.run('UPDATE invoices SET paid_amount = $1 WHERE id = $2', [newPaidAmount, inv.id]);
    const newStatus = await recalcInvoiceStatus(inv.id);

    if (newStatus === 'paid' && inv.order_id) {
      await db.run("UPDATE orders SET status = 'completed' WHERE id = $1 AND status NOT IN ('completed')", [inv.order_id]);
    }

    logAudit(req.user.id, req.user.name, `Оплата ${payAmount} ₽ по счёту ${inv.invoice_number}`, 'Счёт', inv.id, req.ip);
    const updated = await db.get('SELECT * FROM invoices WHERE id = $1', [inv.id]);
    res.status(201).json(await buildInvoice(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id/payments/:paymentId — cancel a payment installment
router.delete('/:id/payments/:paymentId', requireRole('admin', 'accountant', 'director'), async (req, res) => {
  try {
    const inv = await db.get('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Счёт не найден' });

    const payment = await db.get('SELECT * FROM payments WHERE id = $1 AND invoice_id = $2', [req.params.paymentId, inv.id]);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    await db.run('DELETE FROM payments WHERE id = $1', [payment.id]);

    const newPaidAmount = Math.max(0, inv.paid_amount - payment.amount);
    await db.run('UPDATE invoices SET paid_amount = $1 WHERE id = $2', [newPaidAmount, inv.id]);
    await recalcInvoiceStatus(inv.id);

    if (inv.order_id) {
      await db.run("UPDATE orders SET status = 'shipped' WHERE id = $1 AND status = 'completed'", [inv.order_id]);
    }

    const updated = await db.get('SELECT * FROM invoices WHERE id = $1', [inv.id]);
    res.json(await buildInvoice(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
