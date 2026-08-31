export default function KpiStrip({ items }) {
  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div className="kpi" key={item.label}>
          <div className={`kpi-value ${item.accent ? `accent-${item.accent}` : ''}`}>
            {item.value}
          </div>
          <div className="kpi-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
