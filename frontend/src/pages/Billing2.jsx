import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import KpiStrip from '../components/KpiStrip';
import DataTable, { formatNumber } from '../components/DataTable';

const num = (key, group) => ({ key, label: key, numeric: true, group, render: (r) => formatNumber(r[key]) });

// Every column the Billing GU query returns, in order.
const COLUMNS = [
  { key: 'Date', label: 'Date' },
  { key: 'Item_No', label: 'Item_No' },
  { key: 'Item Name', label: 'Item Name' },
  { key: 'Base UOM', label: 'Base UOM' },
  { key: 'StorageType', label: 'StorageType' },
  { key: 'Location Code', label: 'Location Code' },
  num('Opening'),
  num('In Quantity'),
  num('Out Quantity'),
  num('Closing'),
  {
    key: 'Status', label: 'Status',
    render: (r) => (
      <span className={`status-pill ${r.Status === 'Active' ? 'active' : 'inactive'}`}>{r.Status}</span>
    ),
  },
  { key: 'Customer No', label: 'Customer No' },
  { key: 'Customer Name', label: 'Customer Name' },
  num('PALLET Conv', 'PALLET'), num('Op Pal', 'PALLET'), num('In Pal', 'PALLET'), num('Out Pal', 'PALLET'), num('Cl Pal', 'PALLET'),
  num('BILLKG Conv', 'BILL KG'), num('Op BillKg', 'BILL KG'), num('In BillKg', 'BILL KG'), num('Out BillKg', 'BILL KG'), num('Cl BillKg', 'BILL KG'),
  num('CASE Conv', 'CASE'), num('Op Case', 'CASE'), num('In Case', 'CASE'), num('Out Case', 'CASE'), num('Cl Case', 'CASE'),
];

export default function Billing2({ filters }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.billing2Summary(filters), api.billing2({ ...filters, limit: 500 })]).then(
      ([s, r]) => {
        if (cancelled) return;
        setSummary(s); setRows(r); setLoading(false);
      }
    );
    return () => { cancelled = true; };
  }, [filters]);

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Total inbound', value: formatNumber(summary?.totals?.total_in), accent: 'teal' },
          { label: 'Total outbound', value: formatNumber(summary?.totals?.total_out), accent: 'amber' },
          { label: 'Active items', value: formatNumber(summary?.totals?.active_items) },
          { label: 'Active customers', value: formatNumber(summary?.totals?.active_customers) },
        ]}
      />

      <div className="panel">
        <div className="panel-title">Daily inbound vs outbound</div>
        <div className="panel-subtitle">Quantity moved per day across the selected filters</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={summary?.daily || []}>
            <CartesianGrid stroke="#E1E6EB" vertical={false} />
            <XAxis dataKey="txn_date" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} minTickGap={30} />
            <YAxis tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="in_qty" name="In" fill="#0D9797" radius={[2, 2, 0, 0]} />
            <Bar dataKey="out_qty" name="Out" fill="#C96A2E" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="panel-title">Top customers by closing balance</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={summary?.byCustomer || []} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke="#E1E6EB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} />
            <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11.5, fill: '#16212E' }} tickLine={false} axisLine={false} width={160} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
            <Bar dataKey="closing" name="Closing balance" fill="#3E7CB1" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        title="Billing GU detail"
        exportHref={api.exportUrl('/billing2/export', filters)}
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        caption="Showing up to 500 most recent rows. Export CSV returns every row for the current filters."
      />
    </>
  );
}
