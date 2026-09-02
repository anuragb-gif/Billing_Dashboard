import { logout } from '../api';

const PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'billing', label: 'Billing' },
  { id: 'utilization', label: 'Utilization' },
  { id: 'throughput', label: 'Throughput' },
  { id: 'item-master', label: 'Item Master' },
];

export default function NavRail({ activePage, onNavigate, lastRefresh }) {
  return (
    <nav className="nav-rail">
      <div className="nav-brand">
        <div className="nav-brand-name">Snowman Ops</div>
        <div className="nav-brand-sub">Warehouse reporting</div>
      </div>
      <div className="nav-links">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={`nav-link ${activePage === p.id ? 'active' : ''}`}
            onClick={() => onNavigate(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="nav-footer">
        {lastRefresh ? (
          <>Data refreshed<br />{formatRefreshTime(lastRefresh.ran_at)}</>
        ) : (
          <>Refresh status unavailable</>
        )}
        <button type="button" className="nav-logout" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}

function formatRefreshTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
