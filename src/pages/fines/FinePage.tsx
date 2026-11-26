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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { canManageFines } from '../../utils/access';
import { formatISTDate, formatISTDateTime } from '../../utils/dateUtils';
import { ImagePreviewModal } from '../../components/common/ImagePreviewModal';
import { MarkFineModal } from '../../components/fines/MarkFineModal';
import {
  FineService,
  FineEmployee,
  SafetyFine,
  FINE_LIMITS,
  sanitizeSearchTerm,
} from '../../services/fineService';

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

  // Recent fines
  const [fines, setFines] = useState<SafetyFine[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFines, setLoadingFines] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [finesError, setFinesError] = useState<string | null>(null);

  // Modals
  const [fineTarget, setFineTarget] = useState<FineEmployee | null>(null);
  const [previewFine, setPreviewFine] = useState<SafetyFine | null>(null);

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

  const loadFines = useCallback(async () => {
    setLoadingFines(true);
    setFinesError(null);
    try {
      const res = await FineService.getRecentFines(0);
      setFines(res.fines);
      setHasMore(res.hasMore);
      setPage(0);
    } catch (err: any) {
      setFinesError(err?.message || 'Could not load recent fines.');
    } finally {
      setLoadingFines(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) loadFines();
  }, [allowed, loadFines]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await FineService.getRecentFines(next);
      setFines((prev) => {
        const seen = new Set(prev.map((f) => f.id));
        return [...prev, ...res.fines.filter((f) => !seen.has(f.id))];
      });
      setHasMore(res.hasMore);
      setPage(next);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Load Failed', message: err?.message || 'Could not load more fines.' });
    } finally {
      setLoadingMore(false);
    }
  };

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
    setFines((prev) => [fine, ...prev.filter((f) => f.id !== fine.id)]);
  };

  if (!allowed) return null;

  return (
    <div className="page-wrapper fine-page">
      {/* Header */}
      <div className="fine-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gavel size={24} color="var(--brand-primary)" />
          <div>
            <h2 className="fine-title">Fine (Penalty)</h2>
            <p className="fine-subtitle">Search an employee to record a safety violation fine</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="ehs-card fine-search-card">
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

                  <button type="button" className="btn btn-primary fine-mark-btn" onClick={() => setFineTarget(emp)}>
                    <Gavel size={16} /> Mark Fine
                  </button>
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
              onClick={loadFines}
              disabled={loadingFines}
              aria-label="Refresh fines"
              style={{ marginLeft: 'auto', padding: 6 }}
            >
              <RefreshCw size={15} className={loadingFines ? 'spin' : ''} />
            </button>
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
          ) : fines.length === 0 ? (
            <div className="ehs-card fine-empty">No fines recorded yet.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="ehs-card table-desktop-view" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="ehs-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Amount</th>
                        <th>Reason</th>
                        <th>Image</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fines.map((f) => (
                        <tr key={f.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatISTDate(f.date || f.created_at)}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{f.employee?.full_name || 'Unknown'}</div>
                            <div className="fine-employee-id">{f.emp_id}</div>
                          </td>
                          <td>{f.employee?.department || '—'}</td>
                          <td className="fine-amount">{formatAmount(f.fine_amount)}</td>
                          <td className="fine-reason-cell" title={f.reason || ''}>
                            {f.reason || '—'}
                          </td>
                          <td>
                            {f.picture ? (
                              <button type="button" className="fine-thumb" onClick={() => setPreviewFine(f)} aria-label="View image">
                                <img src={f.picture} alt="" loading="lazy" />
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="cards-mobile-view">
                {fines.map((f) => (
                  <div key={f.id} className="fine-mobile-card">
                    <div style={{ display: 'flex', gap: 12 }}>
                      {f.picture ? (
                        <button type="button" className="fine-thumb fine-thumb-lg" onClick={() => setPreviewFine(f)} aria-label="View image">
                          <img src={f.picture} alt="" loading="lazy" />
                        </button>
                      ) : (
                        <div className="fine-thumb fine-thumb-lg fine-thumb-empty">
                          <ImageIcon size={18} />
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div className="fine-employee-name">{f.employee?.full_name || 'Unknown'}</div>
                          <div className="fine-amount">{formatAmount(f.fine_amount)}</div>
                        </div>
                        <div className="fine-employee-id">
                          {f.emp_id}
                          {f.employee?.department ? ` · ${f.employee.department}` : ''}
                        </div>
                        <div className="fine-mobile-reason">{f.reason || '—'}</div>
                        <div className="fine-mobile-date">{formatISTDateTime(f.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <Loader2 size={15} className="spin" /> Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

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
