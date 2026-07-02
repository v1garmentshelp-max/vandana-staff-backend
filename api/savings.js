import { getPool, setCors, handleOptions, ok, err } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const pool = getPool();
  const url  = req.url.split('?')[0];
  const seg  = url.replace(/^\/api\/savings\/?/, '').split('/').filter(Boolean)[0];

  // GET /api/savings
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(`
        SELECT staff_id,
          COALESCE(json_agg(month ORDER BY month) FILTER (WHERE month IS NOT NULL),'[]') AS confirmed,
          COALESCE(SUM(amount),0) AS total
        FROM savings_confirmations GROUP BY staff_id`
      );
      const result = {};
      rows.forEach(r => {
        result[r.staff_id] = { confirmed: r.confirmed, total: Number(r.total) };
      });
      return ok(res, result);
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/savings/confirm
  if (req.method === 'POST' && seg === 'confirm') {
    const { staffId, month, amount } = req.body;
    try {
      const { rowCount } = await pool.query(
        "INSERT INTO savings_confirmations (staff_id,month,amount) VALUES ($1,$2,$3) ON CONFLICT (staff_id,month) DO NOTHING",
        [staffId, month, amount]
      );
      if (rowCount > 0) {
        await pool.query(
          "UPDATE staff SET total_savings=total_savings+$2,updated_at=NOW() WHERE id=$1",
          [staffId, amount]
        );
      }
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/savings/unconfirm
  if (req.method === 'POST' && seg === 'unconfirm') {
    const { staffId, month } = req.body;
    try {
      const { rows } = await pool.query(
        "SELECT amount FROM savings_confirmations WHERE staff_id=$1 AND month=$2",
        [staffId, month]
      );
      if (rows.length > 0) {
        const amount = Number(rows[0].amount);
        await pool.query(
          'DELETE FROM savings_confirmations WHERE staff_id=$1 AND month=$2',
          [staffId, month]
        );
        await pool.query(
          "UPDATE staff SET total_savings=GREATEST(0,total_savings-$2),updated_at=NOW() WHERE id=$1",
          [staffId, amount]
        );
      }
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  return err(res, 'Not found', 404);
}
