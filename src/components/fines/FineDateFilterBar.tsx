import React, { useEffect, useState } from 'react';
import { CalendarRange, FileDown, Loader2, X } from 'lucide-react';
import { FineDateRange, monthStartIST, todayIST } from '../../services/fineService';

interface Props {
  range: FineDateRange;
  onChange: (range: FineDateRange) => void;
  onExport: () => void;
  loading?: boolean;
  exporting?: boolean;
}

/** From/To date filter that applies automatically, plus "This Month", "Clear" and "Export PDF". */
export const FineDateFilterBar: React.FC<Props> = ({ range, onChange, onExport, loading, exporting }) => {
  const today = todayIST();
  const [from, setFrom] = useState(range.from || '');
  const [to, setTo] = useState(range.to || '');
  const [error, setError] = useState<string | null>(null);

  // Keep inputs in sync if the parent changes the range (e.g. "This Month" / "Clear")
  useEffect(() => {
    setFrom(range.from || '');
    setTo(range.to || '');
  }, [range.from, range.to]);

  const apply = (next: FineDateRange) => {
    if (next.from && next.to && next.from > next.to) {
      setError('"From" date cannot be after "To" date.');
      return;
    }
    if ((next.from && next.from > today) || (next.to && next.to > today)) {
      setError('Dates cannot be in the future.');
      return;
    }
    setError(null);
    onChange({ from: next.from || undefined, to: next.to || undefined });
  };

  const handleDate = (which: 'from' | 'to', value: string) => {
    const nextFrom = which === 'from' ? value : from;
    const nextTo = which === 'to' ? value : to;
    if (which === 'from') setFrom(value);
    else setTo(value);
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return; // partially typed
    if (nextFrom === (range.from || '') && nextTo === (range.to || '')) return;
    apply({ from: nextFrom, to: nextTo });
  };

  const active = Boolean(range.from || range.to);

  return (
    <div className="ehs-card fine-filter-bar">
      <div className="fine-filter-dates">
        <label className="fine-filter-field">
          <span>From</span>
          <input type="date" className="form-input" value={from} max={to || today} onChange={(e) => handleDate('from', e.target.value)} />
        </label>
        <label className="fine-filter-field">
          <span>To</span>
          <input
            type="date"
            className="form-input"
            value={to}
            min={from || undefined}
            max={today}
            onChange={(e) => handleDate('to', e.target.value)}
          />
        </label>
      </div>
      <div className="fine-filter-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => apply({ from: monthStartIST(), to: today })}
          disabled={loading}
        >
          <CalendarRange size={15} /> This Month
        </button>
        {active && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => apply({})} disabled={loading}>
            <X size={15} /> Clear
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm fine-export-btn" onClick={onExport} disabled={exporting || loading}>
          {exporting ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />}
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>
      {error && (
        <span className="fine-field-error" style={{ width: '100%' }}>
          {error}
        </span>
      )}
    </div>
  );
};
