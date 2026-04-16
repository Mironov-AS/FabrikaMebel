/**
 * SQLite in-memory mock for the PostgreSQL db module.
 * Provides the same async interface, so all routes work without a real PG instance.
 */
const Database = require('better-sqlite3');

const sqlite = new Database(':memory:');

// ─── Schema ─────────────────────────────────────────────────────────────────

function createSchema() {
  sqlite.exec(`
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
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS counterparties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      inn TEXT,
      kpp TEXT,
      address TEXT,
      delivery_address TEXT,
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
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contract_conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      fulfilled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contract_obligations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      party TEXT NOT NULL,
      text TEXT NOT NULL,
      deadline TEXT,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS contract_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      version_num INTEGER NOT NULL,
      date TEXT NOT NULL,
      author TEXT,
      changes TEXT
    );

    CREATE TABLE IF NOT EXISTS contract_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mimetype TEXT,
      size INTEGER DEFAULT 0,
      content_text TEXT,
      uploaded_by INTEGER,
      uploaded_by_name TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
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
      shipped INTEGER DEFAULT 0
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
      delivery_type TEXT DEFAULT 'pickup',
      delivery_address TEXT,
      scheduled_date TEXT
    );

    CREATE TABLE IF NOT EXISTS shipment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      order_item_id INTEGER,
      name TEXT,
      quantity INTEGER DEFAULT 0,
      price REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER,
      invoice_id INTEGER,
      counterparty_id INTEGER,
      amount REAL DEFAULT 0,
      due_date TEXT,
      paid_date TEXT,
      status TEXT DEFAULT 'pending',
      invoice_number TEXT,
      penalty_days INTEGER DEFAULT 0,
      penalty_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      invoice_number TEXT,
      invoice_date TEXT,
      amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      due_date TEXT,
      counterparty_id INTEGER,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
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
      color TEXT DEFAULT '#3b82f6'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT DEFAULT 'info',
      title TEXT,
      text TEXT,
      date TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER,
      counterparty_id INTEGER,
      from_type TEXT,
      author TEXT,
      text TEXT,
      date TEXT,
      read INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      license TEXT,
      vehicle_brand TEXT,
      vehicle_model TEXT,
      vehicle_year TEXT,
      vehicle_notes TEXT,
      vehicle TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS delivery_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER,
      route_date TEXT NOT NULL,
      status TEXT DEFAULT 'planned',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS route_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      shipment_id INTEGER NOT NULL,
      delivery_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('company_name', 'Test Company');
  `);

  // Insert static production lines (in-memory fixture used by production.js)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS production_lines (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER DEFAULT 10
    );
    INSERT OR IGNORE INTO production_lines VALUES (1, 'Линия 1 — Корпусная мебель', 10);
    INSERT OR IGNORE INTO production_lines VALUES (2, 'Линия 2 — Мягкая мебель', 8);
    INSERT OR IGNORE INTO production_lines VALUES (3, 'Линия 3 — Кухни', 6);
  `);
}

createSchema();

// ─── Helper: convert $1,$2,... → ? ──────────────────────────────────────────

function pgToSqlite(sql) {
  // Replace $N with ? (order matters for positional params)
  let s = sql.replace(/\$\d+/g, '?');
  // Replace NOW() with datetime('now')
  s = s.replace(/\bNOW\(\)/gi, "datetime('now')");
  // Remove PostgreSQL type casts ::type
  s = s.replace(/::[a-zA-Z_]+/g, '');
  return s;
}

// ─── Helper: strip RETURNING id ─────────────────────────────────────────────

function stripReturning(sql) {
  return sql.replace(/\s+RETURNING\s+\w+/gi, '');
}

// ─── Async wrapper interface ────────────────────────────────────────────────

const db = {
  pool: {
    end: async () => {},
    connect: async () => ({
      query: db.query,
      release: () => {},
    }),
  },

  query: async (sql, params = []) => {
    const sqliteSQL = pgToSqlite(sql);

    // Handle RETURNING id in INSERT
    if (/^\s*INSERT/i.test(sqliteSQL) && /RETURNING\s+\w+/i.test(sql)) {
      const clean = stripReturning(sqliteSQL);
      const stmt = sqlite.prepare(clean);
      const result = stmt.run(...params);
      return { rows: [{ id: result.lastInsertRowid }], rowCount: result.changes };
    }

    // Handle information_schema queries (hasColumn mock)
    if (/information_schema/i.test(sql)) {
      const tableMatch = sql.match(/table_name\s*=\s*\$1/i);
      const colMatch = sql.match(/column_name\s*=\s*\$2/i);
      if (tableMatch && colMatch && params.length >= 2) {
        try {
          const info = sqlite.prepare(`PRAGMA table_info("${params[0]}")`).all();
          const exists = info.some(col => col.name === params[1]);
          return { rows: exists ? [{ column_name: params[1] }] : [], rowCount: exists ? 1 : 0 };
        } catch {
          return { rows: [], rowCount: 0 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT / other
    try {
      if (/^\s*SELECT/i.test(sqliteSQL) || /^\s*WITH/i.test(sqliteSQL)) {
        const stmt = sqlite.prepare(sqliteSQL);
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      }
      const stmt = sqlite.prepare(sqliteSQL);
      const result = stmt.run(...params);
      return { rows: [], rowCount: result.changes };
    } catch (err) {
      throw new Error(`SQLite query error: ${err.message}\nSQL: ${sqliteSQL}`);
    }
  },

  get: async (sql, params = []) => {
    const sqliteSQL = pgToSqlite(sql);
    // Handle COUNT(*)::int
    const cleanSQL = sqliteSQL.replace(/::int/gi, '');
    try {
      const stmt = sqlite.prepare(cleanSQL);
      return stmt.get(...params) || null;
    } catch (err) {
      throw new Error(`SQLite get error: ${err.message}\nSQL: ${cleanSQL}`);
    }
  },

  all: async (sql, params = []) => {
    const sqliteSQL = pgToSqlite(sql);
    try {
      const stmt = sqlite.prepare(sqliteSQL);
      return stmt.all(...params);
    } catch (err) {
      throw new Error(`SQLite all error: ${err.message}\nSQL: ${sqliteSQL}`);
    }
  },

  run: async (sql, params = []) => {
    const sqliteSQL = pgToSqlite(sql);
    try {
      const stmt = sqlite.prepare(sqliteSQL);
      const result = stmt.run(...params);
      return { changes: result.changes };
    } catch (err) {
      throw new Error(`SQLite run error: ${err.message}\nSQL: ${sqliteSQL}`);
    }
  },

  runReturning: async (sql, params = []) => {
    const sqliteSQL = pgToSqlite(stripReturning(sql));
    try {
      const stmt = sqlite.prepare(sqliteSQL);
      const result = stmt.run(...params);
      return { lastInsertRowid: result.lastInsertRowid };
    } catch (err) {
      throw new Error(`SQLite runReturning error: ${err.message}\nSQL: ${sqliteSQL}`);
    }
  },

  transaction: async (fn) => {
    const txClient = {
      query: db.query,
      get: db.get,
      all: db.all,
      run: db.run,
      runReturning: db.runReturning,
    };
    return fn(txClient);
  },

  init: async () => {
    createSchema();
  },
};

module.exports = db;
