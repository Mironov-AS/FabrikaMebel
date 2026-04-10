const db = require('./db');

console.log('Adding demo data for product demonstration...');

// ──────────────────────────────────────────────
// 3 NEW COUNTERPARTIES (IDs 6, 7, 8)
// ──────────────────────────────────────────────
const insertCounterparty = db.prepare(`
  INSERT OR IGNORE INTO counterparties (id, name, inn, kpp, address, contact, phone, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertCounterparty.run(6, 'ООО «СтильМебель»',  '1655043210', '165501001', 'г. Казань, ул. Баумана, 34',          'Гарипов Р.Р.',   '+7 843 321-45-67', 'high');
  insertCounterparty.run(7, 'ИП Орлов Д.В.',       '666312345678', null,      'г. Екатеринбург, ул. Малышева, 78',  'Орлов Д.В.',     '+7 343 432-56-78', 'medium');
  insertCounterparty.run(8, 'ООО «ТехноОфис»',     '5407654321', '540701001', 'г. Новосибирск, пр. Красный, 45',    'Власенко Т.С.',  '+7 383 543-67-89', 'low');
})();
console.log('✓ Counterparties added (IDs 6-8)');

// ──────────────────────────────────────────────
// 7 NEW CONTRACTS (IDs 5-11)
// statuses: active, draft, active, suspended, active, completed, draft
// ──────────────────────────────────────────────
const insertContract = db.prepare(`
  INSERT OR IGNORE INTO contracts (id, number, counterparty_id, date, valid_until, status, amount, subject, payment_delay, penalty_rate, file_name, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertContract.run(5,  'ДГ-2026-004', 6, '2026-01-20', '2026-12-31', 'active',    1800000, 'Поставка офисной мебели для корпоративного клиента',        21, 0.10, 'contract_004.pdf', 2);
  insertContract.run(6,  'ДГ-2026-005', 7, '2026-02-14', '2026-11-30', 'draft',      650000, 'Поставка корпусной мебели',                                  30, 0.05, null,               2);
  insertContract.run(7,  'ДГ-2026-006', 8, '2026-02-25', '2027-02-24', 'active',    2200000, 'Поставка конференц-мебели и мебели для переговорных комнат', 14, 0.10, 'contract_006.pdf', 2);
  insertContract.run(8,  'ДГ-2026-007', 6, '2026-03-01', '2026-08-31', 'suspended',  430000, 'Поставка складской мебели и стеллажей',                     30, 0.10, 'contract_007.pdf', 2);
  insertContract.run(9,  'ДГ-2026-008', 4, '2026-01-10', '2026-10-31', 'active',     950000, 'Поставка мягкой мебели для жилых помещений',                 45, 0.08, 'contract_008.pdf', 2);
  insertContract.run(10, 'ДГ-2025-031', 7, '2025-07-01', '2025-12-31', 'completed',  380000, 'Поставка детской мебели',                                   14, 0.10, 'contract_031.pdf', 2);
  insertContract.run(11, 'ДГ-2026-009', 8, '2026-03-20', '2027-03-19', 'draft',     1100000, 'Поставка мебели для переговорных комнат (2-й этап)',          30, 0.05, null,               2);
})();

// Contract conditions
const insertCondition = db.prepare(`INSERT OR IGNORE INTO contract_conditions (contract_id, text, fulfilled) VALUES (?, ?, ?)`);
db.transaction(() => {
  insertCondition.run(5,  'Поставка поэтапно согласно производственному плану', 1);
  insertCondition.run(5,  'Обязательная маркировка каждой единицы продукции',   0);
  insertCondition.run(7,  'Монтаж мебели силами поставщика',                    0);
  insertCondition.run(7,  'Предоставление гарантии 24 месяца',                  1);
  insertCondition.run(9,  'Бесплатная доставка в пределах Самары',              1);
  insertCondition.run(10, 'Все обязательства сторон выполнены в срок',          1);
})();

// Contract obligations
const insertObligation = db.prepare(`INSERT OR IGNORE INTO contract_obligations (contract_id, party, text, deadline, status) VALUES (?, ?, ?, ?, ?)`);
db.transaction(() => {
  insertObligation.run(5, 'seller', 'Изготовить и поставить офисную мебель согласно спецификации', '2026-05-20', 'in_progress');
  insertObligation.run(5, 'buyer',  'Произвести авансовый платёж 30% до начала производства',      '2026-02-01', 'in_progress');
  insertObligation.run(7, 'seller', 'Поставить и смонтировать конференц-мебель',                   '2026-06-30', 'pending');
  insertObligation.run(7, 'buyer',  'Предоставить поэтажный план помещений для расстановки',       '2026-03-15', 'overdue');
  insertObligation.run(8, 'seller', 'Поставить складскую мебель согласно спецификации',            '2026-07-31', 'pending');
  insertObligation.run(9, 'seller', 'Изготовить и поставить мягкую мебель',                        '2026-08-01', 'in_progress');
  insertObligation.run(9, 'buyer',  'Произвести оплату в течение 45 дней после поставки',          null,         'pending');
})();

// Contract versions
const insertVersion = db.prepare(`INSERT OR IGNORE INTO contract_versions (contract_id, version_num, date, author, changes) VALUES (?, ?, ?, ?, ?)`);
db.transaction(() => {
  insertVersion.run(5,  1, '2026-01-20', 'Петрова М.В.',  'Создание договора');
  insertVersion.run(6,  1, '2026-02-14', 'Петрова М.В.',  'Создание договора (черновик)');
  insertVersion.run(7,  1, '2026-02-25', 'Петрова М.В.',  'Создание договора');
  insertVersion.run(7,  2, '2026-03-20', 'Петрова М.В.',  'Уточнение условия монтажа и гарантии');
  insertVersion.run(8,  1, '2026-03-01', 'Петрова М.В.',  'Создание договора');
  insertVersion.run(8,  2, '2026-03-18', 'Иванов А.С.',   'Договор приостановлен — разногласия по спецификации');
  insertVersion.run(9,  1, '2026-01-10', 'Петрова М.В.',  'Создание договора');
  insertVersion.run(10, 1, '2025-07-01', 'Петрова М.В.',  'Создание договора');
  insertVersion.run(10, 2, '2026-01-05', 'Петрова М.В.',  'Закрытие договора — все обязательства выполнены');
  insertVersion.run(11, 1, '2026-03-20', 'Петрова М.В.',  'Создание договора (черновик)');
})();
console.log('✓ Contracts added (IDs 5-11)');

// ──────────────────────────────────────────────
// 15 NEW ORDERS (IDs 6-20)
// statuses: planned, in_production, ready_for_shipment, shipped, completed — все представлены
// ──────────────────────────────────────────────
const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (id, number, contract_id, counterparty_id, date, shipment_deadline, priority, status, total_amount, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  // contract 5, counterparty 6 (ООО «СтильМебель»)
  insertOrder.run(6,  'ЗАК-2026-0046', 5, 6, '2026-02-01', '2026-05-15', 'high',   'planned',             560000, 2);
  insertOrder.run(7,  'ЗАК-2026-0047', 5, 6, '2026-02-20', '2026-06-10', 'medium', 'in_production',       840000, 2);
  // contract 6, counterparty 7 (ИП Орлов Д.В.) — черновик договора
  insertOrder.run(8,  'ЗАК-2026-0048', 6, 7, '2026-02-28', '2026-06-30', 'low',    'planned',             320000, 2);
  // contract 7, counterparty 8 (ООО «ТехноОфис»)
  insertOrder.run(9,  'ЗАК-2026-0049', 7, 8, '2026-03-01', '2026-05-30', 'high',   'in_production',       780000, 2);
  insertOrder.run(10, 'ЗАК-2026-0050', 7, 8, '2026-03-10', '2026-06-15', 'medium', 'ready_for_shipment', 1100000, 2);
  // contract 8, counterparty 6 — договор приостановлен
  insertOrder.run(11, 'ЗАК-2026-0051', 8, 6, '2026-03-05', '2026-07-01', 'low',    'planned',             215000, 2);
  // contract 9, counterparty 4 (ООО «КомфортДом»)
  insertOrder.run(12, 'ЗАК-2026-0052', 9, 4, '2026-01-20', '2026-03-28', 'high',   'shipped',             390000, 2);
  insertOrder.run(13, 'ЗАК-2026-0053', 9, 4, '2026-02-15', '2026-05-20', 'medium', 'in_production',       280000, 2);
  // contract 10, counterparty 7 — завершённый договор
  insertOrder.run(14, 'ЗАК-2025-021',  10, 7, '2025-07-10', '2025-10-15', 'medium', 'completed',          185000, 2);
  insertOrder.run(15, 'ЗАК-2025-022',  10, 7, '2025-09-01', '2025-12-10', 'low',    'completed',          195000, 2);
  // contract 11, counterparty 8 — черновик договора
  insertOrder.run(16, 'ЗАК-2026-0054', 11, 8, '2026-03-25', '2026-07-30', 'medium', 'planned',            450000, 2);
  // contract 1, counterparty 1 (ООО «МебельТорг») — готов к отгрузке
  insertOrder.run(17, 'ЗАК-2026-0055',  1, 1, '2026-03-01', '2026-04-30', 'high',   'ready_for_shipment', 870000, 2);
  // contract 3, counterparty 5 (ЗАО «ГрандМебель»)
  insertOrder.run(18, 'ЗАК-2026-0056',  3, 5, '2026-03-20', '2026-07-01', 'high',   'in_production',     1650000, 2);
  // contract 2, counterparty 3 (АО «ОфисПлюс»)
  insertOrder.run(19, 'ЗАК-2026-0057',  2, 3, '2026-02-15', '2026-04-05', 'medium', 'shipped',            280000, 2);
  // contract 9, counterparty 4 — завершённый заказ
  insertOrder.run(20, 'ЗАК-2026-0058',  9, 4, '2025-10-01', '2025-12-20', 'high',   'completed',          280000, 2);
})();

// Order items (IDs 11-39)
const insertOrderItem = db.prepare(`
  INSERT OR IGNORE INTO order_items (id, order_id, name, article, quantity, price, category, status, shipped)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  // Order 6 (planned)
  insertOrderItem.run(11, 6,  'Стол руководителя «Престиж»',         'ST-PR',   10, 28000, 'Столы',            'planned',       0);
  insertOrderItem.run(12, 6,  'Кресло руководителя «Директор»',      'KR-DIR',  10, 28000, 'Офисные кресла',   'planned',       0);
  // Order 7 (in_production)
  insertOrderItem.run(13, 7,  'Шкаф-купе офисный 3-дверный',         'SH-KUP',  15, 22000, 'Шкафы',            'in_production', 0);
  insertOrderItem.run(14, 7,  'Тумба приставная',                    'TU-PR',   30,  6000, 'Тумбы',            'in_production', 0);
  // Order 8 (planned)
  insertOrderItem.run(15, 8,  'Стеллаж книжный офисный',             'SL-KN',   20,  8000, 'Стеллажи',         'planned',       0);
  // Order 9 (in_production)
  insertOrderItem.run(16, 9,  'Стол переговорный 300×120',            'ST-PER',   5, 58000, 'Столы',            'in_production', 0);
  insertOrderItem.run(17, 9,  'Кресло конференц-зала «Спикер»',      'KO-KONF', 40,  7800, 'Офисные кресла',   'in_production', 0);
  // Order 10 (ready_for_shipment)
  insertOrderItem.run(18, 10, 'Стол переговорный 240×100',            'ST-PER2',  8, 48000, 'Столы',            'produced',      0);
  insertOrderItem.run(19, 10, 'Тумба архивная',                      'TU-ARH',  20,  9500, 'Тумбы',            'produced',      0);
  // Order 11 (planned, suspended contract)
  insertOrderItem.run(20, 11, 'Стеллаж металлический складской',     'SL-MET',  10, 14500, 'Стеллажи',         'planned',       0);
  insertOrderItem.run(21, 11, 'Шкаф инструментальный',               'SH-INS',   5,  9500, 'Шкафы',            'planned',       0);
  // Order 12 (shipped)
  insertOrderItem.run(22, 12, 'Диван «Классик» 2-местный',            'DV-KL2',  10, 22000, 'Диваны',           'done',         10);
  insertOrderItem.run(23, 12, 'Кресло мягкое «Уют»',                  'KR-UYT',  15, 10000, 'Кресла мягкие',    'done',         15);
  // Order 13 (in_production)
  insertOrderItem.run(24, 13, 'Диван «Модерн» угловой',               'DV-MOD',   5, 32000, 'Диваны',           'in_production', 0);
  insertOrderItem.run(25, 13, 'Пуф квадратный',                       'PUF-01',  20,  3500, 'Пуфы',             'planned',       0);
  // Order 14 (completed)
  insertOrderItem.run(26, 14, 'Кровать детская «Малыш»',              'KR-DET',  12,  8500, 'Кровати',          'done',         12);
  insertOrderItem.run(27, 14, 'Шкаф детский 2-дверный',               'SH-DET',  12, 11000, 'Шкафы',            'done',         12);
  // Order 15 (completed)
  insertOrderItem.run(28, 15, 'Стол детский «Учёба»',                 'ST-DET',  15,  6500, 'Столы',            'done',         15);
  insertOrderItem.run(29, 15, 'Стул детский «Кроха»',                 'STU-DET', 20,  2500, 'Стулья',           'done',         20);
  // Order 16 (planned)
  insertOrderItem.run(30, 16, 'Стол переговорный 360×120',            'ST-PER3',  3, 75000, 'Столы',            'planned',       0);
  insertOrderItem.run(31, 16, 'Кресло для переговорной «Статус»',    'KO-PER',  30,  8500, 'Офисные кресла',   'planned',       0);
  // Order 17 (ready_for_shipment)
  insertOrderItem.run(32, 17, 'Кресло офисное «Эксперт»',            'KO-EKS',  40, 11500, 'Офисные кресла',   'produced',      0);
  insertOrderItem.run(33, 17, 'Стол рабочий 140×70',                 'ST-140',  25,  9800, 'Столы',            'produced',      0);
  // Order 18 (in_production)
  insertOrderItem.run(34, 18, 'Диван «Гранд» 3-местный',             'DV-GR3',  20, 42000, 'Диваны',           'in_production', 0);
  insertOrderItem.run(35, 18, 'Кресло мягкое «Комфорт-Н»',           'KR-KN',   30, 18000, 'Кресла мягкие',    'in_production', 0);
  // Order 19 (shipped)
  insertOrderItem.run(36, 19, 'Стол рабочий 120×60',                 'ST-120',  20,  7800, 'Столы',            'done',         20);
  insertOrderItem.run(37, 19, 'Тумба 2-ящичная',                     'TU-002',  20,  4200, 'Тумбы',            'done',         20);
  // Order 20 (completed)
  insertOrderItem.run(38, 20, 'Диван «Классик» 3-местный',           'DV-KL3',   8, 26000, 'Диваны',           'done',          8);
  insertOrderItem.run(39, 20, 'Кресло мягкое «Отдых»',               'KR-OTD',  16,  8000, 'Кресла мягкие',    'done',         16);
})();
console.log('✓ Orders added (IDs 6-20)');

// ──────────────────────────────────────────────
// NEW SHIPMENTS (IDs 7-11) — для shipped/completed заказов
// ──────────────────────────────────────────────
const insertShipment = db.prepare(`
  INSERT OR IGNORE INTO shipments (id, order_id, order_number, counterparty_id, date, invoice_number, amount, status, payment_due_date, paid_amount, paid_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertShipment.run(7,  12, 'ЗАК-2026-0052', 4, '2026-03-25', 'ТН-2026-0061', 390000, 'shipped', '2026-05-09', 0,      null);
  insertShipment.run(8,  14, 'ЗАК-2025-021',  7, '2025-10-12', 'ТН-2025-0108', 185000, 'shipped', '2025-10-26', 185000, '2025-10-24');
  insertShipment.run(9,  15, 'ЗАК-2025-022',  7, '2025-12-08', 'ТН-2025-0142', 195000, 'shipped', '2025-12-22', 195000, '2025-12-20');
  insertShipment.run(10, 19, 'ЗАК-2026-0057', 3, '2026-04-03', 'ТН-2026-0056', 280000, 'shipped', '2026-04-17', 0,      null);
  insertShipment.run(11, 20, 'ЗАК-2026-0058', 4, '2025-12-18', 'ТН-2025-0156', 280000, 'shipped', '2026-02-01', 280000, '2026-01-28');
})();

const insertShipmentItem = db.prepare(`INSERT OR IGNORE INTO shipment_items (shipment_id, order_item_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)`);
db.transaction(() => {
  insertShipmentItem.run(7,  22, 'Диван «Классик» 2-местный',   10, 22000);
  insertShipmentItem.run(7,  23, 'Кресло мягкое «Уют»',          15, 10000);
  insertShipmentItem.run(8,  26, 'Кровать детская «Малыш»',      12,  8500);
  insertShipmentItem.run(8,  27, 'Шкаф детский 2-дверный',       12, 11000);
  insertShipmentItem.run(9,  28, 'Стол детский «Учёба»',         15,  6500);
  insertShipmentItem.run(9,  29, 'Стул детский «Кроха»',         20,  2500);
  insertShipmentItem.run(10, 36, 'Стол рабочий 120×60',          20,  7800);
  insertShipmentItem.run(10, 37, 'Тумба 2-ящичная',              20,  4200);
  insertShipmentItem.run(11, 38, 'Диван «Классик» 3-местный',     8, 26000);
  insertShipmentItem.run(11, 39, 'Кресло мягкое «Отдых»',        16,  8000);
})();

// ──────────────────────────────────────────────
// NEW PAYMENTS (IDs 7-11)
// statuses: pending, paid, paid, overdue, paid
// ──────────────────────────────────────────────
const insertPayment = db.prepare(`
  INSERT OR IGNORE INTO payments (id, shipment_id, counterparty_id, amount, due_date, paid_date, status, invoice_number, penalty_days, penalty_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertPayment.run(7,  7,  4, 390000, '2026-05-09', null,         'pending', 'ТН-2026-0061',  0,    0);
  insertPayment.run(8,  8,  7, 185000, '2025-10-26', '2025-10-24', 'paid',    'ТН-2025-0108',  0,    0);
  insertPayment.run(9,  9,  7, 195000, '2025-12-22', '2025-12-20', 'paid',    'ТН-2025-0142',  0,    0);
  insertPayment.run(10, 10, 3, 280000, '2026-04-17', null,         'overdue', 'ТН-2026-0056',  7, 1960);
  insertPayment.run(11, 11, 4, 280000, '2026-02-01', '2026-01-28', 'paid',    'ТН-2025-0156',  0,    0);
})();
console.log('✓ Shipments & payments added');

// ──────────────────────────────────────────────
// 4 NEW CLAIMS (IDs 3-6)
// statuses: open, in_review, resolved, closed
// ──────────────────────────────────────────────
const insertClaim = db.prepare(`
  INSERT OR IGNORE INTO claims (id, number, contract_id, shipment_id, counterparty_id, order_item_id, date, deadline, description, status, responsible, resolution, pause_payments, affected_payment_id, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  // open — ждёт рассмотрения, платёж приостановлен
  insertClaim.run(3, 'РЕК-2026-003', 9, 7, 4, 22, '2026-04-01', '2026-05-01',
    'Обнаружены повреждения ткани дивана при разгрузке — 2 из 10 единиц имеют видимые дефекты',
    'open', 'Петрова М.В.', null, 1, 7, 2);

  // in_review — на рассмотрении у специалиста
  insertClaim.run(4, 'РЕК-2026-004', 10, 8, 7, 26, '2026-01-15', '2026-02-15',
    'Несоответствие цвета ламели кровати — поставлен «белый вяз» вместо «белого матового» согласно спецификации',
    'in_review', 'Козлов Д.В.', null, 0, null, 2);

  // resolved — претензия удовлетворена, замена произведена
  insertClaim.run(5, 'РЕК-2026-005', 9, 11, 4, 38, '2026-01-20', '2026-02-20',
    'Скол лакокрасочного покрытия на 1 из 8 диванов при транспортировке',
    'resolved', 'Козлов Д.В.',
    'Произведена безвозмездная замена повреждённого изделия. Клиент подтвердил получение и устранение претензии.',
    0, null, 2);

  // closed — претензия закрыта без компенсации
  insertClaim.run(6, 'РЕК-2026-006', 2, 10, 3, 36, '2026-04-05', '2026-05-05',
    'Задержка отгрузки на 3 рабочих дня относительно согласованного календарного графика поставки',
    'closed', 'Петрова М.В.',
    'Задержка признана форс-мажорной (транспортный сбой). Компенсация не предусмотрена. Договорные отношения продолжаются.',
    0, null, 2);
})();
console.log('✓ Claims added (IDs 3-6): open, in_review, resolved, closed');

// ──────────────────────────────────────────────
// NEW PRODUCTION TASKS (IDs 8-17)
// ──────────────────────────────────────────────
const insertTask = db.prepare(`
  INSERT OR IGNORE INTO production_tasks (id, order_id, order_number, name, line_id, start_date, end_date, progress, status, responsible, priority, color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertTask.run(8,  7,  'ЗАК-2026-0047', 'Шкаф-купе офисный (15 шт)',           1, '2026-03-15', '2026-05-01', 40,  'in_progress', 'Козлов Д.В.',  'medium', '#f59e0b');
  insertTask.run(9,  7,  'ЗАК-2026-0047', 'Тумба приставная (30 шт)',             2, '2026-03-20', '2026-04-20', 70,  'in_progress', 'Козлов Д.В.',  'medium', '#f59e0b');
  insertTask.run(10, 9,  'ЗАК-2026-0049', 'Стол переговорный 300×120 (5 шт)',    3, '2026-03-05', '2026-05-10', 55,  'in_progress', 'Новиков А.И.', 'high',   '#ef4444');
  insertTask.run(11, 9,  'ЗАК-2026-0049', 'Кресло конференц-зала (40 шт)',        4, '2026-03-15', '2026-04-25', 80,  'in_progress', 'Козлов Д.В.',  'high',   '#ef4444');
  insertTask.run(12, 10, 'ЗАК-2026-0050', 'Стол переговорный 240×100 (8 шт)',    3, '2026-02-20', '2026-04-05', 100, 'done',        'Новиков А.И.', 'medium', '#6366f1');
  insertTask.run(13, 10, 'ЗАК-2026-0050', 'Тумба архивная (20 шт)',               1, '2026-02-25', '2026-04-08', 100, 'done',        'Козлов Д.В.',  'medium', '#6366f1');
  insertTask.run(14, 13, 'ЗАК-2026-0053', 'Диван «Модерн» угловой (5 шт)',        2, '2026-03-10', '2026-05-05', 35,  'in_progress', 'Козлов Д.В.',  'medium', '#14b8a6');
  insertTask.run(15, 18, 'ЗАК-2026-0056', 'Диван «Гранд» 3-местный (20 шт)',      2, '2026-04-05', '2026-06-15', 15,  'in_progress', 'Новиков А.И.', 'high',   '#a855f7');
  insertTask.run(16, 17, 'ЗАК-2026-0055', 'Кресло офисное «Эксперт» (40 шт)',    4, '2026-02-20', '2026-03-30', 100, 'done',        'Козлов Д.В.',  'high',   '#0ea5e9');
  insertTask.run(17, 17, 'ЗАК-2026-0055', 'Стол рабочий 140×70 (25 шт)',          3, '2026-02-25', '2026-04-05', 100, 'done',        'Новиков А.И.', 'high',   '#0ea5e9');
})();
console.log('✓ Production tasks added');

// ──────────────────────────────────────────────
// ADDITIONAL NOTIFICATIONS
// ──────────────────────────────────────────────
const insertNotification = db.prepare(`
  INSERT INTO notifications (user_id, type, title, text, date, read) VALUES (?, ?, ?, ?, ?, ?)
`);
const newNotifs = [
  ['warning', 'Просрочка платежа',     'АО «ОфисПлюс» — просрочка 7 дней по счёту ТН-2026-0056 (280 000 руб.)',         '2026-04-08', 0],
  ['info',    'Рекламация открыта',     'РЕК-2026-003: ООО «КомфортДом» — повреждение обивки дивана при доставке',        '2026-04-01', 0],
  ['success', 'Рекламация закрыта',     'РЕК-2026-006 (АО «ОфисПлюс») — закрыта без компенсации',                        '2026-04-06', 1],
  ['info',    'Готов к отгрузке',       'Заказ ЗАК-2026-0050 (ООО «ТехноОфис») — готов к отгрузке',                      '2026-04-09', 0],
  ['warning', 'Договор приостановлен',  'ДГ-2026-007 (ООО «СтильМебель») — договор приостановлен, требуется согласование','2026-03-18', 1],
];
db.transaction(() => {
  for (const userId of [1, 3, 7]) {
    for (const n of newNotifs) insertNotification.run(userId, ...n);
  }
})();

// ──────────────────────────────────────────────
// AUDIT LOG
// ──────────────────────────────────────────────
const insertAudit = db.prepare(`
  INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
`);
db.transaction(() => {
  insertAudit.run(2, 'Петрова М.В.',  'Создан контрагент ООО «СтильМебель»',                        'Контрагент',  6,  '192.168.1.15', '2026-01-18 09:30');
  insertAudit.run(2, 'Петрова М.В.',  'Создан контрагент ИП Орлов Д.В.',                             'Контрагент',  7,  '192.168.1.15', '2026-02-12 10:00');
  insertAudit.run(2, 'Петрова М.В.',  'Создан контрагент ООО «ТехноОфис»',                           'Контрагент',  8,  '192.168.1.15', '2026-02-20 11:15');
  insertAudit.run(2, 'Петрова М.В.',  'Создан договор ДГ-2026-004',                                  'Договор',     5,  '192.168.1.15', '2026-01-20 11:00');
  insertAudit.run(2, 'Петрова М.В.',  'Создан договор ДГ-2026-006',                                  'Договор',     7,  '192.168.1.15', '2026-02-25 14:30');
  insertAudit.run(1, 'Иванов А.С.',   'Договор ДГ-2026-007 переведён в статус «Приостановлен»',      'Договор',     8,  '192.168.1.10', '2026-03-18 10:15');
  insertAudit.run(3, 'Сидоров П.К.',  'Зарегистрирован платёж ТН-2025-0108 (185 000 руб.)',          'Платёж',      8,  '192.168.1.18', '2025-10-24 11:00');
  insertAudit.run(3, 'Сидоров П.К.',  'Зарегистрирован платёж ТН-2025-0142 (195 000 руб.)',          'Платёж',      9,  '192.168.1.18', '2025-12-20 14:30');
  insertAudit.run(3, 'Сидоров П.К.',  'Зарегистрирован платёж ТН-2025-0156 (280 000 руб.)',          'Платёж',      11, '192.168.1.18', '2026-01-28 09:45');
  insertAudit.run(2, 'Петрова М.В.',  'Открыта рекламация РЕК-2026-003',                             'Рекламация',  3,  '192.168.1.15', '2026-04-01 15:00');
  insertAudit.run(4, 'Козлов Д.В.',   'Рекламация РЕК-2026-005 переведена в статус «Решена»',        'Рекламация',  5,  '192.168.1.22', '2026-02-18 10:00');
  insertAudit.run(2, 'Петрова М.В.',  'Рекламация РЕК-2026-006 закрыта',                             'Рекламация',  6,  '192.168.1.15', '2026-04-06 16:00');
  insertAudit.run(5, 'Новиков А.И.',  'Производственная задача завершена — ЗАК-2026-0050 (стол)',    'Производство',12, '192.168.1.23', '2026-04-05 16:45');
  insertAudit.run(2, 'Петрова М.В.',  'Заказ ЗАК-2026-0050 переведён в статус «Готов к отгрузке»',  'Заказ',       10, '192.168.1.15', '2026-04-09 09:00');
  insertAudit.run(2, 'Петрова М.В.',  'Заказ ЗАК-2026-0055 переведён в статус «Готов к отгрузке»',  'Заказ',       17, '192.168.1.15', '2026-04-09 09:05');
})();

console.log('\n✅ Demo data added successfully!');
console.log('Summary:');
console.log('  • Counterparties: +3 (IDs 6-8) — high/medium/low priority');
console.log('  • Contracts: +7 (IDs 5-11) — active(3), draft(2), suspended(1), completed(1)');
console.log('  • Orders: +15 (IDs 6-20) — planned(4), in_production(5), ready_for_shipment(2), shipped(2), completed(2)');
console.log('  • Claims: +4 (IDs 3-6) — open, in_review, resolved, closed');
