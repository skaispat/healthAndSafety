import React, { useEffect, useRef, useState } from 'react';
import { IndianRupee, Loader2, AlertCircle } from 'lucide-react';
import { FineEvidenceImageField } from './FineEvidenceImageField';
import { PpeHistoryPanel } from '../ppe/PpeHistoryPanel';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { FINE_LIMITS, validateFineAmount, validateFineImage } from '../../services/fineService';
import {
  Contractor,
  ContractorFine,
  ContractorFineService,
  MAX_WORKER_NAME,
} from '../../services/contractorFineService';

interface Props {
  isOpen: boolean;
  contractors: Contractor[];
  contractorsLoading?: boolean;
  /** Pre-selected contractor (e.g. "Mark Fine Again" from history). */
  preselectedConId?: number | null;
  onClose: () => void;
  onSuccess: (fine: ContractorFine) => void;
}

type Errors = { contractor?: string; empName?: string; amount?: string; reason?: string; image?: string; form?: string };

export const MarkContractorFineModal: React.FC<Props> = ({
  isOpen,
  contractors,
  contractorsLoading,
  preselectedConId,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [conId, setConId] = useState<string>('');
  const [empName, setEmpName] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [imageBusy, setImageBusy] = useState(false); // HEIC conversion in progress

  // Reset whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setConId(preselectedConId ? String(preselectedConId) : '');
    setEmpName('');
    setAmount('');
    setReason('');
    setImage(null);
    setErrors({});
    setSubmitting(false);
    submittingRef.current = false;
  }, [isOpen, preselectedConId]);

  // Previously fined workers of the selected contractor → prefill + suggestions
  const [workerNames, setWorkerNames] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const autoFilledName = useRef<string>(''); // last value we filled in (so we never overwrite typing)

  useEffect(() => {
    if (!isOpen) return;
    const id = Number(conId);
    setWorkerNames([]);
    if (!conId || !Number.isSafeInteger(id)) {
      // Contractor cleared: drop the auto-filled name, keep anything the user typed
      setEmpName((cur) => (cur === autoFilledName.current ? '' : cur));
      autoFilledName.current = '';
      return;
    }
    let cancelled = false;
    setLoadingWorkers(true);
    ContractorFineService.getWorkerNames(id)
      .then((names) => {
        if (cancelled) return;
        setWorkerNames(names);
        const latest = names[0] || '';
        // Prefill only if the field is empty or still holds our previous auto-fill
        setEmpName((cur) => {
          if (cur.trim() === '' || cur === autoFilledName.current) {
            autoFilledName.current = latest;
            return latest;
          }
          return cur;
        });
      })
      .finally(() => !cancelled && setLoadingWorkers(false));
    return () => {
      cancelled = true;
    };
  }, [conId, isOpen]);

  const selected = contractors.find((c) => String(c.id) === conId) || null;

  const handleClose = () => {
    if (submittingRef.current) return;
    onClose();
  };


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submittingRef.current || imageBusy) return;

    const amt = validateFineAmount(amount);
    const name = empName.replace(/\s+/g, ' ').trim();
    const trimmedReason = reason.trim();
    const next: Errors = {};
    if (!selected) next.contractor = 'Please select a contractor.';
    if (name.length < 2) next.empName = 'Please enter the worker name.';
    if (amt.error) next.amount = amt.error;
    if (trimmedReason.length < FINE_LIMITS.MIN_REASON_LENGTH) next.reason = 'Please describe the reason (min 3 characters).';
    const imgErr = validateFineImage(image);
    if (imgErr) next.image = imgErr;
    setErrors(next);
    if (Object.keys(next).length > 0 || !selected) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const fine = await ContractorFineService.createFine({
        con_id: selected.id,
        emp_name: name,
        amount: amt.value!,
        reason: trimmedReason,
        image: image!,
      });
      showToast({
        type: 'success',
        title: 'Fine Recorded',
        message: `₹${fine.fine_amount} fine marked for ${name} (${selected.contractor_name || 'Contractor'}).`,
      });
      submittingRef.current = false;
      setSubmitting(false);
      onSuccess(fine);

      // WhatsApp to the contractor in the background; the fine is already saved.
      const contractorName = selected.contractor_name || 'contractor';
      ContractorFineService.sendWhatsApp(fine.id).then((res) => {
        showToast(
          res.sent
            ? { type: 'info', title: 'WhatsApp Sent', message: `Fine notice sent to ${contractorName}.` }
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Mark Contractor Fine"
      subtitle={selected ? selected.contractor_name || `Contractor #${selected.id}` : 'Select a contractor'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="mark-contractor-fine-form" className="btn btn-primary" disabled={submitting || imageBusy}>
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
      <form id="mark-contractor-fine-form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="fine-form-error" role="alert">
            <AlertCircle size={16} />
            <span>{errors.form}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="cf-contractor">
            Contractor <span className="required">*</span>
          </label>
          <select
            id="cf-contractor"
            className="form-select"
            value={conId}
            disabled={submitting || contractorsLoading}
            onChange={(e) => {
              setConId(e.target.value);
              setErrors((p) => ({ ...p, contractor: undefined }));
            }}
            aria-invalid={Boolean(errors.contractor)}
          >
            <option value="">{contractorsLoading ? 'Loading contractors...' : 'Select contractor'}</option>
            {contractors.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.contractor_name || `Contractor #${c.id}`}
              </option>
            ))}
          </select>
          {errors.contractor && <span className="fine-field-error">{errors.contractor}</span>}
          {!contractorsLoading && contractors.length === 0 && (
            <span className="form-hint">No contractors found in the contractor table.</span>
          )}
        </div>

        <div className="fine-form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="cf-dept">Department</label>
            <input id="cf-dept" className="form-input" value={selected?.department || ''} placeholder="Auto-filled" readOnly tabIndex={-1} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cf-phone">Phone Number</label>
            <input id="cf-phone" className="form-input" value={selected?.phone_number || ''} placeholder="Auto-filled" readOnly tabIndex={-1} />
          </div>
        </div>
        {selected && !selected.phone_number && (
          <div className="form-hint" style={{ marginTop: -10, marginBottom: 14, color: '#b45309' }}>
            This contractor has no phone number, so no WhatsApp notice can be sent.
          </div>
        )}

        {/* PPE issued to this contractor (ppe_issue.contracto_id), for reference before fining */}
        {selected && <PpeHistoryPanel conId={selected.id} />}

        <div className="form-group">
          <label className="form-label" htmlFor="cf-emp">
            Worker Name <span className="required">*</span>
          </label>
          <input
            id="cf-emp"
            className="form-input"
            placeholder={loadingWorkers ? 'Loading previous workers...' : "Name of the contractor's worker"}
            value={empName}
            maxLength={MAX_WORKER_NAME}
            autoComplete="off"
            list={workerNames.length > 0 ? 'cf-worker-names' : undefined}
            disabled={submitting}
            onChange={(e) => setEmpName(e.target.value)}
            aria-invalid={Boolean(errors.empName)}
          />
          {workerNames.length > 0 && (
            <datalist id="cf-worker-names">
              {workerNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          )}
          {errors.empName ? (
            <span className="fine-field-error">{errors.empName}</span>
          ) : workerNames.length > 0 && empName === autoFilledName.current && empName ? (
            <span className="form-hint">Prefilled from this contractor's last fine — edit if it's a different worker.</span>
          ) : null}

          {/* Quick-pick chips for previously fined workers (mobile friendly) */}
          {workerNames.length > 1 && !submitting && (
            <div className="fine-worker-chips" aria-label="Previously fined workers">
              {workerNames.slice(0, 8).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`fine-worker-chip ${n === empName ? 'fine-worker-chip-active' : ''}`}
                  onClick={() => {
                    setEmpName(n);
                    setErrors((p) => ({ ...p, empName: undefined }));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="cf-amount">
            Fine Amount (₹) <span className="required">*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <IndianRupee
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              id="cf-amount"
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
          <label className="form-label" htmlFor="cf-reason">
            Reason <span className="required">*</span>
          </label>
          <textarea
            id="cf-reason"
            className="form-textarea"
            placeholder="Describe the safety violation"
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
