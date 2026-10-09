import React, { useState, useEffect } from 'react';
import { Department } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { PhotoUploader, UploadedPhoto } from '../../components/common/PhotoUploader';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

export const AddTrainingPage: React.FC = () => {
  const { currentUser, isOfficer } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isAdminOrOfficer = Boolean(
    isOfficer ||
    currentUser?.role === 'HEALTH_SAFETY_OFFICER' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.user_access === 'ADMIN' ||
    (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY')
  );

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
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
    if (!isAdminOrOfficer) {
      showToast({
        type: 'error',
        title: 'Access Restricted',
        message: 'Only Health & Safety Officers and Admins can record training sessions.',
      });
      navigate('/', { replace: true });
      return;
    }

    DataService.getDepartments().then((depts) => {
      const activeDepts = depts.filter((d) => d.is_active !== false);
      setDepartments(activeDepts);
      if (activeDepts.length > 0 && !departmentId) {
        setDepartmentId(activeDepts[0].id || String(activeDepts[0].dept_id));
      }
    });

    if (currentUser?.full_name && !conductedBy) {
      setConductedBy(currentUser.full_name);
    }
  }, [isAdminOrOfficer, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !area.trim() || !trainingTopic.trim() || !description.trim() || numberOfPersons <= 0 || !trainingDate || !conductedBy.trim()) {
      showToast({ type: 'warning', title: 'Validation Error', message: 'Please complete all required fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await DataService.createTrainingRecord({
        department_id: departmentId,
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

      showToast({
        type: 'success',
        title: 'Training Saved',
        message: `Training session recorded successfully.`,
      });

      navigate('/training');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to Save', message: err.message || 'Could not save training.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdminOrOfficer) {
    return null;
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => navigate('/training')}
        style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <ArrowLeft size={16} /> Back to Trainings
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Add Training Details
        </h2>
      </div>

      <div className="ehs-card" style={{ padding: '24px' }}>
        <form onSubmit={handleSubmit}>
          
          {/* Row 1: Department & Area */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                Department Name <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </option>
                ))}
              </select>
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

          {/* Row 2: Topic & Number of Persons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
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

          {/* Row 3: Training Date & Conducted By */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
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

          {/* Row 4: Description */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
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

          {/* Row 5: Attendance Sheet Photo */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">
              Attendance Sheet Photo
            </label>
            <PhotoUploader
              photos={attendancePhotos}
              onChange={setAttendancePhotos}
              maxPhotos={5}
              dropzoneTitle="Add Attendance Photo"
            />
          </div>

          {/* Row 6: Group Photo of Training (can add multiple) */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">
              Group Photo of Training
            </label>
            <PhotoUploader
              photos={groupPhotos}
              onChange={setGroupPhotos}
              maxPhotos={10}
              dropzoneTitle="Add Training Photos"
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/training')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              <Save size={16} />
              {isSubmitting ? 'Saving...' : 'Save Training'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
