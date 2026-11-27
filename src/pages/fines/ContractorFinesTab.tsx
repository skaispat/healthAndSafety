import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { HardHat, ImageIcon, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { formatISTDate, formatISTDateTime } from '../../utils/dateUtils';
import { exportContractorFinesPDF } from '../../utils/fineReportExport';
import { ImagePreviewModal } from '../../components/common/ImagePreviewModal';
import { FineDateFilterBar } from '../../components/fines/FineDateFilterBar';
import { MarkContractorFineModal } from '../../components/fines/MarkContractorFineModal';
import { ContractorFineHistoryModal } from '../../components/fines/ContractorFineHistoryModal';
import { FINE_LIMITS, FineDateRange, sanitizeSearchTerm } from '../../services/fineService';
import {
  Contractor,
  ContractorFine,
  ContractorFineGroup,
  ContractorFineService,
} from '../../services/contractorFineService';

export interface ContractorFinesTabHandle {
  openMarkFine: () => void;
}

const inr = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtAmount = (v: string | null) => (v && Number.isFinite(Number(v)) ? inr(Number(v)) : v || '—');

const MonthBadge: React.FC<{ count?: number }> = ({ count }) =>
  count && count > 1 ? (
    <span className="fine-month-badge" title={`${count} fines this month`}>
      {count}× this month
    </span>
  ) : null;

/** Contractor fines: list (one row per contractor), date filter, export, mark fine, history. */
export const ContractorFinesTab = forwardRef<ContractorFinesTabHandle, { searchQuery: string }>(({ searchQuery }, ref) => {
  const { showToast } = useToast();

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorsLoading, setContractorsLoading] = useState(true);

  const [fines, setFines] = useState<ContractorFine[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<FineDateRange>({});
  const [visibleCount, setVisibleCount] = useState<number>(FINE_LIMITS.PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [monthCounts, setMonthCounts] = useState<Map<number, number>>(new Map());

  const [markOpen, setMarkOpen] = useState(false);
  const [markConId, setMarkConId] = useState<number | null>(null);
  const [historyConId, setHistoryConId] = useState<number | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [preview, setPreview] = useState<ContractorFine | null>(null);

  useImperativeHandle(ref, () => ({
    openMarkFine: () => {
      setMarkConId(null);
      setMarkOpen(true);
    },
  }));

  const loadContractors = useCallback(async () => {
    setContractorsLoading(true);
    try {
      setContractors(await ContractorFineService.getContractors());
    } catch (err: any) {
      showToast({ type: 'error', title: 'Contractors', message: err?.message || 'Could not load contractors.' });
    } finally {
      setContractorsLoading(false);
    }
  }, [showToast]);

  const req = useRef(0);
  const loadFines = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const res = await ContractorFineService.getFines(range);
      if (id !== req.current) return;
      setFines(res.fines);
      setTruncated(res.truncated);
      setVisibleCount(FINE_LIMITS.PAGE_SIZE);
    } catch (err: any) {
      if (id === req.current) setError(err?.message || 'Could not load contractor fines.');
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [range]);

  const loadMonthCounts = useCallback(async () => {
    setMonthCounts(await ContractorFineService.getCurrentMonthCounts());
  }, []);

  useEffect(() => {
    loadContractors();
    loadMonthCounts();
  }, [loadContractors, loadMonthCounts]);

  useEffect(() => {
    loadFines();
  }, [loadFines]);

  const groups = useMemo(() => ContractorFineService.groupByContractor(fines), [fines]);
  const term = sanitizeSearchTerm(searchQuery);
  const filtered = useMemo(
    () => (term ? groups.filter((g) => ContractorFineService.matches(g, fines, term)) : groups),
    [groups, fines, term]
  );
  const visible = filtered.slice(0, visibleCount);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { fines: all, truncated: cut } = await ContractorFineService.getFines(range);
      if (all.length === 0) {
        showToast({ type: 'warning', title: 'Nothing to Export', message: 'No contractor fines found for the selected period.' });
        return;
      }
      exportContractorFinesPDF(all, range, { truncated: cut });
      showToast({ type: 'success', title: 'PDF Exported', message: `${all.length} contractor fine(s) exported.` });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Export Failed', message: err?.message || 'Could not export PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const handleSuccess = (fine: ContractorFine) => {
    setMarkOpen(false);
    setMarkConId(null);
    const d = fine.date || '';
    if ((!range.from || d >= range.from) && (!range.to || d <= range.to)) {
      setFines((prev) => [fine, ...prev.filter((f) => f.id !== fine.id)]);
    }
    if (fine.con_id != null) {
      const id = Number(fine.con_id);
      setMonthCounts((prev) => new Map(prev).set(id, (prev.get(id) || 0) + 1));
    }
    setHistoryRefresh((k) => k + 1);
  };

  const openHistory = (conId: number | null) => {
    if (conId != null) setHistoryConId(Number(conId));
  };

  const rangeActive = Boolean(range.from || range.to);

  return (
    <section>
      <div className="fine-section-title">
        <HardHat size={16} />
        <span>Contractor Fines</span>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            loadFines();
            loadMonthCounts();
            loadContractors();
          }}
          disabled={loading}
          aria-label="Refresh contractor fines"
          style={{ marginLeft: 'auto', padding: 6 }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <FineDateFilterBar range={range} onChange={setRange} onExport={handleExport} loading={loading} exporting={exporting} />

      {loading ? (
        <div className="ehs-card fine-empty">
          <Loader2 size={18} className="spin" /> Loading contractor fines...
        </div>
      ) : error ? (
        <div className="ehs-card fine-empty fine-empty-error">
          {error}
          <button className="btn btn-secondary btn-sm" onClick={loadFines} style={{ marginTop: 10 }}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ehs-card fine-empty">
          {term
            ? `No contractor fines match “${term}”.`
            : rangeActive
            ? 'No contractor fines found for the selected dates.'
            : 'No contractor fines recorded yet.'}
        </div>
      ) : (
        <>
          {truncated && (
            <div className="form-hint" style={{ marginBottom: 8 }}>
              Showing contractors from the latest {FINE_LIMITS.EXPORT_MAX.toLocaleString('en-IN')} fines. Narrow the date range to include older records.
            </div>
          )}

          {/* Desktop table — one row per contractor */}
          <div className="ehs-card table-desktop-view" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="ehs-table">
                <thead>
                  <tr>
                    <th>Last Fine</th>
                    <th>Contractor</th>
                    <th>Department</th>
                    <th>Last Worker</th>
                    <th style={{ textAlign: 'center' }}>Fines</th>
                    <th>Total Amount</th>
                    <th>Last Reason</th>
                    <th>Image</th>
                    <th aria-label="View" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((g) => {
                    const f = g.latest;
                    return (
                      <tr key={g.con_id ?? `cf-${f.id}`} className="fine-row-clickable" onClick={() => openHistory(g.con_id)}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatISTDate(f.date || f.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700 }}>{g.contractor?.contractor_name || 'Unknown'}</span>
                            <MonthBadge count={g.con_id != null ? monthCounts.get(Number(g.con_id)) : undefined} />
                          </div>
                          <div className="fine-employee-id">{g.contractor?.phone_number || '—'}</div>
                        </td>
                        <td>{g.contractor?.department || '—'}</td>
                        <td>{f.emp_name || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`fine-count-pill ${g.count > 1 ? 'fine-count-pill-multi' : ''}`}>{g.count}</span>
                        </td>
                        <td className="fine-amount">{inr(g.totalAmount)}</td>
                        <td className="fine-reason-cell">{f.reason || '—'}</td>
                        <td>
                          {f.picture ? (
                            <button
                              type="button"
                              className="fine-thumb"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreview(f);
                              }}
                              aria-label="View latest image"
                            >
                              <img src={f.picture} alt="" loading="lazy" />
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ width: 32 }}>
                          <ChevronRight size={16} color="var(--text-muted)" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="cards-mobile-view">
            {visible.map((g) => {
              const f = g.latest;
              return (
                <div
                  key={g.con_id ?? `cf-${f.id}`}
                  className="fine-mobile-card fine-row-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => openHistory(g.con_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openHistory(g.con_id);
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    {f.picture ? (
                      <button
                        type="button"
                        className="fine-thumb fine-thumb-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreview(f);
                        }}
                        aria-label="View latest image"
                      >
                        <img src={f.picture} alt="" loading="lazy" />
                      </button>
                    ) : (
                      <div className="fine-thumb fine-thumb-lg fine-thumb-empty">
                        <ImageIcon size={18} />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div className="fine-employee-name">{g.contractor?.contractor_name || 'Unknown'}</div>
                        <div className="fine-amount">{inr(g.totalAmount)}</div>
                      </div>
                      <div className="fine-employee-id">
                        {g.contractor?.department || '—'}
                        {g.contractor?.phone_number ? ` · ${g.contractor.phone_number}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        <span className={`fine-count-pill ${g.count > 1 ? 'fine-count-pill-multi' : ''}`}>
                          {g.count} {g.count === 1 ? 'fine' : 'fines'}
                        </span>
                        <MonthBadge count={g.con_id != null ? monthCounts.get(Number(g.con_id)) : undefined} />
                      </div>
                      <div className="fine-mobile-reason">Worker: {f.emp_name || '—'}</div>
                      <div className="fine-mobile-reason">Reason: {f.reason || '—'}</div>
                      <div className="fine-mobile-date">{formatISTDateTime(f.created_at)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length > visibleCount && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setVisibleCount((n) => n + FINE_LIMITS.PAGE_SIZE)}>
                Load More ({filtered.length - visibleCount} more)
              </button>
            </div>
          )}
        </>
      )}

      <ContractorFineHistoryModal
        conId={historyConId}
        refreshKey={historyRefresh}
        onClose={() => setHistoryConId(null)}
        onMarkFine={(id) => {
          setHistoryConId(null);
          setMarkConId(id);
          setMarkOpen(true);
        }}
        onPreviewImage={(f) => setPreview(f)}
      />

      <MarkContractorFineModal
        isOpen={markOpen}
        contractors={contractors}
        contractorsLoading={contractorsLoading}
        preselectedConId={markConId}
        onClose={() => {
          setMarkOpen(false);
          setMarkConId(null);
        }}
        onSuccess={handleSuccess}
      />

      <ImagePreviewModal
        isOpen={Boolean(preview)}
        onClose={() => setPreview(null)}
        imageUrl={preview?.picture || null}
        title={preview?.contractor?.contractor_name || 'Fine Evidence'}
        subtitle={preview ? `${preview.emp_name || ''} · ${fmtAmount(preview.fine_amount)} · ${formatISTDate(preview.date || preview.created_at)}` : undefined}
      />
    </section>
  );
});

ContractorFinesTab.displayName = 'ContractorFinesTab';
