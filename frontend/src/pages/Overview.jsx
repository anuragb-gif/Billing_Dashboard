import { useEffect, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import KpiStrip from '../components/KpiStrip';
import { formatNumber } from '../components/DataTable';

export default function Overview({ filters }) {
  const [billing, setBilling] = useState(null);
  const [utilization, setUtilization] = useState(null);
  const [itemMaster, setItemMaster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.billingSummary(filters),
      api.utilizationSummary(filters),
      api.itemMasterSummary(filters),
    ]).then(([b, u, im]) => {
      if (cancelled) return;
      setBilling(b); setUtilization(u); setItemMaster(im);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filters]);

  if (loading) return <div className="loading-state">Loading overview…</div>;

  const oneDp = (v) => (v === null || v === undefined ? 0 : +Number(v).toFixed(1));
  const utilPct = utilization?.daily?.map((d) => ({
    date: d.on_date,
    frozenPct: oneDp(d.frozen_pct),
    chilledPct: oneDp(d.chilled_pct),
    dryPct: oneDp(d.dry_pct),
  })) || [];

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Stock on hand (closing)', value: formatNumber(billing?.daily?.at(-1)?.closing), accent: 'teal' },
          { label: 'Active items', value: formatNumber(billing?.totals?.active_items) },
          { label: 'Active customers', value: formatNumber(billing?.totals?.active_customers) },
          { label: 'Inventory value', value: itemMaster?.totals?.total_value ? `₹${formatNumber(itemMaster.totals.total_value)}` : '—', accent: 'amber' },
        ]}
      />

      <div className="panel-grid-2">
        <div className="panel">
          <div className="panel-title">Stock movement</div>
          <div className="panel-subtitle">Closing balance across the selected period</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={billing?.daily || []}>
              <defs>
                <linearGradient id="closingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0D9797" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0D9797" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E1E6EB" vertical={false} />
              <XAxis dataKey="txn_date" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} minTickGap={30} />
              <YAxis tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={false} width={50} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
              <Area type="monotone" dataKey="closing" stroke="#0D9797" strokeWidth={2} fill="url(#closingFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">Storage utilization</div>
          <div className="panel-subtitle">% of capacity in use</div>
          <div className="legend-row">
            <span className="legend-chip"><span className="legend-dot" style={{ background: '#3E7CB1' }} />Frozen</span>
            <span className="legend-chip"><span className="legend-dot" style={{ background: '#0D9797' }} />Chilled</span>
            <span className="legend-chip"><span className="legend-dot" style={{ background: '#B98A3E' }} />Dry</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={utilPct}>
              <CartesianGrid stroke="#E1E6EB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} minTickGap={30} />
              <YAxis tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={false} width={36} unit="%" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
              <Line type="monotone" dataKey="frozenPct" stroke="#3E7CB1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="chilledPct" stroke="#0D9797" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="dryPct" stroke="#B98A3E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
