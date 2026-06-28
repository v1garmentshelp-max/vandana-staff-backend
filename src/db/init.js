import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SCHEMA = `
-- ── Branches ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  city        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Staff ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  designation       TEXT DEFAULT '',
  branch            TEXT DEFAULT '',
  aadhar            TEXT DEFAULT '',
  phone             TEXT DEFAULT '',
  alt_phone         TEXT DEFAULT '',
  dob               TEXT DEFAULT '',
  salary            INTEGER DEFAULT 0,
  fixed_cutting     INTEGER DEFAULT 0,
  advance           INTEGER DEFAULT 0,
  extra_advance     INTEGER DEFAULT 0,
  monthly_recovery  INTEGER DEFAULT 0,
  total_outstanding INTEGER DEFAULT 0,
  total_savings     INTEGER DEFAULT 0,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Attendance ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  staff_id    TEXT REFERENCES staff(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT CHECK (status IN ('P','PL','UL','A')) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- ── Savings confirmations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_confirmations (
  id          SERIAL PRIMARY KEY,
  staff_id    TEXT REFERENCES staff(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,          -- "YYYY-MM"
  amount      INTEGER NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, month)
);

-- ── Loans (Extra Advance) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id              SERIAL PRIMARY KEY,
  staff_id        TEXT REFERENCES staff(id) ON DELETE CASCADE UNIQUE,
  total_amount    INTEGER DEFAULT 0,
  monthly_emi     INTEGER DEFAULT 0,
  remaining       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id          SERIAL PRIMARY KEY,
  staff_id    TEXT REFERENCES staff(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  note        TEXT DEFAULT '',
  paid_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Commission ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_targets (
  id          SERIAL PRIMARY KEY,
  staff_id    TEXT REFERENCES staff(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  target      INTEGER DEFAULT 0,
  sales       INTEGER DEFAULT 0,
  rate        NUMERIC(5,2) DEFAULT 1.0,
  pool        INTEGER DEFAULT 0,
  emp_comm    INTEGER DEFAULT 0,
  help_total  INTEGER DEFAULT 0,
  per_helper  INTEGER DEFAULT 0,
  achievement INTEGER DEFAULT 0,
  helpers     TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, month)
);

-- ── Settings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Holidays ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id          SERIAL PRIMARY KEY,
  date        DATE UNIQUE NOT NULL,
  name        TEXT DEFAULT 'Custom Holiday',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ DEFAULT NOW(),
  action      TEXT NOT NULL,
  staff_id    TEXT,
  field       TEXT,
  old_val     TEXT,
  new_val     TEXT,
  source      TEXT DEFAULT 'manual'
);

-- ── Excel Import Log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_logs (
  id            SERIAL PRIMARY KEY,
  imported_at   TIMESTAMPTZ DEFAULT NOW(),
  filename      TEXT DEFAULT '',
  rows_updated  INTEGER DEFAULT 0,
  rows_added    INTEGER DEFAULT 0,
  changes_json  TEXT DEFAULT '{}'
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_audit_staff           ON audit_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_commission_month      ON commission_targets(month);
`;

const SEED_BRANCHES = `
INSERT INTO branches (name, city) VALUES
  ('VANDANA SHOPPING MALL', 'Vizianagaram'),
  ('VANDANA GARMENTS',      'Vizianagaram'),
  ('VANDANA LADIES',        'Vizianagaram'),
  ('WARE HOUSE',            'Vizianagaram'),
  ('AGENCY',                'Vizianagaram'),
  ('INN&OUT (SKLM)',        'Srikakulam'),
  ('INN&OUT (PALASA)',      'Palasa')
ON CONFLICT (name) DO NOTHING;
`;

const SEED_SETTINGS = `
INSERT INTO settings (key, value) VALUES
  ('weekly_off', '0'),
  ('wa_token',   ''),
  ('wa_phone_id','')
ON CONFLICT (key) DO NOTHING;
`;

const SEED_HOLIDAYS = `
INSERT INTO holidays (date, name) VALUES
  ('2025-01-26', 'Republic Day'),
  ('2025-03-14', 'Holi'),
  ('2025-04-14', 'Tamil New Year'),
  ('2025-04-18', 'Good Friday'),
  ('2025-08-15', 'Independence Day'),
  ('2025-10-02', 'Gandhi Jayanti'),
  ('2025-10-24', 'Dussehra'),
  ('2025-11-05', 'Diwali'),
  ('2025-12-25', 'Christmas'),
  ('2026-01-26', 'Republic Day'),
  ('2026-03-03', 'Holi'),
  ('2026-04-14', 'Tamil New Year'),
  ('2026-08-15', 'Independence Day'),
  ('2026-10-02', 'Gandhi Jayanti')
ON CONFLICT (date) DO NOTHING;
`;

async function init() {
  console.log('🔌 Connecting to Neon database...');
  const client = await pool.connect();
  try {
    console.log('✅ Connected!');
    console.log('📋 Creating tables...');
    await client.query(SCHEMA);
    console.log('🌿 Seeding branches...');
    await client.query(SEED_BRANCHES);
    console.log('⚙️  Seeding settings...');
    await client.query(SEED_SETTINGS);
    console.log('📅 Seeding holidays...');
    await client.query(SEED_HOLIDAYS);
    console.log('✅ Database initialized successfully!');
    console.log('');
    console.log('Next step: run  npm run db:seed  to load your 84 staff members.');
  } catch (err) {
    console.error('❌ Init failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

init();
