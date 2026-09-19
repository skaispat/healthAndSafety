import React, { useState } from 'react';
import { Task } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import { formatISTDateTime } from '../../utils/dateUtils';
import { Send, AlertCircle, Wrench, CheckCircle2, User, Clock, ShieldCheck } from 'lucide-react';

interface CorrectiveActionFormProps {
  task: Task;
  onSuccess: () => void;
}

export const CorrectiveActionForm: React.FC<CorrectiveActionFormProps> = ({ task, onSuccess }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attemptNumber = (task.corrective_actions?.length || 0) + 1;
  const isRework = task.status === 'REWORK_REQUIRED';
  const refusalReason = task.rework_reason || task.observation?.rework_reason ||
    (task.corrective_actions && task.corrective_actions.length > 0
      ? task.corrective_actions[task.corrective_actions.length - 1].rework_reason
      : null);

  const refusalTime = task.observation?.updated_at || task.updated_at;

  const submitAction = async (markAsCompleted: boolean) => {
    if (!description.trim()) {
      showToast({ type: 'warning', title: 'Validation Error', message: 'Please enter your solution remarks and corrective details.' });
      return;
    }
    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      await DataService.submitCorrectiveAction({
        task_id: task.id,
        submitted_by: Number(currentUser.emp_id || currentUser.id),
        action_description: description.trim(),
        photos: photos.map((p) => ({ url: p.url, file_name: p.file_name })),
        markAsCompleted,
      });

      showToast({
        type: 'success',
        title: markAsCompleted ? 'Task Completed' : 'Action Submitted for Review',
        message: markAsCompleted
          ? 'Task marked as completed with corrective evidence photos recorded.'
          : `Corrective action (Attempt #${attemptNumber}) submitted for Health & Safety Officer review.`,
      });
      setDescription('');
      setPhotos([]);
      onSuccess();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Could not submit corrective action.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid var(--border-hover)',
        borderRadius: '12px',
        padding: '24px',
        marginTop: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header with Attempt Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: isRework ? '#fff1f2' : '#f0fdf4',
              color: isRework ? '#e11d48' : '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wrench size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.025rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {isRework ? `Submit Rework Action — Cycle #${attemptNumber}` : `Submit Corrective Action & Evidence — Attempt #${attemptNumber}`}
            </h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Fill in the sequential steps below and attach verified photographic proof of hazard rectification.
            </span>
          </div>
        </div>

        <span
          className={isRework ? 'badge badge-rework-required' : 'badge badge-in-progress'}
          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
        >
          {isRework ? `Rework Cycle: Attempt #${attemptNumber}` : `Initial Action: Attempt #${attemptNumber}`}
        </span>
      </div>

      {/* Officer Refusal Reason Callout */}
      {isRework && refusalReason && (
        <div
          style={{
            background: '#fff1f2',
            border: '1.5px solid #f43f5e',
            borderRadius: '10px',
            padding: '16px 18px',
            marginBottom: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e11d48', fontWeight: 700, fontSize: '0.925rem' }}>
              <AlertCircle size={18} />
              <span>Officer Refusal Feedback (Attempt #{attemptNumber - 1} Sent Back for Rework):</span>
            </div>
            {refusalTime && (
              <span style={{ fontSize: '0.72rem', color: '#9f1239', fontWeight: 600 }}>
                Refused at: {formatISTDateTime(refusalTime)}
              </span>
            )}
          </div>

          <div
            style={{
              padding: '12px 14px',
              background: '#ffffff',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#881337',
              fontWeight: 600,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            "{refusalReason}"
          </div>
          <p style={{ fontSize: '0.8rem', color: '#9f1239', margin: '8px 0 0 0' }}>
            ⚠️ Please address the officer's refusal notes above in your updated solution remarks and attach new clear photo proof before re-submitting.
          </p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submitAction(false); }}>
        {/* STEP 1: SOLUTION REMARKS */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                background: 'var(--brand-primary)',
                color: '#ffffff',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              1
            </span>
            <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>
              Solution Remarks & Actions Executed <span className="required">*</span>
            </label>
          </div>

          <textarea
            className="form-textarea"
            rows={4}
            placeholder={
              isRework
                ? "Describe in detail how you addressed the officer's feedback, corrected the hazard, and isolated any ongoing safety risks..."
                : "Detail all repairs, equipment adjustments, safety isolations, or procedural corrections carried out..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            style={{ fontSize: '0.875rem' }}
          />
          <span className="form-hint" style={{ marginTop: '6px', display: 'block', fontSize: '0.78rem' }}>
            Be specific about mechanical replacements, electrical isolations, housekeeping done, or safety guards installed.
          </span>
        </div>

        {/* STEP 2: EVIDENCE PHOTOS */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                background: 'var(--brand-primary)',
                color: '#ffffff',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              2
            </span>
            <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>
              Corrective Evidence Photos (After Repair)
            </label>
          </div>

          <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={10} />
          <span className="form-hint" style={{ marginTop: '6px', display: 'block', fontSize: '0.78rem' }}>
            Upload high-resolution photographs demonstrating the hazard has been rectified (stored in 'observation' bucket).
          </span>
        </div>

        {/* STEP 3: SUBMITTER DETAILS & IST TIMESTAMP BANNER */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={15} color="var(--brand-primary)" />
            <span>
              Action Submitter:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {(!currentUser?.full_name || currentUser.full_name.toLowerCase() === 'admin') ? (currentUser?.position || 'Assigned Employee') : currentUser.full_name}
              </strong>{' '}
              (Emp ID: {currentUser?.emp_id || 'N/A'})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span>
              Submission Time:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {formatISTDateTime(new Date())}
              </strong>
            </span>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ color: '#047857', borderColor: '#a7f3d0' }}
            disabled={isSubmitting || !description.trim()}
            onClick={() => submitAction(true)}
          >
            <CheckCircle2 size={16} />
            <span>Mark as Completed Directly</span>
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !description.trim()}
          >
            <Send size={16} />
            <span>
              {isSubmitting
                ? 'Submitting...'
                : isRework
                ? `Submit Attempt #${attemptNumber} for Officer Review`
                : `Submit Attempt #${attemptNumber} for Review`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

