import React, { useState, useEffect } from 'react';
import { Department, User, PriorityLevel, PRIORITY_RISK_MAP } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { PhotoUploader, UploadedPhoto } from '../../components/common/PhotoUploader';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  AlertTriangle,
  FileText,
  Clock,
  User as UserIcon,
  Camera,
  Send,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { formatISTDateTime } from '../../utils/dateUtils';

const StepHeader: React.FC<{ step: number; title: string; subtitle?: string; icon: React.ReactNode }> = ({
  step,
  title,
  subtitle,
  icon,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid var(--border-subtle)',
    }}
  >
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'rgba(2, 132, 199, 0.1)',
        color: 'var(--brand-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '0.9rem',
        flexShrink: 0,
      }}
    >
      {step}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--brand-primary)' }}>{icon}</span>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {title}
        </h4>
      </div>
      {subtitle && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

export const CreateObservationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  // Form states
  const [departmentId, setDepartmentId] = useState<string>('');
  const [area, setArea] = useState('');
  const [observationText, setObservationText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
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
  }, []);

  // Filter employees belonging to the selected department
  const filteredEmployees = employees.filter((emp) => {
    if (!departmentId) return false;
    const deptNum = Number(departmentId);

    // 1. Direct dept_id check
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
    if (filteredEmployees.length > 0) {
      const isCurrentValid = filteredEmployees.some(e => String(e.emp_id) === assignedTo);
      if (!isCurrentValid) {
        setAssignedTo(String(filteredEmployees[0].emp_id));
      }
    } else {
      setAssignedTo('');
    }
  }, [departmentId, employees]);

  const riskInfo = PRIORITY_RISK_MAP[priority];
  const selectedDeptObj = departments.find(d => String(d.dept_id) === String(departmentId));
  const selectedAssigneeObj = employees.find(e => String(e.emp_id) === String(assignedTo));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !area.trim() || !observationText.trim() || !assignedTo || !dueDate) {
      showToast({
        type: 'warning',
        title: 'Missing Required Fields',
        message: 'Please complete all required fields (Department, Specific Area, Hazard Description, Assignee, Target Due Date).',
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

      navigate('/observations');
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
    <div className="page-wrapper" style={{ maxWidth: '920px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
              Create Observation
            </h2>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* STEP 1: LOCATION */}
          <div className="ehs-card" style={{ padding: '22px' }}>
            <StepHeader
              step={1}
              title="Department &  Location"
              subtitle="Select the plant department and area where the hazard exists"
              icon={<Building2 size={18} />}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              {/* Department Dropdown */}
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

              {/* Specific Area */}
              <div className="form-group">
                <label className="form-label">
                  Specific Area / Machinery / Tag <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rolling Mill Bay 3, Furnace Discharge Conveyor #2"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  required
                />

              </div>
            </div>
          </div>

          {/* STEP 2: RISK ASSESSMENT */}
          <div className="ehs-card" style={{ padding: '22px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', alignItems: 'center' }}>
              <div className="form-group">
                <label className="form-label">
                  Priority <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  required
                  style={{ fontWeight: 600 }}
                >
                  <option value="LOW">LOW — Minor hazard or housekeeping</option>
                  <option value="MEDIUM">MEDIUM — Moderate risk requiring timely repair</option>
                  <option value="HIGH">HIGH — Critical hazard or imminent danger</option>
                </select>

              </div>

              <div>
                <div className={`risk-display-box risk-${priority.toLowerCase()}`} style={{ height: 'auto', padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em' }}>
                      RISK CATEGORY
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Range: {priority === 'LOW' ? '1% – 3%' : priority === 'MEDIUM' ? '3% – 6%' : '6% – 9%'} Factor
                    </div>
                  </div>
                  <div
                    className="risk-percentage-val"
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: priority === 'HIGH' ? '#ef4444' : priority === 'MEDIUM' ? '#f59e0b' : '#10b981',
                    }}
                  >
                    {riskInfo.label}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: HAZARD DESCRIPTION & DIRECTIVE */}
          <div className="ehs-card" style={{ padding: '22px' }}>
            <StepHeader
              step={3}
              title="Hazard Description"

              icon={<FileText size={18} />}
            />

            {/* Observation Text */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">
                Safety Hazard / Unsafe Condition Observed <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                required
              />

            </div>

            {/* Recommended Solution */}
            <div className="form-group">
              <label className="form-label">
                Recommended Action / Solution.
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
              />
            </div>
          </div>

          {/* STEP 4: ASSIGNMENT & TARGET DUE DATE */}
          <div className="ehs-card" style={{ padding: '22px' }}>
            <StepHeader
              step={4}
              title="Task Assignment & Target Date"
              icon={<UserIcon size={18} />}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              {/* Assignee */}
              <div className="form-group">
                <label className="form-label">
                  Task Assignee (Department Employee) <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  required
                  disabled={filteredEmployees.length === 0}
                >
                  {filteredEmployees.length === 0 ? (
                    <option value="">No active employees found in selected department</option>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <option key={emp.emp_id} value={emp.emp_id}>
                        {emp.full_name} — Emp ID: {emp.emp_id} {emp.position ? `(${emp.position})` : ''}
                      </option>
                    ))
                  )}
                </select>
                {filteredEmployees.length === 0 ? (
                  <span className="form-hint" style={{ color: '#dc2626', fontSize: '0.76rem', fontWeight: 600 }}>
                    ⚠️ No active employees are currently assigned to this department.
                  </span>
                ) : (
                  <span className="form-hint" style={{ fontSize: '0.76rem' }}>
                    Showing {filteredEmployees.length} employee(s) filtered by selected department.
                  </span>
                )}
              </div>

              {/* Due Date in IST */}
              <div className="form-group">
                <label className="form-label">
                  Target Date & Time <span className="required">*</span>
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

          {/* STEP 5: INITIAL PHOTOGRAPHIC EVIDENCE */}
          <div className="ehs-card" style={{ padding: '16px' }}>
            <StepHeader
              step={5}
              title="Initial Photographic Proof (Hazard Condition)"
              icon={<Camera size={16} />}
            />

            <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={10} />
          </div>

          {/* STEP 6: ASSIGNER & SUBMISSION SIGN-OFF BANNER */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid var(--border-hover)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#e0f2fe',
                  color: 'var(--brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Assigner: {(!currentUser?.full_name || currentUser.full_name.toLowerCase() === 'admin') ? 'Safety Officer' : currentUser.full_name} (Emp ID: {currentUser?.emp_id || currentUser?.id || 'N/A'})
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Role: Safety Officer • Dept: {(typeof currentUser?.department === 'object' ? currentUser.department?.name : currentUser?.department) || currentUser?.department_name || 'Health & Safety'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Submission Timestamp
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatISTDateTime(new Date())}
                </div>
              </div>
            </div>
          </div>

          {/* FORM ACTIONS */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px', marginBottom: '40px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || filteredEmployees.length === 0}
              style={{ padding: '10px 24px' }}
            >
              <Send size={16} />
              <span>{isSubmitting ? 'Creating...' : 'Create Observation'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

