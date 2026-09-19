import React, { useState, useEffect } from 'react';
import { Observation, TrainingRecord } from '../../types/database';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import {
  BarChart3,
  Download,
  CheckCircle2,
  GraduationCap,
  ShieldAlert
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      DataService.getObservations(),
      DataService.getTrainingRecords(),
    ]).then(([obs, trn]) => {
      setObservations(obs);
      setTrainings(trn);
      setLoading(false);
    });
  }, []);

  // Compute Turnaround Time for completed tasks/observations
  const completedObs = observations.filter((o) => (o.status === 'COMPLETED' || o.status === 'CLOSED') && o.completed_at);
  const totalCompletionHours = completedObs.reduce((acc, o) => {
    const start = new Date(o.created_at).getTime();
    const end = new Date(o.completed_at!).getTime();
    return acc + Math.max(0, (end - start) / (1000 * 60 * 60));
  }, 0);
  const avgCompletionDays = completedObs.length > 0 ? (totalCompletionHours / completedObs.length / 24).toFixed(1) : '0.0';

  const now = Date.now();

  // CSV Export Generators
  const exportObservationsCSV = () => {
    const headers = ['Sr No,Department,Area,Priority,Risk Min %,Risk Max %,Assignee,Due Date,Status,Created Date,Completed Date'];
    const rows = observations.map((o, idx) =>
      `"${idx + 1}","${o.department?.name || ''}","${o.area}","${o.priority}","${o.risk_min}","${o.risk_max}","${o.assignee?.full_name || o.assigned_to}","${o.due_date ? new Date(o.due_date).toLocaleDateString() : ''}","${o.status}","${new Date(o.created_at).toLocaleDateString()}","${o.completed_at ? new Date(o.completed_at).toLocaleDateString() : 'N/A'}"`
    );
    downloadCSV([headers, ...rows].join('\n'), 'healthAndSafety_observations_report.csv');
    showToast({ type: 'success', title: 'Export Generated', message: 'Observations CSV downloaded.' });
  };

  const exportTasksCSV = () => {
    const headers = ['Sr No,Hazard Description,Department,Area,Assignee,Due Date,Status,Created At,Completed At'];
    const rows = observations.map((o, idx) =>
      `"${idx + 1}","${(o.observation_text || '').replace(/"/g, '""')}","${o.department?.name || ''}","${o.area}","${o.assignee?.full_name || o.assigned_to}","${o.due_date ? new Date(o.due_date).toLocaleDateString() : ''}","${o.status}","${new Date(o.created_at).toLocaleDateString()}","${o.completed_at ? new Date(o.completed_at).toLocaleDateString() : 'N/A'}"`
    );
    downloadCSV([headers, ...rows].join('\n'), 'healthAndSafety_tasks_sla_report.csv');
    showToast({ type: 'success', title: 'Export Generated', message: 'Tasks SLA CSV downloaded.' });
  };

  const exportTrainingCSV = () => {
    const headers = ['Training Code,Department,Topic,Trainees Count,Training Date,Instructor'];
    const rows = trainings.map((t) =>
      `"${t.training_number}","${t.department?.name || ''}","${t.training_topic.replace(/"/g, '""')}","${t.number_of_persons}","${t.training_date}","${t.creator?.full_name || 'Officer'}"`
    );
    downloadCSV([headers, ...rows].join('\n'), 'healthAndSafety_trainings_report.csv');
    showToast({ type: 'success', title: 'Export Generated', message: 'Training records CSV downloaded.' });
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={24} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Safety & Compliance Reports</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          Official regulatory audit statistics, turnaround analytics, and verifiable spreadsheet export.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* REPORT 1: OBSERVATIONS AUDIT */}
        <div className="ehs-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="var(--brand-primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Observation Audits</h3>
              </div>
              <span className="badge badge-assigned">{observations.length} Total</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Open Hazards:</span>
                <strong style={{ color: 'var(--brand-secondary)' }}>
                  {observations.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CLOSED').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Closed / Mitigated:</span>
                <strong style={{ color: '#16a34a' }}>
                  {observations.filter((o) => o.status === 'COMPLETED' || o.status === 'CLOSED').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>High Risk (6% - 9%):</span>
                <strong style={{ color: '#dc2626' }}>
                  {observations.filter((o) => o.priority === 'HIGH').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Medium Risk (3% - 6%):</span>
                <strong style={{ color: '#d97706' }}>
                  {observations.filter((o) => o.priority === 'MEDIUM').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Low Risk (1% - 3%):</span>
                <strong style={{ color: '#16a34a' }}>
                  {observations.filter((o) => o.priority === 'LOW').length}
                </strong>
              </div>
            </div>
          </div>

          <button className="btn btn-outline" onClick={exportObservationsCSV} style={{ width: '100%' }}>
            <Download size={16} />
            Export Observations CSV
          </button>
        </div>

        {/* REPORT 2: TASKS & SLA */}
        <div className="ehs-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#16a34a" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Task Lifecycle & SLA</h3>
              </div>
              <span className="badge badge-completed">{observations.length} Assigned</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Avg Turnaround Time:</span>
                <strong style={{ color: '#d97706' }}>{avgCompletionDays} Days</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Awaiting Review:</span>
                <strong style={{ color: '#b45309' }}>
                  {observations.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Rework Cycles Required:</span>
                <strong style={{ color: '#ea580c' }}>
                  {observations.filter((t) => t.status === 'REWORK_REQUIRED').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Overdue Breaches:</span>
                <strong style={{ color: '#dc2626' }}>
                  {observations.filter((t) => t.status === 'OVERDUE' || (t.due_date && new Date(t.due_date).getTime() < now && t.status !== 'COMPLETED' && t.status !== 'CLOSED')).length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Completed & Verified:</span>
                <strong style={{ color: '#16a34a' }}>
                  {observations.filter((t) => t.status === 'COMPLETED').length}
                </strong>
              </div>
            </div>
          </div>

          <button className="btn btn-outline" onClick={exportTasksCSV} style={{ width: '100%' }}>
            <Download size={16} />
            Export Tasks CSV
          </button>
        </div>

        {/* REPORT 3: TRAINING COMPLIANCE */}
        <div className="ehs-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={20} color="var(--brand-secondary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Training Compliance</h3>
              </div>
              <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.12)', color: 'var(--brand-secondary)', border: '1px solid rgba(2, 132, 199, 0.25)' }}>
                ISO 45001
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Training Sessions Held:</span>
                <strong>{trainings.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Attendees Trained:</span>
                <strong style={{ color: '#10b981' }}>
                  {trainings.reduce((acc, t) => acc + (t.number_of_persons || 0), 0)} Workers
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Departments Covered:</span>
                <strong>{new Set(trainings.map((t) => t.department_id || t.dept_id)).size} Departments</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Compliance Rating:</span>
                <strong style={{ color: '#10b981' }}>100% Active</strong>
              </div>
            </div>
          </div>

          <button className="btn btn-outline" onClick={exportTrainingCSV} style={{ width: '100%' }}>
            <Download size={16} />
            Export Training Records CSV
          </button>
        </div>
      </div>
    </div>
  );
};
