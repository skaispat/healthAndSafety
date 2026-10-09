import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, PlusCircle, Eye, GraduationCap, Bell, CheckSquare } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { isOfficer, currentUser } = useAuth();

  const isAdminOrOfficer = Boolean(
    isOfficer ||
    currentUser?.role === 'HEALTH_SAFETY_OFFICER' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.user_access === 'ADMIN' ||
    (currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY')
  );

  return (
    <nav className="mobile-bottom-nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
      >
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </NavLink>

      {isAdminOrOfficer ? (
        <NavLink
          to="/observations/create"
          className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
        >
          <PlusCircle size={20} color="var(--brand-primary)" />
          <span>Create</span>
        </NavLink>
      ) : (
        <NavLink
          to="/my-tasks"
          className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
        >
          <CheckSquare size={20} />
          <span>My Tasks</span>
        </NavLink>
      )}

      <NavLink
        to="/observations"
        className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
      >
        <Eye size={20} />
        <span>Observations</span>
      </NavLink>

      {isAdminOrOfficer && (
        <NavLink
          to="/training"
          className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
        >
          <GraduationCap size={20} />
          <span>Training</span>
        </NavLink>
      )}

      <NavLink
        to="/notifications"
        className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
      >
        <Bell size={20} />
        <span>Alerts</span>
      </NavLink>
    </nav>
  );
};


