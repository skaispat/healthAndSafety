import React, { useState, useEffect } from 'react';
import { Task, Observation } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';
import { Modal } from '../common/Modal';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { PhotoGallery } from '../common/PhotoGallery';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import {
  Building2,
  MapPin,
  Calendar,
  Send,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Clock,
  Download,
  ShieldCheck
} from 'lucide-react';
import { formatISTDate, formatISTDateTime } from '../../utils/dateUtils';
import { exportTaskReportPDF } from '../../utils/reportExport';
import confetti from 'canvas-confetti';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  const { currentUser, isOfficer } = useAuth();
  const { showToast } = useToast();

  // Form states for employee / officer update
  const [solutionRemarks, setSolutionRemarks] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [resolutionStage, setResolutionStage] = useState<'PARTIALLY_DONE' | 'SUBMITTED_FOR_REVIEW'>('SUBMITTED_FOR_REVIEW');

  // States for admin / officer review
  const [officerNotes, setOfficerNotes] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [showReworkBox, setShowReworkBox] = useState(false);
  const [showApproveBox, setShowApproveBox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fallback observation loading if task.observation is missing
  const [loadedObs, setLoadedObs] = useState<Observation | null>(task?.observation || null);

  const isSafetyOfficerOrAdmin = Boolean(
    isOfficer ||
    (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY') ||
    (currentUser?.role && currentUser.role.toUpperCase() === 'HEALTH_SAFETY_OFFICER') ||
    (currentUser?.role && currentUser.role.toLowerCase() === 'admin')
  );
  const isAdmin = isSafetyOfficerOrAdmin;

  useEffect(() => {
    if (!task) return;
    if (task.observation) {
      setLoadedObs(task.observation);
    } else {
      const obsId = task.observation_id || task.id;
      if (obsId) {
        DataService.getObservationById(obsId).then((o) => {
          if (o) setLoadedObs(o);
        });
      }
    }
  }, [task]);

  useEffect(() => {
    if (isOpen) {
      setResolutionStage('SUBMITTED_FOR_REVIEW');
      setShowReworkBox(false);
      setShowApproveBox(false);
      setOfficerNotes('');
      setApprovalRemarks('');
      setSolutionRemarks('');
      setPhotos([]);
    }
  }, [isOpen]);

  if (!task) return null;

  const obs = task.observation || loadedObs || (task as any);
  const rawAssigneeId = task.assigned_to ?? obs?.assigned_to ?? task.assignee?.emp_id ?? (task.assignee as any)?.id;
  const assigneeEmpId = rawAssigneeId != null && rawAssigneeId !== '' && !isNaN(Number(rawAssigneeId)) ? Number(rawAssigneeId) : null;
  const rawCreatorId = task.assigned_by ?? obs?.created_by ?? task.assigner?.emp_id ?? (task.assigner as any)?.id;
  const creatorEmpId = rawCreatorId != null && rawCreatorId !== '' && !isNaN(Number(rawCreatorId)) ? Number(rawCreatorId) : null;
  const currentEmpId = currentUser?.emp_id != null && !isNaN(Number(currentUser.emp_id))
    ? Number(currentUser.emp_id)
    : (currentUser?.id != null && !isNaN(Number(currentUser.id)) ? Number(currentUser.id) : null);

  const isOfficerOrAdmin = Boolean(
    isOfficer ||
    isAdmin ||
    (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY') ||
    (currentUser?.role && currentUser.role.toUpperCase() === 'HEALTH_SAFETY_OFFICER') ||
    (currentUser?.role && currentUser.role.toLowerCase() === 'admin') ||
    (currentUser?.username && currentUser.username.toLowerCase() === 'admin')
  );

  const isAssignee = Boolean(
    (currentEmpId && assigneeEmpId && currentEmpId === assigneeEmpId) ||
    (currentUser?.emp_id && task.assigned_to && String(currentUser.emp_id) === String(task.assigned_to)) ||
    (currentUser?.id && task.assigned_to && String(currentUser.id) === String(task.assigned_to)) ||
    (task.assignee?.username && currentUser?.username && task.assignee.username.toLowerCase() === currentUser.username.toLowerCase())
  );
  const isParticipant = Boolean(currentEmpId && task.participants?.some((p) => Number(p.user_id) === currentEmpId));
  const isAssigneeOrParticipant = isAssignee || isParticipant;
  const isCompleted = task.status === 'COMPLETED' || obs?.status === 'COMPLETED' || task.status === 'CLOSED';
  const isPendingVerification = task.status === 'SUBMITTED_FOR_REVIEW' || obs?.status === 'SUBMITTED_FOR_REVIEW';

  const isRework = task.status === 'REWORK_REQUIRED';
  const reworkReason = task.rework_reason || obs?.rework_reason;

  const isSelfAssigned = isAssignee || Boolean(currentEmpId && creatorEmpId && currentEmpId === creatorEmpId && isOfficerOrAdmin);

  // If the task is active (IN_PROGRESS, ASSIGNED, or REWORK_REQUIRED):
  // The assignee, participant, self-assigned user, OR Safety Officer / Admin
  // MUST have the submission form and action buttons available to save updates or submit for completion.
  const canSubmitAction = (isAssigneeOrParticipant || isSelfAssigned || isOfficerOrAdmin) && !isCompleted;
  const canAct = canSubmitAction;

  const correctiveActions = (task.corrective_actions && task.corrective_actions.length > 0)
    ? task.corrective_actions
    : (obs?.corrective_actions || []);
  const latestAction = correctiveActions.length > 0
    ? correctiveActions[correctiveActions.length - 1]
    : null;

  const assignerName = task.assigner?.full_name || obs?.creator?.full_name || (task.assigned_by ? `Emp #${task.assigned_by}` : null);
  const assigneeName = task.assignee?.full_name || (task.assigned_to ? `Emp #${task.assigned_to}` : null);
  const deptName = obs?.department?.name || loadedObs?.department?.name || (typeof task.assignee?.department === 'string' ? task.assignee.department : (task.assignee?.department as any)?.name) || null;
  const areaName = obs?.area || loadedObs?.area || (task as any).area || '';
  const priority = obs?.priority || loadedObs?.priority || (task as any).priority;
  const problemText = obs?.observation_text || loadedObs?.observation_text || (task as any).observation_text || '';
  const solutionText = obs?.solution_text || loadedObs?.solution_text || (task as any).solution_text || '';
  const assignerEmpId = creatorEmpId || Number(task.assigned_by || obs?.created_by || loadedObs?.created_by);

  const isGenericBoilerplate = (text?: string | null): boolean => {
    if (!text) return true;
    const t = text.trim();
    return (
      t.startsWith('Task logged and marked Completed directly') ||
      t.startsWith('Corrective action completed directly') ||
      t.startsWith('Resolved and completed directly') ||
      t.startsWith('Corrective action executed and verified') ||
      t.startsWith('Safety observation logged and task assigned') ||
      t.startsWith('Task logged by') ||
      t === 'No remarks provided.'
    );
  };

  const getGenuineRemark = (...candidates: (string | null | undefined)[]): string | null => {
    for (const c of candidates) {
      if (c && !isGenericBoilerplate(c)) {
        return c.trim();
      }
    }
    return null;
  };

  const finalApprovalRemarks = getGenuineRemark(
    task.approval_remarks,
    correctiveActions && correctiveActions.length > 0 ? correctiveActions[correctiveActions.length - 1].approver_remarks : null,
    obs?.approval_remarks,
    obs?.solution_text,
    solutionText
  );
  const approverName = task.completer?.full_name ||
    (correctiveActions && correctiveActions.length > 0 ? correctiveActions[correctiveActions.length - 1].approver?.full_name : null) ||
    null;

  // Pool of all photos from task and obs
  // Pool of all photos from task and obs
  const rawPool: any[] = [
    ...(obs?.all_photos || []),
    ...(task.all_photos || []),
    ...(loadedObs?.all_photos || []),
    ...(obs?.photos || []),
    ...(loadedObs?.photos || []),
    ...(task.initial_photos || []),
    ...(task.photos || []),
    ...((task as any).photos || []),
  ];

  // Map by photo_url or url
  const uniquePoolMap = new Map<string, any>();
  rawPool.forEach((p: any) => {
    const url = typeof p === 'string' ? p : (p.photo_url || p.url);
    if (url && !uniquePoolMap.has(url)) {
      uniquePoolMap.set(url, {
        ...(typeof p === 'object' ? p : {}),
        photo_url: url,
        url: url,
        file_name: (typeof p === 'object' ? (p.file_name || p.name) : '') || 'Photo',
        photo_type: (typeof p === 'object' && p.photo_type) ? p.photo_type : 'INITIAL',
      });
    }
  });
  const allUniquePhotos = Array.from(uniquePoolMap.values());

  // BEFORE (Hazard / Problem) Photos:
  // Photos marked INITIAL or uploaded during observation logging
  const beforePhotos = allUniquePhotos.filter((p: any) => {
    if (p.photo_type === 'INITIAL') return true;
    if (p.photo_type === 'CORRECTIVE') return false;
    if (!isSelfAssigned && assigneeEmpId && Number(p.uploaded_by) === assigneeEmpId) return false;
    return true;
  });

  // AFTER (Solution / User Submission) Photos:
  const afterPhotosMap = new Map<string, any>();

  // 1. From corrective_actions records (user submissions)
  correctiveActions.forEach((ca: any) => {
    (ca.photos || []).forEach((p: any) => {
      const url = typeof p === 'string' ? p : (p.photo_url || p.url);
      if (url && !afterPhotosMap.has(url)) {
        afterPhotosMap.set(url, {
          photo_url: url,
          url: url,
          file_name: (typeof p === 'object' ? (p.file_name || p.name) : '') || 'Solution Proof Photo',
          attempt_number: ca.attempt_number,
        });
      }
    });
  });

  // 2. From allUniquePhotos where uploaded as CORRECTIVE
  allUniquePhotos.forEach((p: any) => {
    const url = p.photo_url || p.url;
    if (!url) return;
    const isCorrective = p.photo_type === 'CORRECTIVE';
    if (isCorrective) {
      if (!afterPhotosMap.has(url)) {
        afterPhotosMap.set(url, {
          photo_url: url,
          url: url,
          file_name: p.file_name || 'Solution Proof Photo',
          attempt_number: p.attempt_number,
        });
      }
    }
  });

  const afterPhotos = Array.from(afterPhotosMap.values());
  const observationPhotos = beforePhotos;

  const handleExportPDF = async () => {
    setIsExporting(true);
    showToast({
      type: 'info',
      title: 'Exporting PDF',
      message: 'Generating PDF report and downloading to your system...',
    });
    try {
      await exportTaskReportPDF({
        task,
        obs,
        problemText,
        solutionRemarks: latestAction?.action_description || solutionRemarks || 'Corrective action implemented and verified.',
        assignerName,
        assigneeName,
        deptName,
        areaName,
        priority,
        dueDate: task.due_date,
        completedDate: task.completed_at || (isCompleted ? new Date().toISOString() : null),
        beforePhotos,
        afterPhotos,
        correctiveActions,
        approvalRemarks: finalApprovalRemarks,
        approverName: approverName,
      });
      showToast({
        type: 'success',
        title: 'Download Complete',
        message: 'PDF report downloaded directly to your device.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Download Failed',
        message: err?.message || 'Could not generate PDF download.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Unified task submission handler (Partially Done vs Submit for Verification / Complete & Close)
  const handleUnifiedSubmit = async () => {
    if (!solutionRemarks.trim()) {
      showToast({
        type: 'warning',
        title: 'Remarks Required',
        message: 'Please provide remarks or details regarding the work performed.',
      });
      return;
    }
    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      const isOfficerOrAdmin = Boolean(
        isOfficer ||
        isAdmin ||
        (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY') ||
        (currentUser?.role && currentUser.role.toUpperCase() === 'HEALTH_SAFETY_OFFICER') ||
        (currentUser?.role && currentUser.role.toLowerCase() === 'admin') ||
        (currentUser?.username && currentUser.username.toLowerCase() === 'admin')
      );
      const isVerificationAction = resolutionStage === 'SUBMITTED_FOR_REVIEW';
      const shouldCompleteDirectly = isOfficerOrAdmin && isVerificationAction;

      await DataService.submitCorrectiveAction({
        task_id: task.observation_id || task.id,
        submitted_by: Number(currentUser.emp_id || currentUser.id),
        action_description: solutionRemarks.trim(),
        photos: photos.map((p) => ({ url: p.url, file_name: p.file_name })),
        stage: shouldCompleteDirectly ? 'COMPLETED' : (isVerificationAction ? 'SUBMITTED_FOR_REVIEW' : 'PARTIALLY_DONE'),
        markAsCompleted: shouldCompleteDirectly,
      });

      if (shouldCompleteDirectly) {
        showToast({
          type: 'success',
          title: 'Task Completed',
          message: `${task.task_number} has been completed and closed.`,
        });
      } else if (isVerificationAction) {
        showToast({
          type: 'success',
          title: 'Submitted for Verification',
          message: `${task.task_number} has been submitted for Safety Officer / Admin verification.`,
        });
      } else {
        showToast({
          type: 'success',
          title: 'Update Saved as Active',
          message: `${task.task_number} progress update saved. Task remains active for subsequent updates.`,
        });
      }

      setSolutionRemarks('');
      setPhotos([]);
      onTaskUpdated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Unable to update task.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin / Officer review: Verify & Approve (Complete Task)
  const handleAdminApprove = async () => {
    if (!currentUser) return;
    if (!approvalRemarks.trim()) {
      showToast({
        type: 'warning',
        title: 'Remarks Required',
        message: 'Please enter verification remarks before approving the task.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.reviewTask({
        task_id: task.observation_id || task.id,
        officer_id: currentUser.emp_id || currentUser.id,
        decision: 'COMPLETE',
        approval_remarks: approvalRemarks.trim(),
      });

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
        title: 'Task Verified & Completed',
        message: `${task.task_number} has been verified with your remarks and marked as COMPLETED.`,
      });
      setApprovalRemarks('');
      onTaskUpdated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Unable to approve task.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin / Officer review: Send For Rework
  const handleAdminRework = async () => {
    if (!currentUser) return;
    const reason = (officerNotes || solutionRemarks).trim();
    if (!reason) {
      showToast({
        type: 'warning',
        title: 'Reason Required',
        message: 'Please enter rework reason before sending for rework.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.reviewTask({
        task_id: task.observation_id || task.id,
        officer_id: currentUser.emp_id || currentUser.id,
        decision: 'REWORK',
        rework_reason: reason,
      });

      showToast({
        type: 'warning',
        title: 'Rework Requested',
        message: `${task.task_number} sent back for rework.`,
      });
      setOfficerNotes('');
      setShowReworkBox(false);
      onTaskUpdated();
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
      title={task.task_number}
      size={isCompleted ? 'xl' : 'lg'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Metadata Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <StatusBadge status={task.status} />
            {priority && <PriorityBadge priority={priority} />}
            {deptName && (
              <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
                <Building2 size={11} />
                {deptName}
              </span>
            )}
            {areaName && (
              <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
                <MapPin size={11} />
                {areaName}
              </span>
            )}
            {task.due_date && (
              <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
                <Calendar size={11} />
                Due: {formatISTDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* CASE 1: COMPLETED TASK (BEFORE & AFTER SIDE-BY-SIDE VIEW)      */}
        {/* ============================================================== */}
        {isCompleted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Completion Header Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} color="#16a34a" />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#15803d' }}>
                    Task Completed & Verified
                  </div>

                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleExportPDF}
                disabled={isExporting}
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  opacity: isExporting ? 0.7 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <Download size={14} />
                <span>{isExporting ? 'Downloading...' : 'Export Report PDF'}</span>
              </button>
            </div>

            {/* Side-by-Side 2 Column Comparison Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '14px',
                alignItems: 'stretch',
              }}
            >
              {/* LEFT SIDE: BEFORE (Hazard Observation) */}
              <div
                style={{
                  border: '1.5px solid #fecdd3',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    background: '#fff1f2',
                    padding: '10px 14px',
                    borderBottom: '1.5px solid #fecdd3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        background: '#e11d48',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      BEFORE
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#881337' }}>
                      Initial Safety Hazard
                    </span>
                  </div>
                  {obs?.created_at && (
                    <span style={{ fontSize: '0.72rem', color: '#9f1239' }}>
                      {formatISTDate(obs.created_at)}
                    </span>
                  )}
                </div>

                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Problem Statement (Observation)
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {problemText || 'No problem statement recorded.'}
                    </div>
                  </div>

                  {solutionText && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Proposed Solution
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                        {solutionText}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Hazard Photos ({beforePhotos.length})
                    </div>
                    {beforePhotos.length > 0 ? (
                      <PhotoGallery
                        photos={beforePhotos.map((p: any) => ({
                          photo_url: p.photo_url || p.url || '',
                          file_name: p.file_name || 'Before Photo',
                        }))}
                      />
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No photos attached
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {deptName && <span>Dept: <strong style={{ color: 'var(--text-primary)' }}>{deptName}</strong></span>}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: AFTER (User Submission) */}
              <div
                style={{
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    background: '#ecfdf5',
                    padding: '10px 14px',
                    borderBottom: '1.5px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        background: '#10b981',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      AFTER
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#065f46' }}>
                      Corrective Action Proof
                    </span>
                  </div>
                  {(task.completed_at || latestAction?.submitted_at) && (
                    <span style={{ fontSize: '0.72rem', color: '#047857' }}>
                      {formatISTDate(task.completed_at || latestAction?.submitted_at)}
                    </span>
                  )}
                </div>

                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {correctiveActions.length > 0 ? (
                    correctiveActions.map((ca: any, idx: number) => {
                      const attemptPhotos = (ca.photos && ca.photos.length > 0)
                        ? ca.photos.map((p: any) => ({
                          photo_url: p.photo_url || p.url || '',
                          file_name: p.file_name || 'Evidence Photo',
                        }))
                        : [];
                      const isLatest = idx === correctiveActions.length - 1;

                      const approverRemark = getGenuineRemark(
                        ca.approver_remarks,
                        isLatest ? finalApprovalRemarks : null,
                        obs?.solution_text
                      );
                      const rawUserRemark = (ca.action_description || '').trim();
                      const hasDistinctUserRemark = Boolean(
                        rawUserRemark &&
                        !isGenericBoilerplate(rawUserRemark) &&
                        rawUserRemark !== (approverRemark || '').trim()
                      );

                      return (
                        <div
                          key={ca.id || idx}
                          style={{
                            background: isLatest ? '#f0fdf4' : '#f8fafc',
                            border: isLatest ? '1.5px solid #86efac' : '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '6px',
                              borderBottom: '1px solid var(--border-subtle)',
                              paddingBottom: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isLatest ? '#15803d' : 'var(--text-primary)' }}>
                                Attempt #{ca.attempt_number || idx + 1}
                              </span>
                              {isLatest && (
                                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #bbf7d0' }}>
                                  Final Approved
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {formatISTDateTime(ca.submitted_at)}
                            </span>
                          </div>

                          {/* Remarks - Only shown if distinct user remarks exist */}
                          {hasDistinctUserRemark && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                User Remarks:
                              </span>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                                {rawUserRemark}
                              </div>
                            </div>
                          )}

                          {/* Photos submitted together with this attempt */}
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                              Submitted Photos ({attemptPhotos.length}):
                            </span>
                            {attemptPhotos.length > 0 ? (
                              <PhotoGallery photos={attemptPhotos} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No photos submitted with this attempt
                              </span>
                            )}
                          </div>

                          {/* Rework Reason if rejected in this attempt */}
                          {ca.rework_reason && (
                            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '8px 10px', marginTop: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase' }}>
                                  Officer Feedback / Rework Reason:
                                </span>
                                {ca.reworked_at && (
                                  <span style={{ fontSize: '0.68rem', color: '#9f1239' }}>
                                    {formatISTDateTime(ca.reworked_at)}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: '0.825rem', color: '#881337', margin: 0, fontWeight: 500 }}>
                                "{ca.rework_reason}"
                              </p>
                            </div>
                          )}

                          {/* Safety Officer Verification Remarks - Shown ONCE */}
                          {(approverRemark || isLatest) && (
                            <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '6px', padding: '10px 12px', marginTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Safety Officer Verification Remarks:
                                </span>
                                {(ca.approved_at || task.completed_at) && (
                                  <span style={{ fontSize: '0.68rem', color: '#065f46' }}>
                                    {formatISTDateTime(ca.approved_at || task.completed_at)}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: '0.85rem', color: '#065f46', margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                                "{approverRemark || 'Work inspected on site and verified completed.'}"
                              </p>
                              {(ca.approver?.full_name || approverName) && (
                                <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '4px' }}>
                                  Verified by: <strong>{ca.approver?.full_name || approverName}</strong>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div>
                      {(() => {
                        const approverRemark = getGenuineRemark(finalApprovalRemarks, obs?.solution_text);
                        const rawUserRemark = (latestAction?.action_description || solutionRemarks || '').trim();
                        const hasDistinctUserRemark = Boolean(
                          rawUserRemark &&
                          !isGenericBoilerplate(rawUserRemark) &&
                          rawUserRemark !== (approverRemark || '').trim()
                        );

                        return (
                          <>
                            {hasDistinctUserRemark && (
                              <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                  User Submission (Remarks)
                                </div>
                                <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                                  {rawUserRemark}
                                </div>
                              </div>
                            )}

                            <div style={{ marginTop: hasDistinctUserRemark ? '10px' : '0px' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Evidence Photos ({afterPhotos.length})
                              </div>
                              {afterPhotos.length > 0 ? (
                                <PhotoGallery
                                  photos={afterPhotos.map((p: any) => ({
                                    photo_url: p.photo_url || p.url || '',
                                    file_name: p.file_name || 'After Photo',
                                  }))}
                                />
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No photos attached
                                </span>
                              )}
                            </div>

                            <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '6px', padding: '10px 12px', marginTop: '10px' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>
                                Safety Officer Verification Remarks:
                              </div>
                              <p style={{ fontSize: '0.85rem', color: '#065f46', margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                                "{approverRemark || 'Work inspected on site and verified completed.'}"
                              </p>
                              {approverName && (
                                <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '4px' }}>
                                  Verified by: <strong>{approverName}</strong>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Resolved By: <strong style={{ color: 'var(--text-primary)' }}>{assigneeName || 'Assigned User'}</strong></span>
                    <span style={{ color: '#059669', fontWeight: 600 }}>
                      {approverName ? `Verified by ${approverName}` : 'Verified & Approved'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CASE 2: ACTIVE TASK (PROBLEM STATEMENT, REWORK ALERT, FORM & REVIEW) */
          <>
            {/* Rework Reason Alert (if returned for rework) */}
            {isRework && reworkReason && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: '#e11d48' }}>
                  Rework Reason
                </label>
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={15} color="#e11d48" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.85rem', color: '#881337', fontWeight: 600 }}>
                    {reworkReason}
                  </div>
                </div>
              </div>
            )}

            {/* Problem Statement */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                  Problem Statement
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  {assignerName && (
                    <span>
                      Assigner: <strong style={{ color: 'var(--text-primary)' }}>{assignerName}</strong>
                    </span>
                  )}
                  {assigneeName && (
                    <>
                      <span>•</span>
                      <span>
                        Assignee: <strong style={{ color: 'var(--text-primary)' }}>{assigneeName}</strong>
                      </span>
                    </>
                  )}
                  {deptName && (
                    <>
                      <span>•</span>
                      <span>
                        Dept: <strong style={{ color: 'var(--text-primary)' }}>{deptName}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                  {problemText}
                </p>
              </div>
            </div>

            {/* Solution Statement */}
            {solutionText && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                  Solution Statement
                </label>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {solutionText}
                  </p>
                </div>
              </div>
            )}

            {/* Observation Photos */}
            {observationPhotos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                  Observation Photos
                </label>
                <PhotoGallery photos={observationPhotos} />
              </div>
            )}

            {/* Submission Tracking (All attempts and intermediate updates with remarks, photos, and status) */}
            {correctiveActions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                  Submission & Update Tracking ({correctiveActions.length} {correctiveActions.length === 1 ? 'Record' : 'Records'})
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {correctiveActions.map((ca: any, idx: number) => {
                    const isPartial = ca.status === 'IN_PROGRESS';
                    const isSubmitted = ca.status === 'SUBMITTED';
                    const isApproved = ca.status === 'APPROVED';
                    const isRework = ca.status === 'REWORK_REQUIRED';

                    return (
                      <div
                        key={ca.id || idx}
                        style={{
                          background: isApproved ? '#f0fdf4' : isPartial ? '#fffdf5' : '#f8fafc',
                          border: isApproved ? '1.5px solid #86efac' : isPartial ? '1px solid #fde68a' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                              Update #{ca.attempt_number || idx + 1}
                            </span>
                            {isPartial && (
                              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #fde68a' }}>
                                Active Progress Update
                              </span>
                            )}
                            {isSubmitted && (
                              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #bae6fd' }}>
                                Submitted for Verification
                              </span>
                            )}
                            {isRework && (
                              <span className="badge" style={{ background: '#ffe4e6', color: '#be123c', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #fecdd3' }}>
                                Rework Required
                              </span>
                            )}
                            {isApproved && (
                              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #bbf7d0' }}>
                                Verified & Approved
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {formatISTDateTime(ca.submitted_at)}
                          </span>
                        </div>

                        {ca.submitter?.full_name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Updated by: <strong style={{ color: 'var(--text-primary)' }}>{ca.submitter.full_name}</strong>
                          </div>
                        )}

                        {ca.action_description && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Remarks:</span>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>
                              {ca.action_description}
                            </p>
                          </div>
                        )}

                        {ca.photos && ca.photos.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              Attached Photos ({ca.photos.length}):
                            </span>
                            <PhotoGallery photos={ca.photos} />
                          </div>
                        )}

                        {ca.rework_reason && (
                          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '4px', padding: '8px 10px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase' }}>
                                Rework Feedback:
                              </span>
                              {ca.reworked_at && (
                                <span style={{ fontSize: '0.68rem', color: '#9f1239' }}>
                                  {formatISTDateTime(ca.reworked_at)}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.825rem', color: '#881337', margin: 0, fontWeight: 500 }}>
                              "{ca.rework_reason}"
                            </p>
                          </div>
                        )}

                        {ca.approver_remarks && (
                          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '8px 10px', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                              Safety Officer Remarks:
                            </span>
                            <p style={{ fontSize: '0.85rem', color: '#065f46', margin: '2px 0 0 0', fontWeight: 600 }}>
                              "{ca.approver_remarks}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1. EMPLOYEE VIEW: TASK IS PENDING VERIFICATION */}
            {isPendingVerification && !isAdmin && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  background: '#fffbeb',
                  borderRadius: '10px',
                  border: '1px solid #fde68a',
                  marginTop: '10px',
                }}
              >
                <Clock size={22} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#92400e', marginBottom: '4px' }}>
                    Pending Safety Officer / Admin Verification
                  </div>
                  <p style={{ fontSize: '0.84rem', color: '#b45309', margin: 0, lineHeight: 1.5 }}>
                    Your corrective action has been submitted and is currently in the review queue. A designated Safety Officer or Administrator will inspect the evidence and verify completion before closing this task.
                  </p>
                </div>
              </div>
            )}

            {/* 2. OFFICER / ADMIN VIEW: TASK IS PENDING VERIFICATION */}
            {isPendingVerification && isAdmin && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                  borderRadius: '10px',
                  border: '1px solid #bfdbfe',
                  marginTop: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="var(--brand-primary)" />
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Safety Officer / Admin Verification
                    </span>
                  </div>
                  <span className="badge badge-warning" style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                    Verification Pending
                  </span>
                </div>

                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  The assignee has completed corrective work and submitted proof for verification.
                </p>

                {showApproveBox ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1.5px solid #86efac' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem', margin: 0, color: '#15803d' }}>
                      Approver Verification Remarks <span className="required">*</span>
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Enter remarks for approval (e.g. Work inspected on site, rectification completed to safety standards)..."
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      style={{ width: '100%', resize: 'vertical' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowApproveBox(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={handleAdminApprove}
                        disabled={isSubmitting || !approvalRemarks.trim()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 18px', fontWeight: 700 }}
                      >
                        <CheckCircle2 size={16} />
                        <span>{isSubmitting ? 'Verifying...' : 'Confirm Verify & Approve'}</span>
                      </button>
                    </div>
                  </div>
                ) : showReworkBox ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff1f2', padding: '14px', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem', margin: 0, color: '#9f1239' }}>
                      Reason for Requesting Rework <span className="required">*</span>
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Specify what needs to be improved or re-done..."
                      value={officerNotes}
                      onChange={(e) => setOfficerNotes(e.target.value)}
                      style={{ width: '100%', resize: 'vertical' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowReworkBox(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={handleAdminRework}
                        disabled={isSubmitting || !officerNotes.trim()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 18px', fontWeight: 700 }}
                      >
                        <RotateCcw size={15} />
                        <span>{isSubmitting ? 'Sending...' : 'Confirm Send for Rework'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setShowReworkBox(true);
                        setShowApproveBox(false);
                      }}
                      disabled={isSubmitting}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={15} />
                      <span>Request Rework</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => {
                        setShowApproveBox(true);
                        setShowReworkBox(false);
                      }}
                      disabled={isSubmitting}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', fontWeight: 700 }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Verify & Approve (Mark Completed)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. AWAITING ASSIGNEE SUBMISSION (Viewed by Admin / Assigner when user hasn't submitted yet) */}
            {!isPendingVerification && !isCompleted && !canSubmitAction && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '16px',
                  background: 'rgba(2, 132, 199, 0.04)',
                  borderRadius: '10px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  marginTop: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={18} color="var(--brand-primary)" />
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {isRework ? 'Rework In Progress — Awaiting Assignee Response' : 'Awaiting Assignee Action & Response'}
                    </span>
                  </div>
                  <span className="badge badge-assigned" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                    Assigned to: {assigneeName || `Emp #${task.assigned_to}`}
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {isRework
                    ? `This task was sent back for rework. Waiting for ${assigneeName || 'the assigned employee'} to revise and resubmit their corrective action.`
                    : `This observation task is currently assigned to ${assigneeName || 'the assigned employee'}. Corrective action and closure are awaiting the user's response submission.`}
                </p>
              </div>
            )}

            {/* 4. ACTIVE TASK SUBMISSION SECTION (Only for the Assignee / Participant) */}
            {!isPendingVerification && canAct && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  marginTop: '10px',
                }}
              >
                {/* Stage Selection */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', margin: 0, color: 'var(--text-primary)' }}>
                      Action / Update Type <span className="required">*</span>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* Option 1: Partially Done (Save as Active) */}
                    <button
                      type="button"
                      onClick={() => setResolutionStage('PARTIALLY_DONE')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: resolutionStage === 'PARTIALLY_DONE' ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                        background: resolutionStage === 'PARTIALLY_DONE' ? '#fffbeb' : '#ffffff',
                        color: resolutionStage === 'PARTIALLY_DONE' ? '#b45309' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Clock size={16} color={resolutionStage === 'PARTIALLY_DONE' ? '#d97706' : '#64748b'} />
                      <span>Partially Done (Save as Active)</span>
                    </button>

                    {/* Option 2: Submit for Verification / Mark Completed */}
                    <button
                      type="button"
                      onClick={() => setResolutionStage('SUBMITTED_FOR_REVIEW')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: resolutionStage === 'SUBMITTED_FOR_REVIEW' ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        background: resolutionStage === 'SUBMITTED_FOR_REVIEW' ? 'rgba(2, 132, 199, 0.08)' : '#ffffff',
                        color: resolutionStage === 'SUBMITTED_FOR_REVIEW' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ShieldCheck size={16} color={resolutionStage === 'SUBMITTED_FOR_REVIEW' ? 'var(--brand-primary)' : '#64748b'} />
                      <span>{isOfficerOrAdmin ? 'Mark Completed & Close' : 'Submit for Verification'}</span>
                    </button>
                  </div>

                  <span className="form-hint" style={{ fontSize: '0.74rem', marginTop: '6px', display: 'block' }}>
                    {resolutionStage === 'PARTIALLY_DONE'
                      ? 'Task will remain active (In Progress). Your intermediate update remarks and photos will be recorded in the audit history.'
                      : (isOfficerOrAdmin
                        ? 'Task will be marked Completed and closed directly with your final resolution remarks.'
                        : 'Task will be submitted to Safety Officer / Admin for review and verification.')}
                  </span>
                </div>

                {/* Solution / Remarks Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                    {resolutionStage === 'PARTIALLY_DONE' ? 'Progress Remarks & Work Done' : 'Corrective Action & Solution Details'} <span className="required">*</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder={
                      resolutionStage === 'PARTIALLY_DONE'
                        ? 'Describe what has been completed so far, current stage, and next steps...'
                        : 'Describe the finalized corrective engineering, repairs or safety resolution applied...'
                    }
                    value={solutionRemarks}
                    onChange={(e) => setSolutionRemarks(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                {/* Evidence Photos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                    Evidence Photos (Optional)
                  </label>
                  <PhotoUploader
                    photos={photos}
                    onChange={setPhotos}
                    maxPhotos={6}
                    compact
                  />
                </div>

                {/* SUBMISSION BUTTON */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    className={`btn ${resolutionStage === 'SUBMITTED_FOR_REVIEW' ? 'btn-primary' : 'btn-warning'}`}
                    onClick={handleUnifiedSubmit}
                    disabled={isSubmitting || !solutionRemarks.trim()}
                    style={{ padding: '9px 24px', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    {resolutionStage === 'SUBMITTED_FOR_REVIEW' ? (
                      <ShieldCheck size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                    <span>
                      {isSubmitting
                        ? 'Submitting...'
                        : (resolutionStage === 'SUBMITTED_FOR_REVIEW'
                          ? (isOfficerOrAdmin ? 'Submit & Mark Completed' : 'Submit for Verification')
                          : 'Save Update as Active')}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Fallback view if no corrective actions array but single legacy action exists */}
            {!canSubmitAction && !isOfficer && correctiveActions.length === 0 && latestAction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                    Submitted Solution Remarks
                  </label>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                      {latestAction.action_description}
                    </p>
                  </div>
                </div>

                {latestAction.photos && latestAction.photos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                      Evidence Photos
                    </label>
                    <PhotoGallery photos={latestAction.photos} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
