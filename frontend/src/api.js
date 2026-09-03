const BASE = '/api';

function queryString(params = {}) {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return s ? `?${s}` : '';
}

function goToLogin() {
  const next = encodeURIComponent(location.pathname + location.search);
  location.href = `/login.html?next=${next}`;
}

async function get(path, params = {}) {
  const res = await fetch(`${BASE}${path}${queryString(params)}`);
  if (res.status === 401) { goToLogin(); throw new Error('Not logged in'); }
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${path}`);
  return res.json();
}

export async function logout() {
  try { await fetch(`${BASE}/logout`, { method: 'POST' }); } catch (_) { /* ignore */ }
  location.href = '/login.html';
}

export const api = {
  filters: () => get('/meta/filters'),
  billing: (params) => get('/billing', params),
  billingSummary: (params) => get('/billing/summary', params),
  utilization: (params) => get('/utilization', params),
  utilizationSummary: (params) => get('/utilization/summary', params),
  itemMaster: (params) => get('/item-master', params),
  itemMasterSummary: (params) => get('/item-master/summary', params),
  throughput: (params) => get('/throughput', params),
  throughputSummary: (params) => get('/throughput/summary', params),
  billing2: (params) => get('/billing2', params),
  billing2Summary: (params) => get('/billing2/summary', params),
  // Direct download URL for the "Export CSV" links (streams all matching rows).
  exportUrl: (path, params) => `${BASE}${path}${queryString(params)}`,
};
