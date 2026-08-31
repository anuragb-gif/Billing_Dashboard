import { useEffect, useState } from 'react';
import './index.css';
import './layout.css';
import NavRail from './components/NavRail';
import FilterBar from './components/FilterBar';
import Overview from './pages/Overview';
import Billing from './pages/Billing';
import Utilization from './pages/Utilization';
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
  utilization: { title: 'Utilization', subtitle: 'Storage capacity in use, by location and storage type' },
  'item-master': { title: 'Item Master', subtitle: 'Current stock, conversions, and pricing by SKU' },
};

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [filters, setFilters] = useState(defaultDateRange());
  const [meta, setMeta] = useState({ customers: [], locations: [], lastRefresh: null });

  useEffect(() => {
    api.filters().then(setMeta).catch(() => {});
  }, []);

  const showDateRange = activePage !== 'item-master';
  const { title, subtitle } = PAGE_META[activePage];

  return (
    <div className="app-shell">
      <NavRail activePage={activePage} onNavigate={setActivePage} lastRefresh={meta.lastRefresh} />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">{title}</div>
            <div className="page-subtitle">{subtitle}</div>
          </div>
        </div>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          customers={meta.customers}
          locations={meta.locations}
          showDateRange={showDateRange}
        />

        {activePage === 'overview' && <Overview filters={filters} />}
        {activePage === 'billing' && <Billing filters={filters} />}
        {activePage === 'utilization' && <Utilization filters={filters} />}
        {activePage === 'item-master' && <ItemMaster filters={filters} />}
      </main>
    </div>
  );
}
