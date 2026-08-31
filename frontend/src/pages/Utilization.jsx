import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import KpiStrip from '../components/KpiStrip';
import DataTable, { formatNumber } from '../components/DataTable';

const num = (key) => ({ key, label: key, numeric: true, render: (r) => formatNumber(r[key]) });

// Every column the utilization report returns - one row per source line, daily.
const COLUMNS = [
  { key: 'Region', label: 'Region' },
  { key: 'Primary_Customer_No', label: 'Primary_Customer_No' },
  { key: 'Customer_Name', label: 'Customer_Name' },
  { key: 'Code', label: 'Code' },
  { key: 'Location_Name', label: 'Location_Name' },
  num('Frozen'),
  num('Frozen_Capacity'),
  num('Chilled'),
  num('Chilled_Capacity'),
  num('DRY'),
  num('Dry_Capacity'),
  { key: 'OnDate', label: 'OnDate' },
];

const oneDp = (v) => (v === null || v === undefined ? 0 : +Number(v).toFixed(1));

export default function Utilization({ filters }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.utilizationSummary(filters),
      api.utilization({ ...filters, limit: 2000 }),
    ]).then(([s, r]) => {
      if (cancelled) return;
      setSummary(s); setRows(r); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filters]);

  const daily = (summary?.daily || []).map((d) => ({
    date: d.on_date,
    frozenPct: oneDp(d.frozen_pct),
    chilledPct: oneDp(d.chilled_pct),
    dryPct: oneDp(d.dry_pct),
  }));
  const latest = daily.at(-1);

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Frozen utilization', value: latest ? `${latest.frozenPct}%` : '—', accent: 'teal' },
          { label: 'Chilled utilization', value: latest ? `${latest.chilledPct}%` : '—', accent: 'teal' },
          { label: 'Dry utilization', value: latest ? `${latest.dryPct}%` : '—' },
        ]}
      />

      <div className="panel">
        <div className="panel-title">Utilization over time</div>
        <div className="panel-subtitle">Average of each line's capacity in use, by storage type</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={daily}>
            <CartesianGrid stroke="#E1E6EB" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} minTickGap={30} />
            <YAxis tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={false} width={44} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="frozenPct" name="Frozen" stroke="#3E7CB1" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="chilledPct" name="Chilled" stroke="#0D9797" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="dryPct" name="Dry" stroke="#B98A3E" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        title="Daily utilization"
        exportHref={api.exportUrl('/utilization/export', filters)}
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        caption="Showing up to 2000 rows. Export CSV returns every row for the current filters."
      />
    </>
  );
}
