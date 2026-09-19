import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSupabaseConfig } from '../../lib/supabase';
import { User, Shield, Building2, Mail, Phone, Hash, Database, CheckCircle2, RotateCcw } from 'lucide-react';
import { resetToSeedData } from '../../services/dataService';

export const ProfilePage: React.FC = () => {
  const { currentUser, role, isOfficer, usersList, switchUser } = useAuth();
  const { showToast } = useToast();
  const dbConfig = getSupabaseConfig();

  const handleResetData = () => {
    if (window.confirm('Reset all demo observations, tasks, and training back to factory default?')) {
      resetToSeedData();
      showToast({ type: 'success', title: 'System Reset', message: 'All records restored to factory seed.' });
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>User Profile & Environment</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          Authenticated employee profile, access credentials, and database connectivity.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* User Card */}
        <div className="ehs-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <img
              src={currentUser?.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={currentUser?.full_name}
              style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-hover)' }}
            />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{currentUser?.full_name}</h3>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <span className={`badge ${isOfficer ? 'badge-high' : 'badge-assigned'}`}>
                  {isOfficer ? 'HEALTH & SAFETY OFFICER' : 'EMPLOYEE'}
                </span>
                <span className="badge" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', border: '1px solid rgba(22, 163, 74, 0.25)' }}>
                  ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Hash size={16} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)' }}>Employee ID (emp_id):</span>
              <strong>{currentUser?.emp_id || currentUser?.employee_id}</strong>
            </div>

            {currentUser?.position && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={16} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-muted)' }}>Position / Role:</span>
                <strong>{currentUser.position}</strong>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={16} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)' }}>Department:</span>
              <strong>
                {typeof currentUser?.department === 'string' 
                  ? currentUser.department 
                  : currentUser?.department?.name || 'Safety'}
                {currentUser?.dept_id ? ` (Dept ID: ${currentUser.dept_id})` : ''}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={16} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)' }}>Username:</span>
              <span>{currentUser?.username || currentUser?.email}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Phone size={16} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)' }}>Mobile Number:</span>
              <span>{currentUser?.mobile_number || currentUser?.phone || '+91 98765 00000'}</span>
            </div>

            {currentUser?.user_access && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-muted)' }}>User Access:</span>
                <span className="badge" style={{ background: 'var(--bg-surface-elevated)' }}>{currentUser.user_access}</span>
              </div>
            )}
          </div>
        </div>

        {/* Database & Architecture Settings */}
        <div className="ehs-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Database size={20} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>System & Storage Engine</h3>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            {dbConfig.isConfigured ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                <CheckCircle2 size={18} />
                <strong>Supabase Live Cloud Connected</strong>
              </div>
            ) : (
              <div>
                <span className="badge badge-medium" style={{ marginBottom: '8px' }}>
                  Local Storage & Reactive Engine Active
                </span>
                <p>
                  Full feature set enabled: observations, tasks, rework cycles, @mention chat routing, notifications, and trainings persist across refreshes.
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '16px' }}>
            <button className="btn btn-outline btn-sm" onClick={handleResetData} style={{ width: '100%' }}>
              <RotateCcw size={14} />
              Reset System to Seed Data
            </button>
          </div>
        </div>
      </div>

      {/* Quick Test Switcher for Testing Different Roles */}
      <div className="ehs-card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px' }}>
          Switch Test Profile (Instant Role Verification)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {usersList.map((u) => {
            const isSelected = u.id === currentUser?.id;
            return (
              <div
                key={u.id}
                onClick={() => {
                  switchUser(u.id);
                  showToast({
                    type: 'info',
                    title: 'Role Switched',
                    message: `Logged in as ${u.full_name} (${u.role === 'HEALTH_SAFETY_OFFICER' ? 'Safety Officer' : 'Employee'})`,
                  });
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-surface-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <img
                  src={u.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={u.full_name}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{u.full_name}</div>
                  <div style={{ fontSize: '0.725rem', color: u.role === 'HEALTH_SAFETY_OFFICER' ? 'var(--brand-primary)' : 'var(--brand-secondary)' }}>
                    {u.role === 'HEALTH_SAFETY_OFFICER' ? 'Safety Officer' : `Employee (${typeof u.department === 'string' ? u.department : (u.department?.name || 'Staff')})`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
