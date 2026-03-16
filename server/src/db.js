const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'trc_crm.db');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'director', 'support', 'finance')),
      azure_oid TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT,
      tier TEXT CHECK(tier IN ('A', 'B', 'C')),
      website TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      type TEXT DEFAULT 'Contact',
      first_name TEXT,
      mi TEXT,
      last_name TEXT,
      title TEXT,
      email TEXT,
      linkedin TEXT,
      business_phone TEXT,
      mobile_phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      country TEXT,
      executive_assistant TEXT,
      ea_email TEXT,
      trc_owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      overlap_flag INTEGER DEFAULT 0,
      last_contact TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      stage TEXT NOT NULL DEFAULT 'Target Identified',
      tier TEXT,
      last_touch TEXT,
      next_action_date TEXT,
      next_action_notes TEXT,
      ea_linked TEXT,
      sales_motion TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'Qualified',
      sales_motion TEXT,
      estimated_value REAL,
      confidence INTEGER,
      service_line TEXT,
      close_date TEXT,
      start_date TEXT,
      duration_weeks INTEGER,
      fte_per_month REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      activity_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_relationships_owner ON relationships(owner_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_stage ON relationships(stage);
    CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_id);
    CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
  `);

  // Migrate contacts table — add new columns if they don't exist yet
  const contactCols = db.prepare("PRAGMA table_info(contacts)").all().map(c => c.name);
  const newContactCols = [
    ['type', "TEXT DEFAULT 'Contact'"],
    ['first_name', 'TEXT'],
    ['mi', 'TEXT'],
    ['last_name', 'TEXT'],
    ['linkedin', 'TEXT'],
    ['business_phone', 'TEXT'],
    ['mobile_phone', 'TEXT'],
    ['address', 'TEXT'],
    ['city', 'TEXT'],
    ['state', 'TEXT'],
    ['zip_code', 'TEXT'],
    ['country', 'TEXT'],
    ['executive_assistant', 'TEXT'],
    ['ea_email', 'TEXT'],
    ['trc_owner_id', 'INTEGER'],
    ['overlap_flag', 'INTEGER DEFAULT 0'],
    ['last_contact', 'TEXT'],
  ];
  for (const [col, def] of newContactCols) {
    if (!contactCols.includes(col)) {
      db.exec(`ALTER TABLE contacts ADD COLUMN ${col} ${def}`);
    }
  }

  // Migrate opportunities table
  const oppCols = db.prepare("PRAGMA table_info(opportunities)").all().map(c => c.name);
  const newOppCols = [
    ['start_date', 'TEXT'],
    ['duration_weeks', 'INTEGER'],
    ['fte_per_month', 'REAL'],
  ];
  for (const [col, def] of newOppCols) {
    if (!oppCols.includes(col)) {
      db.exec(`ALTER TABLE opportunities ADD COLUMN ${col} ${def}`);
    }
  }

  // Seed demo data — users/accounts seeded once; contacts/relationships/opps seeded if missing
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

  if (userCount === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);

    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Dave Petrone',  'DavidP@trcadvisory.com',  hash, 'admin');
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Tim Holloway',  'tim@trcadvisory.com',     hash, 'director');
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Melissa Grant', 'melissa@trcadvisory.com', hash, 'support');
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Hemal Patel',   'hemal@trcadvisory.com',   hash, 'finance');

    console.log('Seeded users. Login: DavidP@trcadvisory.com / admin123');
  }

  console.log('Database initialized at', DB_PATH);
}

module.exports = { getDb, initDb };
