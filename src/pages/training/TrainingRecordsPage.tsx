import React, { useState, useEffect } from 'react';
import { TrainingRecord, Department } from '../../types/database';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { CreateTrainingModal } from '../../components/training/CreateTrainingModal';
import { PhotoGallery } from '../../components/common/PhotoGallery';
import { Modal } from '../../components/common/Modal';
import { GraduationCap, PlusCircle, Search, Users, Calendar, Building2, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const TrainingRecordsPage: React.FC = () => {
  const { isOfficer } = useAuth();
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<TrainingRecord | null>(null);

  const loadData = async () => {
    const [trainList, deptList] = await Promise.all([
      DataService.getTrainingRecords(),
      DataService.getDepartments(),
    ]);
    setTrainings(trainList);
    setDepartments(deptList);
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, []);

  const filtered = trainings.filter((t) => {
    const matchesSearch =
      searchQuery === '' ||
      t.training_topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.training_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || t.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  const totalTrainees = trainings.reduce((acc, t) => acc + (t.number_of_persons || 0), 0);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GraduationCap size={24} color="#38bdf8" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Safety Training Records</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Compliance records for occupational safety training, machinery operating drills, and PPE compliance.
          </p>
        </div>

        {isOfficer && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <PlusCircle size={18} />
            Record Training Session
          </button>
        )}
      </div>

      {/* Trainees Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div className="ehs-card" style={{ padding: '16px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL SESSIONS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
            {trainings.length}
          </div>
        </div>

        <div className="ehs-card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>WORKERS TRAINED</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            {totalTrainees}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="ehs-card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search topic, training code, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <select
            className="form-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Training Table */}
      <div className="table-container">
        <table className="ehs-table">
          <thead>
            <tr>
              <th>Training ID</th>
              <th>Department</th>
              <th>Topic / Subject</th>
              <th>Attendance</th>
              <th>Training Date</th>
              <th>Officer In-Charge</th>
              <th>Photos</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No training records found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} onClick={() => setSelectedTraining(t)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>
                    {t.training_number}
                  </td>
                  <td>{t.department?.name || 'All'}</td>
                  <td style={{ maxWidth: '280px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.training_topic}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.description}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', border: '1px solid rgba(22, 163, 74, 0.25)' }}>
                      <Users size={12} />
                      {t.number_of_persons} persons
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(t.training_date).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{t.creator?.full_name || 'Safety Officer'}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.photos?.length || 0} photos
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTraining(t);
                      }}
                      style={{ color: 'var(--brand-primary)', padding: '6px' }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {selectedTraining && (
        <Modal
          isOpen={Boolean(selectedTraining)}
          onClose={() => setSelectedTraining(null)}
          title={`${selectedTraining.training_number} — Safety Training Session`}
          subtitle={`Conducted on ${new Date(selectedTraining.training_date).toLocaleDateString()}`}
          size="lg"
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.12)', color: 'var(--brand-secondary)' }}>
              <Building2 size={13} /> {selectedTraining.department?.name}
            </span>
            <span className="badge" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d' }}>
              <Users size={13} /> {selectedTraining.number_of_persons} Attendees Certified
            </span>
            <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              Instructor: {selectedTraining.creator?.full_name || 'Safety Officer'}
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>CURRICULUM TOPIC</div>
            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginTop: '4px' }}>
              {selectedTraining.training_topic}
            </h4>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SESSION DESCRIPTION</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
              {selectedTraining.description}
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>
              ATTENDANCE EVIDENCE & WORKSHOP PHOTOS
            </div>
            <PhotoGallery photos={selectedTraining.photos} />
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      <CreateTrainingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadData}
      />
    </div>
  );
};
