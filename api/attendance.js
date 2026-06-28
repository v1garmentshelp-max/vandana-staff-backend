import { getPool, setCors, handleOptions, ok, err } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const pool  = getPool();
  const url   = req.url.split('?')[0];
  const seg   = url.replace(/^\/api\/attendance\/?/, '').split('/').filter(Boolean)[0];

  // GET /api/attendance/months
  if (req.method === 'GET' && seg === 'months') {
    try {
      const { rows } = await pool.query(
        "SELECT DISTINCT to_char(date,'YYYY-MM') AS month FROM attendance ORDER BY month DESC"
      );
      return ok(res, rows.map(r => r.month));
    } catch (e) { return err(res, e.message); }
  }

  // GET /api/attendance/:month
  if (req.method === 'GET' && seg) {
    try {
      const { rows } = await pool.query(
        "SELECT staff_id,to_char(date,'YYYY-MM-DD') AS date,status FROM attendance WHERE to_char(date,'YYYY-MM')=$1",
        [seg]
      );
      const result = {};
      rows.forEach(r => {
        if (!result[r.staff_id]) result[r.staff_id] = {};
        result[r.staff_id][r.date] = r.status;
      });
      return ok(res, result);
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/attendance/bulk-present
  if (req.method === 'POST' && seg === 'bulk-present') {
    const { staffIds, date } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of staffIds) {
        await client.query(
          "INSERT INTO attendance (staff_id,date,status) VALUES ($1,$2,'P') ON CONFLICT (staff_id,date) DO NOTHING",
          [id, date]
        );
      }
      await client.query('COMMIT');
      return ok(res, { ok: true, marked: staffIds.length });
    } catch (e) { await client.query('ROLLBACK'); return err(res, e.message); }
    finally { client.release(); }
  }

  // POST /api/attendance — mark one
  if (req.method === 'POST') {
    const { staffId, date, status } = req.body;
    try {
      if (!status) {
        await pool.query('DELETE FROM attendance WHERE staff_id=$1 AND date=$2', [staffId, date]);
      } else {
        await pool.query(
          "INSERT INTO attendance (staff_id,date,status) VALUES ($1,$2,$3) ON CONFLICT (staff_id,date) DO UPDATE SET status=$3,updated_at=NOW()",
          [staffId, date, status]
        );
      }
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  return err(res, 'Not found', 404);
}
