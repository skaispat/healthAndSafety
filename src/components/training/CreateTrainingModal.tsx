import React, { useState, useEffect } from 'react';
import { Department } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import { Save } from 'lucide-react';

interface CreateTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateTrainingModal: React.FC<CreateTrainingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [customDeptName, setCustomDeptName] = useState('');
  const [area, setArea] = useState('');
  const [trainingTopic, setTrainingTopic] = useState('');
  const [description, setDescription] = useState('');
  const [numberOfPersons, setNumberOfPersons] = useState<number>(1);
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().slice(0, 10));
  const [conductedBy, setConductedBy] = useState(
    currentUser?.full_name || currentUser?.username || 'Safety Officer'
  );

  const [groupPhotos, setGroupPhotos] = useState<UploadedPhoto[]>([]);
  const [attendancePhotos, setAttendancePhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      DataService.getDepartments().then((depts) => {
        const active = depts.filter((d) => d.is_active !== false);
        setDepartments(active);
        if (active.length > 0 && !departmentId) {
          setDepartmentId(String(active[0].dept_id));
        }
      });
      if (currentUser?.full_name && !conductedBy) {
        setConductedBy(currentUser.full_name);
      }
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !area.trim() || !trainingTopic.trim() || !description.trim() || numberOfPersons <= 0 || !trainingDate || !conductedBy.trim()) {
      showToast({ type: 'warning', title: 'Validation Error', message: 'Please complete all required fields.' });
      return;
    }

    if (departmentId === 'OTHER' && !customDeptName.trim()) {
      showToast({ type: 'warning', title: 'Department Required', message: 'Please enter the custom department name.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalDeptId: number;
      let finalDeptName: string;

      if (departmentId === 'OTHER') {
        const otherDept = await DataService.getOrCreateOtherDepartment();
        finalDeptId = Number(otherDept.dept_id);
        finalDeptName = customDeptName.trim();
      } else {
        finalDeptId = Number(departmentId);
        const selectedDept = departments.find(d => String(d.dept_id) === String(departmentId));
        finalDeptName = selectedDept?.name || selectedDept?.dept_name || `Department ${finalDeptId}`;
      }

      await DataService.createTrainingRecord({
        dept_id: finalDeptId,
        dept_name: finalDeptName,
        department_id: finalDeptId,
        area: area.trim(),
        training_topic: trainingTopic.trim(),
        description: description.trim(),
        number_of_persons: Number(numberOfPersons),
        training_date: trainingDate,
        conducted_by: conductedBy.trim(),
        group_photos: groupPhotos.map((p) => ({ url: p.url, file_name: p.file_name })),
        attendance_photos: attendancePhotos.map((p) => ({ url: p.url, file_name: p.file_name })),
        officer_id: currentUser.emp_id || currentUser.id,
      });

      showToast({ type: 'success', title: 'Saved', message: 'Training session recorded.' });
      setArea('');
      setTrainingTopic('');
      setDescription('');
      setCustomDeptName('');
      setGroupPhotos([]);
      setAttendancePhotos([]);
      onCreated();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to Save', message: err.message || 'Could not save training.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Training Details"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div className="form-group">
            <label className="form-label">
              Department Name <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={departmentId}
              onChange={(e) => {
                const val = e.target.value;
                setDepartmentId(val);
                if (val === 'OTHER') {
                  const otherDept = departments.find(d => 
                    (d.name && d.name.trim().toUpperCase() === 'OTHER') || 
                    (d.dept_name && d.dept_name.trim().toUpperCase() === 'OTHER')
                  );
                  if (otherDept && otherDept.name && otherDept.name.trim().toUpperCase() !== 'OTHER') {
                    setCustomDeptName(otherDept.name);
                  }
                } else {
                  setCustomDeptName('');
                }
              }}
              required
            >
              {departments
                .filter(d => (d.name || d.dept_name || '').trim().toUpperCase() !== 'OTHER')
                .map((d) => (
                  <option key={d.id || d.dept_id} value={String(d.dept_id)}>
                    {d.name || d.dept_name}
                  </option>
                ))}
              <option value="OTHER">+ Other (Enter Department Name)</option>
            </select>

            {departmentId === 'OTHER' && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Department Name (Editable) <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter custom department name..."
                  value={customDeptName}
                  onChange={(e) => setCustomDeptName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Area <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div className="form-group">
            <label className="form-label">
              Training Topic <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={trainingTopic}
              onChange={(e) => setTrainingTopic(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              No. of Persons <span className="required">*</span>
            </label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={numberOfPersons}
              onChange={(e) => setNumberOfPersons(parseInt(e.target.value) || 0)}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div className="form-group">
            <label className="form-label">
              Training Date <span className="required">*</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={trainingDate}
              onChange={(e) => setTrainingDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Conducted By <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={conductedBy}
              onChange={(e) => setConductedBy(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label">
            Description <span className="required">*</span>
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label">
            Attendance Sheet Photo
          </label>
          <PhotoUploader
            photos={attendancePhotos}
            onChange={setAttendancePhotos}
            maxPhotos={3}
            dropzoneTitle="Add Attendance Photo"
            compact
          />
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">
            Group Photo of Training
          </label>
          <PhotoUploader
            photos={groupPhotos}
            onChange={setGroupPhotos}
            maxPhotos={6}
            dropzoneTitle="Add Training Photos"
            compact
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            <Save size={16} />
            {isSubmitting ? 'Saving...' : 'Save Training'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
