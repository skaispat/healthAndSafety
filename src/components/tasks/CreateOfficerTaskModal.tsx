import React, { useState, useEffect } from 'react';
import { Department, PriorityLevel, PRIORITY_RISK_MAP } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import {
  Building2,
  AlertTriangle,
  FileText,
  Clock,
  Camera,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatISTDateTime } from '../../utils/dateUtils';

interface CreateOfficerTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

const ModalStepHeader: React.FC<{ step: number; title: string; subtitle?: string; icon: React.ReactNode }> = ({
  step,
  title,
  subtitle,
  icon,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '12px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border-subtle)',
    }}
  >
    <div
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        background: 'rgba(2, 132, 199, 0.1)',
        color: 'var(--brand-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '0.8rem',
        flexShrink: 0,
      }}
    >
      {step}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: 'var(--brand-primary)' }}>{icon}</span>
        <h4 style={{ fontSize: '0.925rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {title}
        </h4>
      </div>
      {subtitle && (
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '1px 0 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

export const CreateOfficerTaskModal: React.FC<CreateOfficerTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { currentUser, isOfficer } = useAuth();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);

  // Form states
  const [departmentId, setDepartmentId] = useState('');
  const [area, setArea] = useState('');
  const [observationText, setObservationText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [correctionRemark, setCorrectionRemark] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [beforePhotos, setBeforePhotos] = useState<UploadedPhoto[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentEmpId = Number(currentUser?.emp_id || currentUser?.id || 101);

  useEffect(() => {
    if (isOpen) {
      DataService.getDepartments().then((depts) => {
        const activeDepts = depts.filter((d) => d.is_active !== false);
        setDepartments(activeDepts);
        if (activeDepts.length > 0 && !departmentId) {
          setDepartmentId(String(activeDepts[0].dept_id || activeDepts[0].id));
        }
      });
    }
  }, [isOpen]);

  const riskInfo = PRIORITY_RISK_MAP[priority];

  const handleSave = async (targetStatus: 'IN_PROGRESS' | 'COMPLETED') => {
    if (!currentUser) return;

    if (!departmentId || !area.trim() || !observationText.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Required Fields',
        message: 'Please complete Department, Specific Area, and Hazard Observation.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const internalDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const isSubmittingNow = targetStatus === 'COMPLETED';
      const correctiveStatement = (correctionRemark || solutionText).trim();

      await DataService.createObservationWithTask({
        department_id: Number(departmentId),
        area: area.trim(),
        observation_text: observationText.trim(),
        solution_text: solutionText.trim(),
        corrective_action: correctiveStatement || undefined,
        assigned_to: currentEmpId, // Internal assignment to self / officer
        due_date: internalDueDate,
        priority,
        before_photo_urls: beforePhotos.map((p) => ({ url: p.url, file_name: p.file_name })),
        after_photo_urls: afterPhotos.map((p) => ({ url: p.url, file_name: p.file_name })),
        officer_id: currentEmpId,
        initialStatus: targetStatus,
      });

      showToast({
        type: 'success',
        title: isSubmittingNow ? 'Task Completed' : 'Task Saved as Active',
        message: isSubmittingNow
          ? 'Task submitted and marked as Completed directly.'
          : 'Task saved as Active. You can update or complete it anytime.',
      });

      // Reset fields
      setArea('');
      setObservationText('');
      setSolutionText('');
      setCorrectionRemark('');
      setBeforePhotos([]);
      setAfterPhotos([]);
      onTaskCreated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Unable to create task.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave('COMPLETED');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOfficer ? "Add Officer Task" : "Add Task"}
      subtitle={`Logged on ${formatISTDateTime(new Date())}`}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* STEP 1: LOCATION */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
            <ModalStepHeader
              step={1}
              title="Department & Plant Location"
              icon={<Building2 size={16} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">
                  Department <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                >
                  {departments.map((d) => (
                    <option key={d.dept_id || d.id} value={d.dept_id || d.id}>
                      {d.dept_name || d.name} {d.code ? `(${d.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Specific Area / Location <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Compressor Bay 4, Warehouse Aisle 3"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* STEP 2: RISK ASSESSMENT */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
            <ModalStepHeader
              step={2}
              title="Risk Assessment & Priority"
              icon={<AlertTriangle size={16} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', alignItems: 'center' }}>
              <div className="form-group">
                <label className="form-label">
                  Priority Rating <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  required
                >
                  <option value="LOW">LOW — Minor hazard or housekeeping</option>
                  <option value="MEDIUM">MEDIUM — Moderate risk requiring timely repair</option>
                  <option value="HIGH">HIGH — Critical hazard or imminent danger</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} color="var(--brand-primary)" />
                  <span>Calculated Risk Metric</span>
                </label>
                <div className={`risk-display-box risk-${priority.toLowerCase()}`} style={{ height: 'auto', padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>FACTOR RANGE</div>
                  </div>
                  <div className="risk-percentage-val" style={{ color: priority === 'HIGH' ? '#ef4444' : priority === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                    {riskInfo.label}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: HAZARD OBSERVATION & SOLUTION DIRECTIVE */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
            <ModalStepHeader
              step={3}
              title="Safety Hazard Observation"
              icon={<FileText size={16} />}
            />
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">
                Observation Topic <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Broken handrail on staircase, oil leakage near motor"
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Description of Observation / Recommended Action
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Specify recommended corrective engineering or containment action..."
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
              />
            </div>
          </div>

          {/* STEP 4: BEFORE PHOTOS (INITIAL HAZARD CONDITION) */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
            <ModalStepHeader
              step={4}
              title="1. Before Image (Initial Hazard Condition)"
              subtitle="Visual proof of hazard condition before work order starts"
              icon={<Camera size={16} />}
            />
            <PhotoUploader photos={beforePhotos} onChange={setBeforePhotos} maxPhotos={10} />
          </div>

          {/* STEP 5: AFTER CORRECTION PHOTOS & REMARKS */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
            <ModalStepHeader
              step={5}
              title="2. After Correction Image (Work Done / Corrective Evidence)"
              subtitle="Attach visual proof and statement of corrective work done"
              icon={<Sparkles size={16} color="#10b981" />}
            />
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Correction Remark / Action Taken (Optional for Active, included on Submit)
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Detail the exact repair, containment, or corrective actions taken..."
                value={correctionRemark}
                onChange={(e) => setCorrectionRemark(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                After Correction Photos
              </label>
              <PhotoUploader photos={afterPhotos} onChange={setAfterPhotos} maxPhotos={10} />
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isSubmitting}
              onClick={() => handleSave('IN_PROGRESS')}
              style={{
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#0284c7',
                borderColor: '#0284c7',
                background: 'rgba(2, 132, 199, 0.04)',
              }}
            >
              <Clock size={16} />
              <span>{isSubmitting ? 'Saving...' : 'Save as Active'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={() => handleSave('COMPLETED')}
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={16} />
              <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
