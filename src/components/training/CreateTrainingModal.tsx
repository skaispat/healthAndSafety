import React, { useState, useEffect } from 'react';
import { Department } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import { GraduationCap, Users, Calendar, Building2, Send } from 'lucide-react';

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
  const [numberOfPersons, setNumberOfPersons] = useState<number>(10);
  const [trainingTopic, setTrainingTopic] = useState('');
  const [description, setDescription] = useState('');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      DataService.getDepartments().then((depts) => {
        setDepartments(depts.filter((d) => d.is_active));
        if (depts.length > 0 && !departmentId) {
          setDepartmentId(depts[0].id || String(depts[0].dept_id));
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !trainingTopic.trim() || !description.trim() || numberOfPersons <= 0 || !trainingDate) {
      showToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please fill in all training fields and ensure attendee headcount is greater than 0.',
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
        message: `Session ${record.training_number} (${record.number_of_persons} trainees) recorded.`,
      });

      setTrainingTopic('');
      setDescription('');
      setPhotos([]);
      onCreated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to Save',
        message: err.message || 'Could not save training session.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Safety Training Session"
      subtitle="Log industrial safety instruction, tool-box talks, or compliance certification drills"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">
              Trained Department <span className="required">*</span>
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
            <span className="form-hint">Must be greater than 0 attendees.</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Training Topic / Subject <span className="required">*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Fire Extinguisher Handling & Evacuation Routes"
            value={trainingTopic}
            onChange={(e) => setTrainingTopic(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Curriculum & Session Description <span className="required">*</span>
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Key concepts covered, practical demonstrations, testing protocols..."
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
          <label className="form-label">Attendance & Session Photos</label>
          <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={6} />
          <span className="form-hint">
            Upload roster sheets, demonstration photos, or participant group pictures.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            <GraduationCap size={16} />
            {isSubmitting ? 'Saving...' : 'Save Training Record'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
