export default function DataTable({
  columns, rows, loading, emptyMessage, caption, title, exportHref,
}) {
  const toolbar = (title || exportHref) ? (
    <div className="table-toolbar">
      {title ? <span className="table-toolbar-title">{title}</span> : <span />}
      {exportHref && (
        <a className="table-export-btn" href={exportHref}>
          <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="currentColor" d="M7.25 1.5v6.19L5.03 5.47 3.97 6.53 8 10.56l4.03-4.03-1.06-1.06-2.22 2.22V1.5h-1.5zM2.5 12h11v2.5h-11z" />
          </svg>
          Export CSV
        </a>
      )}
    </div>
  ) : null;

  if (loading) {
    return (<>{toolbar}<div className="loading-state">Loading…</div></>);
  }
  if (!rows || rows.length === 0) {
    return (<>{toolbar}<div className="empty-state">{emptyMessage || 'No rows match the current filters.'}</div></>);
  }
  return (
    <>
      {toolbar}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? 'num' : ''}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? 'num' : ''}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {caption && <div className="table-caption">{caption}</div>}
      </div>
    </>
  );
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
