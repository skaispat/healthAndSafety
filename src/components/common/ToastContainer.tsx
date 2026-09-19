import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 size={20} color="#10b981" />
          ) : t.type === 'error' ? (
            <AlertCircle size={20} color="#ef4444" />
          ) : t.type === 'warning' ? (
            <AlertTriangle size={20} color="#f59e0b" />
          ) : (
            <Info size={20} color="#0284c7" />
          );

        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.title}</div>
              {t.message && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t.message}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="btn-ghost"
              style={{ padding: '2px', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
