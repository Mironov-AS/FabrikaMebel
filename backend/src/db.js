const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = path.resolve(__dirname, '..', process.env.DB_PATH || './data/database.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    position TEXT,
    active INTEGER DEFAULT 1,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS counterparties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    inn TEXT,
    kpp TEXT,
    address TEXT,
    contact TEXT,
    phone TEXT,
    email TEXT,
    priority TEXT DEFAULT 'medium',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    counterparty_id INTEGER,
    date TEXT,
    valid_until TEXT,
    status TEXT DEFAULT 'draft',
    amount REAL DEFAULT 0,
    subject TEXT,
    payment_delay INTEGER DEFAULT 30,
    penalty_rate REAL DEFAULT 0.1,
    file_name TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (counterparty_id) REFERENCES counterparties(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contract_conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    fulfilled INTEGER DEFAULT 0,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contract_obligations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    party TEXT NOT NULL,
    text TEXT NOT NULL,
    deadline TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contract_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    version_num INTEGER NOT NULL,
    date TEXT NOT NULL,
    author TEXT,
    changes TEXT,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    contract_id INTEGER,
    counterparty_id INTEGER,
    date TEXT,
    shipment_deadline TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'planned',
    total_amount REAL DEFAULT 0,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (counterparty_id) REFERENCES counterparties(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    article TEXT,
    quantity INTEGER DEFAULT 0,
    price REAL DEFAULT 0,
    category TEXT,
    status TEXT DEFAULT 'planned',
    shipped INTEGER DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    order_number TEXT,
    counterparty_id INTEGER,
    date TEXT,
    invoice_number TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'shipped',
    payment_due_date TEXT,
    paid_amount REAL DEFAULT 0,
    paid_date TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (counterparty_id) REFERENCES counterparties(id)
  );

  CREATE TABLE IF NOT EXISTS shipment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    order_item_id INTEGER,
    name TEXT,
    quantity INTEGER DEFAULT 0,
    price REAL DEFAULT 0,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER,
    counterparty_id INTEGER,
    amount REAL DEFAULT 0,
    due_date TEXT,
    paid_date TEXT,
    status TEXT DEFAULT 'pending',
    invoice_number TEXT,
    penalty_days INTEGER DEFAULT 0,
    penalty_amount REAL DEFAULT 0,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id),
    FOREIGN KEY (counterparty_id) REFERENCES counterparties(id)
  );

  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    contract_id INTEGER,
    shipment_id INTEGER,
    counterparty_id INTEGER,
    order_item_id INTEGER,
    date TEXT,
    deadline TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    responsible TEXT,
    resolution TEXT,
    pause_payments INTEGER DEFAULT 0,
    affected_payment_id INTEGER,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (shipment_id) REFERENCES shipments(id)
  );

  CREATE TABLE IF NOT EXISTS production_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    order_number TEXT,
    name TEXT,
    line_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'planned',
    responsible TEXT,
    priority TEXT DEFAULT 'medium',
    color TEXT DEFAULT '#3b82f6',
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT DEFAULT 'info',
    title TEXT,
    text TEXT,
    date TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER,
    counterparty_id INTEGER,
    from_type TEXT,
    author TEXT,
    text TEXT,
    date TEXT,
    read INTEGER DEFAULT 1,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Add account-lockout columns if missing (SQLite does not support IF NOT EXISTS for ALTER)
const existingCols = db.pragma('table_info(users)').map(c => c.name);
if (!existingCols.includes('failed_attempts')) {
  db.exec('ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0');
}
if (!existingCols.includes('locked_until')) {
  db.exec('ALTER TABLE users ADD COLUMN locked_until TEXT');
}

// Password-reset tokens table
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

module.exports = db;
