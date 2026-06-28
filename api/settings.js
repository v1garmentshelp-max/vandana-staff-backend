import { getPool, setCors, handleOptions, ok, err } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const pool  = getPool();
  const url   = req.url.split('?')[0];
  const parts = url.replace(/^\/api\/settings\/?/, '').split('/').filter(Boolean);
  const seg0  = parts[0]; // undefined | "holidays" | key
  const seg1  = parts[1]; // holiday date for DELETE

  // GET /api/settings
  if (req.method === 'GET' && !seg0) {
    try {
      const { rows: s } = await pool.query('SELECT key,value FROM settings');
      const { rows: h } = await pool.query(
        "SELECT to_char(date,'YYYY-MM-DD') AS date,name FROM holidays ORDER BY date"
      );
      const settings = {};
      s.forEach(r => { settings[r.key] = r.value; });
      return ok(res, { ...settings, holidays: h });
    } catch (e) { return err(res, e.message); }
  }

  // PUT /api/settings/:key
  if (req.method === 'PUT' && seg0 && seg0 !== 'holidays') {
    const { value } = req.body;
    try {
      await pool.query(
        "INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2,updated_at=NOW()",
        [seg0, String(value)]
      );
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/settings/holidays
  if (req.method === 'POST' && seg0 === 'holidays') {
    const { date, name } = req.body;
    try {
      await pool.query(
        "INSERT INTO holidays (date,name) VALUES ($1,$2) ON CONFLICT (date) DO UPDATE SET name=$2",
        [date, name || 'Custom Holiday']
      );
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  // DELETE /api/settings/holidays/:date
  if (req.method === 'DELETE' && seg0 === 'holidays' && seg1) {
    try {
      await pool.query('DELETE FROM holidays WHERE date=$1', [seg1]);
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  return err(res, 'Not found', 404);
}
