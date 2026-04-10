const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('Seeding database...');

// Check if already seeded
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt > 0) {
  console.log('Database already seeded. Skipping...');
  process.exit(0);
}

const PASSWORD_HASH = bcrypt.hashSync('password123', 10);

// Users
const insertUser = db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, position, active, last_login)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?)
`);

const users = [
  [1, 'Иванов А.С.', 'admin@furniture.ru', PASSWORD_HASH, 'admin', 'Системный администратор', '2026-04-06 09:15'],
  [2, 'Петрова М.В.', 'sales@furniture.ru', PASSWORD_HASH, 'sales_manager', 'Менеджер по продажам', '2026-04-06 08:30'],
  [3, 'Сидоров П.К.', 'accountant@furniture.ru', PASSWORD_HASH, 'accountant', 'Главный бухгалтер', '2026-04-05 17:45'],
  [4, 'Козлов Д.В.', 'prod@furniture.ru', PASSWORD_HASH, 'production_specialist', 'Специалист производства', '2026-04-06 07:00'],
  [5, 'Новиков А.И.', 'prodhead@furniture.ru', PASSWORD_HASH, 'production_head', 'Начальник производства', '2026-04-06 08:00'],
  [6, 'Морозова Е.А.', 'analyst@furniture.ru', PASSWORD_HASH, 'analyst', 'Аналитик', '2026-04-05 16:00'],
  [7, 'Волков С.Р.', 'director@furniture.ru', PASSWORD_HASH, 'director', 'Директор', '2026-04-06 09:00'],
  [8, 'Гость', 'guest@furniture.ru', PASSWORD_HASH, 'guest', 'Гость', '2026-04-04 12:00'],
];

const seedUsers = db.transaction(() => {
  for (const u of users) insertUser.run(...u);
});
seedUsers();
console.log('✓ Users seeded');

// Counterparties
const insertCounterparty = db.prepare(`
  INSERT INTO counterparties (id, name, inn, kpp, address, contact, phone, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const counterparties = [
  [1, 'ООО «МебельТорг»', '7701234567', '770101001', 'г. Москва, ул. Тверская, 15', 'Алексеев В.П.', '+7 495 123-45-67', 'high'],
  [2, 'ИП Смирнова О.В.', '771987654321', null, 'г. Москва, пр. Мира, 88', 'Смирнова О.В.', '+7 916 234-56-78', 'medium'],
  [3, 'АО «ОфисПлюс»', '5032109876', '503201001', 'г. Подольск, ул. Ленина, 5', 'Куликов А.Б.', '+7 499 345-67-89', 'high'],
  [4, 'ООО «КомфортДом»', '6321456789', '632101001', 'г. Самара, ул. Победы, 22', 'Зайцев И.С.', '+7 846 456-78-90', 'low'],
  [5, 'ЗАО «ГрандМебель»', '7809876543', '780901001', 'г. Санкт-Петербург, пр. Невский, 100', 'Фёдорова Н.А.', '+7 812 567-89-01', 'high'],
];

const seedCounterparties = db.transaction(() => {
  for (const c of counterparties) insertCounterparty.run(...c);
});
seedCounterparties();
console.log('✓ Counterparties seeded');

// Contracts
const insertContract = db.prepare(`
  INSERT INTO contracts (id, number, counterparty_id, date, valid_until, status, amount, subject, payment_delay, penalty_rate, file_name, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const contracts = [
  [1, 'ДГ-2026-001', 1, '2026-01-15', '2026-12-31', 'active', 2850000, 'Поставка офисной мебели', 30, 0.1, 'contract_001.pdf', 2],
  [2, 'ДГ-2026-002', 3, '2026-02-01', '2026-09-30', 'active', 1450000, 'Поставка корпусной мебели для офисов', 14, 0.05, 'contract_002.docx', 2],
  [3, 'ДГ-2026-003', 5, '2026-03-10', '2027-03-09', 'active', 5200000, 'Поставка мягкой мебели для гостиниц', 45, 0.15, 'contract_003.pdf', 2],
  [4, 'ДГ-2025-045', 2, '2025-10-01', '2026-03-31', 'completed', 320000, 'Поставка кухонной мебели', 10, 0.1, 'contract_045.pdf', 2],
];

const seedContracts = db.transaction(() => {
  for (const c of contracts) insertContract.run(...c);
});
seedContracts();

// Contract conditions
const insertCondition = db.prepare(`INSERT INTO contract_conditions (contract_id, text, fulfilled) VALUES (?, ?, ?)`);
db.transaction(() => {
  insertCondition.run(1, 'Поставка партиями по мере производства', 1);
  insertCondition.run(1, 'Предоставление сертификатов качества', 1);
  insertCondition.run(3, 'Доставка собственным транспортом', 0);
})();

// Contract obligations
const insertObligation = db.prepare(`INSERT INTO contract_obligations (contract_id, party, text, deadline, status) VALUES (?, ?, ?, ?, ?)`);
db.transaction(() => {
  insertObligation.run(1, 'seller', 'Изготовить и поставить мебель согласно спецификации', '2026-04-30', 'in_progress');
  insertObligation.run(1, 'buyer', 'Произвести оплату в течение 30 дней после поставки', null, 'pending');
  insertObligation.run(2, 'seller', 'Изготовить и поставить мебель согласно спецификации', '2026-05-15', 'in_progress');
  insertObligation.run(3, 'seller', 'Произвести и поставить мягкую мебель', '2026-07-31', 'pending');
  insertObligation.run(3, 'buyer', 'Предоставить схемы расстановки', '2026-04-15', 'overdue');
})();

// Contract versions
const insertVersion = db.prepare(`INSERT INTO contract_versions (contract_id, version_num, date, author, changes) VALUES (?, ?, ?, ?, ?)`);
db.transaction(() => {
  insertVersion.run(1, 1, '2026-01-15', 'Петрова М.В.', 'Создание договора');
  insertVersion.run(1, 2, '2026-02-10', 'Петрова М.В.', 'Изменение суммы договора с 2 700 000 до 2 850 000');
  insertVersion.run(2, 1, '2026-02-01', 'Петрова М.В.', 'Создание договора');
  insertVersion.run(3, 1, '2026-03-10', 'Петрова М.В.', 'Создание договора');
  insertVersion.run(4, 1, '2025-10-01', 'Петрова М.В.', 'Создание договора');
})();
console.log('✓ Contracts seeded');

// Orders
const insertOrder = db.prepare(`
  INSERT INTO orders (id, number, contract_id, counterparty_id, date, shipment_deadline, priority, status, total_amount, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertOrder.run(1, 'ЗАК-2026-0042', 1, 1, '2026-01-20', '2026-04-25', 'high', 'in_production', 980000, 2);
  insertOrder.run(2, 'ЗАК-2026-0043', 1, 1, '2026-02-05', '2026-05-10', 'medium', 'planned', 480000, 2);
  insertOrder.run(3, 'ЗАК-2026-0044', 2, 3, '2026-02-10', '2026-05-01', 'high', 'in_production', 720000, 2);
  insertOrder.run(4, 'ЗАК-2026-0045', 3, 5, '2026-03-15', '2026-07-20', 'high', 'planned', 2100000, 2);
  insertOrder.run(5, 'ЗАК-2026-011', 2, 3, '2026-04-10', '2026-04-30', 'medium', 'shipped', 10000, 1);
})();

// Order items
const insertOrderItem = db.prepare(`
  INSERT INTO order_items (id, order_id, name, article, quantity, price, category, status, shipped)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertOrderItem.run(1, 1, 'Кресло офисное «Комфорт-М»', 'KO-001', 50, 8500, 'Офисные кресла', 'done', 100);
  insertOrderItem.run(2, 1, 'Стол рабочий 160×80', 'ST-160', 30, 12000, 'Столы', 'done', 60);
  insertOrderItem.run(3, 1, 'Тумба 3-ящичная', 'TU-003', 30, 5500, 'Тумбы', 'done', 60);
  insertOrderItem.run(4, 2, 'Шкаф 4-дверный', 'SH-004', 20, 18000, 'Шкафы', 'planned', 0);
  insertOrderItem.run(5, 2, 'Стол переговорный 240×120', 'ST-240', 5, 24000, 'Столы', 'planned', 0);
  insertOrderItem.run(6, 3, 'Стол рабочий угловой', 'ST-UG', 25, 16800, 'Столы', 'in_production', 10);
  insertOrderItem.run(7, 3, 'Кресло офисное «Менеджер»', 'KO-002', 25, 12000, 'Офисные кресла', 'produced', 15);
  insertOrderItem.run(8, 4, 'Диван угловой «Люкс»', 'DV-001', 30, 35000, 'Диваны', 'planned', 0);
  insertOrderItem.run(9, 4, 'Кресло мягкое «Релакс»', 'KR-001', 60, 18000, 'Кресла мягкие', 'planned', 0);
  insertOrderItem.run(10, 5, 'Диван коричневый', 'Кор01', 1, 10000, null, 'done', 1);
})();
console.log('✓ Orders seeded');

// Shipments
const insertShipment = db.prepare(`
  INSERT INTO shipments (id, order_id, order_number, counterparty_id, date, invoice_number, amount, status, payment_due_date, paid_amount, paid_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertShipment.run(1, 1, 'ЗАК-2026-0042', 1, '2026-03-15', 'ТН-2026-0038', 425000, 'shipped', '2026-04-14', 425000, '2026-04-10');
  insertShipment.run(2, 3, 'ЗАК-2026-0044', 3, '2026-03-28', 'ТН-2026-0045', 300000, 'shipped', '2026-04-11', 0, null);
  insertShipment.run(3, 3, 'ЗАК-2026-0044', 3, '2026-04-02', 'ТН-2026-0052', 168000, 'shipped', '2026-04-16', 0, null);
  insertShipment.run(4, 5, 'ЗАК-2026-011', 3, '2026-04-10', 'ТН-2026-011', 10000, 'shipped', '2026-04-24', 0, null);
  insertShipment.run(5, 1, 'ЗАК-2026-0042', 1, '2026-04-10', 'ТН-2026-011', 425000, 'shipped', '2026-05-10', 0, null);
  insertShipment.run(6, 1, 'ЗАК-2026-0042', 1, '2026-04-10', 'ТН-2026-012', 780000, 'shipped', '2026-05-10', 0, null);
})();

// Shipment items
const insertShipmentItem = db.prepare(`INSERT INTO shipment_items (shipment_id, order_item_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)`);
db.transaction(() => {
  insertShipmentItem.run(1, 1, 'Кресло офисное «Комфорт-М»', 20, 8500);
  insertShipmentItem.run(2, 7, 'Кресло офисное «Менеджер»', 15, 12000);
  insertShipmentItem.run(3, 6, 'Стол рабочий угловой', 10, 16800);
  insertShipmentItem.run(4, 10, 'Диван коричневый', 1, 10000);
  insertShipmentItem.run(5, 1, 'Кресло офисное «Комфорт-М»', 50, 8500);
  insertShipmentItem.run(5, 2, 'Стол рабочий 160×80', 30, 12000);
  insertShipmentItem.run(5, 3, 'Тумба 3-ящичная', 30, 5500);
  insertShipmentItem.run(6, 1, 'Кресло офисное «Комфорт-М»', 30, 8500);
  insertShipmentItem.run(6, 2, 'Стол рабочий 160×80', 30, 12000);
  insertShipmentItem.run(6, 3, 'Тумба 3-ящичная', 30, 5500);
})();
console.log('✓ Shipments seeded');

// Payments
const insertPayment = db.prepare(`
  INSERT INTO payments (id, shipment_id, counterparty_id, amount, due_date, paid_date, status, invoice_number, penalty_days, penalty_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertPayment.run(1, 1, 1, 425000, '2026-04-14', '2026-04-10', 'paid', 'ТН-2026-0038', 0, 0);
  insertPayment.run(2, 2, 3, 300000, '2026-04-11', null, 'overdue', 'ТН-2026-0045', 5, 1500);
  insertPayment.run(3, 3, 3, 168000, '2026-04-16', null, 'pending', 'ТН-2026-0052', 0, 0);
  insertPayment.run(4, 4, 3, 10000, '2026-04-24', null, 'pending', 'ТН-2026-011', 0, 0);
  insertPayment.run(5, 5, 1, 425000, '2026-05-10', null, 'pending', 'ТН-2026-011', 0, 0);
  insertPayment.run(6, 6, 1, 780000, '2026-05-10', null, 'pending', 'ТН-2026-012', 0, 0);
})();
console.log('✓ Payments seeded');

// Claims
const insertClaim = db.prepare(`
  INSERT INTO claims (id, number, contract_id, shipment_id, counterparty_id, order_item_id, date, deadline, description, status, responsible, pause_payments, affected_payment_id, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertClaim.run(1, 'РЕК-2026-001', 1, 1, 1, 1, '2026-03-25', '2026-04-25', 'Обнаружен дефект обивки на 3 из 20 кресел (потёртости)', 'in_review', 'Козлов Д.В.', 1, null, 2);
  insertClaim.run(2, 'РЕК-2026-002', 2, 3, 3, 6, '2026-04-04', '2026-05-04', 'Несоответствие размеров 2 столов заявленным в спецификации', 'open', 'Новиков А.И.', 0, 3, 2);
})();
console.log('✓ Claims seeded');

// Production tasks
const insertTask = db.prepare(`
  INSERT INTO production_tasks (id, order_id, order_number, name, line_id, start_date, end_date, progress, status, responsible, priority, color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertTask.run(1, 1, 'ЗАК-2026-0042', 'Кресло офисное «Комфорт-М» (50 шт)', 4, '2026-03-22', '2026-04-11', 65, 'in_progress', 'Козлов Д.В.', 'high', '#3b82f6');
  insertTask.run(2, 1, 'ЗАК-2026-0042', 'Стол рабочий 160×80 (30 шт)', 3, '2026-04-01', '2026-04-18', 30, 'in_progress', 'Козлов Д.В.', 'high', '#3b82f6');
  insertTask.run(3, 1, 'ЗАК-2026-0042', 'Тумба 3-ящичная (30 шт)', 1, '2026-04-09', '2026-04-24', 0, 'planned', 'Козлов Д.В.', 'high', '#3b82f6');
  insertTask.run(4, 3, 'ЗАК-2026-0044', 'Стол рабочий угловой (25 шт)', 3, '2026-03-27', '2026-04-14', 55, 'in_progress', 'Козлов Д.В.', 'high', '#10b981');
  insertTask.run(5, 3, 'ЗАК-2026-0044', 'Кресло «Менеджер» (25 шт)', 2, '2026-03-29', '2026-04-09', 80, 'in_progress', 'Козлов Д.В.', 'high', '#10b981');
  insertTask.run(6, 2, 'ЗАК-2026-0043', 'Шкаф 4-дверный (20 шт)', 1, '2026-04-26', '2026-05-21', 0, 'planned', 'Козлов Д.В.', 'medium', '#f59e0b');
  insertTask.run(7, 4, 'ЗАК-2026-0045', 'Диван угловой «Люкс» (30 шт)', 2, '2026-05-06', '2026-06-20', 0, 'planned', 'Козлов Д.В.', 'high', '#8b5cf6');
})();
console.log('✓ Production tasks seeded');

// Notifications (for all users)
const insertNotification = db.prepare(`
  INSERT INTO notifications (user_id, type, title, text, date, read) VALUES (?, ?, ?, ?, ?, ?)
`);

const notifs = [
  ['warning', 'Просрочка платежа', 'ООО АО «ОфисПлюс» — просрочка 5 дней по счёту ТН-2026-0045', '2026-04-06', 0],
  ['info', 'Срок обязательства', 'Договор ДГ-2026-003 — клиент должен предоставить схемы расстановки до 15.04', '2026-04-06', 0],
  ['success', 'Оплата получена', 'ООО «МебельТорг» оплатил счёт ТН-2026-0038 на 425 000 руб.', '2026-04-10', 1],
  ['warning', 'Рекламация на рассмотрении', 'РЕК-2026-001 — срок рассмотрения истекает 25.04', '2026-04-05', 0],
  ['info', 'Производство', 'Задача «Кресло офисное» выполнена на 65%', '2026-04-06', 0],
];

db.transaction(() => {
  // Add notifications to relevant users (1=admin, 3=accountant, 7=director)
  for (const userId of [1, 3, 7]) {
    for (const n of notifs) insertNotification.run(userId, ...n);
  }
})();
console.log('✓ Notifications seeded');

// Chat messages
const insertChat = db.prepare(`
  INSERT INTO chat_messages (id, contract_id, counterparty_id, from_type, author, text, date, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertChat.run(1, 1, 1, 'client', 'Алексеев В.П.', 'Добрый день! Когда ожидается отгрузка второй партии кресел?', '2026-04-05 10:15', 1);
  insertChat.run(2, 1, 1, 'manager', 'Петрова М.В.', 'Добрый день, Виктор Петрович! Вторая партия запланирована на 10-12 апреля. Уточним дату ближе к событию.', '2026-04-05 11:30', 1);
  insertChat.run(3, 3, 5, 'client', 'Фёдорова Н.А.', 'Прошу подтвердить сроки поставки мягкой мебели. У нас открытие гостиницы в августе.', '2026-04-06 09:00', 0);
})();
console.log('✓ Chat messages seeded');

// Audit log
const insertAudit = db.prepare(`
  INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  insertAudit.run(2, 'Петрова М.В.', 'Создан договор ДГ-2026-003', 'Договор', 3, '192.168.1.15', '2026-03-10 14:22');
  insertAudit.run(4, 'Козлов Д.В.', 'Обновлён статус задачи производства', 'Производство', 1, '192.168.1.22', '2026-04-06 08:15');
  insertAudit.run(2, 'Петрова М.В.', 'Зарегистрирована отгрузка ТН-2026-0052', 'Отгрузка', 3, '192.168.1.15', '2026-04-02 16:30');
  insertAudit.run(3, 'Сидоров П.К.', 'Зарегистрирован платёж по счёту ТН-2026-0038', 'Платёж', 1, '192.168.1.18', '2026-04-10 10:00');
  insertAudit.run(1, 'Иванов А.С.', 'Создан пользователь Морозова Е.А.', 'Пользователь', 6, '192.168.1.10', '2026-03-01 09:00');
  insertAudit.run(1, 'Иванов А.С.', 'Изменён заказ ЗАК-2026-0043', 'Заказ', 2, '127.0.0.1', '2026-04-10 04:42:21');
  insertAudit.run(1, 'Иванов А.С.', 'Зарегистрирован платёж по счёту ТН-2026-0045', 'Платёж', 2, '127.0.0.1', '2026-04-10 04:47:04');
  insertAudit.run(1, 'Иванов А.С.', 'Создан заказ ЗАК-2026-011', 'Заказ', 5, '127.0.0.1', '2026-04-10 08:58:18');
  insertAudit.run(1, 'Иванов А.С.', 'Изменён заказ ЗАК-2026-011', 'Заказ', 5, '127.0.0.1', '2026-04-10 08:58:35');
  insertAudit.run(1, 'Иванов А.С.', 'Обновлён статус позиции заказа ЗАК-2026-011: done', 'Заказ', 5, '127.0.0.1', '2026-04-10 13:23:05');
  insertAudit.run(1, 'Иванов А.С.', 'Зарегистрирована отгрузка ТН-2026-011', 'Отгрузка', 4, '127.0.0.1', '2026-04-10 13:23:53');
  insertAudit.run(1, 'Иванов А.С.', 'Обновлён статус позиции заказа ЗАК-2026-0042: done', 'Заказ', 1, '127.0.0.1', '2026-04-10 13:25:28');
  insertAudit.run(1, 'Иванов А.С.', 'Заказ ЗАК-2026-0042 готов к отгрузке', 'Заказ', 1, '127.0.0.1', '2026-04-10 13:28:13');
  insertAudit.run(1, 'Иванов А.С.', 'Зарегистрирована отгрузка ТН-2026-011', 'Отгрузка', 5, '127.0.0.1', '2026-04-10 13:29:59');
  insertAudit.run(1, 'Иванов А.С.', 'Зарегистрирована отгрузка ТН-2026-012', 'Отгрузка', 6, '127.0.0.1', '2026-04-10 13:30:48');
})();
console.log('✓ Audit log seeded');

console.log('\n✅ Database seeded successfully!');
console.log('Default password for all users: password123');
