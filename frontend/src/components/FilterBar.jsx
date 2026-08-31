export default function FilterBar({
  filters, onChange, customers = [], locations = [], showDateRange = true,
}) {
  return (
    <div className="filter-bar">
      {showDateRange && (
        <>
          <div className="filter-field">
            <label className="filter-label">From</label>
            <input
              type="date"
              className="filter-date"
              value={filters.dateFrom || ''}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="filter-field">
            <label className="filter-label">To</label>
            <input
              type="date"
              className="filter-date"
              value={filters.dateTo || ''}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            />
          </div>
        </>
      )}
      <div className="filter-field">
        <label className="filter-label">Customer</label>
        <select
          className="filter-select"
          value={filters.customerNo || ''}
          onChange={(e) => onChange({ ...filters, customerNo: e.target.value })}
        >
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c.customer_no} value={c.customer_no}>
              {c.customer_name || c.customer_no}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label className="filter-label">Location</label>
        <select
          className="filter-select"
          value={filters.locationCode || ''}
          onChange={(e) => onChange({ ...filters, locationCode: e.target.value })}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.location_code} value={l.location_code}>{l.location_code}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
