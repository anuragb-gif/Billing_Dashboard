import CustomerSelect from './CustomerSelect';

export default function FilterBar({
  filters, onChange, customers = [], locations = [], uoms = [],
  showDateRange = true, showUom = false,
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

      <CustomerSelect
        value={filters.customerNo || ''}
        onChange={(customerNo) => onChange({ ...filters, customerNo })}
        customers={customers}
      />

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

      {showUom && (
        <div className="filter-field">
          <label className="filter-label">Base UOM</label>
          <select
            className="filter-select"
            value={filters.uom || ''}
            onChange={(e) => onChange({ ...filters, uom: e.target.value })}
          >
            <option value="">All UOM</option>
            {uoms.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
