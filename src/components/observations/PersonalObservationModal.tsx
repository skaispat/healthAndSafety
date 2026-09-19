import React, { useState, useEffect } from 'react';
import { Department, PriorityLevel, PRIORITY_RISK_MAP } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { PhotoUploader, UploadedPhoto } from '../common/PhotoUploader';
import { Sparkles, Send } from 'lucide-react';

interface PersonalObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const PersonalObservationModal: React.FC<PersonalObservationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [area, setArea] = useState('');
  const [observationText, setObservationText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('LOW');
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
      const defaultDue = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      setDueDate(defaultDue.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const riskInfo = PRIORITY_RISK_MAP[priority];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!departmentId || !area.trim() || !observationText.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Fields',
        message: 'Please provide Department, Area, and Observation details.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const obs = await DataService.createPersonalObservation({
        department_id: departmentId,
        area: area.trim(),
        observation_text: observationText.trim(),
        solution_text: solutionText.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        priority,
        photo_urls: photos.map((p) => ({ url: p.url, file_name: p.file_name })),
        officer_id: currentUser.id,
      });

      showToast({
        type: 'success',
        title: 'Personal Observation Logged',
        message: `${obs.observation_number} registered for officer monitoring (no employee task created).`,
      });

      setArea('');
      setObservationText('');
      setSolutionText('');
      setPhotos([]);
      onCreated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed',
        message: err.message || 'Could not save personal observation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Personal Safety Observation"
      subtitle="Officer personal observation log. No employee task will be generated."
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
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
              Area / Equipment <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Substation transformer enclosure"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Observation Notes <span className="required">*</span>
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Record safety findings or ongoing observations..."
            value={observationText}
            onChange={(e) => setObservationText(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Resolution Strategy / Action Plan</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Planned corrective actions or monitoring steps..."
            value={solutionText}
            onChange={(e) => setSolutionText(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '14px 0 20px 0' }}>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>

          <div>
            <label className="form-label">Risk Assessment</label>
            <div className={`risk-display-box risk-${priority.toLowerCase()}`}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>CALCULATED RISK</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-assigned</div>
              </div>
              <div className="risk-percentage-val" style={{ color: priority === 'HIGH' ? '#ef4444' : priority === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                {riskInfo.label}
              </div>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Inspection Photos</label>
          <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={6} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            <Sparkles size={16} />
            {isSubmitting ? 'Saving...' : 'Save Personal Observation'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
