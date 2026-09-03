import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_RESULTS = 60;

// Searchable customer picker: type part of a name or code, pick from the list.
export default function CustomerSelect({ value, onChange, customers = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selected = customers.find((c) => c.customer_no === value) || null;
  const selectedLabel = selected
    ? (selected.customer_name || selected.customer_no)
    : '';

  // While closed, the input shows the current selection; while open, what you type.
  const inputValue = open ? query : selectedLabel;

  const matches = useMemo(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter(
          (c) =>
            (c.customer_name || '').toLowerCase().includes(q) ||
            (c.customer_no || '').toLowerCase().includes(q),
        )
      : customers;
    return list.slice(0, MAX_RESULTS);
  }, [open, query, customers]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function choose(customerNo) {
    onChange(customerNo);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="filter-field" ref={wrapRef} style={{ position: 'relative' }}>
      <label className="filter-label">Customer</label>
      <div className="combo-input-wrap">
        <input
          className="filter-select combo-input"
          type="text"
          placeholder="All customers"
          value={inputValue}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        />
        {value && (
          <button
            type="button"
            className="combo-clear"
            aria-label="Clear customer filter"
            onMouseDown={(e) => { e.preventDefault(); choose(''); }}
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="combo-menu">
          <button
            type="button"
            className={`combo-option ${!value ? 'active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); choose(''); }}
          >
            All customers
          </button>
          {matches.map((c) => (
            <button
              key={c.customer_no}
              type="button"
              className={`combo-option ${c.customer_no === value ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(c.customer_no); }}
            >
              <span className="combo-option-name">{c.customer_name || '(no name)'}</span>
              <span className="combo-option-code">{c.customer_no}</span>
            </button>
          ))}
          {matches.length === 0 && <div className="combo-empty">No match</div>}
          {matches.length === MAX_RESULTS && (
            <div className="combo-empty">Showing first {MAX_RESULTS} — keep typing to narrow</div>
          )}
        </div>
      )}
    </div>
  );
}
