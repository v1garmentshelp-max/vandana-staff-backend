import { getPool, setCors, handleOptions, ok, err, addAudit } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const pool    = getPool();
  const url     = req.url.split('?')[0];
  const parts   = url.replace(/^\/api\/loans\/?/, '').split('/').filter(Boolean);
  const staffId = parts[0];

  // GET /api/loans
  if (req.method === 'GET' && !staffId) {
    try {
      const { rows: loans }    = await pool.query('SELECT * FROM loans');
      const { rows: payments } = await pool.query('SELECT * FROM loan_payments ORDER BY paid_at DESC');
      const result = {};
      loans.forEach(l => {
        result[l.staff_id] = {
          total: Number(l.total_amount), monthly: Number(l.monthly_emi),
          remaining: Number(l.remaining),
          payments: payments
            .filter(p => p.staff_id === l.staff_id)
            .map(p => ({ amount: Number(p.amount), note: p.note, date: p.paid_at })),
        };
      });
      return ok(res, result);
    } catch (e) { return err(res, e.message); }
  }

  // GET /api/loans/:staffId
  if (req.method === 'GET' && staffId) {
    try {
      const { rows: loans }    = await pool.query('SELECT * FROM loans WHERE staff_id=$1', [staffId]);
      const { rows: payments } = await pool.query('SELECT * FROM loan_payments WHERE staff_id=$1 ORDER BY paid_at DESC', [staffId]);
      if (!loans.length) return ok(res, { total:0, monthly:0, remaining:0, payments:[] });
      const l = loans[0];
      return ok(res, {
        total: Number(l.total_amount), monthly: Number(l.monthly_emi),
        remaining: Number(l.remaining),
        payments: payments.map(p => ({ amount: Number(p.amount), note: p.note, date: p.paid_at })),
      });
    } catch (e) { return err(res, e.message); }
  }

  // PUT /api/loans/:staffId
  if (req.method === 'PUT' && staffId) {
    const { total, monthly, remaining } = req.body;
    try {
      await pool.query(`
        INSERT INTO loans (staff_id,total_amount,monthly_emi,remaining)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (staff_id) DO UPDATE SET
          total_amount=$2,monthly_emi=$3,remaining=$4,updated_at=NOW()`,
        [staffId, total, monthly, remaining]
      );
      await pool.query(
        'UPDATE staff SET extra_advance=$2,monthly_recovery=$3,total_outstanding=$4,updated_at=NOW() WHERE id=$1',
        [staffId, total, monthly, remaining]
      );
      await addAudit(pool, staffId, 'LOAN_UPDATE', 'loan', null, JSON.stringify({ total, monthly, remaining }));
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/loans/:staffId — payment
  if (req.method === 'POST' && staffId) {
    const { amount, note } = req.body;
    try {
      await pool.query(
        'INSERT INTO loan_payments (staff_id,amount,note) VALUES ($1,$2,$3)',
        [staffId, amount, note || '']
      );
      await pool.query(
        'UPDATE loans SET remaining=GREATEST(0,remaining-$2),updated_at=NOW() WHERE staff_id=$1',
        [staffId, amount]
      );
      await pool.query(
        'UPDATE staff SET total_outstanding=(SELECT remaining FROM loans WHERE staff_id=$1),updated_at=NOW() WHERE id=$1',
        [staffId]
      );
      await addAudit(pool, staffId, 'LOAN_PAYMENT', 'remaining', null, amount);
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  return err(res, 'Not found', 404);
}
