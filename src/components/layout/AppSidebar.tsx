import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Eye,
  PlusCircle,
  CheckSquare,
  Clock,
  BarChart3,
  Bell,
  X
} from 'lucide-react';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isOpen, onClose }) => {
  const { isOfficer } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 290,
          }}
          className="mobile-backdrop"
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Brand Logo & Title - Top of Sidebar */}
        <div
          style={{
            padding: '16px 16px 14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Health & Safety
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Industrial Management
              </div>
            </div>
          </div>

          <button
            className="btn-ghost mobile-close-btn"
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '6px' }}
            aria-label="Close sidebar"
          >
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="sidebar-nav-container">
          <NavLink to="/" end className={navLinkClass} onClick={onClose}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          {isOfficer ? (
            /* ================= OFFICER NAVIGATION ================= */
            <>
              {/* 1. Create Observation Page */}
              <NavLink to="/observations/create" className={navLinkClass} onClick={onClose}>
                <PlusCircle size={18} color="var(--brand-primary)" />
                <span style={{ fontWeight: 700 }}>Create Observation</span>
              </NavLink>

              {/* 2. All Observations & Tasks */}
              <NavLink to="/observations" className={navLinkClass} onClick={onClose}>
                <Eye size={18} />
                <span>All Observations & Tasks</span>
              </NavLink>

              {/* 3. My Assigned Tasks */}
              <NavLink to="/my-tasks" className={navLinkClass} onClick={onClose}>
                <Clock size={18} />
                <span>My Assigned Tasks</span>
              </NavLink>

              {/* 4. Reports & Audits */}
              <NavLink to="/reports" className={navLinkClass} onClick={onClose}>
                <BarChart3 size={18} />
                <span>Reports & Audits</span>
              </NavLink>
            </>
          ) : (
            /* ================= EMPLOYEE NAVIGATION ================= */
            <>
              <NavLink to="/my-tasks" end className={navLinkClass} onClick={onClose}>
                <CheckSquare size={18} />
                <span>My Tasks</span>
              </NavLink>
            </>
          )}

          <NavLink to="/notifications" className={navLinkClass} onClick={onClose}>
            <Bell size={18} />
            <span>Notification Center</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
};

