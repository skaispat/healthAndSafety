import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import {
  Shield,
  Database,
  ChevronDown,
  Menu,
  RotateCcw,
  LogOut,
} from 'lucide-react';
import { getSupabaseConfig } from '../../lib/supabase';
import { resetToSeedData } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar }) => {
  const { currentUser, isOfficer, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDbInfo, setShowDbInfo] = useState(false);
  const { showToast } = useToast();
  const supabaseConfig = getSupabaseConfig();

  const handleResetData = () => {
    if (window.confirm('Clear all local observations, tasks, and notifications cache?')) {
      resetToSeedData();
      showToast({ type: 'success', title: 'Data Cleared', message: 'Local cache cleared successfully.' });
    }
  };

  return (
    <header
      style={{
        height: '64px',
        borderBottom: '1px solid var(--border-subtle)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Left: Mobile hamburger menu toggle */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          className="btn-ghost mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          style={{ padding: '8px', color: 'var(--text-secondary)' }}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* In-app Notification Dropdown */}
        <NotificationDropdown />

        {/* User Switcher Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px 4px 4px',
              borderRadius: '999px',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'all 0.15s',
            }}
          >
            <img
              src={
                currentUser?.profile_photo ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
              }
              alt={currentUser?.full_name || 'User'}
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ textAlign: 'left', display: 'none', lineHeight: 1.2 }} className="header-user-info">
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{currentUser?.full_name}</div>
              <div style={{ fontSize: '0.675rem', color: isOfficer ? 'var(--brand-primary)' : '#0284c7', fontWeight: 600 }}>
                {isOfficer ? 'Safety Officer' : 'Employee'}
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '260px',
                background: '#ffffff',
                border: '1px solid var(--border-hover)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1200,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', background: '#f8fafc' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Active Account
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.925rem', marginTop: '2px', color: 'var(--text-primary)' }}>{currentUser?.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {currentUser?.email || currentUser?.username}
                  {currentUser?.emp_id ? ` • Emp ID: #${currentUser.emp_id}` : ''}
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span className={`badge ${isOfficer ? 'badge-high' : 'badge-assigned'}`} style={{ fontSize: '0.65rem' }}>
                    {isOfficer ? 'Safety Officer' : 'Employee'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="btn-ghost"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={16} color="#dc2626" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .header-subtitle {
            display: block !important;
          }
          .header-db-label {
            display: inline !important;
          }
        }
        @media (min-width: 768px) {
          .header-user-info {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
};
