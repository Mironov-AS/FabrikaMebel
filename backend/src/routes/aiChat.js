const express = require('express');
const https = require('https');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

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

  const production = db.prepare(`
    SELECT pt.id, pt.name, pt.status, pt.start_date, pt.end_date,
           pt.progress, pt.responsible, pt.priority, pt.order_number,
           cp.name AS counterparty_name
    FROM production_tasks pt
    LEFT JOIN orders o ON pt.order_id = o.id
    LEFT JOIN counterparties cp ON o.counterparty_id = cp.id
    ORDER BY pt.end_date ASC
  `).all();

  const statusLabels = {
    active: 'активен', completed: 'выполнен', suspended: 'приостановлен', draft: 'черновик',
    planned: 'запланирован', in_production: 'в производстве',
    ready_for_shipment: 'готов к отгрузке', shipped: 'отгружен',
    paid: 'оплачен', overdue: 'просрочен', pending: 'ожидает оплаты',
    open: 'открыта', in_review: 'на рассмотрении', resolved: 'решена', closed: 'закрыта',
    high: 'высокий', medium: 'средний', low: 'низкий',
  };
  const t = (v) => statusLabels[v] || v || '—';
  const rub = (v) => v != null ? `${Number(v).toLocaleString('ru-RU')} ₽` : '—';

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
).join('\n') || 'Нет данных'}

## ПРОИЗВОДСТВО (${production.length} задач)
${production.map(p =>
  `- ${p.name} | Заказ №${p.order_number || '—'} | ${p.counterparty_name || '—'} | Статус: ${t(p.status)} | Прогресс: ${p.progress ?? 0}% | Срок: ${p.end_date || '—'} | Ответственный: ${p.responsible || '—'} | Приоритет: ${t(p.priority)}`
).join('\n') || 'Нет данных'}`;
}

// Build Yandex message array from history + current message
function buildYandexMessages(systemPrompt, history, userMessage) {
  const messages = [{ role: 'system', text: systemPrompt }];
  for (const m of history) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.content });
  }
  messages.push({ role: 'user', text: userMessage });
  return messages;
}

// POST to Yandex streaming endpoint, returns async iterator of text deltas
function yandexStream(apiKey, folderId, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt/latest`,
      completionOptions: { stream: true, temperature: 0.6, maxTokens: 4000 },
      messages,
    });

    const req = https.request({
      hostname: 'llm.api.cloud.yandex.net',
      path: '/foundationModels/v1/completionStream',
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      resolve(res);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// GET /api/ai-chat/status — check if API key is configured
router.get('/status', (req, res) => {
  const configured = !!(process.env.YANDEX_API_KEY?.trim());
  res.json({ configured });
});

// POST /api/ai-chat — streaming SSE response
router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Сообщение обязательно' });

  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    return res.status(500).json({ error: 'YANDEX_API_KEY или YANDEX_FOLDER_ID не заданы в .env' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const systemPrompt = buildSystemPrompt();
    const messages = buildYandexMessages(systemPrompt, history, message);

    const httpRes = await yandexStream(apiKey, folderId, messages);

    if (httpRes.statusCode !== 200) {
      let errBody = '';
      httpRes.on('data', (chunk) => { errBody += chunk; });
      httpRes.on('end', () => {
        let errMsg = 'Ошибка Yandex API';
        try {
          const parsed = JSON.parse(errBody);
          errMsg = parsed.error?.message || errMsg;
        } catch (_) {}
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      });
      return;
    }

    let prevText = '';
    let buffer = '';

    httpRes.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const currentText = json.result?.alternatives?.[0]?.message?.text ?? '';
          const delta = currentText.slice(prevText.length);
          if (delta) {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
          prevText = currentText;
        } catch (_) {
          // skip unparseable lines
        }
      }
    });

    httpRes.on('end', () => {
      // flush any remaining buffer
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer.trim());
          const currentText = json.result?.alternatives?.[0]?.message?.text ?? '';
          const delta = currentText.slice(prevText.length);
          if (delta) {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        } catch (_) {}
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });

    httpRes.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error('AI Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'Неизвестная ошибка' })}\n\n`);
    res.end();
  }
});

module.exports = router;
