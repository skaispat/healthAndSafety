import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { FineEmployee, FineService, FINE_LIMITS, sanitizeSearchTerm } from '../../services/fineService';

interface Props {
  value: { emp_id: string; full_name: string; department?: string | null } | null;
  onChange: (emp: FineEmployee | null) => void;
  error?: string;
  disabled?: boolean;
}

/** Search users2 by ID / name / phone and pick one employee. */
export const EmployeePicker: React.FC<Props> = ({ value, onChange, error, disabled }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FineEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const seq = useRef(0);
  const term = sanitizeSearchTerm(query);

  useEffect(() => {
    if (value) return;
    if (term.length < FINE_LIMITS.SEARCH_MIN_CHARS) {
      seq.current++;
      setResults([]);
      setLoading(false);
      setSearchError(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setSearchError(null);
    const t = window.setTimeout(async () => {
      try {
        const rows = await FineService.searchEmployees(term);
        if (id === seq.current) setResults(rows);
      } catch (err: any) {
        if (id === seq.current) setSearchError(err?.message || 'Search failed.');
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [term, value]);

  return (
    <div className="form-group">
      <span className="form-label">
        Employee <span className="required">*</span>
      </span>

      {value ? (
        <div className="fine-selected-emp" style={{ marginBottom: 0 }}>
          <div className="fine-avatar">{(value.full_name || '?').trim().charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="fine-employee-name">{value.full_name}</div>
            <div className="fine-employee-id">
              {value.emp_id}
              {value.department ? ` · ${value.department}` : ''}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setQuery('');
                onChange(null);
              }}
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              className="form-input"
              placeholder="Search employee by ID, name or phone"
              value={query}
              maxLength={FINE_LIMITS.SEARCH_MAX_CHARS}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 36 }}
              autoComplete="off"
              disabled={disabled}
              aria-invalid={Boolean(error)}
            />
          </div>
          {term.length >= FINE_LIMITS.SEARCH_MIN_CHARS && (
            <div className="fine-pick-list" style={{ marginTop: 8, maxHeight: 240 }}>
              {loading && results.length === 0 ? (
                <div className="fine-empty" style={{ padding: 14 }}>
                  <Loader2 size={16} className="spin" /> Searching...
                </div>
              ) : searchError ? (
                <div className="fine-empty fine-empty-error" style={{ padding: 14 }}>{searchError}</div>
              ) : results.length === 0 ? (
                <div className="fine-empty" style={{ padding: 14 }}>No employees match “{term}”.</div>
              ) : (
                results.map((emp) => (
                  <button
                    key={emp.emp_id}
                    type="button"
                    className={`fine-pick-item ${emp.is_active === false ? 'emp-row-disabled' : ''}`}
                    onClick={() => emp.is_active !== false && onChange(emp)}
                    disabled={emp.is_active === false}
                    title={emp.is_active === false ? 'PPE cannot be issued to inactive employees' : undefined}
                  >
                    <div className="fine-avatar">{(emp.full_name || '?').trim().charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <div className="fine-employee-name">{emp.full_name}</div>
                      <div className="fine-employee-id">
                        {emp.emp_id}
                        {emp.department ? ` · ${emp.department}` : ''}
                      </div>
                    </div>
                    {emp.is_active === false && <span className="fine-inactive">Inactive</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
      {error && <span className="fine-field-error">{error}</span>}
    </div>
  );
};
