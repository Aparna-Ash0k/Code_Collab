import React from 'react';
import { User, Settings, LogOut, Shield, Mail, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';

const TinyProfileModal = ({ isOpen, onClose, onProfile, onLogout }) => {
  const { user } = useAuth();
  const { leaveSession, session } = useSession();

  if (!isOpen) return null;

  const handleProfileClick = () => {
    onClose();
    onProfile && onProfile();
  };

  const handleLogoutClick = () => {
    onClose();
    onLogout && onLogout();
  };

  const handleLeaveSession = () => {
    leaveSession();
    onClose();
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="tiny-modal-overlay" onClick={onClose}>
      <div className="tiny-profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* User Info Header */}
        <div className="tiny-profile-header">
          <div className="tiny-profile-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="avatar-image" />
            ) : (
              <div className="avatar-initials">
                {getInitials(user?.name || user?.displayName)}
              </div>
            )}
            <div className="status-indicator online"></div>
          </div>
          <div className="tiny-profile-info">
            <h3 className="profile-name">{user?.name || user?.displayName || 'User'}</h3>
            <p className="profile-email">{user?.email || 'No email'}</p>
            {user?.role && (
              <div className="profile-role">
                <Shield size={12} />
                <span>{user.role}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="tiny-profile-stats">
          <div className="stat-item">
            <Calendar size={14} />
            <span>Member since {new Date(user?.createdAt || Date.now()).getFullYear()}</span>
          </div>
          {user?.emailVerified && (
            <div className="stat-item verified">
              <Mail size={14} />
              <span>Verified</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="tiny-profile-actions">
          {session && (
            <button
              onClick={handleLeaveSession}
              className="action-button leave-session"
            >
              <LogOut size={16} />
              <span>Leave Session</span>
            </button>
          )}
          
          <button
            onClick={handleProfileClick}
            className="action-button profile"
          >
            <User size={16} />
            <span>Profile Settings</span>
          </button>
          
          <button
            onClick={handleLogoutClick}
            className="action-button logout"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TinyProfileModal;
