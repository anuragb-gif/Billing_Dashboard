import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import KpiStrip from '../components/KpiStrip';
import DataTable, { formatNumber } from '../components/DataTable';

const num = (key) => ({ key, label: key, numeric: true, render: (r) => formatNumber(r[key]) });

// Every column the throughput report returns, in its original order and names.
const COLUMNS = [
  { key: 'Posting_Date', label: 'Posting_Date' },
  { key: 'Location_Code', label: 'Location_Code' },
  { key: 'Location_Name', label: 'Location_Name' },
  { key: 'Region', label: 'Region' },
  { key: 'StorageType', label: 'StorageType' },
  { key: 'Customer_No', label: 'Customer_No' },
  { key: 'Customer_name', label: 'Customer_name' },
  num('Inward_Qty'),
  num('Outward_Qty'),
  num('Inward_Pallet'),
  num('Outward_Pallet'),
];

export default function Throughput({ filters }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.throughputSummary(filters), api.throughput({ ...filters, limit: 500 })]).then(
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
          { label: 'Inward qty', value: formatNumber(summary?.totals?.total_inward_qty), accent: 'teal' },
          { label: 'Outward qty', value: formatNumber(summary?.totals?.total_outward_qty), accent: 'amber' },
          { label: 'Inward pallets', value: formatNumber(summary?.totals?.total_inward_pallet), accent: 'teal' },
          { label: 'Outward pallets', value: formatNumber(summary?.totals?.total_outward_pallet), accent: 'amber' },
        ]}
      />

      <div className="panel">
        <div className="panel-title">Daily inward vs outward</div>
        <div className="panel-subtitle">Quantity moved per day across the selected filters</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={summary?.daily || []}>
            <CartesianGrid stroke="#E1E6EB" vertical={false} />
            <XAxis dataKey="posting_date" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} minTickGap={30} />
            <YAxis tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="inward_qty" name="Inward" fill="#0D9797" radius={[2, 2, 0, 0]} />
            <Bar dataKey="outward_qty" name="Outward" fill="#C96A2E" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="panel-title">By region</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={summary?.byRegion || []} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke="#E1E6EB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} />
            <YAxis type="category" dataKey="region" tick={{ fontSize: 11.5, fill: '#16212E' }} tickLine={false} axisLine={false} width={120} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="inward_qty" name="Inward" fill="#0D9797" radius={[0, 2, 2, 0]} />
            <Bar dataKey="outward_qty" name="Outward" fill="#C96A2E" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        title="Throughput detail"
        exportHref={api.exportUrl('/throughput/export', filters)}
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        caption="Showing up to 500 most recent rows. Export CSV returns every row for the current filters."
      />
    </>
  );
}
