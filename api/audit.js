import { getPool, setCors, handleOptions, ok, err } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const pool = getPool();

  // GET /api/audit
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT id,ts,action,staff_id,field,old_val,new_val,source FROM audit_log ORDER BY ts DESC LIMIT 500'
      );
      return ok(res, rows.map(r => ({
        id: r.id, ts: r.ts, action: r.action,
        staffId: r.staff_id, field: r.field,
        oldVal: r.old_val, newVal: r.new_val, source: r.source,
      })));
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/audit
  if (req.method === 'POST') {
    const { action, staffId, field, oldVal, newVal, source } = req.body;
    try {
      await pool.query(
        'INSERT INTO audit_log (action,staff_id,field,old_val,new_val,source) VALUES ($1,$2,$3,$4,$5,$6)',
        [action, staffId||null, field||null,
         oldVal != null ? String(oldVal) : null,
         newVal != null ? String(newVal) : null,
         source || 'manual']
      );
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  return err(res, 'Method not allowed', 405);
}
