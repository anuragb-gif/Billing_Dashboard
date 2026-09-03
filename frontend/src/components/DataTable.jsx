const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Walk the columns once and work out, for each one, which grouped block it
// belongs to and whether it's the first column of that block (so we can draw a
// divider). Also returns the run-length segments for the grouping header row.
function analyzeGroups(columns) {
  const meta = [];
  const segments = [];
  let current = null;
  columns.forEach((c) => {
    const group = c.group || null;
    const startsSegment = !current || current.group !== group;
    if (startsSegment) {
      current = { group, span: 0, slug: group ? slug(group) : null };
      segments.push(current);
    }
    current.span += 1;
    meta.push({
      group,
      slug: current.slug,
      isGroupStart: !!group && startsSegment,
    });
  });
  const hasGroups = segments.some((s) => s.group);
  return { meta, segments, hasGroups };
}

export default function DataTable({
  columns, rows, loading, emptyMessage, caption, title, exportHref,
}) {
  const { meta, segments, hasGroups } = analyzeGroups(columns);

  const cellClass = (c, i) => {
    const m = meta[i];
    return [
      c.numeric ? 'num' : '',
      m.group ? 'grp' : '',
      m.group ? `grp--${m.slug}` : '',
      m.isGroupStart ? 'grp-start' : '',
    ].filter(Boolean).join(' ');
  };

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
            {hasGroups && (
              <tr className="group-row">
                {segments.map((s, si) => (
                  <th
                    key={si}
                    colSpan={s.span}
                    className={s.group ? `group-head group-head--on grp--${s.slug}` : 'group-head'}
                  >
                    {s.group || ''}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} className={cellClass(c, i)}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c, ci) => (
                  <td key={c.key} className={cellClass(c, ci)}>
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
