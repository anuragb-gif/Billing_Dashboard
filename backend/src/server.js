require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const apiRoutes = require('./routes/api');
const { runRefresh } = require('./jobs/refresh');
const { login, logout, requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

// ---- public endpoints (no login needed) ----
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/login', login);
app.post('/api/logout', logout);

// ---- everything else under /api requires the shared-password cookie ----
app.use('/api', requireAuth);
app.use('/api', apiRoutes);

// Manual refresh trigger, useful for a "Refresh now" button in the UI later
app.post('/api/refresh', async (req, res) => {
  try {
    await runRefresh();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- serve the built frontend (production) ----
// In development you run `npm run dev` (Vite on :5173) instead and this block
// is simply skipped because frontend/dist doesn't exist yet.
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`Serving built dashboard from ${distDir}`);
} else {
  console.log('frontend/dist not found - API only (run "npm run build" in frontend/ for the all-in-one server).');
}

const PORT = process.env.PORT || 4000;
// 0.0.0.0 so teammates on the office network can reach it via your PC's IP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Snowman dashboard API listening on http://0.0.0.0:${PORT}`);
});

// Scheduled refresh - default nightly at 2:30 AM, configurable via .env
const cronExpr = process.env.REFRESH_CRON || '30 2 * * *';
if (cron.validate(cronExpr)) {
  cron.schedule(cronExpr, () => {
    console.log('[cron] scheduled refresh starting...');
    runRefresh().catch((err) => console.error('[cron] refresh failed:', err.message));
  });
  console.log(`Scheduled refresh registered: "${cronExpr}"`);
} else {
  console.warn(`REFRESH_CRON "${cronExpr}" is not valid cron syntax - scheduled refresh disabled.`);
}
