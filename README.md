# Snowman Ops Dashboard

Billing, Utilization, and Item Master reporting - refreshed automatically
overnight instead of run by hand every month.

## How it works

1. **Refresh job** (`backend/src/jobs/refresh.js`) connects to your SQL
   Server, runs the three optimized queries, and writes the results into a
   local SQLite file (`backend/data/dashboard.db`).
2. **API server** (`backend/src/server.js`) serves that local data to the
   dashboard, and re-runs the refresh job automatically every night on a
   schedule (2:30 AM by default).
3. **Dashboard** (`frontend/`) is a React app your team opens in a browser.

Because the dashboard reads from the local SQLite file (not live from SQL
Server), it stays fast even if the source database is slow, and your team
isn't waiting on a query every time they open it.

The Billing, Utilization, and Item Master tables show every column from the
original SQL query, with the original column names. Each detail table has an
**Export CSV** button that downloads *all* rows matching the current filters
(not just the rows visible on screen) so people can open the full report in
Excel.

## One-time setup

### 1. Backend

```
cd backend
npm install
copy .env.example .env        (Mac/Linux: cp .env.example .env)
```

Open `.env` and fill in your real SQL Server details:

```
SQL_SERVER=your-server-name-or-ip
SQL_DATABASE=your-main-database-name
SQL_USER=your-sql-login
SQL_PASSWORD=your-sql-password
```

> If your SQL Server is a **named instance** (e.g. `HOST\INSTANCE`), put just the
> host name here. The driver can't parse the `HOST\INSTANCE` form; if the
> instance listens on the default port 1433 the bare host works fine.

Also set the dashboard login (one shared password for the whole team) and a
cookie secret:

```
DASHBOARD_PASSWORD=pick-a-team-password
SESSION_SECRET=<paste output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

Then pull real data for the first time:

```
npm run refresh
```

(To preview the dashboard with realistic fake data before your SQL Server
details are ready, run `npm run seed-sample` instead.)

### 2. Frontend

```
cd frontend
npm install
```

## Running it (development)

Two terminals, with live reload:

```
# Terminal 1 - API on :4000
cd backend
npm start

# Terminal 2 - Vite dev server on :5173 (proxies /api to :4000)
cd frontend
npm run dev
```

Open `http://localhost:5173`. You'll be asked for the dashboard password.

## Running it (production - the all-in-one server)

Build the frontend once; the backend then serves it, so there's **one process
and one port** (`4000`) to run and keep alive.

```
cd frontend
npm run build          # outputs frontend/dist/

cd ../backend
npm start              # serves the API AND the built dashboard on :4000
```

Open `http://localhost:4000`. Rebuild (`npm run build`) whenever the frontend
changes.

### Letting your team reach it on the office network

1. Find your PC's local IPv4 address: `ipconfig` (something like `192.168.1.45`).
2. Allow the port through Windows Firewall (run once, in an **Administrator**
   PowerShell):

   ```
   netsh advfirewall firewall add rule name="Snowman Dashboard" dir=in action=allow protocol=TCP localport=4000
   ```

3. Share the URL: `http://192.168.1.45:4000`. Everyone signs in with the shared
   password.

## Keeping it running automatically (Windows Task Scheduler)

The server already runs its own nightly refresh (see `REFRESH_CRON` in `.env`) -
but only while it's running. One Task Scheduler entry keeps the whole thing up
across reboots and logoff:

**Task: Snowman Dashboard**
- General: "Run whether user is logged on or not"
- Trigger: **At startup** (or At log on)
- Action: **Start a program**
  - Program/script: `node`  *(or the full path from `where node` if Task
    Scheduler can't find it, e.g. `C:\Program Files\nodejs\node.exe`)*
  - Add arguments: `src/server.js`
  - Start in: `C:\path\to\snowman-dashboard\backend`
- Settings: tick **"If the task fails, restart every 1 minute"** (up to 3 times)
  so a crash recovers on its own.

After a reboot the dashboard comes back up on its own, already serving the
latest overnight data.

## Updating it later

```
cd C:\path\to\snowman-dashboard
git pull
cd backend  && npm ci
cd ../frontend && npm ci && npm run build
```

Then restart the task (Task Scheduler → right-click → End, then Run), or reboot.

## Project structure

```
backend/
  src/
    db/           local SQLite + source SQL Server connections
    queries/      the three optimized .sql files
    jobs/         refresh.js (real data) and seedSample.js (fake data for testing)
    routes/       Express API endpoints the dashboard calls
    auth.js       shared-password login (signed cookie)
    server.js     entrypoint - API + nightly schedule + serves built frontend
frontend/
  public/
    login.html    standalone sign-in page
  src/
    components/   NavRail, FilterBar, KpiStrip, DataTable
    pages/        Overview, Billing, Utilization, Item Master
    App.jsx       page routing + shared filter state
```
