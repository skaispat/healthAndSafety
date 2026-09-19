import React, { useState, useEffect } from 'react';
import { Task, Department } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { TaskDetailModal } from '../../components/tasks/TaskDetailModal';
import { CreateOfficerTaskModal } from '../../components/tasks/CreateOfficerTaskModal';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Search,
  PlusCircle,
  Eye,
} from 'lucide-react';
import { formatISTDate } from '../../utils/dateUtils';

export const MyTasksPage: React.FC = () => {
  const { currentUser, isOfficer, isUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tasks and counts
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasksCount, setAllTasksCount] = useState(0);
  const [userAssignedCount, setUserAssignedCount] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Officer scope: 'MINE' (Assigned to Myself) | 'ALL' (All Plant Tasks)
  const [officerScope, setOfficerScope] = useState<'MINE' | 'ALL'>('MINE');

  // Modals & Selection
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Filters
  const currentFilter = searchParams.get('filter') || 'ALL';
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const currentEmpId = Number(currentUser?.emp_id || currentUser?.id || 0);
  const isUserRole = isUser;

  const loadData = async () => {
    if (!currentUser) return;

    const [all, depts] = await Promise.all([
      DataService.getTasks(),
      DataService.getDepartments(),
    ]);

    setDepartments(depts);

    // Filter tasks strictly by assigned_to ID matching the logged-in user's emp_id
    const userOnlyTasks = all.filter((t) => {
      const assignedToNum = Number(t.assigned_to ?? t.observation?.assigned_to ?? t.assignee?.emp_id);
      return assignedToNum === currentEmpId;
    });

    setAllTasksCount(all.length);
    setUserAssignedCount(userOnlyTasks.length);

    // If role is employee, show only tasks assigned to them.
    // If officer, show their assigned tasks ('MINE') or all tasks ('ALL').
    const scopedTasks = isUserRole ? userOnlyTasks : (officerScope === 'MINE' ? userOnlyTasks : all);
    setTasks(scopedTasks);

    const paramTaskId = searchParams.get('taskId');
    if (paramTaskId) {
      const match = scopedTasks.find((t) => t.id === paramTaskId || t.task_number === paramTaskId);
      if (match) setSelectedTask(match);
    }
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, [currentUser, searchParams, officerScope, isUserRole]);

  const setFilter = (filter: string) => {
    setSearchParams({ filter });
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      searchQuery === '' ||
      (task.task_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.observation?.observation_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.observation?.area || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.observation?.department?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || task.observation?.department?.name === deptFilter;

    const isPastDue = new Date(task.due_date).getTime() < Date.now();
    const isOverdue = isPastDue && task.status !== 'COMPLETED' && task.status !== 'CLOSED';
    const isCompleted = task.status === 'COMPLETED' || task.status === 'CLOSED';

    if (!matchesSearch || !matchesDept) return false;
    if (currentFilter === 'ALL') return true;
    if (currentFilter === 'ACTIVE') return (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS' || task.status === 'OPEN') && !isOverdue;
    if (currentFilter === 'REWORK_REQUIRED') return task.status === 'REWORK_REQUIRED';
    if (currentFilter === 'SUBMITTED_FOR_REVIEW') return task.status === 'SUBMITTED_FOR_REVIEW';
    if (currentFilter === 'OVERDUE') return isOverdue;
    if (currentFilter === 'COMPLETED') return isCompleted;
    return true;
  });

  const filterTabs = [
    { key: 'ALL', label: 'All Tasks', dotColor: '#64748b', count: tasks.length },
    { key: 'ACTIVE', label: 'Active', dotColor: '#0284c7', count: tasks.filter((t) => (t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'OPEN') && !(new Date(t.due_date).getTime() < Date.now())).length },
    { key: 'REWORK_REQUIRED', label: 'Rework Required', dotColor: '#f97316', count: tasks.filter((t) => t.status === 'REWORK_REQUIRED').length },
    { key: 'SUBMITTED_FOR_REVIEW', label: 'Awaiting Review', dotColor: '#f59e0b', count: tasks.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW').length },
    { key: 'OVERDUE', label: 'Overdue', dotColor: '#ef4444', count: tasks.filter((t) => (t.status === 'OVERDUE' || (new Date(t.due_date).getTime() < Date.now() && t.status !== 'COMPLETED' && t.status !== 'CLOSED'))).length },
    { key: 'COMPLETED', label: 'Completed', dotColor: '#10b981', count: tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length },
  ];

  return (
    <div className="page-wrapper">
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {!isUserRole ? 'Officer Tasks' : 'My Assigned Tasks'}
            </h2>
            <span
              className="badge badge-assigned"
              style={{ fontSize: '0.725rem', padding: '2px 9px', borderRadius: '999px', fontWeight: 700 }}
            >
              Emp ID: {currentEmpId}
            </span>
          </div>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Add Task Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={16} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Stage Filter Tabs */}
      <div className="stage-tabs-container">
        {filterTabs.map((tab) => {
          const isActive = currentFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
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

      {/* Search & Department Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search task number, area, observation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Department Filter */}
        <div style={{ width: '180px' }}>
          <select
            className="form-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.dept_id || d.id} value={d.name || d.dept_name}>
                {d.name || d.dept_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table View */}
      {filteredTasks.length === 0 ? (
        <div className="ehs-card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
            No tasks found
          </h4>
          <p style={{ fontSize: '0.82rem', marginBottom: '14px' }}>
            No tasks in this category.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={15} />
            <span>Add Task</span>
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="ehs-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Sr No</th>
                <th>Observation & Task</th>
                <th>Department & Area</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, index) => {
                const isPastDue = new Date(task.due_date).getTime() < Date.now();
                const isOverdue = isPastDue && task.status !== 'COMPLETED' && task.status !== 'CLOSED';

                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      cursor: 'pointer',
                      background: isOverdue ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    }}
                  >
                    {/* Sr No */}
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isOverdue && <AlertTriangle size={14} color="#ef4444" />}
                        <span>{index + 1}</span>
                      </div>
                    </td>

                    {/* Observation & Task */}
                    <td style={{ maxWidth: '320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {(() => {
                          const obsPhotos = task.observation?.photos || (task.observation as any)?.all_photos || task.photos || [];
                          const p = obsPhotos[0];
                          const thumbUrl = p ? (p.photo_url || p.url || (typeof p === 'string' ? p : null)) : null;
                          if (!thumbUrl) return null;
                          return (
                            <img
                              src={thumbUrl}
                              alt="Observation Thumbnail"
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '6px',
                                objectFit: 'cover',
                                flexShrink: 0,
                                border: '1px solid var(--border-subtle)',
                              }}
                            />
                          );
                        })()}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.observation?.observation_text?.split('\n')[0] || task.observation?.area || 'Safety Task'}
                          </div>
                          {task.observation?.observation_text && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.observation.observation_text}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Department & Area */}
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {task.observation?.department?.name || 'Plant'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {task.observation?.area || 'Plant Site'}
                      </div>
                    </td>

                    {/* Priority */}
                    <td>
                      <PriorityBadge priority={task.observation?.priority || 'MEDIUM'} showRisk={false} />
                    </td>

                    {/* Due Date */}
                    <td style={{ fontSize: '0.8rem', color: isOverdue ? '#ef4444' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: isOverdue ? 700 : 500 }}>
                      {formatISTDate(task.due_date)}
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={task.status} />
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontWeight: 700 }}
                      >
                        View / Update →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateOfficerTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={loadData}
      />

      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={loadData}
      />
    </div>
  );
};
