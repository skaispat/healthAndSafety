import React, { useState, useEffect } from 'react';
import { Department, User, PriorityLevel, PRIORITY_RISK_MAP } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import {
  Building2,
  MapPin,
  AlertTriangle,
  FileText,
  Clock,
  User as UserIcon,
  Camera,
  Send,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { formatISTDateTime } from '../../utils/dateUtils';

interface CreateObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
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

export const CreateObservationModal: React.FC<CreateObservationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  // Form states
  const [departmentId, setDepartmentId] = useState('');
  const [area, setArea] = useState('');
  const [observationText, setObservationText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      DataService.getDepartments().then((depts) => {
        const activeDepts = depts.filter((d) => d.is_active !== false);
        setDepartments(activeDepts);
        if (activeDepts.length > 0 && !departmentId) {
          setDepartmentId(String(activeDepts[0].dept_id));
        }
      });
      DataService.getUsers().then((users) => {
        const active = users.filter((u) => u.status === 'active' || u.is_active);
        setEmployees(active);
      });

      const defaultDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      setDueDate(defaultDue.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  // Filter employees belonging to the selected department
  const filteredEmployees = employees.filter((emp) => {
    if (!departmentId) return false;
    const deptNum = Number(departmentId);

    // 1. Check direct dept_id
    if (emp.dept_id !== undefined && emp.dept_id !== null && Number(emp.dept_id) === deptNum) {
      return true;
    }
    if (emp.department_id && Number(emp.department_id) === deptNum) {
      return true;
    }
    if (typeof emp.department === 'object' && emp.department?.dept_id && Number(emp.department.dept_id) === deptNum) {
      return true;
    }

    // 2. Department name match fallback
    const selectedDept = departments.find(d => Number(d.dept_id) === deptNum || String(d.dept_id) === departmentId);
    const selectedDeptName = (selectedDept?.dept_name || selectedDept?.name || '').trim().toUpperCase();
    const empDeptName = (typeof emp.department === 'string' ? emp.department : emp.department?.name || emp.department_name || '').trim().toUpperCase();
    if (selectedDeptName && empDeptName && selectedDeptName === empDeptName) {
      return true;
    }

    return false;
  });

  // Automatically update assignedTo when department or filtered employees change
  useEffect(() => {
    if (assignedTo && (assignedTo === String(currentUser?.emp_id) || filteredEmployees.some(e => String(e.emp_id) === assignedTo))) {
      return;
    }
    if (filteredEmployees.length > 0) {
      setAssignedTo(String(filteredEmployees[0].emp_id));
    } else if (currentUser?.emp_id) {
      setAssignedTo(String(currentUser.emp_id));
    } else {
      setAssignedTo('');
    }
  }, [departmentId, employees]);

  const riskInfo = PRIORITY_RISK_MAP[priority];
  const selectedAssigneeObj = employees.find(e => String(e.emp_id) === String(assignedTo));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !area.trim() || !observationText.trim() || !assignedTo || !dueDate) {
      showToast({
        type: 'warning',
        title: 'Missing Required Fields',
        message: 'Please complete all required fields (Department, Area, Observation, Assignee, Target Due Date).',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.createObservationWithTask({
        department_id: Number(departmentId),
        area: area.trim(),
        observation_text: observationText.trim(),
        solution_text: solutionText.trim(),
        assigned_to: Number(assignedTo),
        due_date: new Date(dueDate).toISOString(),
        priority,
        photo_urls: photos.map((p) => ({ url: p.url, file_name: p.file_name })),
        officer_id: currentUser.emp_id,
      });

      showToast({
        type: 'success',
        title: 'Observation & Work Order Created',
      });

      // Reset fields
      setArea('');
      setObservationText('');
      setSolutionText('');
      setPhotos([]);
      onCreated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Unable to create observation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Safety Observation & Work Order"
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
              subtitle="Identify department and pinpoint exact machinery or bay"
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
                    <option key={d.dept_id} value={d.dept_id}>
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
              subtitle="Severity level automatically calculates safety risk factor"
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {priority === 'LOW' ? '1% – 3%' : priority === 'MEDIUM' ? '3% – 6%' : '6% – 9%'}
                    </div>
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
              title="Safety Hazard Observation & Solution Directive"
              subtitle="Detailed description of unsafe condition and recommended fix"
              icon={<FileText size={16} />}
            />
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">
                Safety Hazard / Condition Observed <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Describe the unsafe condition or hazard observed in detail..."
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Recommended Corrective Solution Directive</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Specify recommended corrective engineering or containment action..."
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
              />
            </div>
          </div>

          {/* STEP 4: ASSIGNMENT & TARGET DUE DATE */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
            <ModalStepHeader
              step={4}
              title="Task Assignment & Target Due Date"
              subtitle="Filtered to active employees within the selected plant department"
              icon={<UserIcon size={16} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">
                  Task Assignee <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  required
                >
                  {currentUser && (
                    <option value={currentUser.emp_id}>
                      {(!currentUser.full_name || currentUser.full_name.toLowerCase() === 'admin' ? 'Safety Officer' : currentUser.full_name)} — Emp ID: {currentUser.emp_id} (Assign to Myself)
                    </option>
                  )}
                  {filteredEmployees
                    .filter((emp) => String(emp.emp_id) !== String(currentUser?.emp_id))
                    .map((emp) => (
                      <option key={emp.emp_id} value={emp.emp_id}>
                        {emp.full_name} — Emp ID: {emp.emp_id} {emp.position ? `(${emp.position})` : ''}
                      </option>
                    ))}
                </select>
                <span className="form-hint" style={{ fontSize: '0.75rem' }}>
                  {filteredEmployees.length} employee(s) in selected department.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Target Due Date & Time <span className="required">*</span>
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* STEP 5: PHOTOS */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
            <ModalStepHeader
              step={5}
              title="Initial Photographic Evidence"
              subtitle="Visual proof of hazard condition before work order is initiated"
              icon={<Camera size={16} />}
            />
            <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={10} />
          </div>

          {/* ASSIGNER SIGN-OFF & TIMESTAMP STRIP */}
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid var(--border-hover)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="var(--brand-primary)" />
              <span>
                Assigner: <strong style={{ color: 'var(--text-primary)' }}>{(!currentUser?.full_name || currentUser.full_name.toLowerCase() === 'admin') ? 'Safety Officer' : currentUser.full_name}</strong> (Emp ID: {currentUser?.emp_id || currentUser?.id || 'N/A'})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Clock size={13} color="var(--text-muted)" />
              <span>
                Submission Timestamp: <strong style={{ color: 'var(--text-primary)' }}>{formatISTDateTime(new Date())}</strong>
              </span>
            </div>
          </div>

          {/* SUBMIT BUTTONS */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !assignedTo}>
              <Send size={16} />
              {isSubmitting ? 'Creating...' : 'Create Observation'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

