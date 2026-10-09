import React, { useState, useEffect } from 'react';
import { TrainingRecord, Department } from '../../types/database';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PhotoGallery } from '../../components/common/PhotoGallery';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { exportTrainingReportPDF } from '../../utils/trainingReportExport';
import { formatISTDate } from '../../utils/dateUtils';
import {
  GraduationCap,
  PlusCircle,
  Search,
  Users,
  Building2,
  MapPin,
  Eye,
  FileDown,
  Loader2,
  FileSpreadsheet,
  Image,
  Calendar,
  UserCheck
} from 'lucide-react';

export const TrainingRecordsPage: React.FC = () => {
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

  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<TrainingRecord | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [trainList, deptList] = await Promise.all([
        DataService.getTrainingRecords(),
        DataService.getDepartments(),
      ]);
      setTrainings(trainList);
      setDepartments(deptList);
    } catch (err) {
      console.error('Error loading training records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminOrOfficer) {
      showToast({
        type: 'error',
        title: 'Access Denied',
        message: 'This page is restricted to Health & Safety Officers and Admins.',
      });
      navigate('/', { replace: true });
      return;
    }

    loadData();
    return subscribeToDataChanges(loadData);
  }, [isAdminOrOfficer]);

  const handleDownloadPDF = async (t: TrainingRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExportingId(t.id);

    try {
      await exportTrainingReportPDF(t);
      showToast({
        type: 'success',
        title: 'Report Downloaded',
        message: `${t.training_number} PDF exported.`,
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err.message || 'Could not compile PDF report.',
      });
    } finally {
      setExportingId(null);
    }
  };

  if (!isAdminOrOfficer) {
    return null;
  }

  const filtered = trainings.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      (t.training_topic || '').toLowerCase().includes(query) ||
      (t.training_number || '').toLowerCase().includes(query) ||
      (t.department?.name || '').toLowerCase().includes(query) ||
      (t.area || '').toLowerCase().includes(query) ||
      (t.conducted_by || '').toLowerCase().includes(query);

    const matchesDept =
      deptFilter === 'ALL' ||
      t.department_id === deptFilter ||
      String(t.dept_id) === deptFilter ||
      (t.department?.name && t.department.name.toLowerCase() === deptFilter.toLowerCase()) ||
      (t.department?.dept_id && String(t.department.dept_id) === deptFilter);
    return matchesSearch && matchesDept;
  });

  return (
    <div className="page-wrapper" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '30px' }}>
      
      {/* Compact Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={24} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Safety Trainings
          </h2>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/training/add')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <PlusCircle size={15} />
          <span>Add Training</span>
        </button>
      </div>

      {/* Compact Filter Bar */}
      <div
        className="ehs-card"
        style={{
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search trainings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ flex: '0 1 180px' }}>
          <select
            className="form-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{ height: '36px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Departments</option>
            {departments
              .filter(d => (d.name || d.dept_name || '').trim().toUpperCase() !== 'OTHER')
              .map((d) => (
                <option key={d.id || d.dept_id} value={d.name}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginLeft: 'auto' }}>
          {filtered.length} session{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="ehs-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px auto' }} />
          <span style={{ fontSize: '0.85rem' }}>Loading trainings...</span>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div className="ehs-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <GraduationCap size={36} color="var(--border-hover)" style={{ margin: '0 auto 8px auto' }} />
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
            No training records found.
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/training/add')}
            style={{ marginTop: '12px' }}
          >
            <PlusCircle size={15} /> Add Training Now
          </button>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* 1. MOBILE PURE VIEW CARDS (Rendered on mobile screens)         */}
          {/* ============================================================== */}
          <div className="training-mobile-cards">
            {filtered.map((t) => {
              const groupPhotos = t.group_photos || [];
              const attendancePhotos = t.attendance_photos || [];

              return (
                <div
                  key={t.id}
                  className="training-card-item"
                  onClick={() => setSelectedTraining(t)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Top line: Code + Status + Date */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {t.training_number}
                      </span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.1)', color: '#15803d', textTransform: 'uppercase' }}>
                        Completed
                      </span>
                    </div>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      {formatISTDate(t.training_date)}
                    </span>
                  </div>

                  {/* Topic */}
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: 1.35 }}>
                    {t.training_topic}
                  </div>

                  {/* Dept & Area */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={13} color="var(--brand-secondary)" />
                      {t.department?.name || 'Department'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="var(--brand-primary)" />
                      {t.area || 'Plant Area'}
                    </span>
                  </div>

                  {/* Attendees & Trainer info */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', background: 'rgba(22, 163, 74, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        {t.number_of_persons} Attendees
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {t.conducted_by || 'Safety Officer'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedTraining(t)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        <Eye size={14} /> View
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={(e) => handleDownloadPDF(t, e)}
                        disabled={exportingId === t.id}
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        {exportingId === t.id ? (
                          <Loader2 size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <FileDown size={14} />
                        )}
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* 2. DESKTOP TABULAR VIEW (Rendered on larger screens)           */}
          {/* ============================================================== */}
          <div className="training-desktop-table table-container" style={{ background: '#ffffff', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
            <table className="ehs-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Code</th>
                  <th style={{ width: '150px' }}>Department & Area</th>
                  <th>Topic</th>
                  <th style={{ width: '110px' }}>Headcount</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '140px' }}>Conducted By</th>
                  <th style={{ width: '130px' }}>Photos</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const groupPhotos = t.group_photos || [];
                  const attendancePhotos = t.attendance_photos || [];

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTraining(t)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                          {t.training_number}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                          {t.department?.name || 'Department'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {t.area}
                        </div>
                      </td>

                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          {t.training_topic}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.description}
                        </div>
                      </td>

                      <td>
                        <span className="badge" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#15803d', fontWeight: 700, fontSize: '0.75rem' }}>
                          <Users size={12} /> {t.number_of_persons}
                        </span>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {formatISTDate(t.training_date)}
                      </td>

                      <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {t.conducted_by || 'Safety Officer'}
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem' }}>
                          {attendancePhotos.length > 0 && (
                            <span style={{ color: 'var(--brand-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <FileSpreadsheet size={11} /> {attendancePhotos.length} Roster
                            </span>
                          )}
                          {groupPhotos.length > 0 && (
                            <span style={{ color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Image size={11} /> {groupPhotos.length} Photos
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-ghost"
                            onClick={() => setSelectedTraining(t)}
                            style={{ color: 'var(--brand-secondary)', padding: '5px' }}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={(e) => handleDownloadPDF(t, e)}
                            disabled={exportingId === t.id}
                            style={{ color: 'var(--brand-primary)', padding: '5px' }}
                            title="Download PDF"
                          >
                            {exportingId === t.id ? (
                              <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <FileDown size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Details Modal */}
      {selectedTraining && (
        <Modal
          isOpen={Boolean(selectedTraining)}
          onClose={() => setSelectedTraining(null)}
          title={selectedTraining.training_number}
          subtitle={`${formatISTDate(selectedTraining.training_date)} • ${selectedTraining.department?.name || 'Department'}`}
          size="lg"
        >
          {/* Key Badges */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.12)', color: 'var(--brand-secondary)' }}>
              <Building2 size={12} /> {selectedTraining.department?.name}
            </span>
            <span className="badge" style={{ background: 'rgba(185, 28, 28, 0.1)', color: 'var(--brand-primary)' }}>
              <MapPin size={12} /> {selectedTraining.area}
            </span>
            <span className="badge" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d' }}>
              <Users size={12} /> {selectedTraining.number_of_persons} Attendees
            </span>
            <span className="badge" style={{ background: 'var(--bg-surface-elevated)' }}>
              <UserCheck size={12} /> {selectedTraining.conducted_by || 'Safety Officer'}
            </span>
          </div>

          {/* Topic */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOPIC</div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {selectedTraining.training_topic}
            </h4>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>DESCRIPTION</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
              {selectedTraining.description}
            </p>
          </div>

          {/* Attendance Photo */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--brand-secondary)', fontWeight: 700, marginBottom: '6px' }}>
              ATTENDANCE SHEET
            </div>
            <PhotoGallery photos={selectedTraining.attendance_photos} emptyMessage="No attendance sheet attached" />
          </div>

          {/* Group Photos */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700, marginBottom: '6px' }}>
              TRAINING PHOTOS
            </div>
            <PhotoGallery photos={selectedTraining.group_photos} emptyMessage="No training photos attached" />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedTraining(null)}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleDownloadPDF(selectedTraining)}
              disabled={exportingId === selectedTraining.id}
            >
              {exportingId === selectedTraining.id ? (
                <Loader2 size={15} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <FileDown size={15} />
              )}
              Download PDF Report
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};
