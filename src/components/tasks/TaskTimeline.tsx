import React from 'react';
import { TaskHistory } from '../../types/database';
import { formatISTDateTime } from '../../utils/dateUtils';
import { Clock, CheckCircle2, RotateCcw, AlertTriangle, UserPlus, Send, ShieldAlert, ArrowRight } from 'lucide-react';

interface TaskTimelineProps {
  history: TaskHistory[];
}

export const TaskTimeline: React.FC<TaskTimelineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>
        No tracking history recorded for this observation yet.
      </div>
    );
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'TASK_CREATED':
      case 'CREATED':
      case 'ASSIGNED':
        return <ShieldAlert size={12} color="var(--brand-primary)" />;
      case 'CORRECTIVE_ACTION':
      case 'SUBMITTED_FOR_REVIEW':
        return <Send size={12} color="#0284c7" />;
      case 'REWORK_REQUESTED':
      case 'REWORK_REQUIRED':
        return <RotateCcw size={12} color="#e11d48" />;
      case 'TASK_COMPLETED':
      case 'COMPLETED':
        return <CheckCircle2 size={12} color="#10b981" />;
      case 'PARTICIPANT_ADDED':
        return <UserPlus size={12} color="#8b5cf6" />;
      default:
        return <Clock size={12} color="var(--brand-primary)" />;
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case 'REWORK_REQUIRED':
      case 'REWORK_REQUESTED':
        return { bg: '#fff1f2', border: '#fecdd3', text: '#e11d48' };
      case 'COMPLETED':
      case 'TASK_COMPLETED':
        return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
      case 'SUBMITTED_FOR_REVIEW':
      case 'CORRECTIVE_ACTION':
        return { bg: '#f0f9ff', border: '#bae6fd', text: '#0284c7' };
      default:
        return { bg: '#f1f5f9', border: '#e2e8f0', text: 'var(--brand-primary)' };
    }
  };

  return (
    <div className="timeline">
      {history.map((item) => {
        const istFormattedDate = formatISTDateTime(item.created_at);
        const badgeColors = getActionBadgeColor(item.action_type);
        const isRework = item.action_type === 'REWORK_REQUIRED' || item.action_type === 'REWORK_REQUESTED' || Boolean(item.rework_reason);

        return (
          <div key={item.id} className="timeline-item">
            <div className="timeline-node">{getActionIcon(item.action_type)}</div>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: badgeColors.bg,
                      border: `1px solid ${badgeColors.border}`,
                      color: badgeColors.text,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.action_type.replace(/_/g, ' ')}
                  </span>

                  {item.attempt_number && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: 'var(--brand-secondary)',
                      }}
                    >
                      Attempt #{item.attempt_number}
                    </span>
                  )}

                  <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    ID: #{item.id.length > 8 ? item.id.slice(0, 8) : item.id}
                  </span>
                </div>

                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {istFormattedDate}
                </span>
              </div>

              {/* Status Transition Badge if available */}
              {item.previous_status && item.new_status && item.previous_status !== item.new_status && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 6px' }}>
                  <span style={{ fontWeight: 600 }}>{item.previous_status}</span>
                  <ArrowRight size={10} />
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.new_status}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45, margin: '4px 0' }}>
                {item.description}
              </p>

              {/* Explicit refusal reason callout */}
              {isRework && item.rework_reason && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '6px',
                    fontSize: '0.825rem',
                    color: '#881337',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: '#e11d48', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    REFUSAL REASON:
                  </span>
                  "{item.rework_reason}"
                </div>
              )}

              {item.performer && (
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Actioned by: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.performer.full_name}</span> (Emp ID: {item.performer.emp_id})
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

