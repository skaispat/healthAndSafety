import React, { useState, useEffect } from 'react';
import { Task, Department, TaskStatus } from '../../types/database';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { TaskDetailModal } from '../../components/tasks/TaskDetailModal';
import { useSearchParams, useLocation } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Eye, 
  Building2, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckSquare
} from 'lucide-react';
import { formatISTDate } from '../../utils/dateUtils';

export const AllTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const getInitialStatus = () => {
    const q = searchParams.get('status');
    if (q) return q;
    if (location.pathname.endsWith('/rework')) return 'REWORK_REQUIRED';
    if (location.pathname.endsWith('/overdue')) return 'OVERDUE';
    if (location.pathname.endsWith('/completed')) return 'COMPLETED';
    if (location.pathname.endsWith('/awaiting-review')) return 'SUBMITTED_FOR_REVIEW';
    return 'ALL';
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(getInitialStatus);
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Modals
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const loadData = async () => {
    const [taskList, deptList] = await Promise.all([
      DataService.getTasks(),
      DataService.getDepartments(),
    ]);
    setTasks(taskList);
    setDepartments(deptList);

    // If query param taskId exists, open modal
    const paramTaskId = searchParams.get('taskId');
    if (paramTaskId) {
      const match = taskList.find((t) => t.id === paramTaskId);
      if (match) setSelectedTask(match);
    }
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, [searchParams]);

  useEffect(() => {
    setStatusFilter(getInitialStatus());
  }, [searchParams, location.pathname]);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      searchQuery === '' ||
      task.task_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.observation?.observation_text && task.observation.observation_text.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.assignee?.full_name && task.assignee.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.observation?.area && task.observation.area.toLowerCase().includes(searchQuery.toLowerCase()));

    const isCompleted = task.status === 'COMPLETED' || task.status === 'CLOSED';
    const isReview = task.status === 'SUBMITTED_FOR_REVIEW';
    const isRework = task.status === 'REWORK_REQUIRED';
    const isPastDue = task.due_date ? new Date(task.due_date).getTime() < Date.now() : false;
    const isOverdue = (task.status === 'OVERDUE' || isPastDue) && !isCompleted && !isReview;
    const isActive = !isCompleted && !isOverdue && !isReview && !isRework;

    let matchesStatus = true;
    if (statusFilter === 'ALL') {
      matchesStatus = true;
    } else if (statusFilter === 'ACTIVE') {
      matchesStatus = isActive;
    } else if (statusFilter === 'SUBMITTED_FOR_REVIEW') {
      matchesStatus = isReview;
    } else if (statusFilter === 'REWORK_REQUIRED') {
      matchesStatus = isRework;
    } else if (statusFilter === 'OVERDUE') {
      matchesStatus = isOverdue;
    } else if (statusFilter === 'COMPLETED') {
      matchesStatus = isCompleted;
    } else {
      matchesStatus = task.status === statusFilter;
    }

    const taskDeptId = task.observation?.dept_id || (task.observation as any)?.department_id;
    const matchesDept = deptFilter === 'ALL' || String(taskDeptId) === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  // Base list for counting rows in each stage (reflects search and dept)
  const baseForStages = tasks.filter((task) => {
    const matchesSearch =
      searchQuery === '' ||
      task.task_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.observation?.observation_text && task.observation.observation_text.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.assignee?.full_name && task.assignee.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.observation?.area && task.observation.area.toLowerCase().includes(searchQuery.toLowerCase()));
    const taskDeptId = task.observation?.dept_id || (task.observation as any)?.department_id;
    const matchesDept = deptFilter === 'ALL' || String(taskDeptId) === deptFilter;
    return matchesSearch && matchesDept;
  });

  const stageTabs = [
    {
      key: 'ALL',
      label: 'All Tasks',
      dotColor: '#64748b',
      count: baseForStages.length,
    },
    {
      key: 'ACTIVE',
      label: 'Active / Pending',
      dotColor: '#0284c7',
      count: baseForStages.filter((t) => {
        const isCompleted = t.status === 'COMPLETED' || t.status === 'CLOSED';
        const isReview = t.status === 'SUBMITTED_FOR_REVIEW';
        const isRework = t.status === 'REWORK_REQUIRED';
        const isPastDue = t.due_date ? new Date(t.due_date).getTime() < Date.now() : false;
        const isOverdue = (t.status === 'OVERDUE' || isPastDue) && !isCompleted && !isReview;
        return !isCompleted && !isOverdue && !isReview && !isRework;
      }).length,
    },
    {
      key: 'SUBMITTED_FOR_REVIEW',
      label: 'Awaiting Review',
      dotColor: '#f59e0b',
      count: baseForStages.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW').length,
    },
    {
      key: 'REWORK_REQUIRED',
      label: 'Rework Required',
      dotColor: '#f97316',
      count: baseForStages.filter((t) => t.status === 'REWORK_REQUIRED').length,
    },
    {
      key: 'OVERDUE',
      label: 'Overdue',
      dotColor: '#ef4444',
      count: baseForStages.filter((t) => {
        const isCompleted = t.status === 'COMPLETED' || t.status === 'CLOSED';
        const isReview = t.status === 'SUBMITTED_FOR_REVIEW';
        const isPastDue = t.due_date ? new Date(t.due_date).getTime() < Date.now() : false;
        return (t.status === 'OVERDUE' || isPastDue) && !isCompleted && !isReview;
      }).length,
    },
    {
      key: 'COMPLETED',
      label: 'Completed',
      dotColor: '#10b981',
      count: baseForStages.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length,
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
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>All Safety Tasks & Work Orders</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          Realtime status oversight, infinite rework tracking, and employee submission verification.
        </p>
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

      {/* Filter bar */}
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
            placeholder="Search Task ID, employee, description, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Department Filter */}
        <div style={{ flex: '1 1 180px' }}>
          <select
            className="form-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.dept_id || d.id} value={String(d.dept_id || d.id)}>
                {d.name || d.dept_name}
              </option>
            ))}
          </select>
        </div>
      </div>


      {/* Task Table */}
      <div className="table-container">
        <table className="ehs-table">
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Hazard & Location</th>
              <th>Priority / Risk</th>
              <th>Primary Assignee</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No tasks match current filters.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => {
                const obs = task.observation;
                const isOverdue =
                  task.status === 'OVERDUE' ||
                  (new Date(task.due_date).getTime() < Date.now() && task.status !== 'COMPLETED');

                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      cursor: 'pointer',
                      background: isOverdue ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isOverdue && <AlertTriangle size={14} color="#ef4444" />}
                        {task.task_number}
                      </div>
                    </td>

                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {obs?.observation_text}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {obs?.department?.name} • {obs?.area}
                      </div>
                    </td>

                    <td>{obs && <PriorityBadge priority={obs.priority} />}</td>

                    <td>
                      <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem' }}>
                        {task.assignee?.full_name}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {task.assignee?.employee_id}
                      </div>
                    </td>

                    <td style={{ fontSize: '0.8rem', color: isOverdue ? 'var(--hazard-high)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: isOverdue ? 700 : 400 }}>
                      {formatISTDate(task.due_date)}
                    </td>

                    <td>
                      <StatusBadge status={task.status} />
                    </td>

                    <td>
                      <button
                        className="btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        style={{ color: 'var(--text-secondary)', padding: '6px' }}
                        title="View Task Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={loadData}
      />
    </div>
  );
};
