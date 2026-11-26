import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, IndianRupee, Loader2, X, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  FineService,
  FineEmployee,
  SafetyFine,
  FINE_LIMITS,
  validateFineAmount,
  validateFineImage,
} from '../../services/fineService';

interface MarkFineModalProps {
  employee: FineEmployee | null;
  onClose: () => void;
  onSuccess: (fine: SafetyFine) => void;
}

export const MarkFineModal: React.FC<MarkFineModalProps> = ({ employee, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; image?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Reset form whenever a new employee is selected
  useEffect(() => {
    setAmount('');
    setReason('');
    setImage(null);
    setErrors({});
    setSubmitting(false);
    submittingRef.current = false;
  }, [employee?.emp_id]);

  // Manage preview object URL lifecycle (avoid memory leaks)
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const handleClose = () => {
    if (submittingRef.current) return; // block closing mid-submit
    onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;
    const err = validateFineImage(file);
    setErrors((p) => ({ ...p, image: err || undefined }));
    if (!err) setImage(file);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!employee || submittingRef.current) return;

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

  if (!employee) return null;

  return (
    <Modal
      isOpen={Boolean(employee)}
      onClose={handleClose}
      title="Mark Fine"
      subtitle={`${employee.full_name} · ${employee.emp_id}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="mark-fine-form" className="btn btn-primary" disabled={submitting}>
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

        <div className="form-group" style={{ marginBottom: 0 }}>
          <span className="form-label">
            Evidence Image <span className="required">*</span>
          </span>

          {preview ? (
            <div className="fine-image-preview">
              <img src={preview} alt="Fine evidence preview" />
              {!submitting && (
                <button
                  type="button"
                  className="fine-image-remove"
                  onClick={() => setImage(null)}
                  aria-label="Remove image"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="fine-image-actions">
              <button type="button" className="btn btn-outline" onClick={() => cameraRef.current?.click()} disabled={submitting}>
                <Camera size={16} /> Take Photo
              </button>
              <button type="button" className="btn btn-outline" onClick={() => galleryRef.current?.click()} disabled={submitting}>
                <ImagePlus size={16} /> Choose Image
              </button>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            hidden
            onChange={handleFile}
          />
          {errors.image ? (
            <span className="fine-field-error">{errors.image}</span>
          ) : (
            <span className="form-hint">JPG, PNG, WebP or HEIC · max 10 MB</span>
          )}
        </div>
      </form>
    </Modal>
  );
};
