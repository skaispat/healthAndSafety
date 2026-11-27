import React, { useEffect, useRef, useState } from 'react';
import { IndianRupee, Loader2, AlertCircle, Search, ChevronRight } from 'lucide-react';
import { FineEvidenceImageField } from './FineEvidenceImageField';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  FineService,
  FineEmployee,
  SafetyFine,
  FINE_LIMITS,
  validateFineAmount,
  validateFineImage,
  sanitizeSearchTerm,
} from '../../services/fineService';

interface MarkFineModalProps {
  isOpen: boolean;
  /** Pre-selected employee. When null, the modal first asks to search & pick an employee. */
  employee: FineEmployee | null;
  onClose: () => void;
  onSuccess: (fine: SafetyFine) => void;
}

export const MarkFineModal: React.FC<MarkFineModalProps> = ({ isOpen, employee: preselected, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [employee, setEmployee] = useState<FineEmployee | null>(preselected);

  // Employee picker (used when opened without a pre-selected employee)
  const [pickQuery, setPickQuery] = useState('');
  const [pickResults, setPickResults] = useState<FineEmployee[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const pickSeq = useRef(0);
  const pickTerm = sanitizeSearchTerm(pickQuery);

  // Sync selection each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setEmployee(preselected);
    setPickQuery('');
    setPickResults([]);
    setPickError(null);
  }, [isOpen, preselected?.emp_id]);

  // Debounced employee search with stale-response protection
  useEffect(() => {
    if (!isOpen || employee) return;
    if (pickTerm.length < FINE_LIMITS.SEARCH_MIN_CHARS) {
      pickSeq.current++;
      setPickResults([]);
      setPicking(false);
      setPickError(null);
      return;
    }
    const seq = ++pickSeq.current;
    setPicking(true);
    setPickError(null);
    const t = window.setTimeout(async () => {
      try {
        const rows = await FineService.searchEmployees(pickTerm);
        if (seq === pickSeq.current) setPickResults(rows);
      } catch (err: any) {
        if (seq === pickSeq.current) {
          setPickResults([]);
          setPickError(err?.message || 'Search failed.');
        }
      } finally {
        if (seq === pickSeq.current) setPicking(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [pickTerm, isOpen, employee]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; image?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [imageBusy, setImageBusy] = useState(false); // HEIC conversion in progress

  // Reset form whenever a new employee is selected
  useEffect(() => {
    setAmount('');
    setReason('');
    setImage(null);
    setErrors({});
    setSubmitting(false);
    submittingRef.current = false;
  }, [employee?.emp_id, isOpen]);


  const handleClose = () => {
    if (submittingRef.current) return; // block closing mid-submit
    onClose();
  };


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!employee || submittingRef.current || imageBusy) return;

    const amt = validateFineAmount(amount);
    const trimmedReason = reason.trim();
    const next: typeof errors = {};
    if (amt.error) next.amount = amt.error;
    if (trimmedReason.length < FINE_LIMITS.MIN_REASON_LENGTH) next.reason = 'Please describe the reason (min 3 characters).';
    else if (trimmedReason.length > FINE_LIMITS.MAX_REASON_LENGTH) next.reason = `Max ${FINE_LIMITS.MAX_REASON_LENGTH} characters.`;
    const imgErr = validateFineImage(image);
    if (imgErr) next.image = imgErr;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const fine = await FineService.createFine({
        emp_id: employee.emp_id,
        amount: amt.value!,
        reason: trimmedReason,
        image: image!,
      });
      showToast({
        type: 'success',
        title: 'Fine Recorded',
        message: `₹${fine.fine_amount} fine marked for ${employee.full_name}.`,
      });
      submittingRef.current = false;
      setSubmitting(false);
      onSuccess(fine);

      // Fire WhatsApp notification in the background; fine is already saved.
      const employeeName = employee.full_name;
      FineService.sendFineWhatsApp(fine.id).then((res) => {
        showToast(
          res.sent
            ? { type: 'info', title: 'WhatsApp Sent', message: `Fine notice sent to ${employeeName}.` }
            : {
                type: 'warning',
                title: 'WhatsApp Not Sent',
                message: `Fine saved, but the WhatsApp notice failed: ${res.error}`,
                duration: 7000,
              }
        );
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to record fine. Please try again.';
      setErrors({ form: msg });
      showToast({ type: 'error', title: 'Fine Not Saved', message: msg });
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  /* ---------- Step 1: pick an employee ---------- */
  if (!employee) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Mark Fine"
        subtitle="Select the employee to fine"
        footer={
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
        }
      >
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="search"
            className="form-input"
            placeholder="Employee ID, name or phone number"
            value={pickQuery}
            maxLength={FINE_LIMITS.SEARCH_MAX_CHARS}
            onChange={(e) => setPickQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
            aria-label="Search employee to fine"
            autoComplete="off"
            autoFocus
          />
        </div>

        {pickTerm.length < FINE_LIMITS.SEARCH_MIN_CHARS ? (
          <div className="fine-empty">Type an Employee ID, name or phone number to search.</div>
        ) : picking && pickResults.length === 0 ? (
          <div className="fine-empty">
            <Loader2 size={18} className="spin" /> Searching...
          </div>
        ) : pickError ? (
          <div className="fine-empty fine-empty-error">{pickError}</div>
        ) : pickResults.length === 0 ? (
          <div className="fine-empty">No employees match “{pickTerm}”.</div>
        ) : (
          <div className="fine-pick-list" aria-busy={picking}>
            {pickResults.map((emp) => (
              <button
                key={emp.emp_id}
                type="button"
                className={`fine-pick-item ${emp.is_active === false ? 'emp-row-disabled' : ''}`}
                onClick={() => emp.is_active !== false && setEmployee(emp)}
                disabled={emp.is_active === false}
                title={emp.is_active === false ? 'Inactive employees cannot be fined' : undefined}
              >
                <div className="fine-avatar">{(emp.full_name || '?').trim().charAt(0).toUpperCase()}</div>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div className="fine-employee-name">{emp.full_name}</div>
                  <div className="fine-employee-id">
                    {emp.emp_id}
                    {emp.department ? ` · ${emp.department}` : ''}
                    {emp.designation ? ` · ${emp.designation}` : ''}
                  </div>
                </div>
                {emp.is_active === false && <span className="fine-inactive">Inactive</span>}
                <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </Modal>
    );
  }

  /* ---------- Step 2: fine details ---------- */
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Mark Fine"
      subtitle={`${employee.full_name} · ${employee.emp_id}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="mark-fine-form" className="btn btn-primary" disabled={submitting || imageBusy}>
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" /> Saving...
              </>
            ) : (
              'Submit Fine'
            )}
          </button>
        </>
      }
    >
      <form id="mark-fine-form" onSubmit={handleSubmit} noValidate>
        {/* Selected employee summary; "Change" only when picked inside this modal */}
        <div className="fine-selected-emp">
          <div className="fine-avatar">{(employee.full_name || '?').trim().charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="fine-employee-name">{employee.full_name}</div>
            <div className="fine-employee-id">
              {employee.emp_id}
              {employee.department ? ` · ${employee.department}` : ''}
            </div>
          </div>
          {!preselected && !submitting && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEmployee(null)}>
              Change
            </button>
          )}
        </div>

        {errors.form && (
          <div className="fine-form-error" role="alert">
            <AlertCircle size={16} />
            <span>{errors.form}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="fine-amount">
            Fine Amount (₹) <span className="required">*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <IndianRupee
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              id="fine-amount"
              className="form-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 500"
              value={amount}
              maxLength={10}
              disabled={submitting}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              style={{ paddingLeft: 32 }}
              aria-invalid={Boolean(errors.amount)}
            />
          </div>
          {errors.amount && <span className="fine-field-error">{errors.amount}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="fine-reason">
            Reason <span className="required">*</span>
          </label>
          <textarea
            id="fine-reason"
            className="form-textarea"
            placeholder="Describe the safety violation (e.g. not wearing helmet in plant area)"
            value={reason}
            maxLength={FINE_LIMITS.MAX_REASON_LENGTH}
            disabled={submitting}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={Boolean(errors.reason)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span className="fine-field-error">{errors.reason || ''}</span>
            <span className="form-hint">
              {reason.length}/{FINE_LIMITS.MAX_REASON_LENGTH}
            </span>
          </div>
        </div>

        <FineEvidenceImageField
          image={image}
          onChange={setImage}
          error={errors.image}
          onError={(msg) => setErrors((p) => ({ ...p, image: msg }))}
          disabled={submitting}
          onBusyChange={setImageBusy}
        />
      </form>
    </Modal>
  );
};
