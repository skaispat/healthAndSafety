import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Search, X, Loader2, RefreshCw, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { canManageFines } from '../../utils/access';
import { formatISTDate } from '../../utils/dateUtils';
import { exportPpePDF } from '../../utils/fineReportExport';
import { Modal } from '../../components/common/Modal';
import { FineDateFilterBar } from '../../components/fines/FineDateFilterBar';
import { PpeIssueModal } from '../../components/ppe/PpeIssueModal';
import { FINE_LIMITS, FineDateRange, sanitizeSearchTerm } from '../../services/fineService';
import { PpeIssue, PpeService, formatPpeItem } from '../../services/ppeService';

const totalQty = (r: PpeIssue) => r.items.reduce((q, i) => q + i.qty, 0);

const ItemChips: React.FC<{ issue: PpeIssue }> = ({ issue }) =>
  issue.items.length === 0 ? (
    <span className="form-hint">No items</span>
  ) : (
    <div className="ppe-chips">
      {issue.items.map((i, idx) => (
        <span key={idx} className="ppe-chip" title={formatPpeItem(i)}>
          <strong>{i.item}</strong>
          <span className="ppe-chip-qty">×{i.qty}</span>
          {i.size && <span className="ppe-chip-color ppe-chip-size">Size {i.size}</span>}
          {i.color && <span className="ppe-chip-color">{i.color}</span>}
        </span>
      ))}
    </div>
  );

export const PpeIssuePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const allowed = canManageFines(currentUser); // Health & Safety / Super Admin

  const [issues, setIssues] = useState<PpeIssue[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<FineDateRange>({});
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(FINE_LIMITS.PAGE_SIZE);
  const [exporting, setExporting] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PpeIssue | null>(null);
  const [deleting, setDeleting] = useState<PpeIssue | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!allowed) {
      showToast({ type: 'error', title: 'Access Denied', message: 'PPE Issue is restricted to Health & Safety and Super Admin.' });
      navigate('/', { replace: true });
    }
  }, [allowed]);

  const req = useRef(0);
  const load = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const res = await PpeService.list(range);
      if (id !== req.current) return;
      setIssues(res.issues);
      setTruncated(res.truncated);
      setVisibleCount(FINE_LIMITS.PAGE_SIZE);
    } catch (err: any) {
      if (id === req.current) setError(err?.message || 'Could not load PPE issue records.');
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const term = sanitizeSearchTerm(query);
  const filtered = useMemo(() => {
    if (!term) return issues;
    const t = term.toLowerCase();
    const matched = issues.filter((r) => PpeService.matches(r, term));
    // Exact Employee ID first (typing "12" shows employee 12 before 112 / 120), then ID prefix, then the rest.
    const rank = (r: PpeIssue) => {
      const id = String(r.emp_id || '').toLowerCase();
      return id === t ? 0 : id.startsWith(t) ? 1 : 2;
    };
    return matched
      .map((r, i) => ({ r, i, k: rank(r) }))
      .sort((a, b) => a.k - b.k || a.i - b.i) // stable: keeps newest-first within each group
      .map((x) => x.r);
  }, [issues, term]);
  const visible = filtered.slice(0, visibleCount);
  const rangeActive = Boolean(range.from || range.to);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (r: PpeIssue) => {
    setEditing(r);
    setEditorOpen(true);
  };

  const handleSaved = (saved: PpeIssue, mode: 'create' | 'update') => {
    setEditorOpen(false);
    setEditing(null);
    const d = saved.issue_date || '';
    const inRange = (!range.from || d >= range.from) && (!range.to || d <= range.to);
    setIssues((prev) => {
      if (!inRange) return prev.filter((r) => r.id !== saved.id); // moved out of the current date filter
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (mode === 'create' || idx < 0) return [saved, ...prev.filter((r) => r.id !== saved.id)];
      const next = [...prev];
      next[idx] = saved; // keep position when editing
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await PpeService.remove(deleting.id);
      setIssues((prev) => prev.filter((r) => r.id !== deleting.id));
      showToast({ type: 'success', title: 'Deleted', message: `PPE issue for ${deleting.employee?.full_name || deleting.emp_id} deleted.` });
      setDeleting(null);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: err?.message || 'Could not delete record.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Export what's on screen: current date range + search filter (all pages)
      const { issues: all, truncated: cut } = await PpeService.list(range);
      const rows = term ? all.filter((r) => PpeService.matches(r, term)) : all;
      if (rows.length === 0) {
        showToast({ type: 'warning', title: 'Nothing to Export', message: 'No PPE issue records for the selected filters.' });
        return;
      }
      exportPpePDF(rows, range, { truncated: cut });
      showToast({ type: 'success', title: 'PDF Exported', message: `${rows.length} record(s) exported.` });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Export Failed', message: err?.message || 'Could not export PDF.' });
    } finally {
      setExporting(false);
    }
  };

  if (!allowed) return null;

  return (
    <div className="page-wrapper fine-page">
      {/* Header: title | search | button  (mobile: title + button, search below) */}
      <div className="fine-header">
        <div className="fine-header-title">
          <HardHat size={24} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h2 className="fine-title">PPE Issue</h2>
            <p className="fine-subtitle">Record and manage PPE handed over to employees</p>
          </div>
        </div>

        <button type="button" className="btn btn-primary fine-header-mark-btn" onClick={openCreate}>
          Issue PPE
        </button>

        <div className="fine-search-box">
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              className="form-input"
              placeholder="Search employee, ID, department or item"
              value={query}
              maxLength={FINE_LIMITS.SEARCH_MAX_CHARS}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(FINE_LIMITS.PAGE_SIZE);
              }}
              style={{ paddingLeft: 36, paddingRight: 38 }}
              aria-label="Search PPE issues"
              autoComplete="off"
            />
            {query && (
              <button type="button" className="btn-ghost fine-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <section>
        <div className="fine-section-title">
          <HardHat size={16} />
          <span>Issue Records</span>
          {!loading && <span className="fine-count">{filtered.length}</span>}
          <button
            type="button"
            className="btn-ghost"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            style={{ marginLeft: 'auto', padding: 6 }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>

        <FineDateFilterBar range={range} onChange={setRange} onExport={handleExport} loading={loading} exporting={exporting} />

        {loading ? (
          <div className="ehs-card fine-empty">
            <Loader2 size={18} className="spin" /> Loading PPE records...
          </div>
        ) : error ? (
          <div className="ehs-card fine-empty fine-empty-error">
            {error}
            <button className="btn btn-secondary btn-sm" onClick={load} style={{ marginTop: 10 }}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ehs-card fine-empty">
            {term ? `No records match “${term}”.` : rangeActive ? 'No PPE issued in the selected dates.' : 'No PPE issued yet.'}
          </div>
        ) : (
          <>
            {truncated && (
              <div className="form-hint" style={{ marginBottom: 8 }}>
                Showing the latest {FINE_LIMITS.EXPORT_MAX.toLocaleString('en-IN')} records. Narrow the date range to see older ones.
              </div>
            )}

            {/* Desktop table */}
            <div className="ehs-card table-desktop-view" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container" style={{ border: 'none' }}>
                <table className="ehs-table">
                  <thead>
                    <tr>
                      <th>Issue Date</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Issued PPE</th>
                      <th style={{ textAlign: 'center' }}>Total Qty</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatISTDate(r.issue_date || r.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700 }}>{r.employee?.full_name || 'Unknown'}</span>
                            {r.employee?.is_active === false && <span className="fine-inactive">Inactive</span>}
                          </div>
                          <div className="fine-employee-id">{r.emp_id || '—'}</div>
                        </td>
                        <td>{r.employee?.department || '—'}</td>
                        <td style={{ minWidth: 260 }}>
                          <ItemChips issue={r} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="fine-count-pill">{totalQty(r)}</span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(r)} aria-label="Edit">
                            <Pencil size={14} /> Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm ppe-delete-btn"
                            onClick={() => setDeleting(r)}
                            aria-label="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="cards-mobile-view">
              {visible.map((r) => (
                <div key={r.id} className="fine-mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="fine-employee-name">{r.employee?.full_name || 'Unknown'}</span>
                        {r.employee?.is_active === false && <span className="fine-inactive">Inactive</span>}
                      </div>
                      <div className="fine-employee-id">
                        {r.emp_id || '—'}
                        {r.employee?.department ? ` · ${r.employee.department}` : ''}
                      </div>
                    </div>
                    <span className="fine-mobile-date" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
                      {formatISTDate(r.issue_date || r.created_at)}
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <ItemChips issue={r} />
                  </div>
                  <div className="ppe-card-actions">
                    <span className="form-hint">Total qty: {totalQty(r)}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm ppe-delete-btn" onClick={() => setDeleting(r)} aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
      </section>

      <PpeIssueModal
        isOpen={editorOpen}
        issue={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Delete PPE Issue?"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? (
                <>
                  <Loader2 size={16} className="spin" /> Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </>
        }
      >
        {deleting && (
          <>
            <div className="fine-repeat-alert" style={{ marginBottom: 12 }}>
              <AlertTriangle size={16} />
              <span>This permanently removes the record and cannot be undone.</span>
            </div>
            <div className="fine-details">
              <div className="fine-detail-row">
                <span className="fine-detail-label">Employee</span>
                <span className="fine-detail-value">
                  {deleting.employee?.full_name || 'Unknown'} ({deleting.emp_id})
                </span>
              </div>
              <div className="fine-detail-row">
                <span className="fine-detail-label">Issue Date</span>
                <span className="fine-detail-value">{formatISTDate(deleting.issue_date || deleting.created_at)}</span>
              </div>
              <div className="fine-detail-row">
                <span className="fine-detail-label">Items</span>
                <span className="fine-detail-value">{deleting.items.map(formatPpeItem).join(', ') || '—'}</span>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};
