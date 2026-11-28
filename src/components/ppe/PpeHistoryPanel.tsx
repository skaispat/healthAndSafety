import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, HardHat, Loader2 } from 'lucide-react';
import { formatISTDate } from '../../utils/dateUtils';
import { PpeIssue, PpeItem, PpeService, isFootwear } from '../../services/ppeService';
import { HelmetIcon, PpeItemChips, SafetyShoeIcon, isHelmet, resolvePpeColor } from './PpeItemChips';

interface Props {
  /** Show PPE issued to this employee… */
  empId?: string | null;
  /** …or to this contractor. */
  conId?: number | null;
}

const COLLAPSED_COUNT = 3;

/**
 * Read-only "Issued PPE" panel shown inside the fine forms, so the officer can see
 * what safety gear the person was given (and when) before marking a fine.
 */
export const PpeHistoryPanel: React.FC<Props> = ({ empId, conId }) => {
  const [issues, setIssues] = useState<PpeIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const key = empId ? `e:${empId}` : conId ? `c:${conId}` : '';

  useEffect(() => {
    setExpanded(false);
    setIssues([]);
    setError(null);
    if (!key) return;
    let cancelled = false;
    setLoading(true);
    const req = empId ? PpeService.getEmployeeHistory(empId) : PpeService.getContractorHistory(Number(conId));
    req
      .then((rows) => !cancelled && setIssues(rows))
      .catch((err) => !cancelled && setError(err?.message || 'Could not load issued PPE.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return null;

  const shown = expanded ? issues : issues.slice(0, COLLAPSED_COUNT);

  // Latest helmet / footwear ever issued (issues are already newest-first)
  const findLatest = (match: (i: PpeItem) => boolean) => {
    for (const r of issues) {
      const item = r.items.find(match);
      if (item) return { item, date: r.issue_date || r.created_at };
    }
    return null;
  };
  const latestShoes = findLatest((i) => isFootwear(i.item));
  const latestHelmet = findLatest((i) => !isFootwear(i.item) && isHelmet(i.item));

  return (
    <div className="ppe-history-panel">
      <div className="ppe-history-head">
        <HardHat size={15} />
        <span>Issued PPE</span>
        {!loading && !error && <span className="fine-count">{issues.length}</span>}
        {loading && <Loader2 size={14} className="spin" />}
      </div>

      {error ? (
        <div className="ppe-history-empty fine-empty-error">{error}</div>
      ) : loading && issues.length === 0 ? (
        <div className="ppe-history-empty">Loading issued PPE…</div>
      ) : issues.length === 0 ? (
        <div className="ppe-history-empty ppe-history-none">No PPE has been issued yet.</div>
      ) : (
        <div className="ppe-history-body">
          <div className="ppe-history-main">
            <ul className="ppe-history-list">
              {shown.map((r) => (
                <li key={r.id} className="ppe-history-item">
                  <span className="ppe-history-date">{formatISTDate(r.issue_date || r.created_at)}</span>
                  <PpeItemChips items={r.items} />
                </li>
              ))}
            </ul>
            {issues.length > COLLAPSED_COUNT && (
              <button type="button" className="btn btn-ghost btn-sm ppe-history-toggle" onClick={() => setExpanded((v) => !v)}>
                {expanded ? (
                  <>
                    <ChevronUp size={14} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Show all {issues.length}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Big at-a-glance icons: only shown when that item was issued */}
          {(latestHelmet || latestShoes) && (
            <div className="ppe-big-icons">
              {latestHelmet && (
                <div
                  className="ppe-big-icon"
                  title={`${latestHelmet.item.item}${latestHelmet.item.color ? ` (${latestHelmet.item.color})` : ''} · issued ${formatISTDate(latestHelmet.date)}`}
                >
                  <HelmetIcon
                    size={54}
                    color={resolvePpeColor(latestHelmet.item.color) || '#e5e7eb'}
                    title={`${latestHelmet.item.color || ''} helmet`.trim()}
                  />
                  <span className="ppe-big-icon-text">
                    <span className="ppe-big-icon-label">Helmet</span>
                    <span className="ppe-big-icon-sub">{latestHelmet.item.color || 'Colour n/a'}</span>
                  </span>
                </div>
              )}
              {latestShoes && (
                <div
                  className="ppe-big-icon"
                  title={`${latestShoes.item.item}${latestShoes.item.size ? ` (size ${latestShoes.item.size})` : ''} · issued ${formatISTDate(latestShoes.date)}`}
                >
                  <SafetyShoeIcon size={54} title="Safety shoes" />
                  <span className="ppe-big-icon-text">
                    <span className="ppe-big-icon-label">Shoes</span>
                    <span className="ppe-big-icon-sub">{latestShoes.item.size ? `Size ${latestShoes.item.size}` : 'Issued'}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
