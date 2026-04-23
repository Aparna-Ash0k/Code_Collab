import React, { useState } from 'react';
import { Mail, UserPlus, Copy, Check, Share, Link, Crown, Edit, Eye, Users, Globe } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import ModernModal from './ModernModal';
import toast from 'react-hot-toast';

const InviteCollaboratorsModal = ({ isOpen, onClose }) => {
  const { session } = useSession();
  const { user } = useAuth();
  const [inviteMethod, setInviteMethod] = useState('link');
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen || !session) return null;

  const inviteLink = session?.inviteKey ? `${window.location.origin}?invite=${session.inviteKey}` : `${window.location.origin}?session=${session?.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error('Failed to copy link');
    }
  };

  const handleSendInvites = (e) => {
    e.preventDefault();
    const emails = inviteEmails.split(',').map(email => email.trim()).filter(Boolean);
    
    if (emails.length === 0) return;

    // Simulate sending invites (in production, this would call backend API)
    console.log('Sending invites to:', emails, 'with role:', inviteRole);
    setEmailSent(true);
    toast.success(`Invite${emails.length > 1 ? 's' : ''} will be sent to ${emails.length} email${emails.length > 1 ? 's' : ''}!`);
    setTimeout(() => {
      setEmailSent(false);
      setInviteEmails('');
      onClose();
    }, 2000);
  };

  const renderAccessLevelOption = (level, icon, title, description) => (
    <label key={level} className="access-level-option">
      <input
        type="radio"
        name="accessLevel"
        value={level}
        checked={inviteRole === level}
        onChange={(e) => setInviteRole(e.target.value)}
        className="sr-only"
      />
      <div className={`access-level-card ${inviteRole === level ? 'selected' : ''}`}>
        <div className="access-level-header">
          {icon}
          <span className="access-level-title">{title}</span>
        </div>
        <p className="access-level-description">{description}</p>
      </div>
    </label>
  );

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Collaborators"
      subtitle={`Share "${session.name}" with your team`}
      maxWidth="lg"
      headerActions={
        <div className="header-badges">
          <div className="badge badge-info">
            <Users size={12} />
            {session.userCount || 1} online
          </div>
        </div>
      }
    >
      {/* Invite Method Tabs */}
      <div className="tab-group">
        <button
          onClick={() => setInviteMethod('link')}
          className={`tab-button ${inviteMethod === 'link' ? 'active' : ''}`}
        >
          <Link size={16} />
          Share Link
        </button>
        <button
          onClick={() => setInviteMethod('email')}
          className={`tab-button ${inviteMethod === 'email' ? 'active' : ''}`}
        >
          <Mail size={16} />
          Send Email
        </button>
      </div>

      {/* Access Level Selection */}
      <div className="form-group">
        <label className="form-label">Choose Access Level</label>
        <div className="access-level-grid">
          {renderAccessLevelOption(
            'viewer',
            <Eye size={18} className="text-gray-500" />,
            'Viewer',
            'Can view files and see live changes but cannot edit'
          )}
          {renderAccessLevelOption(
            'editor',
            <Edit size={18} className="text-blue-500" />,
            'Editor',
            'Can view, edit, create files and collaborate in real-time'
          )}
          {renderAccessLevelOption(
            'owner',
            <Crown size={18} className="text-yellow-500" />,
            'Co-owner',
            'Full control including user management and session settings'
          )}
        </div>
      </div>

      {/* Email Invite Form */}
      {inviteMethod === 'email' && (
        <form onSubmit={handleSendInvites}>
          <div className="form-group">
            <label className="form-label">Email Addresses</label>
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses separated by commas&#10;colleague1@example.com, colleague2@example.com"
              className="form-input form-textarea"
              rows={4}
              required
            />
            <div className="form-help">
              Add multiple emails separated by commas. Each person will receive an invitation with <span className="text-accent">{inviteRole}</span> access.
            </div>
          </div>

          <div className="card">
            <div className="card-header">📧 Invitation Preview</div>
            <div className="card-content">
              <strong>{user?.name || user?.displayName || 'You'}</strong> invited you to collaborate on <strong>"{session.name}"</strong> with <span className="badge badge-info">{inviteRole}</span> access.
            </div>
          </div>

          <div className="button-group">
            <button
              type="submit"
              disabled={!inviteEmails.trim() || emailSent}
              className="button button-primary"
            >
              {emailSent ? (
                <>
                  <Check size={16} />
                  Invites Sent!
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Send Invitations
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="button button-outline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Link Sharing */}
      {inviteMethod === 'link' && (
        <div>
          <div className="form-group">
            <label className="form-label">Session Invite Link</label>
            <div className="link-input-group">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="form-input link-input"
              />
              <button
                onClick={handleCopyLink}
                className="copy-button"
              >
                {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                {linkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">🔗 Link Details</div>
            <div className="card-content">
              <div className="link-details">
                <div className="detail-row">
                  <span>Session:</span>
                  <span className="detail-value">{session.name}</span>
                </div>
                <div className="detail-row">
                  <span>Invite Key:</span>
                  <span className="detail-value mono">{session.inviteKey}</span>
                </div>
                <div className="detail-row">
                  <span>Access Level:</span>
                  <span className="detail-value">
                    <span className="badge badge-info">{inviteRole}</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span>Created by:</span>
                  <span className="detail-value">{user?.name || user?.displayName || 'You'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="info-box info-box-warning">
            <div className="info-header">
              <Globe size={16} />
              <strong>Security Notice</strong>
            </div>
            Anyone with this link can join your session with <strong>{inviteRole}</strong> access. Only share with people you trust.
          </div>

          <div className="button-group">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Join "${session.name}" on CodeCollab`,
                    text: `${user?.name || 'Someone'} invited you to collaborate on "${session.name}"`,
                    url: inviteLink
                  });
                } else {
                  handleCopyLink();
                }
              }}
              className="button button-primary"
            >
              <Share size={16} />
              Share Link
            </button>
            <button
              onClick={onClose}
              className="button button-outline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer Tip */}
      <div className="info-box info-box-info">
        <strong>💡 Pro Tip:</strong> Use share links for instant access, or send email invitations for a more formal approach. 
        You can manage individual permissions after collaborators join.
      </div>
    </ModernModal>
  );
};

export default InviteCollaboratorsModal;
