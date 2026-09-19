import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Clock, AlertTriangle, MessageSquare, UserCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { Notification } from '../../types/database';
import { useNavigate } from 'react-router-dom';

export const NotificationDropdown: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    if (!currentUser) return;
    const list = await DataService.getNotifications(currentUser.emp_id);
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();
    const unsubscribe = subscribeToDataChanges(() => {
      loadNotifications();
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (currentUser) {
      await DataService.markAllNotificationsAsRead(currentUser.emp_id);
      loadNotifications();
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    await DataService.markNotificationAsRead(n.id);
    setIsOpen(false);
    if (n.task_id) {
      navigate(`/tasks?taskId=${n.task_id}`);
    } else if (n.observation_id) {
      navigate(`/observations?obsId=${n.observation_id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'TASK_OVERDUE':
        return <AlertTriangle size={15} color="#ef4444" />;
      case 'CHAT_MESSAGE':
        return <MessageSquare size={15} color="#38bdf8" />;
      case 'USER_MENTIONED':
        return <UserCheck size={15} color="#f59e0b" />;
      case 'TASK_COMPLETED':
        return <ShieldCheck size={15} color="#10b981" />;
      default:
        return <Clock size={15} color="#f59e0b" />;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="btn-ghost"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '8px',
          color: unreadCount > 0 ? 'var(--brand-primary)' : 'var(--text-secondary)',
        }}
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: 'var(--hazard-high)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              borderRadius: '9999px',
              padding: '1px 5px',
              minWidth: '18px',
              textAlign: 'center',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-dropdown-panel"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '360px',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: '480px',
            background: '#ffffff',
            border: '1px solid var(--border-hover)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1500,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: 'var(--brand-primary)',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="btn-ghost"
                style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', padding: '4px 6px' }}
              >
                <CheckCheck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.85rem' }}>No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: n.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.05)')
                  }
                >
                  <div
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface-elevated)',
                      flexShrink: 0,
                    }}
                  >
                    {getIcon(n.notification_type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: n.is_read ? 500 : 700,
                        color: n.is_read ? 'var(--text-primary)' : 'var(--brand-primary)',
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.775rem',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  {!n.is_read && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--brand-primary)',
                        flexShrink: 0,
                        marginTop: '6px',
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
