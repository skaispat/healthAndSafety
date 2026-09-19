import React, { useState, useEffect } from 'react';
import { Department } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { PhotoUploader, UploadedPhoto } from '../../components/common/PhotoUploader';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Send } from 'lucide-react';

export const AddTrainingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [numberOfPersons, setNumberOfPersons] = useState<number>(12);
  const [trainingTopic, setTrainingTopic] = useState('');
  const [description, setDescription] = useState('');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    DataService.getDepartments().then((depts) => {
      setDepartments(depts.filter((d) => d.is_active));
      if (depts.length > 0 && !departmentId) {
        setDepartmentId(depts[0].id || String(depts[0].dept_id));
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !trainingTopic.trim() || !description.trim() || numberOfPersons <= 0 || !trainingDate) {
      showToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please complete all required fields and specify positive headcount.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await DataService.createTrainingRecord({
        department_id: departmentId,
        number_of_persons: Number(numberOfPersons),
        training_topic: trainingTopic.trim(),
        description: description.trim(),
        training_date: trainingDate,
        photos: photos.map((p) => ({ url: p.url, file_name: p.file_name })),
        officer_id: currentUser.id,
      });

      showToast({
        type: 'success',
        title: 'Training Logged',
        message: `${record.training_number} recorded with ${record.number_of_persons} trainees.`,
      });

      navigate('/training');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to Save', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '840px' }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <ArrowLeft size={16} /> Back to Training Records
      </button>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Record Safety Training Session</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          Document safety workshops, machine safety certifications, and emergency drills.
        </p>
      </div>

      <div className="ehs-card">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
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
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Number of Attendees / Persons <span className="required">*</span>
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

          <div className="form-group">
            <label className="form-label">
              Training Topic <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Overhead Crane Rigging & Sling Angle Inspections"
              value={trainingTopic}
              onChange={(e) => setTrainingTopic(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Curriculum & Description <span className="required">*</span>
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Detail key modules taught, practical demonstrations, testing protocols..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

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
            <label className="form-label">Training Photos</label>
            <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={6} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <GraduationCap size={16} />
              {isSubmitting ? 'Saving...' : 'Save Training Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
