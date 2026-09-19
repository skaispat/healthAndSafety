import React from 'react';
import { PriorityLevel, TaskStatus, ObservationStatus, OfficerTaskStatus, PRIORITY_RISK_MAP } from '../../types/database';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, RotateCcw, ShieldAlert, Send, TrendingUp } from 'lucide-react';

interface PriorityBadgeProps {
  priority: PriorityLevel;
  showRisk?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, showRisk = true }) => {
  const riskInfo = PRIORITY_RISK_MAP[priority];

  if (priority === 'HIGH') {
    return (
      <span className="badge badge-high" title={`High Priority - Risk ${riskInfo.label}`}>
        <AlertCircle size={13} />
        HIGH {showRisk && `(${riskInfo.label})`}
      </span>
    );
  }

  if (priority === 'MEDIUM') {
    return (
      <span className="badge badge-medium" title={`Medium Priority - Risk ${riskInfo.label}`}>
        <AlertTriangle size={13} />
        MEDIUM {showRisk && `(${riskInfo.label})`}
      </span>
    );
  }

  return (
    <span className="badge badge-low" title={`Low Priority - Risk ${riskInfo.label}`}>
      <ShieldAlert size={13} />
      LOW {showRisk && `(${riskInfo.label})`}
    </span>
  );
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'ASSIGNED':
      return (
        <span className="badge badge-assigned">
          <Clock size={13} />
          ASSIGNED
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="badge badge-in-progress">
          <Clock size={13} />
          IN PROGRESS
        </span>
      );
    case 'SUBMITTED_FOR_REVIEW':
      return (
        <span className="badge badge-submitted-review">
          <Send size={13} />
          AWAITING REVIEW
        </span>
      );
    case 'REWORK_REQUIRED':
      return (
        <span className="badge badge-rework-required">
          <RotateCcw size={13} />
          REWORK REQUIRED
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="badge badge-completed">
          <CheckCircle size={13} />
          COMPLETED
        </span>
      );
    case 'OVERDUE':
      return (
        <span className="badge badge-high" style={{ background: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5' }}>
          <AlertCircle size={13} />
          OVERDUE
        </span>
      );
    case 'OPEN':
      return (
        <span className="badge badge-assigned">
          <Clock size={13} />
          OPEN
        </span>
      );
    case 'CLOSED':
      return (
        <span className="badge badge-completed">
          <CheckCircle size={13} />
          CLOSED
        </span>
      );
    default:
      return <span className="badge">{status}</span>;
  }
};

interface ObservationStatusBadgeProps {
  status: ObservationStatus;
}

export const ObservationStatusBadge: React.FC<ObservationStatusBadgeProps> = ({ status }) => {
  return <StatusBadge status={status as TaskStatus} />;
};

interface OfficerTaskStatusBadgeProps {
  status: OfficerTaskStatus;
  progress?: number;
}

export const OfficerTaskStatusBadge: React.FC<OfficerTaskStatusBadgeProps> = ({ status, progress }) => {
  switch (status) {
    case 'PENDING':
      return (
        <span
          className="badge"
          style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
        >
          <Clock size={12} />
          PENDING
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span
          className="badge badge-in-progress"
          style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
        >
          <Clock size={12} />
          IN PROGRESS {progress !== undefined ? `(${progress}%)` : ''}
        </span>
      );
    case 'PARTIALLY_DONE':
      return (
        <span
          className="badge"
          style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a', fontWeight: 700 }}
        >
          <TrendingUp size={12} />
          PARTIALLY DONE {progress !== undefined ? `(${progress}%)` : ''}
        </span>
      );
    case 'DONE':
      return (
        <span
          className="badge badge-completed"
          style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac', fontWeight: 700 }}
        >
          <CheckCircle size={12} />
          DONE (100%)
        </span>
      );
    default:
      return <span className="badge">{status}</span>;
  }
};


