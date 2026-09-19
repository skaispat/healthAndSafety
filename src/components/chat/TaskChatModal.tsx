import React, { useState, useEffect, useRef } from 'react';
import { Task, User, TaskMessage } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { DataService, subscribeToDataChanges } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { Send, Users, AtSign, Clock, ShieldCheck, UserCheck } from 'lucide-react';

interface TaskChatModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskChatModal: React.FC<TaskChatModalProps> = ({ task, isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadData = async () => {
    if (!task) return;
    const currentTask = await DataService.getTaskById(task.id);
    if (currentTask && currentTask.messages) {
      setMessages(currentTask.messages);
    }
    const users = await DataService.getUsers();
    setActiveUsers(users.filter((u) => u.is_active));
  };

  useEffect(() => {
    if (isOpen && task) {
      loadData();
      const unsubscribe = subscribeToDataChanges(() => {
        loadData();
      });
      return unsubscribe;
    }
  }, [isOpen, task?.id]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!task) return null;

  // Handle typing & mention trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const selStart = e.target.selectionStart;
    setInputText(val);

    // Look backwards from cursor for '@'
    const textBeforeCursor = val.slice(0, selStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      // Ensure no spaces or newline before trigger
      if (!query.includes('\n') && query.length < 25) {
        setMentionQuery(query.toLowerCase());
        setMentionCursorPos(lastAtIdx);
        setShowMentionSuggestions(true);
        return;
      }
    }

    setShowMentionSuggestions(false);
  };

  const handleSelectMention = (user: User) => {
    if (mentionCursorPos === null) return;
    const beforeAt = inputText.slice(0, mentionCursorPos);
    const afterCursor = inputText.slice(textareaRef.current?.selectionStart || mentionCursorPos);
    const newText = `${beforeAt}@${user.full_name} ${afterCursor}`;
    setInputText(newText);
    setShowMentionSuggestions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeAt.length + user.full_name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser) return;

    const messageText = inputText.trim();
    setInputText('');
    setShowMentionSuggestions(false);

    try {
      await DataService.sendMessage({
        task_id: task.id,
        sender_id: currentUser.id,
        message: messageText,
      });
      showToast({ type: 'success', title: 'Message Sent' });
    } catch (err) {
      showToast({ type: 'error', title: 'Send Failed', message: 'Unable to send message.' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!showMentionSuggestions) {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  const filteredMentionUsers = activeUsers.filter(
    (u) =>
      u.id !== currentUser?.id &&
      (u.full_name.toLowerCase().includes(mentionQuery) ||
        (typeof u.department === 'string' ? u.department : (u.department?.name || '')).toLowerCase().includes(mentionQuery) ||
        u.role.toLowerCase().includes(mentionQuery))
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${task.task_number} — Realtime Communication`}
      subtitle={`Dedicated chat for task collaboration with @mention participant routing`}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '540px' }}>
        {/* Participants bar */}
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.775rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} color="var(--brand-primary)" />
            <span style={{ color: 'var(--text-secondary)' }}>
              Assignee: <strong style={{ color: 'var(--text-primary)' }}>{task.assignee?.full_name || 'Assigned'}</strong>
            </span>
            {task.participants && task.participants.length > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                • Participants ({task.participants.length}):{' '}
                {task.participants.map((p) => p.user?.full_name).join(', ')}
              </span>
            )}
          </div>
          <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>● Live Stream</span>
        </div>

        {/* Message Feed */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
              <AtSign size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>No messages yet in this task.</p>
              <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                Type <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>@EmployeeName</span> to include colleagues in this task.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === currentUser?.id;
              const sender = m.sender;
              const isSafetyOfficer = sender?.role === 'HEALTH_SAFETY_OFFICER';

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                  }}
                >
                  {!isMine && (
                    <img
                      src={sender?.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={sender?.full_name || 'User'}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: '2px' }}
                    />
                  )}

                  <div>
                    <div
                      style={{
                        fontSize: '0.725rem',
                        color: 'var(--text-muted)',
                        marginBottom: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: isMine ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                        {isMine ? 'You' : sender?.full_name}
                      </span>
                      {isSafetyOfficer && (
                        <span style={{ fontSize: '0.65rem', background: '#fef2f2', color: 'var(--brand-primary)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fecaca' }}>
                          Officer
                        </span>
                      )}
                      <span>•</span>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isMine
                          ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                          : '#f1f5f9',
                        border: '1px solid',
                        borderColor: isMine ? '#b91c1c' : '#e2e8f0',
                        color: isMine ? '#ffffff' : '#0f172a',
                        fontSize: '0.875rem',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Highlight @mentions in message */}
                      {m.message.split(/(@[A-Za-z\s]+?)(?=\s@|$|[.,!?])/g).map((chunk, idx) => {
                        if (chunk.startsWith('@')) {
                          return (
                            <span
                              key={idx}
                              style={{
                                color: isMine ? '#fef3c7' : '#b45309',
                                fontWeight: 800,
                                background: isMine ? 'rgba(0,0,0,0.15)' : '#fef3c7',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                            >
                              {chunk}
                            </span>
                          );
                        }
                        return chunk;
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Popover */}
        {showMentionSuggestions && filteredMentionUsers.length > 0 && (
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              border: '1px solid var(--border-hover)',
              borderRadius: '8px',
              padding: '6px',
              marginBottom: '8px',
              maxHeight: '160px',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', padding: '4px 8px', fontWeight: 800 }}>
              SELECT EMPLOYEE TO @MENTION & ADD TO TASK:
            </div>
            {filteredMentionUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => handleSelectMention(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <img
                  src={u.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={u.full_name}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span style={{ fontWeight: 700 }}>{u.full_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                  ({typeof u.department === 'string' ? u.department : (u.department?.name || u.role)})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          style={{
            marginTop: '10px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
            position: 'relative',
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              className="form-textarea"
              placeholder="Type your message... Use @Name to add an employee to this task communication"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              style={{
                minHeight: '60px',
                maxHeight: '110px',
                paddingRight: '36px',
                fontSize: '0.85rem',
              }}
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setInputText((prev) => prev + '@');
                setMentionQuery('');
                setShowMentionSuggestions(true);
                textareaRef.current?.focus();
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
                padding: '4px',
                color: 'var(--brand-primary)',
              }}
              title="Add @mention"
            >
              <AtSign size={18} />
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!inputText.trim()}
            style={{ height: '54px', padding: '0 18px' }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </Modal>
  );
};
