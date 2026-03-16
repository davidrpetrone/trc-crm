const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../../data');
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

  // Seed demo data if no users exist
  const row = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (row.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);

    // Users
    const uDave    = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Dave Petrone',    'DavidP@trcadvisory.com',  hash, 'admin').lastInsertRowid;
    const uTim     = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Tim Holloway',    'tim@trcadvisory.com',     hash, 'director').lastInsertRowid;
    const uMelissa = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Melissa Grant',   'melissa@trcadvisory.com', hash, 'support').lastInsertRowid;
    const uHemal   = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run('Hemal Patel',     'hemal@trcadvisory.com',   hash, 'finance').lastInsertRowid;

    // Accounts
    const aApex    = db.prepare('INSERT INTO accounts (name, industry, tier) VALUES (?,?,?)').run('Apex Industrial Group',   'Manufacturing',        'A').lastInsertRowid;
    const aVenture = db.prepare('INSERT INTO accounts (name, industry, tier) VALUES (?,?,?)').run('Venture Capital Grp',     'Private Equity',       'A').lastInsertRowid;
    const aNorthStar=db.prepare('INSERT INTO accounts (name, industry, tier) VALUES (?,?,?)').run('NorthStar Energy',        'Energy & Utilities',   'B').lastInsertRowid;
    const aCrest   = db.prepare('INSERT INTO accounts (name, industry, tier) VALUES (?,?,?)').run('Crest Financial Partners','Financial Services',   'A').lastInsertRowid;
    const aPinnacle= db.prepare('INSERT INTO accounts (name, industry, tier) VALUES (?,?,?)').run('Pinnacle Health Systems', 'Healthcare',           'B').lastInsertRowid;
    const aBlue    = db.prepare('INSERT INTO accounts (name, industry, tier) VALUES (?,?,?)').run('Blue Ridge Logistics',    'Transportation',       'C').lastInsertRowid;

    // Contacts
    const ins = db.prepare('INSERT INTO contacts (account_id, type, first_name, last_name, title, email, business_phone, trc_owner_id, tier, last_contact) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const cJames  = ins.run(aApex,    'Contact',  'James',   'Whitfield', 'CEO',                    'jwhitfield@apexind.com',   '412-555-0101', uDave,    'A', '2026-03-01').lastInsertRowid;
    const cSarah  = ins.run(aApex,    'Contact',  'Sarah',   'Connors',   'VP Operations',          'sconnors@apexind.com',     '412-555-0102', uTim,     'A', '2026-02-14').lastInsertRowid;
    const cMark   = ins.run(aVenture, 'Contact',  'Mark',    'Ellison',   'Managing Partner',       'mellison@venturecg.com',   '212-555-0201', uDave,    'A', '2026-03-10').lastInsertRowid;
    const cRachel = ins.run(aNorthStar,'Contact', 'Rachel',  'Torres',    'CFO',                    'rtorres@northstarenergy.com','713-555-0301',uTim,    'B', '2026-01-20').lastInsertRowid;
    const cDan    = ins.run(aCrest,   'Contact',  'Daniel',  'Forsythe',  'Partner',                'dforsythe@crestfp.com',    '312-555-0401', uDave,    'A', '2026-03-05').lastInsertRowid;
    const cLisa   = ins.run(aCrest,   'Prospect', 'Lisa',    'Nakamura',  'Director of Strategy',   'lnakamura@crestfp.com',    '312-555-0402', uTim,     'A', '2026-02-01').lastInsertRowid;
    const cBrian  = ins.run(aPinnacle,'Contact',  'Brian',   'Okafor',    'COO',                    'bokafor@pinnaclehealth.com','615-555-0501', uMelissa, 'B', '2025-12-10').lastInsertRowid;
    const cTanya  = ins.run(aBlue,    'Prospect', 'Tanya',   'Simmons',   'VP Supply Chain',        'tsimmons@blueridgelog.com', '540-555-0601', uTim,     'C', null).lastInsertRowid;

    // Relationships
    const rIns = db.prepare(`INSERT INTO relationships
      (contact_id, account_id, owner_id, stage, tier, last_touch, next_action_date, next_action_notes, sales_motion, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    rIns.run(cJames,  aApex,     uDave,    'Commercial Signal Observed', 'A', '2026-03-01', '2026-03-20', 'Send capability deck',          'Relationship-led',   'Long-standing relationship. James flagged org redesign project.');
    rIns.run(cSarah,  aApex,     uTim,     'Relationship Developing',    'A', '2026-02-14', '2026-03-25', 'Follow up on ops assessment RFI','Relationship-led',   'Introduced by James. Key decision-maker for ops work.');
    rIns.run(cMark,   aVenture,  uDave,    'Relationship Active',        'A', '2026-03-10', '2026-04-01', 'Quarterly check-in call',        'Referral/PE-led',    'PE contact. Actively referring portfolio companies.');
    rIns.run(cRachel, aNorthStar,uTim,     'Relationship Active',        'B', '2026-01-20', '2026-03-18', 'Re-engage after Q1 close',       'Market-driven',      'Stale — needs re-engagement after budget cycle.');
    rIns.run(cDan,    aCrest,    uDave,    'Convert to Opportunity',     'A', '2026-03-05', '2026-03-17', 'Schedule scoping call',          'Relationship-led',   'Ready to convert. Finance transformation discussion ongoing.');
    rIns.run(cLisa,   aCrest,    uTim,     'Target Identified',          'A', null,         '2026-03-28', 'Intro email via Dan Forsythe',   'Relationship-led',   'Warm intro pending from Dan.');
    rIns.run(cBrian,  aPinnacle, uMelissa, 'Relationship Developing',    'B', '2025-12-10', '2026-03-19', 'Healthcare ops capability brief', 'Market-driven',      'Attended TRC webinar in Dec. Interest in care delivery ops.');
    rIns.run(cTanya,  aBlue,     uTim,     'Target Identified',          'C', null,         null,         null,                             'Market-driven',      'Cold outreach target. Supply chain background relevant.');

    // Opportunities
    const oIns = db.prepare(`INSERT INTO opportunities
      (account_id, contact_id, owner_id, name, stage, sales_motion, estimated_value, confidence,
       service_line, close_date, start_date, duration_weeks, fte_per_month, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    oIns.run(aApex,    cJames, uDave, 'Apex Org Redesign',            'Proposal Delivered',      'Relationship-led', 480000, 70, 'Human Capital',          '2026-04-15', '2026-05-01', 16, 3.0, 'Full org design and change management. Verbal interest received.');
    oIns.run(aCrest,   cDan,   uDave, 'Crest Finance Transformation', 'Verbal Alignment',        'Relationship-led', 620000, 85, 'Finance & Accounting',   '2026-04-01', '2026-04-14', 20, 4.0, 'CFO-sponsored. Contract review underway.');
    oIns.run(aVenture, cMark,  uDave, 'Portfolio Co Ops Assessment',  'Discovery',               'Referral/PE-led',  180000, 40, 'Operations',             '2026-05-30', '2026-06-16', 8,  2.0, 'PE-referred portco. Scope TBD pending discovery.');
    oIns.run(aNorthStar,cRachel,uTim, 'NorthStar Cost Reduction',     'Solution Shaping',        'Market-driven',    340000, 55, 'Operations',             '2026-05-15', '2026-06-01', 12, 2.5, 'Cost takeout initiative. Solution shaping with Rachel\'s team.');
    oIns.run(aPinnacle,cBrian,  uMelissa,'Pinnacle Care Delivery Ops', 'Qualified',               'Market-driven',    260000, 25, 'Operations',             '2026-06-30', '2026-07-07', 10, 2.0, 'Early stage. Budget confirmation needed.');
    oIns.run(aApex,    cSarah,  uTim,  'Apex Supply Chain Pilot',     'Proposal in Development', 'Relationship-led', 150000, 60, 'Operations',             '2026-04-30', '2026-05-15', 6,  1.5, 'Follow-on to org redesign if won. Proposal due April 18.');

    console.log('Seeded demo data: 4 users, 6 accounts, 8 contacts, 8 relationships, 6 opportunities');
    console.log('Login: DavidP@trcadvisory.com / admin123');
  }

  console.log('Database initialized at', DB_PATH);
}

module.exports = { getDb, initDb };
