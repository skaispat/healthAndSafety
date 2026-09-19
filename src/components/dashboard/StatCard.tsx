import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accentColor = '#f59e0b',
  onClick,
}) => {
  return (
    <div
      className={`stat-card ${onClick ? 'ehs-card-interactive' : ''}`}
      onClick={onClick}
      style={{ '--card-accent': accentColor } as React.CSSProperties}
    >
      <div className="stat-card-title">
        <span>{title}</span>
        <div style={{ color: accentColor, display: 'flex', alignItems: 'center' }}>{icon}</div>
      </div>

      <div className="stat-card-value" style={{ color: typeof value === 'number' && value > 0 && accentColor === '#ef4444' ? '#f87171' : undefined }}>
        {value}
      </div>

      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
};
