import React, { useState, useEffect } from 'react';
import { Task } from '../../types/database';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PriorityBadge } from '../../components/common/Badge';
import { OfficerReviewModal } from '../../components/tasks/OfficerReviewModal';
import { PhotoGallery } from '../../components/common/PhotoGallery';
import { Clock, ShieldCheck, CheckCircle2, RotateCcw, Wrench } from 'lucide-react';

export const AwaitingReviewPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const loadData = async () => {
    const all = await DataService.getTasks();
    setTasks(all.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW'));
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, []);

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={24} color="#fbbf24" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Tasks Awaiting Safety Officer Review</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          Employees have executed corrective actions and submitted photographic evidence for officer sign-off.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="ehs-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
            No submissions pending review
          </h3>
          <p style={{ fontSize: '0.85rem' }}>All submitted corrective actions have been evaluated.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tasks.map((task) => {
            const obs = task.observation;
            const latestAttempt = task.corrective_actions?.[0];

            return (
              <div
                key={task.id}
                className="ehs-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  borderLeft: '4px solid #fbbf24',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', fontSize: '1.05rem' }}>
                      {task.task_number}
                    </span>
                    {obs && <PriorityBadge priority={obs.priority} />}
                    <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                      {obs?.department?.name} • {obs?.area}
                    </span>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedTask(task)}
                  >
                    <ShieldCheck size={16} />
                    Inspect & Sign Off
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Left: Original Issue */}
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                      INITIAL SAFETY ISSUE
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {obs?.observation_text}
                    </p>
                  </div>

                  {/* Right: Submitted Corrective Action */}
                  <div style={{ background: 'rgba(245, 158, 11, 0.04)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.725rem', color: 'var(--brand-secondary)', fontWeight: 700 }}>
                        SUBMITTED ACTION (ATTEMPT #{latestAttempt?.attempt_number || 1})
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        By {task.assignee?.full_name}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: '8px' }}>
                      {latestAttempt?.action_description}
                    </p>
                    <PhotoGallery photos={latestAttempt?.photos} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Officer Review Modal */}
      <OfficerReviewModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onReviewCompleted={loadData}
      />
    </div>
  );
};
