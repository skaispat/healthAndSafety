import React, { useEffect, useState } from 'react';
import { Gavel, Loader2, Building2, BadgeCheck, UserCog, Phone, ImageIcon, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { formatISTDate } from '../../utils/dateUtils';
import { FineService, FineEmployee, SafetyFine, monthStartIST } from '../../services/fineService';

interface Props {
  empId: string | null;
  /** Bumped by the parent after a new fine so the history reloads. */
  refreshKey?: number;
  onClose: () => void;
  onMarkFine: (employee: FineEmployee) => void;
  onPreviewImage: (fine: SafetyFine) => void;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtAmount = (v: string | null) => (Number.isFinite(Number(v)) && v ? inr(Number(v)) : v || '—');

export const EmployeeFineHistoryModal: React.FC<Props> = ({ empId, refreshKey = 0, onClose, onMarkFine, onPreviewImage }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<FineEmployee | null>(null);
  const [fines, setFines] = useState<SafetyFine[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (!empId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    FineService.getEmployeeFineHistory(empId)
      .then((res) => {
        if (cancelled) return;
        setEmployee(res.employee);
        setFines(res.fines);
        setTotalCount(res.totalCount);
        setTotalAmount(res.totalAmount);
      })
      .catch((err) => !cancelled && setError(err?.message || 'Could not load fine history.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [empId, refreshKey]);

  if (!empId) return null;

  const monthStart = monthStartIST();
  const thisMonth = fines.filter((f) => (f.date || '') >= monthStart).length;

  return (
    <Modal
      isOpen={Boolean(empId)}
      onClose={onClose}
      size="lg"
      title={employee?.full_name || 'Employee Fines'}
      subtitle={`Employee ID: ${empId}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!employee || loading}
            onClick={() => employee && onMarkFine(employee)}
          >
            <Gavel size={16} /> Mark Fine Again
          </button>
        </>
      }
    >
      {loading && !employee ? (
        <div className="fine-empty">
          <Loader2 size={18} className="spin" /> Loading...
        </div>
      ) : error ? (
        <div className="fine-empty fine-empty-error">{error}</div>
      ) : !employee ? (
        <div className="fine-empty fine-empty-error">Employee record not found.</div>
      ) : (
        <>
          {thisMonth > 1 && (
            <div className="fine-repeat-alert" role="status">
              <AlertTriangle size={16} />
              <span>
                Repeat offender: <strong>{thisMonth} fines</strong> this month.
              </span>
            </div>
          )}

          <div className="fine-history-stats">
            <div>
              <span>Total Fines</span>
              <strong>{totalCount}</strong>
            </div>
            <div>
              <span>This Month</span>
              <strong className={thisMonth > 1 ? 'fine-text-red' : ''}>{thisMonth}</strong>
            </div>
            <div>
              <span>Total Amount</span>
              <strong className="fine-text-red">{inr(totalAmount)}</strong>
            </div>
          </div>

          <div className="fine-details" style={{ marginBottom: 16 }}>
            <div className="fine-detail-row">
              <span className="fine-detail-label"><Building2 size={13} />Department</span>
              <span className="fine-detail-value">{employee.department || '—'}</span>
            </div>
            <div className="fine-detail-row">
              <span className="fine-detail-label"><BadgeCheck size={13} />Designation</span>
              <span className="fine-detail-value">{employee.designation || '—'}</span>
            </div>
            <div className="fine-detail-row">
              <span className="fine-detail-label"><UserCog size={13} />HOD</span>
              <span className="fine-detail-value">
                {employee.hod_name ? `${employee.hod_name} (${employee.hod_id})` : employee.hod_id || '—'}
              </span>
            </div>
            <div className="fine-detail-row">
              <span className="fine-detail-label"><Phone size={13} />Phone</span>
              <span className="fine-detail-value">{employee.phone_number || '—'}</span>
            </div>
          </div>

          <div className="fine-section-title" style={{ marginBottom: 8 }}>
            Fine History
            {loading && <Loader2 size={14} className="spin" />}
          </div>
          {fines.length === 0 ? (
            <div className="fine-empty">No fines recorded.</div>
          ) : (
            <div className="fine-history-list">
              {fines.map((f) => (
                <div key={f.id} className="fine-history-item">
                  {f.picture ? (
                    <button type="button" className="fine-thumb" onClick={() => onPreviewImage(f)} aria-label="View image">
                      <img src={f.picture} alt="" loading="lazy" />
                    </button>
                  ) : (
                    <div className="fine-thumb fine-thumb-empty">
                      <ImageIcon size={16} />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="fine-mobile-date" style={{ marginTop: 0 }}>
                        {formatISTDate(f.date || f.created_at)}
                      </span>
                      <span className="fine-amount">{fmtAmount(f.fine_amount)}</span>
                    </div>
                    <div className="fine-mobile-reason">{f.reason || '—'}</div>
                  </div>
                </div>
              ))}
              {totalCount > fines.length && (
                <div className="form-hint" style={{ textAlign: 'center' }}>
                  Showing latest {fines.length} of {totalCount} fines
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
};
