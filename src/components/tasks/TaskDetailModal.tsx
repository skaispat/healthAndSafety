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
  Download
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
  const [resolutionStage, setResolutionStage] = useState<'PARTIALLY_DONE' | 'COMPLETED'>('COMPLETED');

  // States for admin / officer review
  const [officerNotes, setOfficerNotes] = useState('');
  const [showReworkBox, setShowReworkBox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fallback observation loading if task.observation is missing
  const [loadedObs, setLoadedObs] = useState<Observation | null>(task?.observation || null);

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

  if (!task) return null;

  const obs = task.observation || loadedObs || (task as any);
  const currentEmpId = Number(currentUser?.emp_id || currentUser?.id);
  const isAssignee = currentEmpId === Number(task.assigned_to);
  const isParticipant = task.participants?.some((p) => Number(p.user_id) === currentEmpId);
  const canSubmitAction = (isAssignee || isParticipant) && task.status !== 'COMPLETED';
  const isRework = task.status === 'REWORK_REQUIRED';
  const reworkReason = task.rework_reason || obs?.rework_reason;

  const isAdmin = Boolean(
    isOfficer ||
    (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY') ||
    Number(task.assigned_by) === currentEmpId ||
    Number(obs?.created_by) === currentEmpId
  );

  const isSelfAssigned = isAssignee && (isAdmin || Number(task.assigned_by) === currentEmpId);
  const canAct = (canSubmitAction || isAdmin) && task.status !== 'COMPLETED' && task.status !== 'CLOSED';

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
  const assignerEmpId = Number(task.assigned_by || obs?.created_by || loadedObs?.created_by);
  const assigneeEmpId = Number(task.assigned_to || obs?.assigned_to || loadedObs?.assigned_to);

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
  const isCompleted = task.status === 'COMPLETED' || obs?.status === 'COMPLETED';

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

  // Unified task submission handler (Partially Done vs Complete & Close Task)
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
      const isCompleteAction = resolutionStage === 'COMPLETED';

      await DataService.submitCorrectiveAction({
        task_id: task.observation_id || task.id,
        submitted_by: Number(currentUser.emp_id || currentUser.id),
        action_description: solutionRemarks.trim(),
        photos: photos.map((p) => ({ url: p.url, file_name: p.file_name })),
        stage: isCompleteAction ? 'COMPLETED' : 'PARTIALLY_DONE',
        markAsCompleted: isCompleteAction,
      });

      if (isCompleteAction) {
        try {
          await DataService.reviewTask({
            task_id: task.observation_id || task.id,
            officer_id: currentUser.emp_id || currentUser.id,
            decision: 'COMPLETE',
          });
        } catch (e) {
          // already completed by submitCorrectiveAction
        }

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
          title: 'Task Completed & Closed',
          message: `${task.task_number} has been marked as COMPLETED.`,
        });
      } else {
        showToast({
          type: 'success',
          title: 'Task Saved as Partially Done',
          message: `${task.task_number} has been updated and remains active (In Progress).`,
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
                    <span>Logged By: <strong style={{ color: 'var(--text-primary)' }}>{assignerName || 'Safety Officer'}</strong></span>
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

                          {/* Remarks */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              User Remarks:
                            </span>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                              {ca.action_description || 'No remarks provided.'}
                            </div>
                          </div>

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
                        </div>
                      );
                    })
                  ) : (
                    <div>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          User Submission (Remarks)
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                          {latestAction?.action_description || solutionRemarks || 'Corrective action executed and verified by safety team.'}
                        </div>
                      </div>

                      <div style={{ marginTop: '10px' }}>
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
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Resolved By: <strong style={{ color: 'var(--text-primary)' }}>{assigneeName || 'Assigned User'}</strong></span>
                    <span style={{ color: '#059669', fontWeight: 600 }}>Verified & Approved</span>
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

            {/* Submission Tracking (All attempts with remarks, photos, and rework reasons) */}
            {correctiveActions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                  Submission Tracking ({correctiveActions.length} {correctiveActions.length === 1 ? 'Submission' : 'Submissions'})
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {correctiveActions.map((ca: any, idx: number) => (
                    <div
                      key={ca.id || idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          Attempt #{ca.attempt_number || idx + 1}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {formatISTDateTime(ca.submitted_at)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Remarks:</span>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>
                          {ca.action_description}
                        </p>
                      </div>

                      {ca.photos && ca.photos.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Evidence Photos:</span>
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UNIFIED SUBMISSION SECTION: 1 clean form, choice of Partially Done / Complete, 1 action button */}
            {canAct && (
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
                      Task Resolution Stage <span className="required">*</span>
                    </label>

                    {isAdmin && !isAssignee && task.status === 'SUBMITTED_FOR_REVIEW' && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setShowReworkBox(!showReworkBox)}
                        style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 600, padding: '2px 8px' }}
                      >
                        <RotateCcw size={13} style={{ marginRight: '4px' }} />
                        {showReworkBox ? 'Back to Approval' : 'Need Rework?'}
                      </button>
                    )}
                  </div>

                  {showReworkBox ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff1f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: '#9f1239' }}>
                        Resubmit Reason / Feedback <span className="required">*</span>
                      </label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Specify reason for rework..."
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
                          style={{ padding: '6px 18px' }}
                        >
                          {isSubmitting ? 'Sending...' : 'Confirm Resubmit'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                          }}
                        >
                          <Clock size={16} color={resolutionStage === 'PARTIALLY_DONE' ? '#d97706' : '#64748b'} />
                          <span>Partially Done</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setResolutionStage('COMPLETED')}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: resolutionStage === 'COMPLETED' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                            background: resolutionStage === 'COMPLETED' ? '#ecfdf5' : '#ffffff',
                            color: resolutionStage === 'COMPLETED' ? '#047857' : 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <CheckCircle2 size={16} color={resolutionStage === 'COMPLETED' ? '#10b981' : '#64748b'} />
                          <span>Complete & Close Task</span>
                        </button>
                      </div>

                      <span className="form-hint" style={{ fontSize: '0.74rem', marginTop: '6px', display: 'block' }}>
                        {resolutionStage === 'PARTIALLY_DONE'
                          ? 'Task will remain active (In Progress) with your updated progress remarks.'
                          : 'Task will be marked as fully completed and closed.'}
                      </span>
                    </>
                  )}
                </div>

                {!showReworkBox && (
                  <>
                    {/* Solution / Remarks Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                        {resolutionStage === 'PARTIALLY_DONE' ? 'Progress Remarks & Work Done' : 'Corrective Solution Remarks'} <span className="required">*</span>
                      </label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder={
                          resolutionStage === 'PARTIALLY_DONE'
                            ? 'Describe what has been completed so far, current stage, and next steps...'
                            : 'Describe the finalized corrective engineering or permanent solution applied...'
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

                    {/* SINGLE SUBMISSION BUTTON */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        className={`btn ${resolutionStage === 'COMPLETED' ? 'btn-success' : 'btn-primary'}`}
                        onClick={handleUnifiedSubmit}
                        disabled={isSubmitting || !solutionRemarks.trim()}
                        style={{ padding: '9px 24px', fontWeight: 700, fontSize: '0.85rem' }}
                      >
                        {resolutionStage === 'COMPLETED' ? <CheckCircle2 size={16} /> : <Send size={16} />}
                        <span>
                          {isSubmitting
                            ? 'Submitting...'
                            : (resolutionStage === 'COMPLETED' ? 'Complete & Close Task' : 'Save as Partially Done')}
                        </span>
                      </button>
                    </div>
                  </>
                )}
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
