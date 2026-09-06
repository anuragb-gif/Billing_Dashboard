import { logout } from '../api';

const PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'billing', label: 'Billing' },
  { id: 'billing-gu', label: 'Billing GU' },
  { id: 'utilization', label: 'Utilization' },
  { id: 'throughput', label: 'Throughput' },
  { id: 'item-master', label: 'Item Master' },
];

export default function NavRail({ activePage, onNavigate }) {
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
        Snowman Logistics
        <button type="button" className="nav-logout" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}
