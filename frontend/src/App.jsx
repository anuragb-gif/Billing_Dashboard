import { useEffect, useState } from 'react';
import './index.css';
import './layout.css';
import NavRail from './components/NavRail';
import FilterBar from './components/FilterBar';
import RefreshBadge from './components/RefreshBadge';
import Overview from './pages/Overview';
import Billing from './pages/Billing';
import Billing2 from './pages/Billing2';
import Utilization from './pages/Utilization';
import Throughput from './pages/Throughput';
import ItemMaster from './pages/ItemMaster';
import { api } from './api';

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}

const PAGE_META = {
  overview: { title: 'Overview', subtitle: 'Cross-warehouse snapshot across billing, utilization, and stock' },
  billing: { title: 'Billing', subtitle: 'Daily opening, movement, and closing balances by item and customer' },
  'billing-gu': { title: 'Billing GU', subtitle: 'Billing for the GU customer set, with PALLET / BILL KG / CASE conversions' },
  utilization: { title: 'Utilization', subtitle: 'Storage capacity in use, by location and storage type' },
  throughput: { title: 'Throughput', subtitle: 'Inward and outward quantity and pallets per day, by customer and location' },
  'item-master': { title: 'Item Master', subtitle: 'Current stock, conversions, and pricing by SKU' },
};

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [filters, setFilters] = useState(defaultDateRange());
  const [meta, setMeta] = useState({ customers: [], locations: [], baseUoms: [], lastRefresh: null });

  useEffect(() => {
    api.filters().then(setMeta).catch(() => {});
  }, []);

  const showDateRange = activePage !== 'item-master';
  const showUom = activePage === 'billing-gu';
  const { title, subtitle } = PAGE_META[activePage];

  return (
    <div className="app-shell">
      <NavRail activePage={activePage} onNavigate={setActivePage} />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">{title}</div>
            <div className="page-subtitle">{subtitle}</div>
          </div>
          <RefreshBadge lastRefresh={meta.lastRefresh} />
        </div>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          customers={meta.customers}
          locations={meta.locations}
          uoms={meta.baseUoms}
          showDateRange={showDateRange}
          showUom={showUom}
        />

        {activePage === 'overview' && <Overview filters={filters} />}
        {activePage === 'billing' && <Billing filters={filters} />}
        {activePage === 'billing-gu' && <Billing2 filters={filters} />}
        {activePage === 'utilization' && <Utilization filters={filters} />}
        {activePage === 'throughput' && <Throughput filters={filters} />}
        {activePage === 'item-master' && <ItemMaster filters={filters} />}
      </main>
    </div>
  );
}
