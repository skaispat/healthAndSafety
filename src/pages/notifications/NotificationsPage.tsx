import React, { useState, useEffect } from 'react';
import { Notification } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { Bell, CheckCheck, Clock, AlertTriangle, MessageSquare, UserCheck, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    if (!currentUser) return;
    const list = await DataService.getNotifications(currentUser.emp_id);
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();
    return subscribeToDataChanges(loadNotifications);
  }, [currentUser]);

  const handleMarkAllRead = async () => {
    if (currentUser) {
      await DataService.markAllNotificationsAsRead(currentUser.emp_id);
      loadNotifications();
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    await DataService.markNotificationAsRead(n.id);
    if (n.observation_id) {
      navigate(`/observations?obsId=${n.observation_id}`);
    } else if (n.task_id) {
      navigate(`/tasks?taskId=${n.task_id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'TASK_OVERDUE':
        return <AlertTriangle size={18} color="#ef4444" />;
      case 'CHAT_MESSAGE':
        return <MessageSquare size={18} color="#38bdf8" />;
      case 'USER_MENTIONED':
        return <UserCheck size={18} color="#f59e0b" />;
      case 'TASK_COMPLETED':
        return <ShieldCheck size={18} color="#10b981" />;
      default:
        return <Clock size={18} color="var(--brand-primary)" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="page-wrapper">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={24} color="var(--brand-primary)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Notification Center</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Realtime alerts for task assignments, officer rework requests, and overdue flags for Employee #{currentUser?.emp_id}.
          </p>
        </div>

        {unreadCount > 0 && (
          <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>
            <CheckCheck size={16} />
            Mark All as Read ({unreadCount})
          </button>
        )}
      </div>

      <div className="ehs-card" style={{ padding: 0, overflow: 'hidden' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>You have no notifications at this time.</p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: n.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.04)')
                }
              >
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-elevated)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {getIcon(n.notification_type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div
                      style={{
                        fontWeight: n.is_read ? 600 : 800,
                        fontSize: '0.9rem',
                        color: n.is_read ? 'var(--text-primary)' : 'var(--brand-primary)',
                      }}
                    >
                      {n.title}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.45 }}>
                    {n.message}
                  </p>
                </div>

                {!n.is_read && (
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--brand-primary)',
                      flexShrink: 0,
                      marginTop: '8px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
