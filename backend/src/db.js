const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ─── SQLite adapter ────────────────────────────────────────────────────────────
function createSqliteDb() {
  const Database = require('better-sqlite3');
  const fs = require('fs');

  const DB_PATH = process.env.NODE_ENV === 'test'
    ? ':memory:'
    : path.resolve(__dirname, '..', process.env.DB_PATH || './data/database.sqlite');

  if (process.env.NODE_ENV !== 'test') {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Convert PostgreSQL $1,$2... placeholders to SQLite ?
  function pgToSqlite(sql) {
    return sql.replace(/\$\d+/g, '?');
  }

  // Strip RETURNING clause and return last insert id via .lastInsertRowid
  function stripReturning(sql) {
    return sql.replace(/\s+RETURNING\s+\w+\s*$/i, '');
  }

  const db = {
    _sqlite: sqlite,

    query: async (sql, params = []) => {
      const s = pgToSqlite(sql).trim();
      const lower = s.toLowerCase().trimStart();
      if (lower.startsWith('select') || lower.startsWith('with')) {
        const rows = sqlite.prepare(s).all(...params);
        return { rows };
      } else {
        const info = sqlite.prepare(s).run(...params);
        return { rows: [], rowCount: info.changes };
      }
    },

    get: async (sql, params = []) => {
      const s = pgToSqlite(sql);
      return sqlite.prepare(s).get(...params) || null;
    },

    all: async (sql, params = []) => {
      const s = pgToSqlite(sql);
      return sqlite.prepare(s).all(...params);
    },

    run: async (sql, params = []) => {
      const s = pgToSqlite(stripReturning(sql));
      const info = sqlite.prepare(s).run(...params);
      return { changes: info.changes };
    },

    runReturning: async (sql, params = []) => {
      const s = pgToSqlite(stripReturning(sql));
      const info = sqlite.prepare(s).run(...params);
      return { lastInsertRowid: info.lastInsertRowid };
    },

    transaction: async (fn) => {
      let result;
      const txn = sqlite.transaction(() => {
        // We can't use async inside better-sqlite3 transactions directly,
        // so we build a sync-compatible tx client
        const txClient = {
          query: (sql, params = []) => {
            const s = pgToSqlite(sql).trim();
            const lower = s.toLowerCase().trimStart();
            if (lower.startsWith('select') || lower.startsWith('with')) {
              return Promise.resolve({ rows: sqlite.prepare(s).all(...params) });
            }
            const info = sqlite.prepare(s).run(...params);
            return Promise.resolve({ rows: [], rowCount: info.changes });
          },
          get: (sql, params = []) => Promise.resolve(sqlite.prepare(pgToSqlite(sql)).get(...params) || null),
          all: (sql, params = []) => Promise.resolve(sqlite.prepare(pgToSqlite(sql)).all(...params)),
          run: (sql, params = []) => {
            const info = sqlite.prepare(pgToSqlite(stripReturning(sql))).run(...params);
            return Promise.resolve({ changes: info.changes });
          },
          runReturning: (sql, params = []) => {
            const info = sqlite.prepare(pgToSqlite(stripReturning(sql))).run(...params);
            return Promise.resolve({ lastInsertRowid: info.lastInsertRowid });
          },
        };
        // fn returns a promise but we can't await inside a sync transaction
        // Run it and capture the result synchronously via a hack
        let resolved;
        fn(txClient).then(r => { resolved = r; });
        result = resolved;
      });
      txn();
      return result;
    },

    init: async () => {
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
        CREATE TABLE IF NOT EXISTS contract_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract_id INTEGER NOT NULL,
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          mimetype TEXT,
          size INTEGER DEFAULT 0,
          uploaded_by INTEGER,
          uploaded_by_name TEXT,
          content_text TEXT,
          uploaded_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
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
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER,
          invoice_number TEXT,
          amount REAL DEFAULT 0,
          paid_amount REAL DEFAULT 0,
          status TEXT DEFAULT 'pending',
          due_date TEXT,
          counterparty_id INTEGER,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (counterparty_id) REFERENCES counterparties(id)
        );
        CREATE TABLE IF NOT EXISTS drivers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
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
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (driver_id) REFERENCES drivers(id)
        );
        CREATE TABLE IF NOT EXISTS route_shipments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          route_id INTEGER NOT NULL,
          shipment_id INTEGER NOT NULL,
          delivery_order INTEGER DEFAULT 0,
          FOREIGN KEY (route_id) REFERENCES delivery_routes(id) ON DELETE CASCADE,
          FOREIGN KEY (shipment_id) REFERENCES shipments(id)
        );
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      // Migrations: add missing columns
      function hasCol(table, col) {
        return sqlite.pragma(`table_info(${table})`).some(c => c.name === col);
      }
      if (!hasCol('payments', 'invoice_id'))          sqlite.exec('ALTER TABLE payments ADD COLUMN invoice_id INTEGER');
      if (!hasCol('invoices', 'invoice_date'))         sqlite.exec('ALTER TABLE invoices ADD COLUMN invoice_date TEXT');
      if (!hasCol('invoices', 'is_active'))            sqlite.exec('ALTER TABLE invoices ADD COLUMN is_active INTEGER DEFAULT 1');
      if (!hasCol('counterparties', 'delivery_address')) sqlite.exec('ALTER TABLE counterparties ADD COLUMN delivery_address TEXT');
      if (!hasCol('shipments', 'delivery_type'))       sqlite.exec("ALTER TABLE shipments ADD COLUMN delivery_type TEXT DEFAULT 'pickup'");
      if (!hasCol('shipments', 'delivery_address'))    sqlite.exec('ALTER TABLE shipments ADD COLUMN delivery_address TEXT');
      if (!hasCol('shipments', 'scheduled_date'))      sqlite.exec('ALTER TABLE shipments ADD COLUMN scheduled_date TEXT');
      if (!hasCol('drivers', 'license'))               sqlite.exec('ALTER TABLE drivers ADD COLUMN license TEXT');
      if (!hasCol('drivers', 'vehicle_brand'))         sqlite.exec('ALTER TABLE drivers ADD COLUMN vehicle_brand TEXT');
      if (!hasCol('drivers', 'vehicle_model'))         sqlite.exec('ALTER TABLE drivers ADD COLUMN vehicle_model TEXT');
      if (!hasCol('drivers', 'vehicle_year'))          sqlite.exec('ALTER TABLE drivers ADD COLUMN vehicle_year TEXT');
      if (!hasCol('drivers', 'vehicle_notes'))         sqlite.exec('ALTER TABLE drivers ADD COLUMN vehicle_notes TEXT');
      if (!hasCol('users', 'failed_attempts'))         sqlite.exec('ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0');
      if (!hasCol('users', 'locked_until'))            sqlite.exec('ALTER TABLE users ADD COLUMN locked_until TEXT');

      const existingCo = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'company_name'").get();
      if (!existingCo) sqlite.prepare("INSERT INTO app_settings (key, value) VALUES ('company_name', '')").run();

      // Fix stuck orders
      const stuck = sqlite.prepare("SELECT id FROM orders WHERE status IN ('ready_for_shipment', 'scheduled_for_shipment')").all();
      for (const order of stuck) {
        const items = sqlite.prepare('SELECT quantity, shipped FROM order_items WHERE order_id = ?').all(order.id);
        if (items.length > 0 && items.every(i => (i.shipped || 0) >= i.quantity)) {
          sqlite.prepare("UPDATE orders SET status = 'shipped' WHERE id = ?").run(order.id);
        }
      }

      console.log('Database initialized (SQLite)');
    },
  };

  return db;
}

// ─── PostgreSQL adapter ────────────────────────────────────────────────────────
function createPgDb() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const db = {
    pool,

    query: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        return await client.query(sql, params);
      } finally {
        client.release();
      }
    },

    get: async (sql, params = []) => {
      const result = await db.query(sql, params);
      return result.rows[0] || null;
    },

    all: async (sql, params = []) => {
      const result = await db.query(sql, params);
      return result.rows;
    },

    run: async (sql, params = []) => {
      const result = await db.query(sql, params);
      return { changes: result.rowCount };
    },

    runReturning: async (sql, params = []) => {
      const returningSQL = sql.trimEnd().replace(/;$/, '') + ' RETURNING id';
      const result = await db.query(returningSQL, params);
      return { lastInsertRowid: result.rows[0]?.id };
    },

    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txClient = {
          query: (sql, params = []) => client.query(sql, params),
          get: async (sql, params = []) => { const r = await client.query(sql, params); return r.rows[0] || null; },
          all: async (sql, params = []) => { const r = await client.query(sql, params); return r.rows; },
          run: async (sql, params = []) => { const r = await client.query(sql, params); return { changes: r.rowCount }; },
          runReturning: async (sql, params = []) => {
            const s = sql.trimEnd().replace(/;$/, '') + ' RETURNING id';
            const r = await client.query(s, params);
            return { lastInsertRowid: r.rows[0]?.id };
          },
        };
        const result = await fn(txClient);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    init: async () => {
      // (same CREATE TABLE statements as before — abbreviated here)
      const { Pool: _P } = require('pg'); // already imported above
      // Run all CREATE TABLE IF NOT EXISTS from original db.js
      // We import the init logic inline to keep this file self-contained
      await _initPg(db);
      console.log('Database initialized (PostgreSQL)');
    },
  };

  return db;
}

async function _initPg(db) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, position TEXT, active INTEGER DEFAULT 1, mfa_enabled INTEGER DEFAULT 0, mfa_secret TEXT, last_login TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS counterparties (id SERIAL PRIMARY KEY, name TEXT NOT NULL, inn TEXT, kpp TEXT, address TEXT, contact TEXT, phone TEXT, email TEXT, priority TEXT DEFAULT 'medium', created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS contracts (id SERIAL PRIMARY KEY, number TEXT UNIQUE NOT NULL, counterparty_id INTEGER, date TEXT, valid_until TEXT, status TEXT DEFAULT 'draft', amount REAL DEFAULT 0, subject TEXT, payment_delay INTEGER DEFAULT 30, penalty_rate REAL DEFAULT 0.1, file_name TEXT, created_by INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (counterparty_id) REFERENCES counterparties(id), FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS contract_conditions (id SERIAL PRIMARY KEY, contract_id INTEGER NOT NULL, text TEXT NOT NULL, fulfilled INTEGER DEFAULT 0, FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS contract_obligations (id SERIAL PRIMARY KEY, contract_id INTEGER NOT NULL, party TEXT NOT NULL, text TEXT NOT NULL, deadline TEXT, status TEXT DEFAULT 'pending', FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS contract_versions (id SERIAL PRIMARY KEY, contract_id INTEGER NOT NULL, version_num INTEGER NOT NULL, date TEXT NOT NULL, author TEXT, changes TEXT, FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, number TEXT UNIQUE NOT NULL, contract_id INTEGER, counterparty_id INTEGER, date TEXT, shipment_deadline TEXT, priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'planned', total_amount REAL DEFAULT 0, notes TEXT, created_by INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (contract_id) REFERENCES contracts(id), FOREIGN KEY (counterparty_id) REFERENCES counterparties(id))`,
    `CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, name TEXT NOT NULL, article TEXT, quantity INTEGER DEFAULT 0, price REAL DEFAULT 0, category TEXT, status TEXT DEFAULT 'planned', shipped INTEGER DEFAULT 0, FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS shipments (id SERIAL PRIMARY KEY, order_id INTEGER, order_number TEXT, counterparty_id INTEGER, date TEXT, invoice_number TEXT, amount REAL DEFAULT 0, status TEXT DEFAULT 'shipped', payment_due_date TEXT, paid_amount REAL DEFAULT 0, paid_date TEXT, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (counterparty_id) REFERENCES counterparties(id))`,
    `CREATE TABLE IF NOT EXISTS shipment_items (id SERIAL PRIMARY KEY, shipment_id INTEGER NOT NULL, order_item_id INTEGER, name TEXT, quantity INTEGER DEFAULT 0, price REAL DEFAULT 0, FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, shipment_id INTEGER, counterparty_id INTEGER, amount REAL DEFAULT 0, due_date TEXT, paid_date TEXT, status TEXT DEFAULT 'pending', invoice_number TEXT, penalty_days INTEGER DEFAULT 0, penalty_amount REAL DEFAULT 0, FOREIGN KEY (shipment_id) REFERENCES shipments(id), FOREIGN KEY (counterparty_id) REFERENCES counterparties(id))`,
    `CREATE TABLE IF NOT EXISTS claims (id SERIAL PRIMARY KEY, number TEXT UNIQUE NOT NULL, contract_id INTEGER, shipment_id INTEGER, counterparty_id INTEGER, order_item_id INTEGER, date TEXT, deadline TEXT, description TEXT, status TEXT DEFAULT 'open', responsible TEXT, resolution TEXT, pause_payments INTEGER DEFAULT 0, affected_payment_id INTEGER, created_by INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (contract_id) REFERENCES contracts(id), FOREIGN KEY (shipment_id) REFERENCES shipments(id))`,
    `CREATE TABLE IF NOT EXISTS production_tasks (id SERIAL PRIMARY KEY, order_id INTEGER, order_number TEXT, name TEXT, line_id INTEGER, start_date TEXT, end_date TEXT, progress INTEGER DEFAULT 0, status TEXT DEFAULT 'planned', responsible TEXT, priority TEXT DEFAULT 'medium', color TEXT DEFAULT '#3b82f6', FOREIGN KEY (order_id) REFERENCES orders(id))`,
    `CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER, type TEXT DEFAULT 'info', title TEXT, text TEXT, date TEXT, read INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, contract_id INTEGER, counterparty_id INTEGER, from_type TEXT, author TEXT, text TEXT, date TEXT, read INTEGER DEFAULT 1, FOREIGN KEY (contract_id) REFERENCES contracts(id))`,
    `CREATE TABLE IF NOT EXISTS audit_log (id SERIAL PRIMARY KEY, user_id INTEGER, user_name TEXT, action TEXT, entity_type TEXT, entity_id INTEGER, ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS invoices (id SERIAL PRIMARY KEY, order_id INTEGER, invoice_number TEXT, amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, status TEXT DEFAULT 'pending', due_date TEXT, counterparty_id INTEGER, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (counterparty_id) REFERENCES counterparties(id))`,
    `CREATE TABLE IF NOT EXISTS contract_files (id SERIAL PRIMARY KEY, contract_id INTEGER NOT NULL, original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mimetype TEXT, size INTEGER DEFAULT 0, uploaded_by INTEGER, uploaded_by_name TEXT, uploaded_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE, FOREIGN KEY (uploaded_by) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS drivers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT, vehicle TEXT, active INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS delivery_routes (id SERIAL PRIMARY KEY, driver_id INTEGER, route_date TEXT NOT NULL, status TEXT DEFAULT 'planned', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (driver_id) REFERENCES drivers(id))`,
    `CREATE TABLE IF NOT EXISTS route_shipments (id SERIAL PRIMARY KEY, route_id INTEGER NOT NULL, shipment_id INTEGER NOT NULL, delivery_order INTEGER DEFAULT 0, FOREIGN KEY (route_id) REFERENCES delivery_routes(id) ON DELETE CASCADE, FOREIGN KEY (shipment_id) REFERENCES shipments(id))`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`,
  ];
  for (const sql of tables) await db.query(sql);

  async function hasColumn(table, column) {
    const result = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' AND column_name = $2`,
      [table, column]
    );
    return result.rows.length > 0;
  }
  if (!(await hasColumn('payments', 'invoice_id')))           await db.query('ALTER TABLE payments ADD COLUMN invoice_id INTEGER REFERENCES invoices(id)');
  if (!(await hasColumn('invoices', 'invoice_date')))          await db.query('ALTER TABLE invoices ADD COLUMN invoice_date TEXT');
  if (!(await hasColumn('invoices', 'is_active')))             await db.query('ALTER TABLE invoices ADD COLUMN is_active INTEGER DEFAULT 1');
  if (!(await hasColumn('contract_files', 'content_text')))    await db.query('ALTER TABLE contract_files ADD COLUMN content_text TEXT');
  if (!(await hasColumn('counterparties', 'delivery_address'))) await db.query('ALTER TABLE counterparties ADD COLUMN delivery_address TEXT');
  if (!(await hasColumn('shipments', 'delivery_type')))        await db.query("ALTER TABLE shipments ADD COLUMN delivery_type TEXT DEFAULT 'pickup'");
  if (!(await hasColumn('shipments', 'delivery_address')))     await db.query('ALTER TABLE shipments ADD COLUMN delivery_address TEXT');
  if (!(await hasColumn('shipments', 'scheduled_date')))       await db.query('ALTER TABLE shipments ADD COLUMN scheduled_date TEXT');
  if (!(await hasColumn('drivers', 'license')))                await db.query('ALTER TABLE drivers ADD COLUMN license TEXT');
  if (!(await hasColumn('drivers', 'vehicle_brand')))          await db.query('ALTER TABLE drivers ADD COLUMN vehicle_brand TEXT');
  if (!(await hasColumn('drivers', 'vehicle_model')))          await db.query('ALTER TABLE drivers ADD COLUMN vehicle_model TEXT');
  if (!(await hasColumn('drivers', 'vehicle_year')))           await db.query('ALTER TABLE drivers ADD COLUMN vehicle_year TEXT');
  if (!(await hasColumn('drivers', 'vehicle_notes')))          await db.query('ALTER TABLE drivers ADD COLUMN vehicle_notes TEXT');
  if (!(await hasColumn('users', 'failed_attempts')))          await db.query('ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0');
  if (!(await hasColumn('users', 'locked_until')))             await db.query('ALTER TABLE users ADD COLUMN locked_until TEXT');

  const existingCo = await db.get("SELECT value FROM app_settings WHERE key = 'company_name'");
  if (!existingCo) await db.run("INSERT INTO app_settings (key, value) VALUES ('company_name', '')");

  const stuck = await db.all("SELECT id FROM orders WHERE status IN ('ready_for_shipment', 'scheduled_for_shipment')");
  for (const order of stuck) {
    const items = await db.all('SELECT quantity, shipped FROM order_items WHERE order_id = $1', [order.id]);
    if (items.length > 0 && items.every(i => (i.shipped || 0) >= i.quantity)) {
      await db.run("UPDATE orders SET status = 'shipped' WHERE id = $1", [order.id]);
    }
  }
}

// ─── Auto-detect: try PostgreSQL, fall back to SQLite ─────────────────────────
let _db = null;

async function detectAndCreate() {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const testPool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
      const client = await testPool.connect();
      client.release();
      await testPool.end();
      console.log('Using PostgreSQL database');
      return createPgDb();
    } catch (e) {
      console.warn(`PostgreSQL unavailable (${e.message}), falling back to SQLite`);
    }
  }
  console.log('Using SQLite database');
  return createSqliteDb();
}

// Proxy object — forwards all calls to the real db once initialized
const db = new Proxy({}, {
  get(_, prop) {
    if (prop === 'init') {
      return async () => {
        _db = await detectAndCreate();
        return _db.init();
      };
    }
    return (...args) => {
      if (!_db) throw new Error('Database not initialized — call db.init() first');
      return _db[prop](...args);
    };
  },
});

module.exports = db;
