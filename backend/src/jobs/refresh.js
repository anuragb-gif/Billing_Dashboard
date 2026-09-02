const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { runQuery, sql } = require('../db/source');
const { replaceTable, logRefresh } = require('../db/localDb');

// How far back to pull each run. A rolling window keeps every refresh fast
// and self-healing (no dependency on "did last month's refresh succeed").
const ROLLING_DAYS_BACK = 400; // ~13 months, comfortably covers YoY comparisons

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function loadQueryTemplate(fileName, dateFrom, dateTo) {
  const filePath = path.join(__dirname, '..', 'queries', fileName);
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replaceAll('{{DATE_FROM}}', dateFrom).replaceAll('{{DATE_TO}}', dateTo);
  return text;
}

// Column layout kept verbatim from each report's SELECT list (order matters -
// it drives the SQLite schema, the on-screen table, and the CSV export).
const BILLING_COLUMNS = [
  'Date', 'Item_No', 'Item Name', 'Base UOM', 'StorageType', 'Location Code',
  'Opening', 'In Quantity', 'Out Quantity', 'Closing', 'Status', 'Customer No',
  'Customer Name', 'Item Conversion', 'Op Pal', 'In Pal', 'Out Pal', 'Cl pal',
];

const UTILIZATION_COLUMNS = [
  'Region', 'Primary_Customer_No', 'Customer_Name', 'Code', 'Location_Name',
  'Frozen', 'Frozen_Capacity', 'Chilled', 'Chilled_Capacity', 'DRY',
  'Dry_Capacity', 'OnDate',
];

const ITEM_MASTER_COLUMNS = [
  'Report', 'LocationCode', 'Customer', 'Location', 'Customer Name', 'ItemNo',
  'Min_Billable Quantity', 'PalletConv', 'KGConv', 'CASEConv', 'CRATEConv',
  'BILLKGConv', 'BAGConv', 'BOTTLEConv', 'BOXConv', 'BUCKETConv', 'DRUMConv',
  'EACHConv', 'NOSConv', 'PCSConv', 'PKTConv', 'Billing Category Qty',
  'BillingCategoryUOM', 'Storage_Type', 'Unit_Price', 'Base_Unit_of_Measure',
  'Quantity', 'Qty in Pal', 'Item Name',
];

const THROUGHPUT_COLUMNS = [
  'Posting_Date', 'Location_Code', 'Location_Name', 'Region', 'StorageType',
  'Customer_No', 'Customer_name', 'Inward_Qty', 'Outward_Qty',
  'Inward_Pallet', 'Outward_Pallet',
];

// Columns that come back from SQL Server as Date objects and need to be stored
// as plain YYYY-MM-DD text.
const DATE_COLUMNS = {
  billing: ['Date'], utilization: ['OnDate'], item_master: [], throughput: ['Posting_Date'],
};

function normalizeDates(rows, dateCols) {
  if (!dateCols.length) return rows;
  return rows.map((r) => {
    const out = { ...r };
    for (const c of dateCols) {
      const v = out[c];
      if (v instanceof Date) out[c] = v.toISOString().slice(0, 10);
    }
    return out;
  });
}

async function runRefresh() {
  const today = new Date();
  const dateTo = formatDate(today);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - ROLLING_DAYS_BACK);
  const dateFrom = formatDate(fromDate);

  console.log(`[refresh] starting run for ${dateFrom} -> ${dateTo}`);

  try {
    console.log('[refresh] running billing query...');
    const billingRows = await runQuery(loadQueryTemplate('billing.sql', dateFrom, dateTo));
    replaceTable('billing', BILLING_COLUMNS, normalizeDates(billingRows, DATE_COLUMNS.billing));
    console.log(`[refresh] billing: ${billingRows.length} rows`);

    console.log('[refresh] running utilization query...');
    const utilRows = await runQuery(loadQueryTemplate('utilization.sql', dateFrom, dateTo));
    replaceTable('utilization', UTILIZATION_COLUMNS, normalizeDates(utilRows, DATE_COLUMNS.utilization));
    console.log(`[refresh] utilization: ${utilRows.length} rows`);

    console.log('[refresh] running item master query...');
    const itemRows = await runQuery(fs.readFileSync(path.join(__dirname, '..', 'queries', 'itemMaster.sql'), 'utf8'));
    replaceTable('item_master', ITEM_MASTER_COLUMNS, normalizeDates(itemRows, DATE_COLUMNS.item_master));
    console.log(`[refresh] item master: ${itemRows.length} rows`);

    console.log('[refresh] running throughput query...');
    const thruRows = await runQuery(loadQueryTemplate('throughput.sql', dateFrom, dateTo));
    replaceTable('throughput', THROUGHPUT_COLUMNS, normalizeDates(thruRows, DATE_COLUMNS.throughput));
    console.log(`[refresh] throughput: ${thruRows.length} rows`);

    logRefresh({
      status: 'success',
      billingRows: billingRows.length,
      utilizationRows: utilRows.length,
      itemMasterRows: itemRows.length,
      throughputRows: thruRows.length,
    });
    console.log('[refresh] done.');
  } catch (err) {
    console.error('[refresh] FAILED:', err.message);
    logRefresh({ status: 'failed', error: err.message });
    throw err;
  } finally {
    await sql.close().catch(() => {});
  }
}

if (require.main === module) {
  runRefresh()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runRefresh };
