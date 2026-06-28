import { setCors, handleOptions, ok } from './_db.js';

export default function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  return ok(res, {
    status: 'Vandana Mall API running ✅',
    version: '2.0',
    timestamp: new Date().toISOString(),
  });
}
