import React, { useState } from 'react';
import { Task } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { PhotoGallery } from '../common/PhotoGallery';
import { CheckCircle2, RotateCcw, AlertCircle, ShieldAlert, Wrench, Clock, User } from 'lucide-react';
import { formatISTDateTime } from '../../utils/dateUtils';
import confetti from 'canvas-confetti';

interface OfficerReviewModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewCompleted: () => void;
}

export const OfficerReviewModal: React.FC<OfficerReviewModalProps> = ({
  task,
  isOpen,
  onClose,
  onReviewCompleted,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const obs = task.observation;
  const previousAttempts = task.corrective_actions && task.corrective_actions.length > 1
    ? task.corrective_actions.slice(0, -1)
    : [];
  const latestAttempt = task.corrective_actions && task.corrective_actions.length > 0
    ? task.corrective_actions[task.corrective_actions.length - 1]
    : null;

  const handleApprove = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await DataService.reviewTask({
        task_id: task.observation_id || task.id,
        officer_id: currentUser.emp_id || currentUser.id,
        decision: 'COMPLETE',
      });

      // Celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore if not supported
      }

      showToast({
        type: 'success',
        title: 'Task Completed',
        message: `${task.task_number} has been approved and marked COMPLETED.`,
      });
      onReviewCompleted();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Action Failed', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendForRework = async () => {
    if (!currentUser) return;
    if (!reworkReason.trim()) {
      showToast({
        type: 'warning',
        title: 'Reason Required',
        message: 'Please enter rework reason.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.reviewTask({
        task_id: task.observation_id || task.id,
        officer_id: currentUser.emp_id || currentUser.id,
        decision: 'REWORK',
        rework_reason: reworkReason.trim(),
      });

      showToast({
        type: 'warning',
        title: 'Rework Requested',
        message: `${task.task_number} sent back to ${task.assignee?.full_name || 'employee'} for rework.`,
      });
      setReworkReason('');
      setShowReworkInput(false);
      onReviewCompleted();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Action Failed', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Officer Review — ${task.task_number}`}
      size="xl"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        {/* LEFT COLUMN: STEP 1 - Original Hazard Observation (Read-only) */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <ShieldAlert size={16} color="var(--brand-primary)" />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Step 1: Original Safety Hazard</h4>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {obs && <PriorityBadge priority={obs.priority} />}
            <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
              {obs?.department?.name || 'Department'}
            </span>
            <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
              Area: {obs?.area}
            </span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: '3px' }}>
              <strong>Logged On:</strong> {formatISTDateTime(task.created_at)}
            </div>
            <div>
              <strong>Target Resolution Due:</strong> {formatISTDateTime(task.due_date)}
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>OBSERVED HAZARD</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '3px', lineHeight: 1.45, margin: 0 }}>
              {obs?.observation_text}
            </p>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>RECOMMENDED RESOLUTION</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.45, margin: 0 }}>
              {obs?.solution_text || 'None specified.'}
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
              INITIAL PHOTOS
            </div>
            <PhotoGallery photos={obs?.photos} />
          </div>
        </div>

        {/* RIGHT COLUMN: STEP 2 - Employee Corrective Action Submission */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-hover)',
            borderRadius: '10px',
            padding: '18px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={18} color="#0284c7" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                Step 2: Corrective Proof (Attempt #{latestAttempt?.attempt_number || 1})
              </h4>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {latestAttempt?.submitted_at ? formatISTDateTime(latestAttempt.submitted_at) : ''}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Submitted by: <strong style={{ color: 'var(--text-primary)' }}>{task.assignee?.full_name || 'Assigned Employee'}</strong> (Emp ID: {task.assigned_to})
          </div>

          {/* Previous Cycles Refusal Summary */}
          {previousAttempts.length > 0 && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 12px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Previous Rework Cycles ({previousAttempts.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {previousAttempts.map((pa) => (
                  <div key={pa.id} style={{ fontSize: '0.75rem', color: '#881337', background: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700 }}>Attempt #{pa.attempt_number} Refusal:</span>
                      {pa.reworked_at && (
                        <span style={{ fontSize: '0.68rem', color: '#9f1239' }}>{formatISTDateTime(pa.reworked_at)}</span>
                      )}
                    </div>
                    <div>"{pa.rework_reason || 'Rework requested'}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>EMPLOYEE ACTION REPORT</div>
            <div
              style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginTop: '4px',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              {latestAttempt?.action_description || 'No corrective action submitted yet.'}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
              CORRECTIVE ACTION EVIDENCE PHOTOS
            </div>
            <PhotoGallery photos={latestAttempt?.photos} />
          </div>

          {/* Rework Input Form */}
          {showReworkInput && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '14px',
                marginTop: '14px',
              }}
            >
              <label className="form-label" style={{ color: '#fca5a5' }}>
                Officer Observation / Rework Reason <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={reworkReason}
                onChange={(e) => setReworkReason(e.target.value)}
                style={{ marginTop: '6px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowReworkInput(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleSendForRework}
                  disabled={isSubmitting || !reworkReason.trim()}
                >
                  Confirm Resubmit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      {!showReworkInput && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            gap: '10px',
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowReworkInput(true)}
            disabled={isSubmitting}
            style={{ padding: '8px 20px', borderColor: '#f97316', color: '#ea580c', fontWeight: 600 }}
          >
            <RotateCcw size={15} color="#ea580c" />
            <span>Resubmit</span>
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleApprove}
            disabled={isSubmitting}
            style={{ padding: '8px 24px', fontWeight: 600 }}
          >
            <CheckCircle2 size={15} />
            <span>OK</span>
          </button>
        </div>
      )}
    </Modal>
  );
};
