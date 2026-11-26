import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gavel,
  Search,
  X,
  Loader2,
  Building2,
  Phone,
  UserCog,
  BadgeCheck,
  IndianRupee,
  ImageIcon,
  RefreshCw,
  Users,
  CalendarRange,
  FileDown,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { canManageFines } from '../../utils/access';
import { formatISTDate, formatISTDateTime } from '../../utils/dateUtils';
import { ImagePreviewModal } from '../../components/common/ImagePreviewModal';
import { MarkFineModal } from '../../components/fines/MarkFineModal';
import { EmployeeFineHistoryModal } from '../../components/fines/EmployeeFineHistoryModal';
import { exportFinesPDF } from '../../utils/fineReportExport';
import {
  FineService,
  FineEmployee,
  SafetyFine,
  FINE_LIMITS,
  FineDateRange,
  FineGroup,
  sanitizeSearchTerm,
  todayIST,
  monthStartIST,
} from '../../services/fineService';

/** Red label shown when an employee has more than one fine in the current month. */
const MonthCountBadge: React.FC<{ count: number | undefined }> = ({ count }) =>
  count && count > 1 ? (
    <span className="fine-month-badge" title={`${count} fines this month`}>
      {count}× this month
    </span>
  ) : null;

const formatAmount = (v: string | null) => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return v || '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string | null | undefined }> = ({
  icon,
  label,
  value,
}) => (
  <div className="fine-detail-row">
    <span className="fine-detail-label">
      {icon}
      {label}
    </span>
    <span className="fine-detail-value">{value || '—'}</span>
  </div>
);

export const FinePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const allowed = canManageFines(currentUser);

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FineEmployee[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  // Recent fines — one row per employee (latest fine + count/total in range)
  const [groups, setGroups] = useState<FineGroup[]>([]);
  const [groupsTruncated, setGroupsTruncated] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(FINE_LIMITS.PAGE_SIZE);
  const [loadingFines, setLoadingFines] = useState(true);
  const [finesError, setFinesError] = useState<string | null>(null);

  // Date range filter (applied) + draft inputs
  const [range, setRange] = useState<FineDateRange>({});
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Per-employee fine counts for the current month
  const [monthCounts, setMonthCounts] = useState<Map<string, number>>(new Map());

  // Modals
  const [fineTarget, setFineTarget] = useState<FineEmployee | null>(null);
  const [previewFine, setPreviewFine] = useState<SafetyFine | null>(null);
  const [historyEmpId, setHistoryEmpId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const today = todayIST();

  const term = sanitizeSearchTerm(query);
  const isSearchMode = term.length >= FINE_LIMITS.SEARCH_MIN_CHARS;

  // Access guard
  useEffect(() => {
    if (!allowed) {
      showToast({
        type: 'error',
        title: 'Access Denied',
        message: 'The Fine page is restricted to Health & Safety and Super Admin.',
      });
      navigate('/', { replace: true });
    }
  }, [allowed]);

  const finesReq = useRef(0);
  const loadFines = useCallback(async () => {
    const req = ++finesReq.current;
    setLoadingFines(true);
    setFinesError(null);
    try {
      const res = await FineService.getGroupedFines(range);
      if (req !== finesReq.current) return; // a newer filter request superseded this one
      setGroups(res.groups);
      setGroupsTruncated(res.truncated);
      setVisibleCount(FINE_LIMITS.PAGE_SIZE);
    } catch (err: any) {
      if (req === finesReq.current) setFinesError(err?.message || 'Could not load recent fines.');
    } finally {
      if (req === finesReq.current) setLoadingFines(false);
    }
  }, [range]);

  const loadMonthCounts = useCallback(async () => {
    try {
      setMonthCounts(await FineService.getCurrentMonthCounts());
    } catch {
      /* non-critical: badges simply won't show */
    }
  }, []);

  useEffect(() => {
    if (allowed) loadFines();
  }, [allowed, loadFines]);

  useEffect(() => {
    if (allowed) loadMonthCounts();
  }, [allowed, loadMonthCounts]);

  const refreshAll = () => {
    loadFines();
    loadMonthCounts();
  };

  const applyRange = (next: FineDateRange) => {
    if (next.from && next.to && next.from > next.to) {
      setRangeError('"From" date cannot be after "To" date.');
      return;
    }
    if ((next.from && next.from > today) || (next.to && next.to > today)) {
      setRangeError('Dates cannot be in the future.');
      return;
    }
    setRangeError(null);
    setDraftFrom(next.from || '');
    setDraftTo(next.to || '');
    setRange({ from: next.from || undefined, to: next.to || undefined });
  };

  /** Auto-apply the range as soon as a date is picked (or cleared). Invalid ranges are shown, not applied. */
  const handleDateChange = (which: 'from' | 'to', value: string) => {
    const nextFrom = which === 'from' ? value : draftFrom;
    const nextTo = which === 'to' ? value : draftTo;
    if (which === 'from') setDraftFrom(value);
    else setDraftTo(value);
    // Ignore partially-typed dates (desktop keyboard entry emits '' until complete)
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    if (nextFrom === (range.from || '') && nextTo === (range.to || '')) return;
    applyRange({ from: nextFrom, to: nextTo });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { fines: all, truncated } = await FineService.getFinesForExport(range);
      if (all.length === 0) {
        showToast({ type: 'warning', title: 'Nothing to Export', message: 'No fines found for the selected period.' });
        return;
      }
      exportFinesPDF(all, range, { truncated });
      showToast({ type: 'success', title: 'PDF Exported', message: `${all.length} fine(s) exported.` });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Export Failed', message: err?.message || 'Could not export PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const rangeActive = Boolean(range.from || range.to);

  const visibleGroups = groups.slice(0, visibleCount);
  const hasMore = groups.length > visibleCount;
  const loadMore = () => setVisibleCount((n) => n + FINE_LIMITS.PAGE_SIZE);

  // Debounced employee search with stale-response protection
  useEffect(() => {
    if (!allowed) return;
    if (!isSearchMode) {
      searchSeq.current++;
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    const t = window.setTimeout(async () => {
      try {
        const rows = await FineService.searchEmployees(term);
        if (seq === searchSeq.current) setResults(rows);
      } catch (err: any) {
        if (seq === searchSeq.current) {
          setResults([]);
          setSearchError(err?.message || 'Search failed.');
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [term, isSearchMode, allowed]);

  const handleFineSuccess = (fine: SafetyFine) => {
    setFineTarget(null);
    const d = fine.date || '';
    const inRange = (!range.from || d >= range.from) && (!range.to || d <= range.to);
    if (inRange) {
      // Move this employee's row to the top with updated latest fine / count / total
      const amt = Number(fine.fine_amount);
      setGroups((prev) => {
        const key = fine.emp_id ? String(fine.emp_id) : null;
        const existing = key ? prev.find((g) => String(g.emp_id) === key) : undefined;
        const updated: FineGroup = {
          emp_id: fine.emp_id,
          employee: fine.employee || existing?.employee || null,
          latest: fine,
          count: (existing?.count || 0) + 1,
          totalAmount: (existing?.totalAmount || 0) + (Number.isFinite(amt) ? amt : 0),
        };
        return [updated, ...prev.filter((g) => g !== existing)];
      });
    }
    if (fine.emp_id) {
      const id = String(fine.emp_id);
      setMonthCounts((prev) => new Map(prev).set(id, (prev.get(id) || 0) + 1));
    }
    setHistoryRefresh((k) => k + 1);
  };

  const openMarkFineFromHistory = (emp: FineEmployee) => {
    setHistoryEmpId(null);
    setFineTarget(emp);
  };

  const openHistory = (empId: string | null) => {
    if (empId) setHistoryEmpId(String(empId));
  };

  if (!allowed) return null;

  return (
    <div className="page-wrapper fine-page">
      {/* Header + search (search sits on the right on desktop, stacks below on mobile) */}
      <div className="fine-header">
        <div className="fine-header-title">
          <Gavel size={24} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h2 className="fine-title">Fine (Penalty)</h2>
            <p className="fine-subtitle">Search an employee to record a safety violation fine</p>
          </div>
        </div>

        <div className="fine-search-box">
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="search"
              className="form-input"
              placeholder="Search by Employee ID, name or phone number"
              value={query}
              maxLength={FINE_LIMITS.SEARCH_MAX_CHARS}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 36, paddingRight: 38 }}
              aria-label="Search employees"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                className="btn-ghost fine-search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {query.trim().length > 0 && !isSearchMode && (
            <span className="form-hint" style={{ display: 'block', marginTop: 6 }}>
              Type at least {FINE_LIMITS.SEARCH_MIN_CHARS} characters to search.
            </span>
          )}
        </div>
      </div>

      {isSearchMode ? (
        /* ================= SEARCH RESULTS ================= */
        <section>
          <div className="fine-section-title">
            <Users size={16} />
            <span>Employees</span>
            {!searching && <span className="fine-count">{results.length}</span>}
            {searching && <Loader2 size={15} className="spin" />}
          </div>

          {searchError ? (
            <div className="ehs-card fine-empty fine-empty-error">{searchError}</div>
          ) : !searching && results.length === 0 ? (
            <div className="ehs-card fine-empty">No employees match “{term}”.</div>
          ) : (
            <div className="fine-employee-grid" aria-busy={searching}>
              {results.map((emp) => (
                <div key={emp.emp_id} className="ehs-card fine-employee-card">
                  <div className="fine-employee-head">
                    <div className="fine-avatar">{(emp.full_name || '?').trim().charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="fine-employee-name">{emp.full_name}</div>
                      <div className="fine-employee-id">ID: {emp.emp_id}</div>
                    </div>
                    <MonthCountBadge count={monthCounts.get(emp.emp_id)} />
                    {emp.is_active === false && <span className="fine-inactive">Inactive</span>}
                  </div>

                  <div className="fine-details">
                    <DetailRow icon={<Building2 size={13} />} label="Department" value={emp.department} />
                    <DetailRow icon={<BadgeCheck size={13} />} label="Designation" value={emp.designation} />
                    <DetailRow
                      icon={<UserCog size={13} />}
                      label="HOD"
                      value={emp.hod_name ? `${emp.hod_name} (${emp.hod_id})` : emp.hod_id}
                    />
                    <DetailRow icon={<Phone size={13} />} label="Phone" value={emp.phone_number} />
                  </div>

                  <div className="fine-card-actions">
                    <button type="button" className="btn btn-outline" onClick={() => openHistory(emp.emp_id)}>
                      <Eye size={16} /> History
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setFineTarget(emp)}>
                      <Gavel size={16} /> Mark Fine
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* ================= RECENT FINES ================= */
        <section>
          <div className="fine-section-title">
            <IndianRupee size={16} />
            <span>Recent Fines</span>
            <button
              type="button"
              className="btn-ghost"
              onClick={refreshAll}
              disabled={loadingFines}
              aria-label="Refresh fines"
              style={{ marginLeft: 'auto', padding: 6 }}
            >
              <RefreshCw size={15} className={loadingFines ? 'spin' : ''} />
            </button>
          </div>

          {/* Date range filter + export */}
          <div className="ehs-card fine-filter-bar">
            <div className="fine-filter-dates">
              <label className="fine-filter-field">
                <span>From</span>
                <input
                  type="date"
                  className="form-input"
                  value={draftFrom}
                  max={draftTo || today}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                />
              </label>
              <label className="fine-filter-field">
                <span>To</span>
                <input
                  type="date"
                  className="form-input"
                  value={draftTo}
                  min={draftFrom || undefined}
                  max={today}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                />
              </label>
            </div>
            <div className="fine-filter-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => applyRange({ from: monthStartIST(), to: today })}
                disabled={loadingFines}
              >
                <CalendarRange size={15} /> This Month
              </button>
              {rangeActive && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyRange({})} disabled={loadingFines}>
                  <X size={15} /> Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm fine-export-btn"
                onClick={handleExport}
                disabled={exporting || loadingFines}
              >
                {exporting ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />}
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
            {rangeError && (
              <span className="fine-field-error" style={{ width: '100%' }}>
                {rangeError}
              </span>
            )}
          </div>

          {loadingFines ? (
            <div className="ehs-card fine-empty">
              <Loader2 size={18} className="spin" /> Loading fines...
            </div>
          ) : finesError ? (
            <div className="ehs-card fine-empty fine-empty-error">
              {finesError}
              <button className="btn btn-secondary btn-sm" onClick={loadFines} style={{ marginTop: 10 }}>
                Retry
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="ehs-card fine-empty">
              {rangeActive ? 'No fines found for the selected dates.' : 'No fines recorded yet.'}
            </div>
          ) : (
            <>
              {groupsTruncated && (
                <div className="form-hint" style={{ marginBottom: 8 }}>
                  Showing employees from the latest {FINE_LIMITS.EXPORT_MAX.toLocaleString('en-IN')} fines. Narrow the
                  date range to include older records.
                </div>
              )}

              {/* Desktop table — one row per employee */}
              <div className="ehs-card table-desktop-view" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="ehs-table">
                    <thead>
                      <tr>
                        <th>Last Fine</th>
                        <th>Employee</th>
                        <th>Department</th>
                        <th style={{ textAlign: 'center' }}>Fines</th>
                        <th>Total Amount</th>
                        <th>Last Reason</th>
                        <th>Image</th>
                        <th aria-label="View" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleGroups.map((g) => {
                        const f = g.latest;
                        return (
                          <tr key={g.emp_id ?? `fine-${f.id}`} className="fine-row-clickable" onClick={() => openHistory(g.emp_id)}>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatISTDate(f.date || f.created_at)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700 }}>{g.employee?.full_name || 'Unknown'}</span>
                                <MonthCountBadge count={g.emp_id ? monthCounts.get(String(g.emp_id)) : undefined} />
                              </div>
                              <div className="fine-employee-id">{g.emp_id}</div>
                            </td>
                            <td>{g.employee?.department || '—'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`fine-count-pill ${g.count > 1 ? 'fine-count-pill-multi' : ''}`}>{g.count}</span>
                            </td>
                            <td className="fine-amount">{formatAmount(String(g.totalAmount))}</td>
                            <td className="fine-reason-cell" title={f.reason || ''}>
                              {f.reason || '—'}
                            </td>
                            <td>
                              {f.picture ? (
                                <button
                                  type="button"
                                  className="fine-thumb"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewFine(f);
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

              {/* Mobile cards — one card per employee */}
              <div className="cards-mobile-view">
                {visibleGroups.map((g) => {
                  const f = g.latest;
                  return (
                    <div
                      key={g.emp_id ?? `fine-${f.id}`}
                      className="fine-mobile-card fine-row-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => openHistory(g.emp_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openHistory(g.emp_id);
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
                              setPreviewFine(f);
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
                            <div className="fine-employee-name">{g.employee?.full_name || 'Unknown'}</div>
                            <div className="fine-amount">{formatAmount(String(g.totalAmount))}</div>
                          </div>
                          <div className="fine-employee-id">
                            {g.emp_id}
                            {g.employee?.department ? ` · ${g.employee.department}` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <span className={`fine-count-pill ${g.count > 1 ? 'fine-count-pill-multi' : ''}`}>
                              {g.count} {g.count === 1 ? 'fine' : 'fines'}
                            </span>
                            <MonthCountBadge count={g.emp_id ? monthCounts.get(String(g.emp_id)) : undefined} />
                          </div>
                          <div className="fine-mobile-reason">Reason: {f.reason || '—'}</div>
                          <div className="fine-mobile-date">{formatISTDateTime(f.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button className="btn btn-secondary" onClick={loadMore}>
                    Load More ({groups.length - visibleCount} more)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <EmployeeFineHistoryModal
        empId={historyEmpId}
        refreshKey={historyRefresh}
        onClose={() => setHistoryEmpId(null)}
        onMarkFine={openMarkFineFromHistory}
        onPreviewImage={(f) => setPreviewFine(f)}
      />

      <MarkFineModal employee={fineTarget} onClose={() => setFineTarget(null)} onSuccess={handleFineSuccess} />

      <ImagePreviewModal
        isOpen={Boolean(previewFine)}
        onClose={() => setPreviewFine(null)}
        imageUrl={previewFine?.picture || null}
        title={previewFine?.employee?.full_name || 'Fine Evidence'}
        subtitle={previewFine ? `${formatAmount(previewFine.fine_amount)} · ${formatISTDate(previewFine.date || previewFine.created_at)}` : undefined}
      />
    </div>
  );
};
