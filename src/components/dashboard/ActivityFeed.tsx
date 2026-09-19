import React from 'react';
import { TaskHistory } from '../../types/database';
import { Activity, Clock, ShieldCheck, RotateCcw, AlertTriangle, Send, UserPlus } from 'lucide-react';

interface ActivityFeedProps {
  activities: TaskHistory[];
  onSelectTask: (taskId: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, onSelectTask }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'TASK_CREATED':
        return <Activity size={14} color="var(--brand-primary)" />;
      case 'CORRECTIVE_ACTION':
        return <Send size={14} color="#38bdf8" />;
      case 'REWORK_REQUESTED':
        return <RotateCcw size={14} color="#f97316" />;
      case 'TASK_COMPLETED':
        return <ShieldCheck size={14} color="#10b981" />;
      case 'STATUS_CHANGE':
        return <AlertTriangle size={14} color="#ef4444" />;
      case 'PARTICIPANT_ADDED':
        return <UserPlus size={14} color="#a855f7" />;
      default:
        return <Clock size={14} color="var(--text-muted)" />;
    }
  };

  return (
    <div className="ehs-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--brand-primary)" />
          Recent Safety Activity & Audit Stream
        </h4>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realtime Log</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activities.slice(0, 8).map((act) => (
          <div
            key={act.id}
            onClick={() => onSelectTask(act.task_id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = 'var(--border-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-elevated)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            <div
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'var(--bg-surface-elevated)',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              {getIcon(act.action_type)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {act.description}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
