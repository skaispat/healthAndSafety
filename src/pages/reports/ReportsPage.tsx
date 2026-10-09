import React, { useState, useEffect, useMemo } from 'react';
import { Observation, TrainingRecord, Department } from '../../types/database';
import { DataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { exportAuditReportPDF } from '../../utils/auditReportExport';
import { formatISTDate } from '../../utils/dateUtils';
import { PriorityBadge, ObservationStatusBadge } from '../../components/common/Badge';
import {
  BarChart3,
  Download,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  ShieldAlert,
  Calendar,
  Building2,
  Layers,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Filters
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    Promise.all([
      DataService.getObservations(),
      DataService.getTrainingRecords(),
      DataService.getDepartments(),
    ]).then(([obs, trn, depts]) => {
      setObservations(obs);
      setTrainings(trn);
      setDepartments(depts);
      setLoading(false);
    });
  }, []);

  // Filtered Observations
  const filteredObservations = useMemo(() => {
    return observations.filter((o) => {
      if (deptFilter !== 'ALL' && String(o.dept_id) !== deptFilter) return false;
      if (priorityFilter !== 'ALL' && o.priority !== priorityFilter) return false;

      const createdTime = new Date(o.created_at).getTime();
      if (dateFrom) {
        const fromTime = new Date(dateFrom).getTime();
        if (createdTime < fromTime) return false;
      }
      if (dateTo) {
        const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
        if (createdTime > toTime) return false;
      }
      return true;
    });
  }, [observations, deptFilter, priorityFilter, dateFrom, dateTo]);

  // Filtered Trainings
  const filteredTrainings = useMemo(() => {
    return trainings.filter((t) => {
      if (deptFilter !== 'ALL') {
        const tDeptId = String(t.department_id || t.dept_id);
        if (tDeptId !== deptFilter) return false;
      }
      if (dateFrom) {
        const tTime = new Date(t.training_date).getTime();
        const fromTime = new Date(dateFrom).getTime();
        if (tTime < fromTime) return false;
      }
      if (dateTo) {
        const tTime = new Date(t.training_date).getTime();
        const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
        if (tTime > toTime) return false;
      }
      return true;
    });
  }, [trainings, deptFilter, dateFrom, dateTo]);

  // Calculated Metrics
  const totalAudited = filteredObservations.length;
  const closedCount = filteredObservations.filter(
    (o) => o.status === 'COMPLETED' || o.status === 'CLOSED'
  ).length;
  const openCount = totalAudited - closedCount;
  const complianceRate = totalAudited > 0 ? Math.round((closedCount / totalAudited) * 100) : 100;
  const highRiskCount = filteredObservations.filter((o) => o.priority === 'HIGH').length;
  const totalTrained = filteredTrainings.reduce(
    (acc, t) => acc + (Number(t.number_of_persons) || 0),
    0
  );

  // Department Audit Matrix
  const deptAuditMatrix = useMemo(() => {
    const list = deptFilter === 'ALL'
      ? departments
      : departments.filter((d) => String(d.dept_id) === deptFilter);

    return list.map((dept) => {
      const deptObs = filteredObservations.filter((o) => String(o.dept_id) === String(dept.dept_id));
      const total = deptObs.length;
      const closed = deptObs.filter((o) => o.status === 'COMPLETED' || o.status === 'CLOSED').length;
      const open = total - closed;
      const rate = total > 0 ? Math.round((closed / total) * 100) : 100;

      const deptTrn = filteredTrainings.filter(
        (t) => String(t.department_id || t.dept_id) === String(dept.dept_id)
      );
      const trained = deptTrn.reduce((acc, t) => acc + (Number(t.number_of_persons) || 0), 0);

      let status = 'COMPLIANT';
      if (total > 0 && rate < 60) status = 'CRITICAL';
      else if (total > 0 && rate < 85) status = 'ATTENTION';

      return {
        id: dept.dept_id,
        name: dept.name || dept.dept_name || 'Plant Department',
        total,
        closed,
        open,
        complianceRate: rate,
        trained,
        status,
      };
    });
  }, [departments, filteredObservations, filteredTrainings, deptFilter]);

  // Quick Period Presets
  const setQuickPeriod = (type: 'ALL' | 'THIS_MONTH' | 'LAST_30') => {
    const now = new Date();
    if (type === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (type === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(firstDay.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    } else if (type === 'LAST_30') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Sr No,Department,Area,Hazard,Priority,Assignee,Due Date,Status,Created At,Completed At'];
    const rows = filteredObservations.map((o, idx) =>
      `"${idx + 1}","${o.department?.name || ''}","${o.area}","${(o.observation_text || '').replace(/"/g, '""')}","${o.priority}","${o.assignee?.full_name || o.assigned_to}","${o.due_date ? new Date(o.due_date).toLocaleDateString() : ''}","${o.status}","${new Date(o.created_at).toLocaleDateString()}","${o.completed_at ? new Date(o.completed_at).toLocaleDateString() : 'N/A'}"`
    );
    const content = [headers, ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SKA_Ispat_Safety_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({ type: 'success', title: 'Audit CSV Downloaded' });
  };

  // PDF Export
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const selectedDeptObj = departments.find((d) => String(d.dept_id) === deptFilter);
      const criticalObs = filteredObservations.filter((o) => o.priority === 'HIGH' || o.status === 'OVERDUE');

      await exportAuditReportPDF({
        periodLabel: dateFrom || dateTo ? `${dateFrom || 'Beginning'} to ${dateTo || 'Today'}` : 'All-Time Records',
        departmentName: selectedDeptObj ? selectedDeptObj.name : 'All Plant Departments',
        totalAudited,
        totalClosed: closedCount,
        totalOpen: openCount,
        complianceRate,
        highRiskCount,
        totalTrained,
        departmentRows: deptAuditMatrix,
        criticalItems: criticalObs.map((c, i) => ({
          srNo: i + 1,
          department: c.department?.name || 'N/A',
          area: c.area,
          hazard: c.observation_text,
          priority: c.priority,
          status: c.status,
          dueDate: c.due_date ? formatISTDate(c.due_date) : 'N/A',
        })),
      });
      showToast({ type: 'success', title: 'Audit Report PDF Generated' });
    } catch (err: any) {
      console.error(err);
      showToast({ type: 'error', title: 'PDF Generation Failed', message: err?.message });
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={24} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Safety & Audit Reports</h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportCSV}
            disabled={loading}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleExportPDF}
            disabled={loading || exportingPDF}
          >
            <FileText size={15} />
            <span>{exportingPDF ? 'Generating...' : 'Download Audit PDF'}</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div
        className="ehs-card"
        style={{
          padding: '14px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Department */}
          <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Department</label>
            <select
              className="form-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.dept_id} value={String(d.dept_id)}>
                  {d.name || d.dept_name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Risk Priority</label>
            <select
              className="form-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High (6% - 9%)</option>
              <option value="MEDIUM">Medium (3% - 6%)</option>
              <option value="LOW">Low (1% - 3%)</option>
            </select>
          </div>

          {/* Date From */}
          <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            />
          </div>

          {/* Date To */}
          <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* Quick Date Presets */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Range:</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setQuickPeriod('THIS_MONTH')}
            style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
          >
            This Month
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setQuickPeriod('LAST_30')}
            style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setQuickPeriod('ALL')}
            style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Primary Audit KPIs */}
      <div className="grid-audit-kpi" style={{ marginBottom: '24px' }}>
        <div className="ehs-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Audited</span>
            <Building2 size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px' }}>{totalAudited}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Hazard observations</div>
        </div>

        <div className="ehs-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Resolution Rate</span>
            <CheckCircle2 size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: complianceRate >= 80 ? '#16a34a' : '#d97706', marginTop: '6px' }}>
            {complianceRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
            {closedCount} resolved • {openCount} open
          </div>
        </div>

        <div className="ehs-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Critical / High Risk</span>
            <ShieldAlert size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: '6px' }}>
            {highRiskCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Auto-assessed 6% - 9%</div>
        </div>

        <div className="ehs-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Workers Trained</span>
            <GraduationCap size={18} color="var(--brand-secondary)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-secondary)', marginTop: '6px' }}>
            {totalTrained}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{filteredTrainings.length} sessions held</div>
        </div>
      </div>

      {/* Section 1: Department Compliance Matrix */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>
          Department Safety Performance
        </h3>

        {/* Desktop Table View */}
        <div className="table-container table-desktop-view">
          <table className="ehs-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Department</th>
                <th style={{ textAlign: 'center' }}>Total Audited</th>
                <th style={{ textAlign: 'center' }}>Resolved</th>
                <th style={{ textAlign: 'center' }}>Open</th>
                <th style={{ textAlign: 'center' }}>Resolution %</th>
                <th style={{ textAlign: 'center' }}>Trained</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {deptAuditMatrix.map((r, idx) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ textAlign: 'center' }}>{r.total}</td>
                  <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{r.closed}</td>
                  <td style={{ textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{r.open}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.complianceRate}%</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.trained}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className="badge"
                      style={{
                        background:
                          r.status === 'COMPLIANT'
                            ? 'rgba(22, 163, 74, 0.1)'
                            : r.status === 'ATTENTION'
                            ? 'rgba(217, 119, 6, 0.1)'
                            : 'rgba(220, 38, 38, 0.1)',
                        color:
                          r.status === 'COMPLIANT'
                            ? '#16a34a'
                            : r.status === 'ATTENTION'
                            ? '#d97706'
                            : '#dc2626',
                        border: '1px solid currentColor',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="cards-mobile-view">
          {deptAuditMatrix.map((r, idx) => (
            <div key={r.id} className="mobile-data-card">
              <div className="mobile-card-row">
                <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: '0.9rem' }}>
                  #{idx + 1} {r.name}
                </span>
                <span
                  className="badge"
                  style={{
                    background:
                      r.status === 'COMPLIANT'
                        ? 'rgba(22, 163, 74, 0.1)'
                        : r.status === 'ATTENTION'
                        ? 'rgba(217, 119, 6, 0.1)'
                        : 'rgba(220, 38, 38, 0.1)',
                    color:
                      r.status === 'COMPLIANT'
                        ? '#16a34a'
                        : r.status === 'ATTENTION'
                        ? '#d97706'
                        : '#dc2626',
                    border: '1px solid currentColor',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                  }}
                >
                  {r.status}
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Resolution Rate</span>
                <span className="mobile-card-val" style={{ color: r.complianceRate >= 80 ? '#16a34a' : '#d97706' }}>
                  {r.complianceRate}% ({r.closed} of {r.total})
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Open Hazards</span>
                <span className="mobile-card-val" style={{ color: r.open > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                  {r.open}
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Workers Trained</span>
                <span className="mobile-card-val">{r.trained}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Filtered Observation Log */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
            Audit Hazard Observations ({filteredObservations.length})
          </h3>
        </div>

        {filteredObservations.length === 0 ? (
          <div className="ehs-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hazard observations match current filter criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-container table-desktop-view">
              <table className="ehs-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Sr No</th>
                    <th>Department & Area</th>
                    <th>Hazard Observation</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredObservations.map((obs, idx) => (
                    <tr key={obs.id}>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{obs.department?.name || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{obs.area}</div>
                      </td>
                      <td style={{ maxWidth: '320px' }}>
                        <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {obs.observation_text}
                        </div>
                      </td>
                      <td>
                        <PriorityBadge priority={obs.priority} />
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {obs.due_date ? formatISTDate(obs.due_date) : '—'}
                      </td>
                      <td>
                        <ObservationStatusBadge status={obs.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="cards-mobile-view">
              {filteredObservations.map((obs, idx) => (
                <div key={obs.id} className="mobile-data-card">
                  <div className="mobile-card-row">
                    <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: '0.85rem' }}>
                      #{idx + 1} • {obs.department?.name || 'Plant'}
                    </span>
                    <ObservationStatusBadge status={obs.status} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {obs.observation_text}
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Area</span>
                    <span className="mobile-card-val">{obs.area}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Priority</span>
                    <PriorityBadge priority={obs.priority} />
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Target Date</span>
                    <span className="mobile-card-val">{obs.due_date ? formatISTDate(obs.due_date) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
