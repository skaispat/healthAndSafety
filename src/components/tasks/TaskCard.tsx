import React from 'react';
import { Task } from '../../types/database';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { Calendar, User, MapPin, Building2, AlertTriangle } from 'lucide-react';
import { formatISTDate } from '../../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onSelect }) => {
  const obs = task.observation;
  const isOverdue = task.status === 'OVERDUE' || (new Date(task.due_date).getTime() < Date.now() && task.status !== 'COMPLETED');

  return (
    <div
      className="ehs-card ehs-card-interactive"
      onClick={() => onSelect(task)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        padding: '14px',
        borderColor: isOverdue ? 'rgba(239, 68, 68, 0.4)' : undefined,
      }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>
              {task.task_number}
            </span>
            {isOverdue && (
              <span style={{ color: 'var(--hazard-high)', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 700 }}>
                <AlertTriangle size={12} />
                OVERDUE
              </span>
            )}
          </div>
          <StatusBadge status={task.status} />
        </div>

        {/* Observation snippet */}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '10px', lineHeight: 1.4 }}>
          {obs?.observation_text ? (
            obs.observation_text.length > 100 ? `${obs.observation_text.slice(0, 100)}...` : obs.observation_text
          ) : (
            'Safety task assignment'
          )}
        </p>

        {/* Meta badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {obs && <PriorityBadge priority={obs.priority} />}
          <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
            <Building2 size={11} />
            {obs?.department?.name || 'Department'}
          </span>
          <span className="badge" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
            <MapPin size={11} />
            {obs?.area || 'Area'}
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '8px',
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <User size={12} color="var(--brand-primary)" />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            {task.assignee?.full_name?.split(' ')[0] || 'Assigned'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOverdue ? 'var(--hazard-high)' : 'inherit' }}>
          <Calendar size={12} />
          <span>Due: {formatISTDate(task.due_date)}</span>
        </div>
      </div>
    </div>
  );
};
