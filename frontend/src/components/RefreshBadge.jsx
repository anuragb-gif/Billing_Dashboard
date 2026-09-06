import { useEffect, useState } from 'react';

function relative(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function absolute(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// Shown top-right on every report so people can tell at a glance how fresh the
// data is. Green = refreshed within the last day, amber = overdue (the nightly
// job runs ~08:15), red = the last refresh errored.
export default function RefreshBadge({ lastRefresh }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (!lastRefresh || !lastRefresh.ran_at) {
    return (
      <div className="refresh-badge refresh-badge--stale">
        <span className="refresh-dot" />
        <span>Refresh status unavailable</span>
      </div>
    );
  }

  const ageHours = (Date.now() - new Date(lastRefresh.ran_at).getTime()) / 3600000;
  const failed = lastRefresh.status && lastRefresh.status !== 'success';
  const state = failed ? 'fail' : ageHours > 30 ? 'stale' : 'ok';

  return (
    <div
      className={`refresh-badge refresh-badge--${state}`}
      title={`Last refresh ${absolute(lastRefresh.ran_at)} — status: ${lastRefresh.status || 'unknown'}`}
    >
      <span className="refresh-dot" />
      <span className="refresh-badge-text">
        {failed ? 'Last refresh failed' : 'Data refreshed'} {relative(lastRefresh.ran_at)}
      </span>
      <span className="refresh-badge-time">{absolute(lastRefresh.ran_at)}</span>
    </div>
  );
}
