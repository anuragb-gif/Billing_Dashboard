const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.LOCAL_DB_PATH || './data/dashboard.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

// Quote an identifier that may contain spaces (the report keeps the original
// SQL column names verbatim, e.g. "Item Name", "Op Pal").
const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';

// Bump this whenever the column layout of billing/utilization/item_master
// changes so the old tables are dropped and rebuilt on the next refresh.
const SCHEMA_VERSION = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS billing (
  "Date" TEXT, "Item_No" TEXT, "Item Name" TEXT, "Base UOM" TEXT,
  "StorageType" TEXT, "Location Code" TEXT, "Opening" REAL, "In Quantity" REAL,
  "Out Quantity" REAL, "Closing" REAL, "Status" TEXT, "Customer No" TEXT,
  "Customer Name" TEXT, "Item Conversion" REAL, "Op Pal" REAL, "In Pal" REAL,
  "Out Pal" REAL, "Cl pal" REAL
);

CREATE TABLE IF NOT EXISTS utilization (
  "Region" TEXT, "Primary_Customer_No" TEXT, "Customer_Name" TEXT, "Code" TEXT,
  "Location_Name" TEXT, "Frozen" REAL, "Frozen_Capacity" REAL, "Chilled" REAL,
  "Chilled_Capacity" REAL, "DRY" REAL, "Dry_Capacity" REAL, "OnDate" TEXT
);

CREATE TABLE IF NOT EXISTS item_master (
  "Report" TEXT, "LocationCode" TEXT, "Customer" TEXT, "Location" TEXT,
  "Customer Name" TEXT, "ItemNo" TEXT, "Min_Billable Quantity" REAL,
  "PalletConv" REAL, "KGConv" REAL, "CASEConv" REAL, "CRATEConv" REAL,
  "BILLKGConv" REAL, "BAGConv" REAL, "BOTTLEConv" REAL, "BOXConv" REAL,
  "BUCKETConv" REAL, "DRUMConv" REAL, "EACHConv" REAL, "NOSConv" REAL,
  "PCSConv" REAL, "PKTConv" REAL, "Billing Category Qty" REAL,
  "BillingCategoryUOM" TEXT, "Storage_Type" TEXT, "Unit_Price" REAL,
  "Base_Unit_of_Measure" TEXT, "Quantity" REAL, "Qty in Pal" REAL, "Item Name" TEXT
);

CREATE TABLE IF NOT EXISTS refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  status TEXT NOT NULL,
  billing_rows INTEGER,
  utilization_rows INTEGER,
  item_master_rows INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_date ON billing("Date");
CREATE INDEX IF NOT EXISTS idx_billing_customer ON billing("Customer No");
CREATE INDEX IF NOT EXISTS idx_util_date ON utilization("OnDate");
CREATE INDEX IF NOT EXISTS idx_util_customer ON utilization("Primary_Customer_No");
CREATE INDEX IF NOT EXISTS idx_item_customer ON item_master("Customer");
CREATE INDEX IF NOT EXISTS idx_item_location ON item_master("LocationCode");
`;

// One-time migration: if the stored layout is older than SCHEMA_VERSION, drop
// the data tables so they are recreated with the current columns. They repopulate
// on the next `npm run refresh` (or `npm run seed-sample`).
const storedVersion = db.pragma('user_version', { simple: true });
if (storedVersion < SCHEMA_VERSION) {
  db.exec(`
    DROP TABLE IF EXISTS billing;
    DROP TABLE IF EXISTS utilization;
    DROP TABLE IF EXISTS item_master;
    DROP TABLE IF EXISTS billing_staging;
    DROP TABLE IF EXISTS utilization_staging;
    DROP TABLE IF EXISTS item_master_staging;
  `);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  if (storedVersion > 0) {
    console.warn(`[localDb] schema upgraded ${storedVersion} -> ${SCHEMA_VERSION}; run a refresh to repopulate.`);
  }
}

db.exec(SCHEMA);

/**
 * Replace a table's contents atomically: write to a staging table, then
 * swap it in inside a transaction. This means the API never reads a
 * half-refreshed table, even if the refresh job is mid-run.
 */
function replaceTable(tableName, columns, rows) {
  const stagingTable = `${tableName}_staging`;
  db.exec(`DROP TABLE IF EXISTS ${stagingTable}`);
  db.exec(`CREATE TABLE ${stagingTable} AS SELECT * FROM ${tableName} WHERE 0`);

  const placeholders = columns.map(() => '?').join(', ');
  const insert = db.prepare(
    `INSERT INTO ${stagingTable} (${columns.map(q).join(', ')}) VALUES (${placeholders})`
  );

  const insertMany = db.transaction((allRows) => {
    for (const row of allRows) {
      insert.run(columns.map((c) => row[c] ?? null));
    }
  });
  insertMany(rows);

  const swap = db.transaction(() => {
    db.exec(`DROP TABLE ${tableName}`);
    db.exec(`ALTER TABLE ${stagingTable} RENAME TO ${tableName}`);
  });
  swap();
}

function logRefresh({ status, billingRows, utilizationRows, itemMasterRows, error }) {
  db.prepare(
    `INSERT INTO refresh_log (ran_at, status, billing_rows, utilization_rows, item_master_rows, error)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(new Date().toISOString(), status, billingRows ?? null, utilizationRows ?? null, itemMasterRows ?? null, error ?? null);
}

module.exports = { db, replaceTable, logRefresh, q };
