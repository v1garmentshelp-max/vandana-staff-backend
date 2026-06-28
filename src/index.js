import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import handlers
import indexHandler from '../api/index.js';
import staffHandler from '../api/staff.js';
import attendanceHandler from '../api/attendance.js';
import savingsHandler from '../api/savings.js';
import loansHandler from '../api/loans.js';
import commissionHandler from '../api/commission.js';
import settingsHandler from '../api/settings.js';
import auditHandler from '../api/audit.js';

const app = express();
app.use(cors());
app.use(express.json());

// Express middleware wrapper to match Vercel's req/res API interface
const handle = (fn) => (req, res) => {
  // Ensure req.url matches the full path including /api so handlers can route correctly
  req.url = req.originalUrl;
  return fn(req, res);
};

app.all('/api/staff*', handle(staffHandler));
app.all('/api/attendance*', handle(attendanceHandler));
app.all('/api/savings*', handle(savingsHandler));
app.all('/api/loans*', handle(loansHandler));
app.all('/api/commission*', handle(commissionHandler));
app.all('/api/settings*', handle(settingsHandler));
app.all('/api/audit*', handle(auditHandler));
app.all('/', handle(indexHandler));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Local dev server running on http://localhost:${PORT}`);
});
