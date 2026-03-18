const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin','director','finance','consultant')),
      azure_oid TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      tier TEXT CHECK(tier IN ('A','B','C')),
      website TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS relationships (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      activity_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add is_active to contacts if missing
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

  // Migrate role constraint to include consultant, drop support
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  // Update any existing 'support' roles to 'consultant' BEFORE re-adding constraint
  await pool.query(`UPDATE users SET role='consultant' WHERE role='support'`);
  await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','director','finance','consultant'))`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_relationships_owner ON relationships(owner_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_relationships_stage  ON relationships(stage)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_opportunities_owner  ON opportunities(owner_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_opportunities_stage  ON opportunities(stage)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activities_entity    ON activities(entity_type, entity_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS financial_inputs (
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      target_revenue REAL DEFAULT 0,
      prior_year_revenue REAL DEFAULT 0,
      PRIMARY KEY (year, month)
    )
  `);

  // Seed users on first boot
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c === 0) {
    const bcrypt = require('bcryptjs');
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Dave Petrone',   'DavidP@trcadvisory.com',   bcrypt.hashSync('admin123',  10), 'admin']);
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Patrick Lelich', 'patrickl@trcadvisory.com', bcrypt.hashSync('lelich22$', 10), 'admin']);
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Hemal Vyas',     'hemalv@trcadvisory.com',   bcrypt.hashSync('vyas22$',   10), 'admin']);
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Melissa Wis',    'melissaw@trcadvisory.com', bcrypt.hashSync('wis22$',    10), 'admin']);
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Gopi Kumar',     'Gopi@trcadvisory.com',     bcrypt.hashSync('Kumar22$',  10), 'director']);
    console.log('Seeded users. Login: DavidP@trcadvisory.com / admin123');
  }

  console.log('Database initialized');
}

module.exports = { pool, initDb };
