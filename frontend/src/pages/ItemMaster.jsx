import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';
import KpiStrip from '../components/KpiStrip';
import DataTable, { formatNumber } from '../components/DataTable';

const STORAGE_COLORS = { FROZEN: '#3E7CB1', CHILLED: '#0D9797', DRY: '#B98A3E' };

const num = (key) => ({ key, label: key, numeric: true, render: (r) => formatNumber(r[key]) });

// Every column the item master report returns, in its original order and names.
const COLUMNS = [
  { key: 'Report', label: 'Report' },
  { key: 'LocationCode', label: 'LocationCode' },
  { key: 'Customer', label: 'Customer' },
  { key: 'Location', label: 'Location' },
  { key: 'Customer Name', label: 'Customer Name' },
  { key: 'ItemNo', label: 'ItemNo' },
  num('Min_Billable Quantity'),
  num('PalletConv'),
  num('KGConv'),
  num('CASEConv'),
  num('CRATEConv'),
  num('BILLKGConv'),
  num('BAGConv'),
  num('BOTTLEConv'),
  num('BOXConv'),
  num('BUCKETConv'),
  num('DRUMConv'),
  num('EACHConv'),
  num('NOSConv'),
  num('PCSConv'),
  num('PKTConv'),
  num('Billing Category Qty'),
  { key: 'BillingCategoryUOM', label: 'BillingCategoryUOM' },
  { key: 'Storage_Type', label: 'Storage_Type' },
  num('Unit_Price'),
  { key: 'Base_Unit_of_Measure', label: 'Base_Unit_of_Measure' },
  num('Quantity'),
  num('Qty in Pal'),
  { key: 'Item Name', label: 'Item Name' },
];

export default function ItemMaster({ filters }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const scopedFilters = { customerNo: filters.customerNo, locationCode: filters.locationCode };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.itemMasterSummary(scopedFilters),
      api.itemMaster({ ...scopedFilters, limit: 500 }),
    ]).then(([s, r]) => {
      if (cancelled) return;
      setSummary(s); setRows(r); setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.customerNo, filters.locationCode]);

  return (
    <>
      <KpiStrip
        items={[
          { label: 'Total SKUs', value: formatNumber(summary?.totals?.total_items) },
          { label: 'Total quantity', value: formatNumber(summary?.totals?.total_quantity), accent: 'teal' },
          { label: 'Inventory value', value: summary?.totals?.total_value ? `₹${formatNumber(summary.totals.total_value)}` : '—', accent: 'amber' },
        ]}
      />

      <div className="panel">
        <div className="panel-title">Quantity by storage type</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={summary?.byStorageType || []}>
            <CartesianGrid stroke="#E1E6EB" vertical={false} />
            <XAxis dataKey="storage_type" tick={{ fontSize: 11.5, fill: '#16212E' }} tickLine={false} axisLine={{ stroke: '#E1E6EB' }} />
            <YAxis tick={{ fontSize: 11, fill: '#93A2B0' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E1E6EB' }} />
            <Bar dataKey="quantity" radius={[3, 3, 0, 0]}>
              {(summary?.byStorageType || []).map((entry) => (
                <Cell key={entry.storage_type} fill={STORAGE_COLORS[entry.storage_type] || '#93A2B0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        title="Item master detail"
        exportHref={api.exportUrl('/item-master/export', scopedFilters)}
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        caption="Showing up to 500 rows. Export CSV returns every row for the current filters."
      />
    </>
  );
}
