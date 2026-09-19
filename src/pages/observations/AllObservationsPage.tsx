import React, { useState, useEffect } from 'react';
import { Observation, Department, Task } from '../../types/database';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PriorityBadge, ObservationStatusBadge } from '../../components/common/Badge';
import { PhotoGallery } from '../../components/common/PhotoGallery';
import { CreateObservationModal } from '../../components/observations/CreateObservationModal';
import { TaskDetailModal } from '../../components/tasks/TaskDetailModal';
import { Modal } from '../../components/common/Modal';
import { Search, PlusCircle, Eye, Building2, MapPin, Clock, Calendar, User, AlertCircle, Wrench, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatISTDateTime, formatISTDate } from '../../utils/dateUtils';

export const AllObservationsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter(urlStatus);
    } else {
      setStatusFilter('ALL');
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [obsList, deptList] = await Promise.all([
        DataService.getObservations(),
        DataService.getDepartments(),
      ]);
      setObservations(obsList);
      setDepartments(deptList);

      // Auto-open modal if specified in query params
      const paramObsId = searchParams.get('obsId');
      const paramTaskId = searchParams.get('taskId');
      if (paramObsId) {
        const match = obsList.find((o) => o.id === paramObsId || o.observation_number === paramObsId);
        if (match) openObsDetails(match);
      } else if (paramTaskId) {
        const match = obsList.find(
          (o) => o.id === paramTaskId || o.task?.id === paramTaskId || o.observation_number === paramTaskId || o.task?.task_number === paramTaskId
        );
        if (match) openObsDetails(match);
      }
    } catch (err) {
      console.error('Error loading observations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, []);

  const openObsDetails = (obs: Observation) => {
    if (obs.is_personal) {
      setSelectedObs(obs);
    } else {
      const taskForObs: Task = {
        ...(obs.task || {}),
        id: obs.id,
        task_number: obs.observation_number || obs.task?.task_number || `TASK-${obs.id.slice(0, 6)}`,
        observation_id: obs.id,
        assigned_to: Number(obs.assigned_to),
        assigned_by: Number(obs.created_by),
        status: obs.status as any,
        due_date: obs.due_date || obs.task?.due_date || new Date().toISOString(),
        created_at: obs.created_at,
        updated_at: obs.updated_at,
        assignee: obs.assignee || obs.task?.assignee,
        assigner: obs.creator || obs.task?.assigner,
        observation: obs,
        corrective_actions: obs.task?.corrective_actions || (obs as any).corrective_actions || [],
      };
      setSelectedTask(taskForObs);
    }
  };

  const filteredObservations = observations.filter((obs) => {
    const matchesSearch =
      searchQuery === '' ||
      (obs.observation_number && obs.observation_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      obs.observation_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obs.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (obs.department?.name && obs.department.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (obs.assignee?.full_name && obs.assignee.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = deptFilter === 'ALL' || String(obs.dept_id) === deptFilter;
    const matchesPriority = priorityFilter === 'ALL' || obs.priority === priorityFilter;

    // Stage & Status Filter Logic
    const isCompleted = obs.status === 'COMPLETED' || obs.status === 'CLOSED';
    const isPastDue = obs.due_date ? new Date(obs.due_date).getTime() < Date.now() : false;
    const isOverdue = (obs.status === 'OVERDUE' || isPastDue) && !isCompleted && obs.status !== 'SUBMITTED_FOR_REVIEW';

    let matchesStatus = true;
    if (statusFilter === 'ALL') {
      matchesStatus = true;
    } else if (statusFilter === 'SUBMITTED_FOR_REVIEW') {
      matchesStatus = obs.status === 'SUBMITTED_FOR_REVIEW';
    } else if (statusFilter === 'REWORK_REQUIRED') {
      matchesStatus = obs.status === 'REWORK_REQUIRED';
    } else if (statusFilter === 'PENDING') {
      matchesStatus = !isCompleted && !isOverdue && obs.status !== 'SUBMITTED_FOR_REVIEW' && obs.status !== 'REWORK_REQUIRED';
    } else if (statusFilter === 'COMPLETED') {
      matchesStatus = isCompleted;
    } else if (statusFilter === 'OVERDUE') {
      matchesStatus = isOverdue;
    } else {
      matchesStatus = obs.status === statusFilter;
    }

    return matchesSearch && matchesDept && matchesPriority && matchesStatus;
  });

  // Base list for counting rows in each stage (reflects search, dept, and priority)
  const baseForStages = observations.filter((obs) => {
    const matchesSearch =
      searchQuery === '' ||
      (obs.observation_number && obs.observation_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      obs.observation_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obs.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (obs.department?.name && obs.department.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (obs.assignee?.full_name && obs.assignee.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = deptFilter === 'ALL' || String(obs.dept_id) === deptFilter;
    const matchesPriority = priorityFilter === 'ALL' || obs.priority === priorityFilter;
    return matchesSearch && matchesDept && matchesPriority;
  });

  const stageTabs = [
    {
      key: 'ALL',
      label: 'All Stages',
      dotColor: '#64748b',
      count: baseForStages.length,
    },
    {
      key: 'SUBMITTED_FOR_REVIEW',
      label: 'Awaiting Review',
      dotColor: '#f59e0b',
      count: baseForStages.filter((o) => o.status === 'SUBMITTED_FOR_REVIEW').length,
    },
    {
      key: 'PENDING',
      label: 'Pending / Active',
      dotColor: '#0284c7',
      count: baseForStages.filter((o) => {
        const isCompleted = o.status === 'COMPLETED' || o.status === 'CLOSED';
        const isPastDue = o.due_date ? new Date(o.due_date).getTime() < Date.now() : false;
        const isOverdue = (o.status === 'OVERDUE' || isPastDue) && !isCompleted && o.status !== 'SUBMITTED_FOR_REVIEW';
        return !isCompleted && !isOverdue && o.status !== 'SUBMITTED_FOR_REVIEW' && o.status !== 'REWORK_REQUIRED';
      }).length,
    },
    {
      key: 'REWORK_REQUIRED',
      label: 'Rework Required',
      dotColor: '#f97316',
      count: baseForStages.filter((o) => o.status === 'REWORK_REQUIRED').length,
    },
    {
      key: 'OVERDUE',
      label: 'Overdue',
      dotColor: '#ef4444',
      count: baseForStages.filter((o) => {
        const isCompleted = o.status === 'COMPLETED' || o.status === 'CLOSED';
        const isPastDue = o.due_date ? new Date(o.due_date).getTime() < Date.now() : false;
        return (o.status === 'OVERDUE' || isPastDue) && !isCompleted && o.status !== 'SUBMITTED_FOR_REVIEW';
      }).length,
    },
    {
      key: 'COMPLETED',
      label: 'Completed',
      dotColor: '#10b981',
      count: baseForStages.filter((o) => o.status === 'COMPLETED' || o.status === 'CLOSED').length,
    },
  ];

  const handleStageSelect = (key: string) => {
    setStatusFilter(key);
    if (key === 'ALL') {
      searchParams.delete('status');
      setSearchParams(searchParams);
    } else {
      searchParams.set('status', key);
      setSearchParams(searchParams);
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
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Safety Observations & Tasks</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Comprehensive overview of industrial hazard reports, corrective assignments, and verification.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <PlusCircle size={18} />
          Create Observation
        </button>
      </div>

      {/* Stage Filter Tabs with Row Counts */}
      <div className="stage-tabs-container">
        {stageTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStageSelect(tab.key)}
              className={`stage-tab-btn ${isActive ? 'stage-tab-active' : ''}`}
            >
              <span
                className="stage-tab-dot"
                style={{ background: isActive ? '#ffffff' : tab.dotColor }}
              />
              <span>{tab.label}</span>
              <span className={`stage-tab-count ${isActive ? 'stage-tab-count-active' : ''}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
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
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search observation, area, employee, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Department Filter */}
        <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
          <select
            className="form-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.dept_id} value={String(d.dept_id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
          <select
            className="form-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>


      {/* Observations Table */}
      <div className="table-container">
        <table className="ehs-table">
          <thead>
            <tr>
              <th style={{ width: '70px' }}>Sr No</th>
              <th>Department & Area</th>
              <th>Safety Observation</th>
              <th>Priority & Risk</th>
              <th>Assignee</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredObservations.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No observations found matching current filters.
                </td>
              </tr>
            ) : (
              filteredObservations.map((obs, index) => {
                const isReviewNeeded = obs.status === 'SUBMITTED_FOR_REVIEW';

                return (
                  <tr
                    key={obs.id}
                    onClick={() => openObsDetails(obs)}
                    style={{
                      cursor: 'pointer',
                      background: isReviewNeeded ? 'rgba(245, 158, 11, 0.05)' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>
                      {index + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{obs.department?.name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{obs.area}</div>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {obs.observation_text}
                      </div>
                    </td>
                    <td>
                      <PriorityBadge priority={obs.priority} />
                    </td>
                    <td>
                      {obs.is_personal ? (
                        <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                          Personal Log
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--brand-secondary)', fontWeight: 600 }}>
                          {obs.assignee?.full_name || `Emp #${obs.assigned_to}`}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {obs.due_date ? formatISTDate(obs.due_date) : '—'}
                    </td>
                    <td>
                      <ObservationStatusBadge status={obs.status} />
                    </td>
                    <td>
                      {isReviewNeeded ? (
                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openObsDetails(obs);
                          }}
                          style={{
                            background: '#f59e0b',
                            borderColor: '#d97706',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 12px',
                          }}
                          title="Review submission and send OK or Resubmit"
                        >
                          <ShieldCheck size={14} />
                          <span>Review</span>
                        </button>
                      ) : (
                        <button
                          className="btn-outline btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openObsDetails(obs);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Task Detail & Admin Review Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={loadData}
      />

      {/* Personal Observation Detail View Modal */}
      {selectedObs && selectedObs.is_personal && (
        <Modal
          isOpen={Boolean(selectedObs)}
          onClose={() => setSelectedObs(null)}
          title={`Safety Observation ${selectedObs.observation_number || ''}`}
          subtitle={`Logged on ${formatISTDateTime(selectedObs.created_at)}`}
          size="lg"
        >
          {/* Status & Meta Tags Header */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <PriorityBadge priority={selectedObs.priority} />
            <ObservationStatusBadge status={selectedObs.status} />
            <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
              <Building2 size={12} />
              {selectedObs.department?.name}
            </span>
            <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
              <MapPin size={12} />
              Area: {selectedObs.area}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* SEQUENCE 1: HAZARD DESCRIPTION & DIRECTIVE */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Step 1: Observed Hazard & Unsafe Condition
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>
                {selectedObs.observation_text}
              </p>

              {selectedObs.solution_text && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Recommended Action Directive
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                    {selectedObs.solution_text}
                  </p>
                </div>
              )}
            </div>

            {/* SEQUENCE 2: TASK ASSIGNMENT & TARGET DUE DATE */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Step 2: Task Assignee
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.875rem' }}>
                  {selectedObs.assignee?.full_name || `Emp #${selectedObs.assigned_to}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Emp ID: {selectedObs.assigned_to}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Target Resolution Due Date
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', fontSize: '0.85rem' }}>
                  {selectedObs.due_date ? formatISTDateTime(selectedObs.due_date) : 'Not specified'}
                </div>
              </div>
            </div>

            {/* SEQUENCE 3: ATTACHED PHOTOS */}
            {selectedObs.photos && selectedObs.photos.length > 0 && (
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Step 3: Attached Photos ({selectedObs.photos.length})
                </div>
                <PhotoGallery photos={selectedObs.photos} />
              </div>
            )}

            {/* SEQUENCE 4: CORRECTIVE ACTION PROOF (IF RECORDED) */}
            {selectedObs.corrective_action && (
              <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1.5px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <Wrench size={14} />
                  <span>Step 4: Submitted Corrective Action</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1.5, margin: '6px 0 0 0' }}>
                  {selectedObs.corrective_action}
                </p>
              </div>
            )}

            {/* SEQUENCE 5: OFFICER REWORK / REFUSAL FEEDBACK (IF REWORK REQUIRED) */}
            {selectedObs.rework_reason && (
              <div style={{ padding: '14px', background: '#fff1f2', borderRadius: '8px', border: '1.5px solid #fecdd3' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e11d48', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <AlertCircle size={14} />
                  <span>Step 5: Officer Rework / Refusal Notes</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#881337', marginTop: '6px', lineHeight: 1.5, margin: '6px 0 0 0', fontWeight: 600 }}>
                  "{selectedObs.rework_reason}"
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create Observation Modal */}
      <CreateObservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadData}
      />
    </div>
  );
};

