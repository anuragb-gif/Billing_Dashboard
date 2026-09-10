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

// ---- refresh coordination ----
// One refresh at a time: the queries are heavy (~2.8M billing rows) and a
// second concurrent run - e.g. a manual trigger landing on top of the nightly
// retry - would double the load on the source SQL Server.
let refreshInProgress = false;

async function triggerRefresh(reason) {
  if (refreshInProgress) {
    console.log(`[refresh] ${reason}: skipped, a refresh is already running`);
    return { skipped: true };
  }
  refreshInProgress = true;
  try {
    console.log(`[refresh] ${reason}: starting`);
    await runRefresh();
    console.log(`[refresh] ${reason}: done`);
    return { ok: true };
  } finally {
    refreshInProgress = false;
  }
}

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
    const result = await triggerRefresh('manual (API)');
    if (result.skipped) {
      return res.status(409).json({ ok: false, error: 'a refresh is already running' });
    }
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

// Scheduled refresh - time configurable via .env (REFRESH_CRON).
// The source SQL Server is sometimes still busy with morning jobs when this
// first fires, so on failure we retry once after REFRESH_RETRY_DELAY_MS
// (default 30 min). If the retry also fails we give up until the next run.
const cronExpr = process.env.REFRESH_CRON || '30 2 * * *';
const retryDelayMs = Number(process.env.REFRESH_RETRY_DELAY_MS || 30 * 60 * 1000);
const retryDelayMin = Math.round(retryDelayMs / 60000);

if (cron.validate(cronExpr)) {
  cron.schedule(cronExpr, async () => {
    try {
      await triggerRefresh('scheduled');
    } catch (err) {
      console.error(`[cron] scheduled refresh failed: ${err.message}`);
      console.log(`[cron] retrying once in ${retryDelayMin} min`);
      setTimeout(() => {
        triggerRefresh('scheduled retry').catch((e) =>
          console.error(`[cron] retry refresh failed: ${e.message} - giving up until next run`),
        );
      }, retryDelayMs);
    }
  });
  console.log(`Scheduled refresh registered: "${cronExpr}" (one retry after ${retryDelayMin} min on failure)`);
} else {
  console.warn(`REFRESH_CRON "${cronExpr}" is not valid cron syntax - scheduled refresh disabled.`);
}
