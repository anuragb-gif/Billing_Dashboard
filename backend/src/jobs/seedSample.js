// Generates realistic-looking sample data into the local SQLite store so you
// can build/preview the dashboard before wiring up the real SQL Server
// connection. Run with: npm run seed-sample
//
// Column names match the real report output verbatim (spaces and all).
const { replaceTable, logRefresh } = require('../db/localDb');

const CUSTOMERS = [
  ['BLGP000193', 'Bhilai Grocers Pvt Ltd'],
  ['CHNP000718', 'Chennai Fresh Foods'],
  ['MUMP000199', 'Mumbai Cold Chain Co'],
  ['HYBP000483', 'Hyderabad Dairy Ltd'],
  ['VRNP000176', 'Varanasi Frozen Foods'],
  ['KKTP000338', 'Kolkata Trading Co'],
];

const LOCATIONS = [
  ['MUM01', 'Mumbai DC 1', 'West'],
  ['CHN01', 'Chennai DC 1', 'South'],
  ['DEL01', 'Delhi DC 1', 'North'],
  ['KOL01', 'Kolkata DC 1', 'East'],
];

const ITEMS = [
  ['IT1001', 'Frozen Chicken Nuggets 1kg', 'CS'],
  ['IT1002', 'Vanilla Ice Cream Tub 5L', 'CS'],
  ['IT1003', 'Fresh Paneer Block 500g', 'CS'],
  ['IT1004', 'Frozen Peas 1kg', 'CS'],
  ['IT1005', 'Butter Slabs 200g', 'BOX'],
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function dateStr(d) { return d.toISOString().slice(0, 10); }

function seedBilling() {
  const rows = [];
  const today = new Date();
  for (const [custNo, custName] of CUSTOMERS) {
    for (const [locCode] of LOCATIONS) {
      for (const [itemNo, itemName, uom] of ITEMS) {
        if (Math.random() < 0.4) continue; // not every combo is active everywhere
        let balance = randInt(500, 5000);
        for (let d = 60; d >= 0; d--) {
          const date = new Date(today);
          date.setDate(date.getDate() - d);
          const inQty = Math.random() < 0.3 ? randInt(0, 800) : 0;
          const outQty = Math.random() < 0.3 ? randInt(0, Math.min(600, balance)) : 0;
          const opening = balance;
          balance = balance + inQty - outQty;
          const closing = balance;
          if (opening === 0 && inQty === 0 && outQty === 0 && closing === 0) continue;
          const conv = 50;
          rows.push({
            'Date': dateStr(date), 'Item_No': itemNo, 'Item Name': itemName, 'Base UOM': uom,
            'StorageType': pick(['FROZEN', 'CHILLED', 'DRY']), 'Location Code': locCode,
            'Opening': opening, 'In Quantity': inQty, 'Out Quantity': outQty, 'Closing': closing,
            'Status': 'Active', 'Customer No': custNo, 'Customer Name': custName,
            'Item Conversion': conv,
            'Op Pal': +(opening / conv).toFixed(2), 'In Pal': +(inQty / conv).toFixed(2),
            'Out Pal': +(outQty / conv).toFixed(2), 'Cl pal': +(closing / conv).toFixed(2),
          });
        }
      }
    }
  }
  return rows;
}

function seedUtilization() {
  const rows = [];
  const today = new Date();
  for (const [locCode, locName, region] of LOCATIONS) {
    const frozenCap = randInt(8000, 15000);
    const chilledCap = randInt(6000, 12000);
    const dryCap = randInt(10000, 20000);
    for (const [custNo, custName] of CUSTOMERS) {
      if (Math.random() < 0.5) continue;
      for (let d = 60; d >= 0; d--) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        rows.push({
          'Region': region, 'Primary_Customer_No': custNo, 'Customer_Name': custName,
          'Code': locCode, 'Location_Name': locName,
          'Frozen': +(rand(0.3, 0.95) * frozenCap / CUSTOMERS.length).toFixed(0),
          'Frozen_Capacity': frozenCap,
          'Chilled': +(rand(0.2, 0.9) * chilledCap / CUSTOMERS.length).toFixed(0),
          'Chilled_Capacity': chilledCap,
          'DRY': +(rand(0.1, 0.85) * dryCap / CUSTOMERS.length).toFixed(0),
          'Dry_Capacity': dryCap,
          'OnDate': dateStr(date),
        });
      }
    }
  }
  return rows;
}

function seedItemMaster() {
  const rows = [];
  for (const [locCode, locName] of LOCATIONS) {
    for (const [custNo, custName] of CUSTOMERS) {
      if (Math.random() < 0.4) continue;
      for (const [itemNo, itemName, uom] of ITEMS) {
        if (Math.random() < 0.3) continue;
        const qty = randInt(0, 4000);
        rows.push({
          'Report': 'Snowman Logistics Limited', 'LocationCode': locCode, 'Customer': custNo,
          'Location': locName, 'Customer Name': custName, 'ItemNo': itemNo,
          'Min_Billable Quantity': randInt(50, 500),
          'PalletConv': 50, 'KGConv': 1, 'CASEConv': 12, 'CRATEConv': 20, 'BILLKGConv': 1,
          'BAGConv': 25, 'BOTTLEConv': null, 'BOXConv': 24, 'BUCKETConv': null, 'DRUMConv': null,
          'EACHConv': 1, 'NOSConv': 1, 'PCSConv': 1, 'PKTConv': 10,
          'Billing Category Qty': randInt(100, 1000), 'BillingCategoryUOM': uom,
          'Storage_Type': pick(['FROZEN', 'CHILLED', 'DRY']),
          'Unit_Price': +rand(10, 500).toFixed(2), 'Base_Unit_of_Measure': uom,
          'Quantity': qty, 'Qty in Pal': +(qty / 50).toFixed(2), 'Item Name': itemName,
        });
      }
    }
  }
  return rows;
}

const BILLING_COLUMNS = [
  'Date', 'Item_No', 'Item Name', 'Base UOM', 'StorageType', 'Location Code',
  'Opening', 'In Quantity', 'Out Quantity', 'Closing', 'Status', 'Customer No',
  'Customer Name', 'Item Conversion', 'Op Pal', 'In Pal', 'Out Pal', 'Cl pal',
];
const UTILIZATION_COLUMNS = [
  'Region', 'Primary_Customer_No', 'Customer_Name', 'Code', 'Location_Name',
  'Frozen', 'Frozen_Capacity', 'Chilled', 'Chilled_Capacity', 'DRY', 'Dry_Capacity', 'OnDate',
];
const ITEM_MASTER_COLUMNS = [
  'Report', 'LocationCode', 'Customer', 'Location', 'Customer Name', 'ItemNo',
  'Min_Billable Quantity', 'PalletConv', 'KGConv', 'CASEConv', 'CRATEConv', 'BILLKGConv',
  'BAGConv', 'BOTTLEConv', 'BOXConv', 'BUCKETConv', 'DRUMConv', 'EACHConv', 'NOSConv',
  'PCSConv', 'PKTConv', 'Billing Category Qty', 'BillingCategoryUOM', 'Storage_Type',
  'Unit_Price', 'Base_Unit_of_Measure', 'Quantity', 'Qty in Pal', 'Item Name',
];

const billingRows = seedBilling();
const utilRows = seedUtilization();
const itemRows = seedItemMaster();

replaceTable('billing', BILLING_COLUMNS, billingRows);
replaceTable('utilization', UTILIZATION_COLUMNS, utilRows);
replaceTable('item_master', ITEM_MASTER_COLUMNS, itemRows);
logRefresh({ status: 'success (sample data)', billingRows: billingRows.length, utilizationRows: utilRows.length, itemMasterRows: itemRows.length });

console.log(`Seeded sample data: billing=${billingRows.length}, utilization=${utilRows.length}, item_master=${itemRows.length}`);
