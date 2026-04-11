const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY не задан в .env');

  // Support OpenRouter keys (sk-or-v1-...) via compatible API endpoint
  const isOpenRouter = apiKey.startsWith('sk-or-v1-');
  const options = { apiKey };
  if (isOpenRouter) {
    // Anthropic SDK appends /v1 automatically, so base = /api (not /api/v1)
    options.baseURL = 'https://openrouter.ai/api';
    options.defaultHeaders = {
      'HTTP-Referer': 'https://contractpro.local',
      'X-Title': 'ContractPro AI Assistant',
    };
  }
  return new Anthropic.default(options);
}

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);

  const counterparties = db.prepare('SELECT * FROM counterparties ORDER BY name').all();

  const contracts = db.prepare(`
    SELECT c.id, c.number, c.status, c.amount, c.date, c.valid_until, c.subject,
           c.payment_delay, c.penalty_rate, cp.name AS counterparty_name
    FROM contracts c
    LEFT JOIN counterparties cp ON c.counterparty_id = cp.id
    ORDER BY c.date DESC
  `).all();

  const orders = db.prepare(`
    SELECT o.id, o.number, o.status, o.total_amount, o.date, o.shipment_deadline, o.priority,
           c.number AS contract_number, cp.name AS counterparty_name
    FROM orders o
    LEFT JOIN contracts c ON o.contract_id = c.id
    LEFT JOIN counterparties cp ON o.counterparty_id = cp.id
    ORDER BY o.date DESC
  `).all();

  const payments = db.prepare(`
    SELECT p.id, p.amount, p.due_date, p.paid_date, p.status,
           p.invoice_number, p.penalty_days, p.penalty_amount,
           cp.name AS counterparty_name
    FROM payments p
    LEFT JOIN counterparties cp ON p.counterparty_id = cp.id
    ORDER BY p.due_date DESC
  `).all();

  const shipments = db.prepare(`
    SELECT s.id, s.order_number, s.date, s.invoice_number, s.amount,
           s.status, s.payment_due_date, s.paid_amount, s.paid_date,
           cp.name AS counterparty_name
    FROM shipments s
    LEFT JOIN counterparties cp ON s.counterparty_id = cp.id
    ORDER BY s.date DESC
  `).all();

  const claims = db.prepare(`
    SELECT cl.id, cl.number, cl.date, cl.deadline, cl.description,
           cl.status, cl.responsible, cl.resolution,
           c.number AS contract_number, cp.name AS counterparty_name
    FROM claims cl
    LEFT JOIN contracts c ON cl.contract_id = c.id
    LEFT JOIN counterparties cp ON cl.counterparty_id = cp.id
    ORDER BY cl.date DESC
  `).all();

  const statusLabels = {
    // contracts
    active: 'активен', completed: 'выполнен', suspended: 'приостановлен', draft: 'черновик',
    // orders
    planned: 'запланирован', in_production: 'в производстве',
    ready_for_shipment: 'готов к отгрузке', shipped: 'отгружен',
    // payments
    paid: 'оплачен', overdue: 'просрочен', pending: 'ожидает оплаты',
    // claims
    open: 'открыта', in_review: 'на рассмотрении', resolved: 'решена', closed: 'закрыта',
    // priority
    high: 'высокий', medium: 'средний', low: 'низкий',
  };
  const t = (v) => statusLabels[v] || v || '—';
  const rub = (v) => v != null ? `${Number(v).toLocaleString('ru-RU')} ₽` : '—';

  // Key metrics for quick overview
  const overduePayments = payments.filter(p => p.status === 'overdue');
  const overdueTotal = overduePayments.reduce((s, p) => s + (p.amount || 0), 0);
  const activeContracts = contracts.filter(c => c.status === 'active');
  const openClaims = claims.filter(c => c.status === 'open' || c.status === 'in_review');
  const upcomingShipments = orders.filter(o =>
    o.status !== 'completed' && o.status !== 'shipped' && o.shipment_deadline &&
    new Date(o.shipment_deadline) >= new Date(today)
  ).sort((a, b) => new Date(a.shipment_deadline) - new Date(b.shipment_deadline));

  return `Ты — ИИ-ассистент системы управления договорами ContractPro.
Помогаешь сотрудникам находить информацию по клиентам, договорам, заказам, платежам, отгрузкам и рекламациям.
Отвечай на русском языке, чётко и по существу. Используй маркированные списки и структуру там, где это улучшает читаемость.
При ответе опирайся ТОЛЬКО на данные ниже. Если данных нет — так и скажи.
Сегодняшняя дата: ${today}

=== СВОДКА ===
- Активных договоров: ${activeContracts.length}, на сумму ${rub(activeContracts.reduce((s, c) => s + (c.amount || 0), 0))}
- Просроченных платежей: ${overduePayments.length}${overduePayments.length ? `, общая сумма ${rub(overdueTotal)}` : ''}
- Открытых рекламаций: ${openClaims.length}
- Ближайший срок отгрузки: ${upcomingShipments[0] ? `Заказ №${upcomingShipments[0].number} до ${upcomingShipments[0].shipment_deadline}` : 'нет'}

=== ДАННЫЕ СИСТЕМЫ ===

## КОНТРАГЕНТЫ (${counterparties.length})
${counterparties.map(c =>
  `- ${c.name} | ИНН: ${c.inn || '—'} | Тел: ${c.phone || '—'} | Email: ${c.email || '—'} | Приоритет: ${t(c.priority)}`
).join('\n') || 'Нет данных'}

## ДОГОВОРЫ (${contracts.length})
${contracts.map(c =>
  `- №${c.number} | ${c.counterparty_name || '—'} | Статус: ${t(c.status)} | Сумма: ${rub(c.amount)} | Дата: ${c.date || '—'} | До: ${c.valid_until || '—'} | Предмет: ${c.subject || '—'}`
).join('\n') || 'Нет данных'}

## ЗАКАЗЫ (${orders.length})
${orders.map(o =>
  `- №${o.number} | ${o.counterparty_name || '—'} | Договор №${o.contract_number || '—'} | Статус: ${t(o.status)} | Сумма: ${rub(o.total_amount)} | Дедлайн отгрузки: ${o.shipment_deadline || '—'} | Приоритет: ${t(o.priority)}`
).join('\n') || 'Нет данных'}

## ПЛАТЕЖИ (${payments.length})
${payments.map(p =>
  `- ID:${p.id} | ${p.counterparty_name || '—'} | Счёт: ${p.invoice_number || '—'} | Сумма: ${rub(p.amount)} | Статус: ${t(p.status)} | Срок оплаты: ${p.due_date || '—'} | Оплачено: ${p.paid_date || '—'}${p.penalty_days ? ` | Просрочка: ${p.penalty_days} дн, штраф: ${rub(p.penalty_amount)}` : ''}`
).join('\n') || 'Нет данных'}

## ОТГРУЗКИ (${shipments.length})
${shipments.map(s =>
  `- Заказ №${s.order_number || s.id} | ${s.counterparty_name || '—'} | Счёт: ${s.invoice_number || '—'} | Сумма: ${rub(s.amount)} | Дата: ${s.date || '—'} | Статус: ${t(s.status)} | Срок оплаты: ${s.payment_due_date || '—'} | Оплачено: ${rub(s.paid_amount)}`
).join('\n') || 'Нет данных'}

## РЕКЛАМАЦИИ (${claims.length})
${claims.map(c =>
  `- №${c.number} | ${c.counterparty_name || '—'} | Договор №${c.contract_number || '—'} | Статус: ${t(c.status)} | Срок: ${c.deadline || '—'} | Ответственный: ${c.responsible || '—'} | Описание: ${c.description || '—'}`
).join('\n') || 'Нет данных'}`;
}

// GET /api/ai-chat/status — check if API key is configured
router.get('/status', (req, res) => {
  const configured = !!(process.env.ANTHROPIC_API_KEY?.trim());
  res.json({ configured });
});

// POST /api/ai-chat  — streaming SSE response
router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Сообщение обязательно' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const client = getClient();
    const systemPrompt = buildSystemPrompt();

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const stream = await client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
      max_tokens: 900,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('AI Chat error:', err);
    const msg = err.status === 401
      ? 'Неверный ANTHROPIC_API_KEY. Проверьте файл backend/.env'
      : err.message || 'Неизвестная ошибка';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

module.exports = router;
