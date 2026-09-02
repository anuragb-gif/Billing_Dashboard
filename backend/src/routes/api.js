const express = require('express');
const { Readable } = require('stream');
const { db, q } = require('../db/localDb');

const router = express.Router();

// Which real column backs each shared filter param, per report. The report
// column names are kept verbatim (spaces and all), so everything is quoted.
const ENTITY = {
  billing: {
    table: 'billing', dateCol: 'Date',
    customerCol: 'Customer No', locationCol: 'Location Code',
    order: `${q('Date')} DESC`,
  },
  utilization: {
    table: 'utilization', dateCol: 'OnDate',
    customerCol: 'Primary_Customer_No', locationCol: 'Code',
    order: `${q('OnDate')} DESC`,
  },
  item_master: {
    table: 'item_master', dateCol: null,
    customerCol: 'Customer', locationCol: 'LocationCode',
    order: `${q('Item Name')}`,
  },
  throughput: {
    table: 'throughput', dateCol: 'Posting_Date',
    customerCol: 'Customer_No', locationCol: 'Location_Code',
    order: `${q('Posting_Date')} DESC`,
  },
};

function buildWhere(cfg, { dateFrom, dateTo, customerNo, locationCode } = {}) {
  const clauses = [];
  const params = [];
  if (cfg.dateCol && dateFrom) { clauses.push(`${q(cfg.dateCol)} >= ?`); params.push(dateFrom); }
  if (cfg.dateCol && dateTo) { clauses.push(`${q(cfg.dateCol)} <= ?`); params.push(dateTo); }
  if (customerNo) { clauses.push(`${q(cfg.customerCol)} = ?`); params.push(customerNo); }
  if (locationCode) { clauses.push(`${q(cfg.locationCol)} = ?`); params.push(locationCode); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// ---- CSV export: stream every row matching the current filters ----
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function streamCsv(req, res, entityKey, filenameBase) {
  const cfg = ENTITY[entityKey];
  const { where, params } = buildWhere(cfg, req.query);
  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}_${stamp}.csv"`);

  const stmt = db.prepare(`SELECT * FROM ${cfg.table} ${where} ORDER BY ${cfg.order}`);

  // Lazy generator + Readable.from so the DB cursor advances only as fast as the
  // client can drain it (backpressure) - a full export never buffers in memory.
  function* csvLines() {
    yield '﻿'; // UTF-8 BOM so Excel opens it cleanly
    let wroteHeader = false;
    for (const row of stmt.iterate(...params)) {
      if (!wroteHeader) {
        yield Object.keys(row).map(csvCell).join(',') + '\r\n';
        wroteHeader = true;
      }
      yield Object.values(row).map(csvCell).join(',') + '\r\n';
    }
  }

  Readable.from(csvLines()).pipe(res).on('error', () => res.destroy());
}

// ---- meta: filter dropdown options ----
router.get('/meta/filters', (req, res) => {
  const customers = db.prepare(
    `SELECT DISTINCT ${q('Customer No')} AS customer_no, ${q('Customer Name')} AS customer_name
       FROM billing WHERE ${q('Customer No')} IS NOT NULL
     UNION
     SELECT DISTINCT ${q('Primary_Customer_No')}, ${q('Customer_Name')}
       FROM utilization WHERE ${q('Primary_Customer_No')} IS NOT NULL
     UNION
     SELECT DISTINCT ${q('Customer_No')}, ${q('Customer_name')}
       FROM throughput WHERE ${q('Customer_No')} IS NOT NULL AND ${q('Customer_No')} <> ''
     ORDER BY customer_name`
  ).all();
  const locations = db.prepare(
    `SELECT DISTINCT location_code FROM (
       SELECT ${q('Location Code')} AS location_code FROM billing WHERE ${q('Location Code')} IS NOT NULL
       UNION SELECT ${q('Code')} FROM utilization WHERE ${q('Code')} IS NOT NULL
       UNION SELECT ${q('LocationCode')} FROM item_master WHERE ${q('LocationCode')} IS NOT NULL
       UNION SELECT ${q('Location_Code')} FROM throughput WHERE ${q('Location_Code')} IS NOT NULL
     ) ORDER BY location_code`
  ).all();
  const lastRefresh = db.prepare(
    `SELECT ran_at, status, billing_rows, utilization_rows, item_master_rows, throughput_rows
     FROM refresh_log ORDER BY id DESC LIMIT 1`
  ).get();
  res.json({ customers, locations, lastRefresh: lastRefresh || null });
});

// ---- billing ----
router.get('/billing', (req, res) => {
  const cfg = ENTITY.billing;
  const { where, params } = buildWhere(cfg, req.query);
  const rows = db.prepare(
    `SELECT * FROM billing ${where} ORDER BY ${cfg.order} LIMIT ?`
  ).all(...params, Number(req.query.limit) || 500);
  res.json(rows);
});

router.get('/billing/summary', (req, res) => {
  const cfg = ENTITY.billing;
  const { where, params } = buildWhere(cfg, req.query);
  const daily = db.prepare(
    `SELECT ${q('Date')} AS txn_date, SUM(${q('In Quantity')}) AS in_qty,
            SUM(${q('Out Quantity')}) AS out_qty, SUM(${q('Closing')}) AS closing
     FROM billing ${where} GROUP BY ${q('Date')} ORDER BY ${q('Date')}`
  ).all(...params);
  const byCustomer = db.prepare(
    `SELECT ${q('Customer Name')} AS customer_name, SUM(${q('Closing')}) AS closing
     FROM billing ${where} GROUP BY ${q('Customer Name')} ORDER BY closing DESC LIMIT 10`
  ).all(...params);
  const totals = db.prepare(
    `SELECT SUM(${q('In Quantity')}) AS total_in, SUM(${q('Out Quantity')}) AS total_out,
            COUNT(DISTINCT ${q('Item_No')}) AS active_items,
            COUNT(DISTINCT ${q('Customer No')}) AS active_customers
     FROM billing ${where}`
  ).get(...params);
  res.json({ daily, byCustomer, totals });
});

router.get('/billing/export', (req, res) => streamCsv(req, res, 'billing', 'billing'));

// ---- utilization (daily, no aggregation) ----
router.get('/utilization', (req, res) => {
  const cfg = ENTITY.utilization;
  const { where, params } = buildWhere(cfg, req.query);
  const rows = db.prepare(
    `SELECT * FROM utilization ${where} ORDER BY ${cfg.order} LIMIT ?`
  ).all(...params, Number(req.query.limit) || 2000);
  res.json(rows);
});

router.get('/utilization/summary', (req, res) => {
  const cfg = ENTITY.utilization;
  const { where, params } = buildWhere(cfg, req.query);
  // Trend line only (the detail table keeps every raw row). Capacity is stored
  // once per location and repeated on each customer row, so a location's fill
  // for a day is SUM(used) / that location's capacity; the day-level number is
  // the average of those location fills.
  const daily = db.prepare(
    `WITH loc_day AS (
       SELECT ${q('OnDate')} AS on_date, ${q('Code')} AS code,
              SUM(${q('Frozen')}) AS f_used,  MAX(${q('Frozen_Capacity')})  AS f_cap,
              SUM(${q('Chilled')}) AS c_used, MAX(${q('Chilled_Capacity')}) AS c_cap,
              SUM(${q('DRY')}) AS d_used,     MAX(${q('Dry_Capacity')})     AS d_cap
       FROM utilization ${where}
       GROUP BY ${q('OnDate')}, ${q('Code')}
     )
     SELECT on_date,
            AVG(CASE WHEN f_cap > 0 THEN 100.0 * f_used / f_cap END) AS frozen_pct,
            AVG(CASE WHEN c_cap > 0 THEN 100.0 * c_used / c_cap END) AS chilled_pct,
            AVG(CASE WHEN d_cap > 0 THEN 100.0 * d_used / d_cap END) AS dry_pct
     FROM loc_day GROUP BY on_date ORDER BY on_date`
  ).all(...params);
  res.json({ daily });
});

router.get('/utilization/export', (req, res) => streamCsv(req, res, 'utilization', 'utilization'));

// ---- item master (full set, no date filter) ----
router.get('/item-master', (req, res) => {
  const cfg = ENTITY.item_master;
  const { where, params } = buildWhere(cfg, req.query);
  const rows = db.prepare(
    `SELECT * FROM item_master ${where} ORDER BY ${cfg.order} LIMIT ?`
  ).all(...params, Number(req.query.limit) || 500);
  res.json(rows);
});

router.get('/item-master/summary', (req, res) => {
  const cfg = ENTITY.item_master;
  const { where, params } = buildWhere(cfg, req.query);
  const byStorageType = db.prepare(
    `SELECT ${q('Storage_Type')} AS storage_type, SUM(${q('Quantity')}) AS quantity,
            COUNT(DISTINCT ${q('ItemNo')}) AS item_count
     FROM item_master ${where} GROUP BY ${q('Storage_Type')}`
  ).all(...params);
  const totals = db.prepare(
    `SELECT COUNT(DISTINCT ${q('ItemNo')}) AS total_items, SUM(${q('Quantity')}) AS total_quantity,
            SUM(${q('Quantity')} * ${q('Unit_Price')}) AS total_value
     FROM item_master ${where}`
  ).get(...params);
  res.json({ byStorageType, totals });
});

router.get('/item-master/export', (req, res) => streamCsv(req, res, 'item_master', 'item_master'));

// ---- throughput (inward/outward per day) ----
router.get('/throughput', (req, res) => {
  const cfg = ENTITY.throughput;
  const { where, params } = buildWhere(cfg, req.query);
  const rows = db.prepare(
    `SELECT * FROM throughput ${where} ORDER BY ${cfg.order} LIMIT ?`
  ).all(...params, Number(req.query.limit) || 500);
  res.json(rows);
});

router.get('/throughput/summary', (req, res) => {
  const cfg = ENTITY.throughput;
  const { where, params } = buildWhere(cfg, req.query);
  const daily = db.prepare(
    `SELECT ${q('Posting_Date')} AS posting_date,
            SUM(${q('Inward_Qty')}) AS inward_qty, SUM(${q('Outward_Qty')}) AS outward_qty,
            SUM(${q('Inward_Pallet')}) AS inward_pallet, SUM(${q('Outward_Pallet')}) AS outward_pallet
     FROM throughput ${where} GROUP BY ${q('Posting_Date')} ORDER BY ${q('Posting_Date')}`
  ).all(...params);
  const byRegion = db.prepare(
    `SELECT ${q('Region')} AS region,
            SUM(${q('Inward_Qty')}) AS inward_qty, SUM(${q('Outward_Qty')}) AS outward_qty
     FROM throughput ${where} GROUP BY ${q('Region')} ORDER BY (SUM(${q('Inward_Qty')}) + SUM(${q('Outward_Qty')})) DESC`
  ).all(...params);
  const totals = db.prepare(
    `SELECT SUM(${q('Inward_Qty')}) AS total_inward_qty, SUM(${q('Outward_Qty')}) AS total_outward_qty,
            SUM(${q('Inward_Pallet')}) AS total_inward_pallet, SUM(${q('Outward_Pallet')}) AS total_outward_pallet,
            COUNT(DISTINCT ${q('Customer_No')}) AS active_customers,
            COUNT(DISTINCT ${q('Location_Code')}) AS active_locations
     FROM throughput ${where}`
  ).get(...params);
  res.json({ daily, byRegion, totals });
});

router.get('/throughput/export', (req, res) => streamCsv(req, res, 'throughput', 'throughput'));

module.exports = router;
