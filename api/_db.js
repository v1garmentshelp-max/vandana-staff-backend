import pg from 'pg';
const { Pool } = pg;

let pool;
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 8000,
    });
    pool.on('error', (err) => console.error('DB pool error:', err.message));
  }
  return pool;
}

export function camelStaff(row) {
  return {
    id: row.id, name: row.name, designation: row.designation,
    branch: row.branch, aadhar: row.aadhar, phone: row.phone,
    altPhone: row.alt_phone, dob: row.dob,
    salary: Number(row.salary), fixedCutting: Number(row.fixed_cutting),
    advance: Number(row.advance), extraAdvance: Number(row.extra_advance),
    monthlyRecovery: Number(row.monthly_recovery),
    totalOutstanding: Number(row.total_outstanding),
    totalSavings: Number(row.total_savings),
    active: row.active,
  };
}

// CORS — allow all origins so frontend on different domain can connect
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.status(200).end();
    return true;
  }
  return false;
}

export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

export function err(res, msg, status = 500) {
  console.error(`API Error [${status}]:`, msg);
  return res.status(status).json({ error: msg });
}

export async function addAudit(pool, staffId, action, field, oldVal, newVal, source = 'manual') {
  try {
    await pool.query(
      'INSERT INTO audit_log (staff_id,action,field,old_val,new_val,source) VALUES ($1,$2,$3,$4,$5,$6)',
      [staffId || null, action, field || null,
       oldVal != null ? String(oldVal) : null,
       newVal != null ? String(newVal) : null,
       source]
    );
  } catch (e) { console.error('Audit error:', e.message); }
}
