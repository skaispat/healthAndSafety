import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { Observation, Task, Department, TrainingRecord, TaskHistory } from '../../types/database';
import { StatCard } from '../../components/dashboard/StatCard';
import { ChartSection } from '../../components/dashboard/ChartSection';
import { ActivityFeed } from '../../components/dashboard/ActivityFeed';
import { CreateObservationModal } from '../../components/observations/CreateObservationModal';
import { PersonalObservationModal } from '../../components/observations/PersonalObservationModal';
import { CreateTrainingModal } from '../../components/training/CreateTrainingModal';
import { TaskDetailModal } from '../../components/tasks/TaskDetailModal';
import { TaskCard } from '../../components/tasks/TaskCard';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  CheckSquare,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Users,
  ShieldAlert,
  PlusCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { currentUser, isOfficer } = useAuth();
  const navigate = useNavigate();

  const [observations, setObservations] = useState<Observation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateObs, setShowCreateObs] = useState(false);
  const [showPersonalObs, setShowPersonalObs] = useState(false);
  const [showCreateTraining, setShowCreateTraining] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const loadData = async () => {
    try {
      const [obsList, taskList, deptList, trainList] = await Promise.all([
        DataService.getObservations(),
        DataService.getTasks(),
        DataService.getDepartments(),
        DataService.getTrainingRecords(),
      ]);

      setObservations(obsList);
      setTasks(taskList);
      setDepartments(deptList);
      setTrainings(trainList);

      // Collect all history items
      const allHistory = taskList.flatMap((t) => t.history || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setHistory(allHistory);

      if (isOfficer) {
        const officerStats = await DataService.getOfficerDashboardStats();
        setStats(officerStats);
      } else if (currentUser) {
        const empStats = await DataService.getEmployeeDashboardStats(currentUser.emp_id || currentUser.id);
        setStats(empStats);
      }
    } catch (err) {
      console.error('Error loading dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDataChanges(() => {
      loadData();
    });
    return unsubscribe;
  }, [currentUser, isOfficer]);

  if (loading) {
    return (
      <div className="page-wrapper" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <Clock size={32} style={{ margin: '0 auto 12px', animation: 'spin 1.5s linear infinite' }} />
        <p>Loading Health & Safety Metrics...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // OFFICER DASHBOARD
  if (isOfficer) {
    return (
      <div className="page-wrapper">
        {/* Officer Welcome & Quick Actions */}
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
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Health & Safety Dashboard
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
              Realtime workplace hazard monitoring, corrective actions, and regulatory audit compliance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* <button className="btn btn-outline btn-sm" onClick={() => setShowPersonalObs(true)}>
              <Sparkles size={16} color="var(--brand-primary)" />
              Personal Observation
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowCreateTraining(true)}>
              <GraduationCap size={16} color="#38bdf8" />
              Log Training
            </button> */}
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateObs(true)}>
              <PlusCircle size={16} />
              Create Observation & Assign Task
            </button>
          </div>
        </div>

        {/* 1. Primary KPI Stats Cards */}
        <div className="grid-dashboard-kpi">
          <StatCard
            title="Total Observations"
            value={stats.totalObservations || 0}
            subtitle={`${stats.openObservations || 0} Open • ${stats.closedObservations || 0} Closed`}
            icon={<Eye size={20} />}
            accentColor="#b91c1c"
            onClick={() => navigate('/observations')}
          />
          <StatCard
            title="Active Tasks"
            value={stats.activeTasks || 0}
            subtitle="In progress / assigned"
            icon={<CheckSquare size={20} />}
            accentColor="#38bdf8"
            onClick={() => navigate('/observations?status=PENDING')}
          />
          <StatCard
            title="Awaiting Review"
            value={stats.awaitingReview || 0}
            subtitle="Pending officer inspection"
            icon={<Clock size={20} />}
            accentColor="#fbbf24"
            onClick={() => navigate('/observations?status=SUBMITTED_FOR_REVIEW')}
          />
          <StatCard
            title="Rework Required"
            value={stats.reworkRequired || 0}
            subtitle="Sent back for correction"
            icon={<RotateCcw size={20} />}
            accentColor="#f97316"
            onClick={() => navigate('/observations?status=REWORK_REQUIRED')}
          />
          <StatCard
            title="Overdue Tasks"
            value={stats.overdueTasks || 0}
            subtitle="Immediate escalation required"
            icon={<AlertTriangle size={20} />}
            accentColor="#ef4444"
            onClick={() => navigate('/observations?status=OVERDUE')}
          />
          <StatCard
            title="High Risk Hazards"
            value={stats.highRisk || 0}
            subtitle="Auto-assessed 6% – 9%"
            icon={<ShieldAlert size={20} />}
            accentColor="#ef4444"
          />
          <StatCard
            title="Completed Tasks"
            value={stats.completedTasks || 0}
            subtitle="Verified by safety officer"
            icon={<CheckCircle2 size={20} />}
            accentColor="#10b981"
            onClick={() => navigate('/observations?status=COMPLETED')}
          />
          <StatCard
            title="Safety Training"
            value={stats.trainingSessions || 0}
            subtitle={`${stats.peopleTrained || 0} Workers Certified`}
            icon={<GraduationCap size={20} />}
            accentColor="#8b5cf6"
            onClick={() => navigate('/training')}
          />
        </div>

        {/* 2. Charts Section */}
        <ChartSection
          observations={observations}
          tasks={tasks}
          departments={departments}
        />

        {/* 3. Operational Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '24px' }}>
          {/* Urgent Tasks Queue */}
          <div className="ehs-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#ef4444" />
                Tasks Requiring Attention ({tasks.filter((t) => t.status === 'OVERDUE' || t.status === 'SUBMITTED_FOR_REVIEW').length})
              </h4>
              <button
                className="btn-ghost"
                onClick={() => navigate('/observations?status=OVERDUE')}
                style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', padding: '2px 6px' }}
              >
                View all <ArrowRight size={13} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tasks
                .filter((t) => t.status === 'OVERDUE' || t.status === 'SUBMITTED_FOR_REVIEW' || t.status === 'REWORK_REQUIRED')
                .slice(0, 5)
                .map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: '0.85rem' }}>
                          {task.task_number}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          • {task.observation?.area}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        Assignee: <strong style={{ color: 'var(--brand-secondary)' }}>{task.assignee?.full_name}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        className={`badge ${task.status === 'OVERDUE'
                          ? 'badge-overdue'
                          : task.status === 'SUBMITTED_FOR_REVIEW'
                            ? 'badge-submitted-review'
                            : 'badge-rework-required'
                          }`}
                      >
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Activity Feed */}
          <ActivityFeed
            activities={history}
            onSelectTask={async (taskId) => {
              const t = await DataService.getTaskById(taskId);
              if (t) setSelectedTask(t);
            }}
          />
        </div>

        {/* Modals */}
        <CreateObservationModal
          isOpen={showCreateObs}
          onClose={() => setShowCreateObs(false)}
          onCreated={loadData}
        />
        <PersonalObservationModal
          isOpen={showPersonalObs}
          onClose={() => setShowPersonalObs(false)}
          onCreated={loadData}
        />
        <CreateTrainingModal
          isOpen={showCreateTraining}
          onClose={() => setShowCreateTraining(false)}
          onCreated={loadData}
        />
        <TaskDetailModal
          task={selectedTask}
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={loadData}
        />
      </div>
    );
  }

  // EMPLOYEE DASHBOARD
  const currentEmpId = Number(currentUser?.emp_id || currentUser?.id || 0);
  const myTasks = tasks.filter((t) => {
    const assignedToNum = Number(t.assigned_to ?? t.observation?.assigned_to ?? t.assignee?.emp_id);
    return assignedToNum === currentEmpId;
  });

  return (
    <div className="page-wrapper">
      {/* Employee Welcome */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Employee Safety Portal</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          Welcome, {currentUser?.full_name}. View assigned safety work orders and submit corrective evidence.
        </p>
      </div>

      {/* Employee KPI Cards */}
      <div className="grid-dashboard-kpi">
        <StatCard
          title="My Active Tasks"
          value={stats.activeTasks || 0}
          subtitle="Assigned or in progress"
          icon={<CheckSquare size={20} />}
          accentColor="#38bdf8"
          onClick={() => navigate('/my-tasks?filter=ACTIVE')}
        />
        <StatCard
          title="Rework Required"
          value={stats.reworkRequired || 0}
          subtitle="Officer requested adjustments"
          icon={<RotateCcw size={20} />}
          accentColor="#f97316"
          onClick={() => navigate('/my-tasks?filter=REWORK_REQUIRED')}
        />
        <StatCard
          title="Awaiting Review"
          value={stats.awaitingReview || 0}
          subtitle="Submitted for officer verification"
          icon={<Clock size={20} />}
          accentColor="#fbbf24"
          onClick={() => navigate('/my-tasks?filter=SUBMITTED_FOR_REVIEW')}
        />
        <StatCard
          title="Overdue Tasks"
          value={stats.overdue || 0}
          subtitle="Action immediately"
          icon={<AlertTriangle size={20} />}
          accentColor="#ef4444"
          onClick={() => navigate('/my-tasks?filter=OVERDUE')}
        />
        <StatCard
          title="Completed Tasks"
          value={stats.completed || 0}
          subtitle="Satisfied and closed"
          icon={<CheckCircle2 size={20} />}
          accentColor="#10b981"
          onClick={() => navigate('/my-tasks?filter=COMPLETED')}
        />
      </div>

      {/* Task List Grid for Employee */}
      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>My Assigned Tasks ({myTasks.length})</h3>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/my-tasks')}>
            View in Table
          </button>
        </div>

        {myTasks.length === 0 ? (
          <div className="ehs-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>No pending safety tasks assigned to you.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>All safe and compliant!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {myTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={(t) => setSelectedTask(t)}
              />
            ))}
          </div>
        )}
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
