import React, { useState, useEffect } from 'react';
import { Observation } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { PriorityBadge, ObservationStatusBadge } from '../../components/common/Badge';
import { PhotoGallery } from '../../components/common/PhotoGallery';
import { PersonalObservationModal } from '../../components/observations/PersonalObservationModal';
import { useToast } from '../../context/ToastContext';
import { Sparkles, PlusCircle, CheckCircle, Clock, RotateCcw, Building2, MapPin } from 'lucide-react';

export const MyObservationsPage: React.FC = () => {
  const { currentUser, isOfficer } = useAuth();
  const { showToast } = useToast();
  const [personalObs, setPersonalObs] = useState<Observation[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closingObsId, setClosingObsId] = useState<string | null>(null);

  const loadData = async () => {
    const all = await DataService.getObservations();
    const mine = all.filter((o) => o.is_personal && (Number(o.created_by) === currentUser?.emp_id || String(o.created_by) === currentUser?.id));
    setPersonalObs(mine);
  };

  useEffect(() => {
    loadData();
    return subscribeToDataChanges(loadData);
  }, [currentUser]);

  const handleToggleStatus = async (obs: Observation) => {
    if (!currentUser) return;

    if (obs.status === 'OPEN') {
      // Prompt for closing note
      setClosingObsId(obs.id);
      setCloseReason('');
    } else {
      // Re-open
      await DataService.togglePersonalObservationStatus(obs.id, currentUser.emp_id);
      showToast({ type: 'info', title: 'Status Updated', message: `${obs.observation_number} reopened for inspection.` });
      loadData();
    }
  };

  const confirmClose = async () => {
    if (!closingObsId || !currentUser) return;
    await DataService.togglePersonalObservationStatus(closingObsId, currentUser.emp_id, closeReason.trim());
    showToast({ type: 'success', title: 'Observation Closed', message: 'Personal safety observation marked CLOSED.' });
    setClosingObsId(null);
    setCloseReason('');
    loadData();
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
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
            <Sparkles size={24} color="var(--brand-primary)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>My Personal Observations</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
            Independent officer safety monitoring log. Unassigned to employees; managed directly using Open/Close.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <PlusCircle size={18} />
          Log Personal Observation
        </button>
      </div>

      {/* Grid of Personal Observations */}
      {personalObs.length === 0 ? (
        <div className="ehs-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Sparkles size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>No personal observations yet</h3>
          <p style={{ fontSize: '0.85rem' }}>
            Use this space to track workplace hazards that you manage directly without creating employee tasks.
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
            style={{ marginTop: '16px' }}
          >
            Create Your First Personal Observation
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {personalObs.map((obs, index) => {
            const isOpen = obs.status === 'OPEN';

            return (
              <div
                key={obs.id}
                className="ehs-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: isOpen ? 'var(--bg-card)' : 'var(--bg-surface-elevated)',
                  borderColor: isOpen ? 'var(--brand-primary)' : 'var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontSize: '0.95rem' }}>
                      #{index + 1}
                    </span>
                    <ObservationStatusBadge status={obs.status} />
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <PriorityBadge priority={obs.priority} />
                    <span className="badge" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <Building2 size={12} />
                      {obs.department?.name}
                    </span>
                    <span className="badge" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <MapPin size={12} />
                      {obs.area}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: 1.5 }}>
                    {obs.observation_text}
                  </p>

                  {obs.solution_text && (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '14px',
                      }}
                    >
                      <strong style={{ color: 'var(--text-muted)' }}>Action Notes:</strong> {obs.solution_text}
                    </div>
                  )}

                  {obs.photos && obs.photos.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <PhotoGallery photos={obs.photos} />
                    </div>
                  )}
                </div>

                {/* Status Toggle Bar */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Logged: {new Date(obs.created_at).toLocaleDateString()}
                    {obs.closed_at && ` • Closed: ${new Date(obs.closed_at).toLocaleDateString()}`}
                  </span>

                  {isOpen ? (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleToggleStatus(obs)}
                    >
                      <CheckCircle size={14} />
                      Mark Resolved (CLOSE)
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleToggleStatus(obs)}
                    >
                      <RotateCcw size={14} />
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Close Resolution Dialog */}
      {closingObsId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Close Personal Observation</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Optionally enter resolution notes detailing how this issue was corrected:
              </p>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="e.g. Broken glass cover replaced with polycarbonate shield on 12 Sep..."
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setClosingObsId(null)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={confirmClose}>
                Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}

      <PersonalObservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadData}
      />
    </div>
  );
};
