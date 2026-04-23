import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { X, Key, Users, Share, Copy, Check, Mail, UserPlus, Link, Plus, Settings } from 'lucide-react';
import './SessionModal.css';

const SessionModal = ({ isOpen, onClose, initialMode = 'join' }) => {
  const [mode, setMode] = useState(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const { user } = useAuth();
  const { session, joinSession, createSession, getUserSessions } = useSession();

  // Join session state
  const [inviteKey, setInviteKey] = useState('');

  // Create session state
  const [sessionData, setSessionData] = useState({
    name: '',
    maxUsers: 5,
    allowGuests: true,
    permissions: {
      canEdit: true,
      canExecute: true,
      canChat: true,
      canInvite: false
    }
  });

  // Invite state
  const [inviteData, setInviteData] = useState({
    method: 'email',
    emails: '',
    role: 'editor'
  });

  // Session list state
  const [userSessions, setUserSessions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      if (mode === 'sessions') {
        loadUserSessions();
      }
      // Default to link sharing when in invite mode to show the invite key
      if (mode === 'invite') {
        setInviteData(prev => ({ ...prev, method: 'link' }));
      }
    }
  }, [isOpen, mode]);

  const resetForm = () => {
    setError('');
    setSuccess('');
    setLinkCopied(false);
    setEmailSent(false);
    setInviteKey('');
    setSessionData({
      name: '',
      maxUsers: 5,
      allowGuests: true,
      permissions: {
        canEdit: true,
        canExecute: true,
        canChat: true,
        canInvite: false
      }
    });
    setInviteData({
      method: 'email',
      emails: '',
      role: 'editor'
    });
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  const loadUserSessions = async () => {
    setIsLoading(true);
    try {
      const sessions = await getUserSessions();
      setUserSessions(sessions || []);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!inviteKey.trim()) return;

    setIsLoading(true);
    setError('');
    
    try {
      const result = await joinSession(inviteKey.trim());
      if (result.success) {
        setSuccess('Successfully joined session!');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1500);
      } else {
        setError(result.message || 'Failed to join session');
      }
    } catch (err) {
      setError(err.message || 'Failed to join session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionData.name.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await createSession(sessionData.name, {
        maxUsers: sessionData.maxUsers,
        allowGuests: sessionData.allowGuests,
        permissions: sessionData.permissions
      });
      if (result.success) {
        setSuccess(`Session "${sessionData.name}" created successfully!`);
        // Switch to invite mode to show the invite key instead of closing
        setTimeout(() => {
          setMode('invite');
          setSuccess('🎉 Session created! Your invite key is ready to share below.');
        }, 1000);
      } else {
        setError(result.message || 'Failed to create session');
      }
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvites = async (e) => {
    e.preventDefault();
    const emails = inviteData.emails.split(',').map(email => email.trim()).filter(Boolean);
    
    if (emails.length === 0) return;

    setIsLoading(true);
    try {
      // Simulate sending invites (replace with actual API call)
      console.log('Sending invites to:', emails, 'with role:', inviteData.role);
      setEmailSent(true);
      setSuccess(`Invitations sent to ${emails.length} email${emails.length > 1 ? 's' : ''}!`);
      setTimeout(() => {
        setEmailSent(false);
        setInviteData({ ...inviteData, emails: '' });
      }, 2000);
    } catch (err) {
      setError('Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setSuccess('Link copied to clipboard!');
      setTimeout(() => {
        setLinkCopied(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError('Failed to copy link');
    }
  };

  if (!isOpen) return null;

  const getModeConfig = () => {
    switch (mode) {
      case 'join':
        return {
          title: 'Join Session',
          subtitle: 'Enter an invite key to join a collaborative session',
          icon: <Key size={24} />
        };
      case 'create':
        return {
          title: 'Create Session',
          subtitle: 'Set up a new collaborative session',
          icon: <Plus size={24} />
        };
      case 'invite':
        return {
          title: 'Invite Collaborators',
          subtitle: 'Share your session with team members',
          icon: <UserPlus size={24} />
        };
      case 'sessions':
        return {
          title: 'My Sessions',
          subtitle: 'Manage your active sessions',
          icon: <Settings size={24} />
        };
      default:
        return {
          title: 'Session Manager',
          subtitle: 'Manage your collaborative sessions',
          icon: <Users size={24} />
        };
    }
  };

  const config = getModeConfig();

  return (
    <div className="session-modal-overlay" onClick={onClose}>
      <div className="session-modal" onClick={(e) => e.stopPropagation()}>
        <button className="session-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="session-modal-header">
          <div className="session-modal-icon">
            {config.icon}
          </div>
          <h2>{config.title}</h2>
          <p className="session-modal-subtitle">{config.subtitle}</p>
        </div>

        {/* Mode Tabs */}
        <div className="session-modal-tabs">
          <button
            className={`session-tab ${mode === 'join' ? 'active' : ''}`}
            onClick={() => switchMode('join')}
          >
            <Key size={16} />
            Join
          </button>
          <button
            className={`session-tab ${mode === 'create' ? 'active' : ''}`}
            onClick={() => switchMode('create')}
          >
            <Plus size={16} />
            Create
          </button>
          <button
            className={`session-tab ${mode === 'invite' ? 'active' : ''}`}
            onClick={() => switchMode('invite')}
          >
            <UserPlus size={16} />
            Invite
          </button>
          <button
            className={`session-tab ${mode === 'sessions' ? 'active' : ''}`}
            onClick={() => switchMode('sessions')}
          >
            <Settings size={16} />
            My Sessions
          </button>
        </div>

        {error && (
          <div className="session-alert session-alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="session-alert session-alert-success">
            {success}
          </div>
        )}

        {/* Content based on mode */}
        <div className="session-modal-content">
          {mode === 'join' && (
            <form onSubmit={handleJoinSession}>
              <div className="session-form-group">
                <label htmlFor="inviteKey">Invite Key</label>
                <input
                  type="text"
                  id="inviteKey"
                  value={inviteKey}
                  onChange={(e) => setInviteKey(e.target.value.toUpperCase())}
                  placeholder="Enter invite key (e.g., ABC123XYZ456)"
                  maxLength={12}
                  disabled={isLoading}
                  className="session-input-code"
                />
                <div className="session-input-hint">
                  Get the invite key from someone who created a session. It's 12 characters long and case-insensitive.
                </div>
              </div>
              <button
                type="submit"
                className="session-btn session-btn-primary"
                disabled={isLoading || !inviteKey.trim()}
              >
                {isLoading ? (
                  <span className="session-spinner"></span>
                ) : (
                  <>
                    <Key size={16} />
                    Join Session
                  </>
                )}
              </button>
            </form>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreateSession}>
              <div className="session-form-group">
                <label htmlFor="sessionName">Session Name</label>
                <input
                  type="text"
                  id="sessionName"
                  value={sessionData.name}
                  onChange={(e) => setSessionData({ ...sessionData, name: e.target.value })}
                  placeholder="Enter session name"
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="session-form-row">
                <div className="session-form-group">
                  <label htmlFor="maxUsers">Max Users</label>
                  <select
                    id="maxUsers"
                    value={sessionData.maxUsers}
                    onChange={(e) => setSessionData({ ...sessionData, maxUsers: parseInt(e.target.value) })}
                    disabled={isLoading}
                  >
                    <option value={2}>2 users</option>
                    <option value={5}>5 users</option>
                    <option value={10}>10 users</option>
                    <option value={20}>20 users</option>
                  </select>
                </div>
                <div className="session-form-group">
                  <label className="session-checkbox-label">
                    <input
                      type="checkbox"
                      checked={sessionData.allowGuests}
                      onChange={(e) => setSessionData({ ...sessionData, allowGuests: e.target.checked })}
                      disabled={isLoading}
                    />
                    Allow guest users
                  </label>
                </div>
              </div>

              <div className="session-permissions">
                <h3>Default Permissions</h3>
                <div className="session-permissions-grid">
                  {Object.entries(sessionData.permissions).map(([key, value]) => (
                    <label key={key} className="session-checkbox-label">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setSessionData({
                          ...sessionData,
                          permissions: { ...sessionData.permissions, [key]: e.target.checked }
                        })}
                        disabled={isLoading}
                      />
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="session-btn session-btn-primary"
                disabled={isLoading || !sessionData.name.trim()}
              >
                {isLoading ? (
                  <span className="session-spinner"></span>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Session
                  </>
                )}
              </button>
            </form>
          )}

          {mode === 'invite' && (
            <div>
              <div className="session-invite-tabs">
                <button
                  className={`session-invite-tab ${inviteData.method === 'email' ? 'active' : ''}`}
                  onClick={() => setInviteData({ ...inviteData, method: 'email' })}
                >
                  <Mail size={16} />
                  Send Email
                </button>
                <button
                  className={`session-invite-tab ${inviteData.method === 'link' ? 'active' : ''}`}
                  onClick={() => setInviteData({ ...inviteData, method: 'link' })}
                >
                  <Link size={16} />
                  Share Link
                </button>
              </div>

              {/* Prominent invite key display for easy sharing */}
              {session?.inviteKey && (
                <div className="session-key-highlight" style={{
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                  border: '2px solid #2196f3',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#1976d2', fontSize: '16px' }}>
                    🎉 Your Session Invite Key
                  </h4>
                  <div style={{
                    background: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '15px',
                    margin: '10px 0',
                    fontFamily: 'Monaco, Menlo, monospace',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    letterSpacing: '3px',
                    color: '#1976d2',
                    userSelect: 'all'
                  }}>
                    {String(session.inviteKey)}
                  </div>
                  <p style={{ margin: '10px 0 0 0', color: '#666', fontSize: '14px' }}>
                    Share this key with collaborators to join your session
                  </p>
                  <button
                    type="button"
                    className="session-btn session-btn-primary"
                    onClick={() => {
                      handleCopyLink(String(session.inviteKey));
                      setSuccess('Invite key copied to clipboard!');
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    <Copy size={16} />
                    Copy Invite Key
                  </button>
                </div>
              )}

              {inviteData.method === 'email' && (
                <form onSubmit={handleSendInvites}>
                  <div className="session-form-group">
                    <label htmlFor="emails">Email Addresses (comma-separated)</label>
                    <textarea
                      id="emails"
                      value={inviteData.emails}
                      onChange={(e) => setInviteData({ ...inviteData, emails: e.target.value })}
                      placeholder="colleague1@example.com, colleague2@example.com"
                      rows={3}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="session-form-group">
                    <label htmlFor="role">Permission Level</label>
                    <select
                      id="role"
                      value={inviteData.role}
                      onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                      disabled={isLoading}
                    >
                      <option value="editor">Editor - Can edit files and collaborate</option>
                      <option value="viewer">Viewer - Read-only access</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="session-btn session-btn-primary"
                    disabled={isLoading || !inviteData.emails.trim() || emailSent}
                  >
                    {emailSent ? (
                      <>
                        <Check size={16} />
                        Invites Sent!
                      </>
                    ) : isLoading ? (
                      <span className="session-spinner"></span>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Send Invitations
                      </>
                    )}
                  </button>
                </form>
              )}

              {inviteData.method === 'link' && (
                <div>
                  <div className="session-form-group">
                    <label>Session Invite Key</label>
                    <div className="session-link-container">
                      <input
                        type="text"
                        value={session?.inviteKey || 'No session active'}
                        readOnly
                        className="session-link-input session-input-code"
                        style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}
                      />
                      <button
                        type="button"
                        className="session-btn session-btn-secondary"
                        onClick={() => handleCopyLink(session?.inviteKey || '')}
                        disabled={!session?.inviteKey}
                      >
                        {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                        {linkCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="session-form-group">
                    <label>Share Link</label>
                    <div className="session-link-container">
                      <input
                        type="text"
                        value={session?.inviteKey ? `${window.location.origin}?inviteKey=${session.inviteKey}` : 'No session active'}
                        readOnly
                        className="session-link-input"
                      />
                      <button
                        type="button"
                        className="session-btn session-btn-secondary"
                        onClick={() => handleCopyLink(session?.inviteKey ? `${window.location.origin}?inviteKey=${session.inviteKey}` : '')}
                        disabled={!session?.inviteKey}
                      >
                        {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                        {linkCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="session-details">
                    <h4>Session Details:</h4>
                    <div className="session-details-grid">
                      <div>Session ID: <span className="session-detail-value">{session?.id || 'N/A'}</span></div>
                      <div>Session Name: <span className="session-detail-value">{session?.name || 'N/A'}</span></div>
                      <div>Invite Key: <span className="session-detail-value session-input-code">{session?.inviteKey || 'N/A'}</span></div>
                      <div>Permission: <span className="session-detail-value">Editor access</span></div>
                      <div>Max Users: <span className="session-detail-value">{session?.maxUsers || 'N/A'}</span></div>
                      <div>Expires: <span className="session-detail-value">Never (persistent session)</span></div>
                    </div>
                  </div>

                  <div className="session-share-actions">
                    <button
                      className="session-btn session-btn-primary"
                      onClick={() => {
                        if (navigator.share && session?.inviteKey) {
                          navigator.share({
                            title: 'Join my CodeCollab session',
                            text: `Join me for collaborative coding! Use invite key: ${session.inviteKey}`,
                            url: `${window.location.origin}?inviteKey=${session.inviteKey}`
                          });
                        }
                      }}
                      disabled={!session?.inviteKey}
                    >
                      <Share size={16} />
                      Share Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'sessions' && (
            <div>
              {isLoading ? (
                <div className="session-loading">
                  <span className="session-spinner"></span>
                  Loading sessions...
                </div>
              ) : userSessions.length > 0 ? (
                <div className="session-list">
                  {userSessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className="session-item-header">
                        <h4>{session.name}</h4>
                        <span className={`session-status ${session.status}`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="session-item-details">
                        <span>{session.userCount} users</span>
                        <span>Created {session.createdAt}</span>
                      </div>
                      <div className="session-item-actions">
                        <button className="session-btn session-btn-small">
                          Join
                        </button>
                        <button className="session-btn session-btn-small session-btn-secondary">
                          Manage
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="session-empty">
                  <Users size={48} />
                  <h3>No sessions found</h3>
                  <p>Create your first session to start collaborating</p>
                  <button
                    className="session-btn session-btn-primary"
                    onClick={() => switchMode('create')}
                  >
                    <Plus size={16} />
                    Create Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="session-modal-footer">
          <div className="session-tip">
            💡 <strong>Pro Tip:</strong> Share session links for instant access, or send email invitations for formal collaboration.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionModal;
