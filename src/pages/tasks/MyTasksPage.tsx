import React, { useState, useEffect } from 'react';
import { Task, Department } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { TaskDetailModal } from '../../components/tasks/TaskDetailModal';
import { CreateOfficerTaskModal } from '../../components/tasks/CreateOfficerTaskModal';
import { ImagePreviewModal } from '../../components/common/ImagePreviewModal';
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
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { formatISTDate } from '../../utils/dateUtils';

export const MyTasksPage: React.FC = () => {
  const { currentUser, isOfficer, isUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Loading state
  const [loading, setLoading] = useState(true);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Image Preview Modal state
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    badgeText?: string;
    badgeBg?: string;
    badgeColor?: string;
  } | null>(null);

  // Modals & Selection
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Filters
  const currentFilter = searchParams.get('filter') || 'ALL';
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const currentEmpId = Number(currentUser?.emp_id || currentUser?.id || 0);
  const isSafetyOfficerOrAdmin = Boolean(
    isOfficer ||
    (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY') ||
    (currentUser?.role && currentUser.role.toUpperCase() === 'HEALTH_SAFETY_OFFICER') ||
    (currentUser?.role && currentUser.role.toLowerCase() === 'admin') ||
    (currentUser?.username && currentUser.username.toLowerCase() === 'admin')
  );
  const isUserRole = !isSafetyOfficerOrAdmin;

  const getTaskPhotosInfo = (task: Task) => {
    const obs = task.observation;
    const rawPool: any[] = [
      ...(obs?.all_photos || []),
      ...(task.all_photos || []),
      ...(obs?.photos || []),
      ...(task.initial_photos || []),
      ...(task.photos || []),
      ...((task as any).photos || []),
    ];
    const uniquePoolMap = new Map<string, any>();
    rawPool.forEach((p: any) => {
      const url = typeof p === 'string' ? p : (p.photo_url || p.url);
      if (url && !uniquePoolMap.has(url)) {
        uniquePoolMap.set(url, {
          ...(typeof p === 'object' ? p : {}),
          photo_url: url,
          url: url,
          file_name: (typeof p === 'object' ? (p.file_name || p.name) : '') || 'Photo',
          photo_type: (typeof p === 'object' && p.photo_type) ? p.photo_type : 'INITIAL',
        });
      }
    });
    const allUniquePhotos = Array.from(uniquePoolMap.values());

    const beforePhotos = allUniquePhotos.filter((p: any) => {
      if (p.photo_type === 'INITIAL') return true;
      if (p.photo_type === 'CORRECTIVE') return false;
      return true;
    });

    const afterPhotosMap = new Map<string, any>();
    (task.corrective_actions || (obs as any)?.corrective_actions || []).forEach((ca: any) => {
      (ca.photos || []).forEach((p: any) => {
        const url = typeof p === 'string' ? p : (p.photo_url || p.url);
        if (url && !afterPhotosMap.has(url)) {
          afterPhotosMap.set(url, {
            photo_url: url,
            url: url,
            file_name: (typeof p === 'object' ? (p.file_name || p.name) : '') || 'Proof Photo',
          });
        }
      });
    });

    allUniquePhotos.forEach((p: any) => {
      const url = p.photo_url || p.url;
      if (!url) return;
      if (p.photo_type === 'CORRECTIVE') {
        if (!afterPhotosMap.has(url)) {
          afterPhotosMap.set(url, {
            photo_url: url,
            url: url,
            file_name: p.file_name || 'Proof Photo',
          });
        }
      }
    });

    const afterPhotos = Array.from(afterPhotosMap.values());

    const beforeUrl = beforePhotos[0]?.photo_url || beforePhotos[0]?.url || null;
    const afterUrl = afterPhotos[0]?.photo_url || afterPhotos[0]?.url || null;
    const isCompleted = task.status === 'COMPLETED' || task.status === 'CLOSED';
    const isPendingReview = task.status === 'SUBMITTED_FOR_REVIEW';

    return {
      beforeUrl,
      afterUrl,
      beforeCount: beforePhotos.length,
      afterCount: afterPhotos.length,
      isCompleted,
      isPendingReview,
    };
  };

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const [all, depts] = await Promise.all([
        DataService.getTasks(),
        DataService.getDepartments(),
      ]);

      setDepartments(depts);

      // Filter tasks strictly for current user across all roles (Employee, Safety Officer, Admin):
      // Shows only tasks assigned to the user or logged by the user
      const userOnlyTasks = all.filter((t) => {
        // 1. Assignee check (tasks assigned to current user)
        const assignedToRaw = t.assigned_to ?? t.observation?.assigned_to ?? t.assignee?.emp_id ?? (t.assignee as any)?.id;
        const assignedToNum = assignedToRaw !== undefined && assignedToRaw !== null && assignedToRaw !== '' ? Number(assignedToRaw) : null;
        const assignedToStr = assignedToRaw !== undefined && assignedToRaw !== null ? String(assignedToRaw).trim() : '';

        const isAssignedToMe = Boolean(
          (currentEmpId && assignedToNum !== null && assignedToNum === currentEmpId) ||
          (currentUser?.emp_id && assignedToStr === String(currentUser.emp_id).trim()) ||
          (currentUser?.id && assignedToStr === String(currentUser.id).trim()) ||
          (currentUser?.username && t.assignee?.username && t.assignee.username.toLowerCase() === currentUser.username.toLowerCase())
        );

        // 2. Creator check (tasks logged / created by current user)
        const creatorRaw = t.assigned_by ?? t.observation?.created_by ?? t.assigner?.emp_id ?? (t.assigner as any)?.id;
        const creatorNum = creatorRaw !== undefined && creatorRaw !== null && creatorRaw !== '' ? Number(creatorRaw) : null;
        const creatorStr = creatorRaw !== undefined && creatorRaw !== null ? String(creatorRaw).trim() : '';

        const isLoggedByMe = Boolean(
          (currentEmpId && creatorNum !== null && creatorNum === currentEmpId) ||
          (currentUser?.emp_id && creatorStr === String(currentUser.emp_id).trim()) ||
          (currentUser?.id && creatorStr === String(currentUser.id).trim()) ||
          (currentUser?.username && t.assigner?.username && t.assigner.username.toLowerCase() === currentUser.username.toLowerCase())
        );

        // 3. Participant check
        const isParticipant = Boolean(
          t.participants?.some((p) => 
            (currentEmpId && Number(p.user_id) === currentEmpId) ||
            (currentUser?.emp_id && String(p.user_id).trim() === String(currentUser.emp_id).trim()) ||
            (currentUser?.id && String(p.user_id).trim() === String(currentUser.id).trim())
          )
        );

        // 4. Corrective work submitted by me
        const submittedByMe = Boolean(
          t.corrective_actions?.some((ca: any) => 
            (currentEmpId && Number(ca.submitted_by) === currentEmpId) ||
            (currentUser?.emp_id && String(ca.submitted_by).trim() === String(currentUser.emp_id).trim()) ||
            (currentUser?.id && String(ca.submitted_by).trim() === String(currentUser.id).trim())
          )
        );

        // Strictly exclude tasks solely approved by admin/officer:
        // Do NOT match by t.completed_by because that records the verifier/approver,
        // which previously caused all approved tasks in the organization to flood an admin's My Tasks list.
        return isAssignedToMe || isLoggedByMe || isParticipant || submittedByMe;
      });

      // Show strictly only current user's assigned/self-assigned tasks
      setTasks(userOnlyTasks);

      const paramTaskId = searchParams.get('taskId');
      if (paramTaskId) {
        const match = userOnlyTasks.find((t) => t.id === paramTaskId || t.task_number === paramTaskId);
        if (match) setSelectedTask(match);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, [currentUser, searchParams]);

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
    { key: 'SUBMITTED_FOR_REVIEW', label: 'Pending Verification', dotColor: '#f59e0b', count: tasks.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW').length },
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
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              My Task
            </h2>
          </div>
        </div>

        {/* Top Actions: Add Task Button only for Safety Officer and Admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!isUserRole && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={16} />
              <span>Add Task</span>
            </button>
          )}
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
      {loading ? (
        <div
          className="ehs-card"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <Loader2 size={32} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>Loading Assigned Tasks...</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Fetching safety action items and progress</div>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="ehs-card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
            No tasks found
          </h4>
          <p style={{ fontSize: '0.82rem', marginBottom: '14px' }}>
            No tasks in this category.
          </p>
          {!isUserRole && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={15} />
              <span>Add Task</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="table-container table-desktop-view">
            <table className="ehs-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Sr No</th>
                  <th>Observation & Task</th>
                  {!isUserRole && (
                    <>
                      <th style={{ minWidth: '120px' }}>Before Image</th>
                      <th style={{ minWidth: '130px' }}>After Image</th>
                    </>
                  )}
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
                  const isPendingVerification = task.status === 'SUBMITTED_FOR_REVIEW';
                  const photoInfo = getTaskPhotosInfo(task);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      style={{
                        cursor: 'pointer',
                        background: isOverdue
                          ? 'rgba(239, 68, 68, 0.04)'
                          : (isPendingVerification ? 'rgba(245, 158, 11, 0.05)' : undefined),
                        borderLeft: isPendingVerification ? '4px solid #f59e0b' : undefined,
                      }}
                    >
                      {/* Sr No */}
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isOverdue && <AlertTriangle size={14} color="#ef4444" />}
                          <span>{task.task_number || task.observation?.observation_number || `SKAEHS/2026-27/OB-${String(index + 1).padStart(2, '0')}`}</span>
                        </div>
                      </td>

                      {/* Observation & Task */}
                      <td style={{ maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isUserRole && photoInfo.beforeUrl && (
                            <img
                              src={photoInfo.beforeUrl}
                              alt="Observation Thumbnail"
                              title="Hazard Photo (Click to preview)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage({
                                  url: photoInfo.beforeUrl!,
                                  title: `Observation Hazard Photo — ${task.task_number || task.observation?.observation_number || 'Task'}`,
                                  badgeText: 'BEFORE HAZARD',
                                  badgeBg: 'rgba(239, 68, 68, 0.15)',
                                  badgeColor: '#f87171',
                                });
                              }}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '6px',
                                objectFit: 'cover',
                                flexShrink: 0,
                                cursor: 'zoom-in',
                                border: '1px solid var(--border-subtle)',
                              }}
                            />
                          )}
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

                      {/* Before Image Column (Officer / Admin) */}
                      {!isUserRole && (
                        <td>
                          {photoInfo.beforeUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <img
                                src={photoInfo.beforeUrl}
                                alt="Before hazard condition"
                                title="Before condition (Click to view full photo)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage({
                                    url: photoInfo.beforeUrl!,
                                    title: `Before Hazard Condition — ${task.task_number || task.observation?.observation_number || 'Observation'}`,
                                    badgeText: 'BEFORE HAZARD',
                                    badgeBg: 'rgba(239, 68, 68, 0.15)',
                                    badgeColor: '#f87171',
                                  });
                                }}
                                style={{
                                  width: '42px',
                                  height: '42px',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                  cursor: 'zoom-in',
                                  border: '1px solid var(--border-subtle)',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: '#64748b',
                                  background: '#f1f5f9',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Before{photoInfo.beforeCount > 1 ? ` (+${photoInfo.beforeCount - 1})` : ''}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      )}

                      {/* After Image Column (Officer / Admin) */}
                      {!isUserRole && (
                        <td>
                          {photoInfo.afterUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <img
                                src={photoInfo.afterUrl}
                                alt={photoInfo.isCompleted ? 'After resolution' : 'After / Partial proof'}
                                title={photoInfo.isCompleted ? 'After resolution (Click to view)' : 'After / Partial work (Click to view)'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage({
                                    url: photoInfo.afterUrl!,
                                    title: photoInfo.isCompleted
                                      ? `After Resolution Proof — ${task.task_number || task.observation?.observation_number || 'Observation'}`
                                      : `After / Partial Correction — ${task.task_number || task.observation?.observation_number || 'Observation'}`,
                                    badgeText: photoInfo.isCompleted ? 'RESOLVED PROOF' : 'PARTIAL WORK',
                                    badgeBg: photoInfo.isCompleted ? 'rgba(22, 163, 74, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    badgeColor: photoInfo.isCompleted ? '#4ade80' : '#fbbf24',
                                  });
                                }}
                                style={{
                                  width: '42px',
                                  height: '42px',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                  cursor: 'zoom-in',
                                  border: photoInfo.isCompleted ? '1px solid #86efac' : '1px solid #fde047',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: photoInfo.isCompleted ? '#15803d' : photoInfo.isPendingReview ? '#4338ca' : '#b45309',
                                  background: photoInfo.isCompleted ? '#dcfce7' : photoInfo.isPendingReview ? '#e0e7ff' : '#fef3c7',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                After{photoInfo.afterCount > 1 ? ` (+${photoInfo.afterCount - 1})` : ''}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      )}

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
                        {!isUserRole && isPendingVerification ? (
                          <button
                            type="button"
                            className="btn btn-warning btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(task);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontWeight: 700,
                              padding: '4px 10px',
                              fontSize: '0.76rem',
                            }}
                          >
                            <ShieldCheck size={13} />
                            <span>Inspect & Verify →</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(task);
                            }}
                            style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontWeight: 700 }}
                          >
                            {!isUserRole ? 'View Details →' : 'Update Task →'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="cards-mobile-view">
            {filteredTasks.map((task, index) => {
              const isPastDue = new Date(task.due_date).getTime() < Date.now();
              const isOverdue = isPastDue && task.status !== 'COMPLETED' && task.status !== 'CLOSED';
              const isPendingVerification = task.status === 'SUBMITTED_FOR_REVIEW';

              return (
                <div
                  key={task.id}
                  className="mobile-data-card"
                  onClick={() => setSelectedTask(task)}
                  style={{
                    borderLeft: isPendingVerification
                      ? '4px solid #f59e0b'
                      : isOverdue
                        ? '4px solid #ef4444'
                        : undefined,
                    background: isPendingVerification
                      ? 'rgba(245, 158, 11, 0.03)'
                      : isOverdue
                        ? 'rgba(239, 68, 68, 0.03)'
                        : '#ffffff',
                  }}
                >
                  <div className="mobile-card-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isOverdue && <AlertTriangle size={15} color="#ef4444" />}
                      <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontSize: '0.88rem' }}>
                        #{index + 1} • {task.task_number || task.observation?.observation_number || `SKAEHS/2026-27/OB-${String(index + 1).padStart(2, '0')}`}
                      </span>
                      <PriorityBadge priority={task.observation?.priority || 'MEDIUM'} showRisk={false} />
                    </div>
                    <StatusBadge status={task.status} />
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                    {task.observation?.observation_text?.split('\n')[0] || task.observation?.area || 'Safety Task'}
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Department / Area</span>
                    <span className="mobile-card-val">
                      {task.observation?.department?.name || 'Plant'} • {task.observation?.area || 'Site'}
                    </span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Target Date</span>
                    <span
                      className="mobile-card-val"
                      style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)', fontWeight: isOverdue ? 700 : 500 }}
                    >
                      {formatISTDate(task.due_date)} {isOverdue ? '(Overdue)' : ''}
                    </span>
                  </div>

                  <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                    {!isUserRole && isPendingVerification ? (
                      <button
                        type="button"
                        className="btn btn-warning btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 700,
                          padding: '8px 12px',
                        }}
                      >
                        <ShieldCheck size={15} />
                        <span>Inspect & Verify →</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 700,
                          padding: '8px 12px',
                        }}
                      >
                        <span>{!isUserRole ? 'View Details →' : 'Update Task →'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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

      {/* Row Image Preview Lightbox Modal */}
      <ImagePreviewModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        badge={previewImage?.badgeText ? {
          text: previewImage.badgeText,
          bg: previewImage.badgeBg,
          color: previewImage.badgeColor,
        } : undefined}
      />
    </div>
  );
};
