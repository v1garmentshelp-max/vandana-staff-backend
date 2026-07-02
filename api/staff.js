import { getPool, camelStaff, setCors, handleOptions, ok, err, addAudit } from './_db.js';

function toSnake(s) {
  return s.replace(/[A-Z]/g, l => '_' + l.toLowerCase());
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const pool  = getPool();
  const url   = req.url.split('?')[0];
  const parts = url.replace(/^\/api\/staff\/?/, '').split('/').filter(Boolean);
  const seg   = parts[0]; // undefined | "bulk" | staffId

  // GET /api/staff
  if (req.method === 'GET' && !seg) {
    try {
      const { rows } = await pool.query('SELECT * FROM staff WHERE active=TRUE ORDER BY id');
      return ok(res, rows.map(camelStaff));
    } catch (e) { return err(res, e.message); }
  }

  // GET /api/staff/:id
  if (req.method === 'GET' && seg) {
    try {
      const { rows } = await pool.query('SELECT * FROM staff WHERE id=$1', [seg]);
      if (!rows.length) return err(res, 'Not found', 404);
      return ok(res, camelStaff(rows[0]));
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/staff/bulk
  if (req.method === 'POST' && seg === 'bulk') {
    const { changes } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let updated = 0, added = 0;

      // One UPDATE per staff (all changed fields in one query)
      for (const c of changes.filter(x => x.type === 'update')) {
        if (!c.diffs?.length) continue;
        const setClauses = c.diffs.map((d, i) => `${toSnake(d.field)}=$${i + 2}`).join(', ');
        await client.query(
          `UPDATE staff SET ${setClauses}, updated_at=NOW() WHERE id=$1`,
          [c.id, ...c.diffs.map(d => d.new)]
        );
        updated++;
      }

      // Batch INSERT for new staff
      const adds = changes.filter(x => x.type === 'add');
      if (adds.length) {
        const placeholders = [], vals = [];
        let pi = 1;
        for (const c of adds) {
          const m = c.mapped || {};
          const newId = c.id && c.id !== 'NEW' ? c.id : `VM${Date.now()}${added}`;
          placeholders.push(`($${pi},$${pi+1},$${pi+2},$${pi+3},$${pi+4},$${pi+5},$${pi+6},$${pi+7},$${pi+8},$${pi+9},$${pi+10},$${pi+11},$${pi+12},$${pi+13},$${pi+14},$${pi+15},$${pi+16})`);
          vals.push(newId, m.name||c.name, m.designation||'', m.branch||'', m.aadhar||'',
            m.phone||'', m.altPhone||'', m.dob||'',
            m.salary||0, m.fixedCutting||0, m.advance||0,
            m.extraAdvance||0, m.monthlyRecovery||0, m.totalOutstanding||0, m.totalSavings||0,
            m.daysPresent||0, m.daysAbsent||0);
          pi += 17; added++;
        }
        await client.query(`
          INSERT INTO staff (id,name,designation,branch,aadhar,phone,alt_phone,dob,
            salary,fixed_cutting,advance,extra_advance,monthly_recovery,total_outstanding,total_savings,days_present,days_absent)
          VALUES ${placeholders.join(',')} ON CONFLICT (id) DO NOTHING`, vals);
      }

      await client.query(
        'INSERT INTO import_logs (rows_updated,rows_added,changes_json) VALUES ($1,$2,$3)',
        [updated, added, JSON.stringify(changes)]
      );
      await client.query('COMMIT');
      return ok(res, { ok: true, updated, added });
    } catch (e) { await client.query('ROLLBACK'); return err(res, e.message); }
    finally { client.release(); }
  }

  // POST /api/staff
  if (req.method === 'POST' && !seg) {
    const s = req.body;
    try {
      const { rows } = await pool.query(`
        INSERT INTO staff (id,name,designation,branch,aadhar,phone,alt_phone,dob,salary,
          fixed_cutting,advance,extra_advance,monthly_recovery,total_outstanding,total_savings,days_present,days_absent)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [s.id,s.name,s.designation||'',s.branch||'',s.aadhar||'',s.phone||'',
         s.altPhone||'',s.dob||'',s.salary||0,s.fixedCutting||0,s.advance||0,
         s.extraAdvance||0,s.monthlyRecovery||0,s.totalOutstanding||0,s.totalSavings||0,
         s.daysPresent||0,s.daysAbsent||0]
      );
      await addAudit(pool, rows[0].id, 'ADD_STAFF', null, null, s.name);
      return ok(res, camelStaff(rows[0]), 201);
    } catch (e) { return err(res, e.message); }
  }

  // PUT /api/staff/:id
  if (req.method === 'PUT' && seg) {
    const s = req.body;
    try {
      const { rows } = await pool.query(`
        UPDATE staff SET name=$2,designation=$3,branch=$4,aadhar=$5,phone=$6,alt_phone=$7,
          dob=$8,salary=$9,fixed_cutting=$10,advance=$11,extra_advance=$12,
          monthly_recovery=$13,total_outstanding=$14,total_savings=$15,days_present=$16,days_absent=$17,updated_at=NOW()
        WHERE id=$1 RETURNING *`,
        [seg,s.name,s.designation||'',s.branch||'',s.aadhar||'',s.phone||'',
         s.altPhone||'',s.dob||'',s.salary||0,s.fixedCutting||0,s.advance||0,
         s.extraAdvance||0,s.monthlyRecovery||0,s.totalOutstanding||0,s.totalSavings||0,
         s.daysPresent||0,s.daysAbsent||0]
      );
      if (!rows.length) return err(res, 'Not found', 404);
      await addAudit(pool, seg, 'UPDATE_STAFF', null, null, JSON.stringify(s));
      return ok(res, camelStaff(rows[0]));
    } catch (e) { return err(res, e.message); }
  }

  // DELETE /api/staff/:id
  if (req.method === 'DELETE' && seg) {
    try {
      const { rows } = await pool.query(
        'UPDATE staff SET active=FALSE,updated_at=NOW() WHERE id=$1 RETURNING name', [seg]
      );
      await addAudit(pool, seg, 'DELETE_STAFF', null, rows[0]?.name, null);
      return ok(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  return err(res, 'Not found', 404);
}
