import React, { useState } from 'react';
import { Crown, UserPlus, Eye, Edit, MoreVertical } from 'lucide-react';
import { useCollaboration } from '../contexts/CollaborationContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import './Modal.css';

const CollaboratorsSidebar = ({ onInviteClick }) => {
  // Safely get collaboration context
  let collaboration = null;
  try {
    collaboration = useCollaboration();
  } catch (error) {
    console.debug('Collaboration context not available in CollaboratorsSidebar');
  }
  
  const { 
    getCollaboratorsArray = () => [], 
    getFileActivitiesArray = () => [], 
    getUserRole = () => null,
    isSessionOwner = () => false,
    canManageRoles = () => false,
    updateCollaboratorRole = () => {}
  } = collaboration || {};
  
  const { session } = useSession();
  const { user } = useAuth();
  const [expandedCollaborator, setExpandedCollaborator] = useState(null);

  const collaborators = getCollaboratorsArray();
  const fileActivities = getFileActivitiesArray();
  const currentUserId = user?.uid || user?.id;
  const currentUserRole = getUserRole(currentUserId);
  const isOwner = isSessionOwner(currentUserId);
  const canManage = canManageRoles(currentUserId);

  // Get current file activity for each collaborator
  const getCollaboratorStatus = (collaboratorId) => {
    const activity = fileActivities.find(a => a.userId === collaboratorId);
    if (!activity) return { status: '👀', file: 'Viewing project', isEditing: false };
    
    const timeSinceActivity = Date.now() - activity.timestamp;
    const isRecentlyActive = timeSinceActivity < 30000; // 30 seconds
    
    return {
      status: isRecentlyActive ? '✍️' : '👀',
      file: isRecentlyActive ? activity.fileName : 'Viewing project',
      isEditing: isRecentlyActive
    };
  };

  // Generate user initials from name
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCollaboratorClick = (collaboratorId) => {
    setExpandedCollaborator(
      expandedCollaborator === collaboratorId ? null : collaboratorId
    );
  };

  const handleRoleChange = (collaboratorId, newRole) => {
    if (canManage) {
      updateCollaboratorRole(collaboratorId, newRole);
      setExpandedCollaborator(null);
    }
  };

  const renderCollaborator = (collaborator) => {
    const status = getCollaboratorStatus(collaborator.id);
    const role = getUserRole(collaborator.id) || 'editor';
    const initials = getUserInitials(collaborator.name);
    const isExpanded = expandedCollaborator === collaborator.id;

    return (
      <div key={collaborator.id} className="collaborator-item">
        <div 
          className="collaborator-main"
          onClick={() => handleCollaboratorClick(collaborator.id)}
        >
          {/* Avatar with cursor color */}
          <div 
            className="collaborator-avatar"
            style={{ backgroundColor: collaborator.color }}
            title={collaborator.name}
          >
            {initials}
          </div>

          {/* Collaborator info */}
          <div className="collaborator-info">
            <div className="collaborator-name">
              {collaborator.name}
              {role === 'owner' && (
                <Crown size={12} className="inline ml-1 text-yellow-500" />
              )}
            </div>
            <div className="collaborator-status">
              <span className="status-emoji">{status.status}</span>
              <span className="status-text">{status.file}</span>
            </div>
          </div>

          {/* Activity indicator */}
          {status.isEditing && (
            <div className="activity-indicator" title="Currently editing">
              <div className="activity-pulse"></div>
            </div>
          )}

          {/* More actions */}
          {canManage && collaborator.id !== currentUserId && role !== 'owner' && (
            <button 
              className="collaborator-actions"
              onClick={(e) => {
                e.stopPropagation();
                handleCollaboratorClick(collaborator.id);
              }}
            >
              <MoreVertical size={14} />
            </button>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="collaborator-details">
            <div className="detail-row">
              <span className="detail-label">Access:</span>
              <span className={`access-badge access-${role}`}>
                {role === 'owner' && <Crown size={10} />}
                {role === 'editor' && <Edit size={10} />}
                {role === 'viewer' && <Eye size={10} />}
                {role}
              </span>
            </div>
            {collaborator.email && (
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{collaborator.email}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value">
                {status.isEditing ? 'Actively editing' : 'Viewing'}
              </span>
            </div>
            {/* Role management for session owners */}
            {canManage && collaborator.id !== currentUserId && role !== 'owner' && (
              <div className="detail-row">
                <span className="detail-label">Change Role:</span>
                <div className="role-options">
                  <button 
                    onClick={() => handleRoleChange(collaborator.id, 'editor')}
                    className={`role-option ${role === 'editor' ? 'active' : ''}`}
                  >
                    <Edit size={10} />
                    Editor
                  </button>
                  <button 
                    onClick={() => handleRoleChange(collaborator.id, 'viewer')}
                    className={`role-option ${role === 'viewer' ? 'active' : ''}`}
                  >
                    <Eye size={10} />
                    Viewer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCurrentUser = () => {
    const role = currentUserRole || 'editor';
    const initials = getUserInitials(user?.name || user?.displayName);

    return (
      <div className="collaborator-item current-user">
        <div className="collaborator-main">
          {/* User's avatar */}
          <div 
            className="collaborator-avatar"
            style={{ backgroundColor: '#007ACC' }} // VS Code blue
          >
            {initials}
          </div>

          {/* User info */}
          <div className="collaborator-info">
            <div className="collaborator-name">
              {user?.name || user?.displayName || 'You'}
              {role === 'owner' && (
                <Crown size={12} className="inline ml-1 text-yellow-500" />
              )}
            </div>
            <div className="collaborator-status">
              <span className="status-emoji">✍️</span>
              <span className="status-text">You are here</span>
            </div>
          </div>

          {/* Current user indicator */}
          <div className="current-user-badge">You</div>
        </div>
      </div>
    );
  };

  // Only show collaborators panel during active collaboration sessions
  if (!session) {
    return null; // Hide completely when not in a session
  }

  return (
    <div className="collaborators-sidebar">
      <div className="collaborators-header">
        <h3 className="collaborators-title">
          Collaborators ({collaborators.length + 1})
        </h3>
        {isOwner && (
          <button 
            className="invite-button"
            onClick={onInviteClick}
            title="Invite collaborators"
          >
            <UserPlus size={14} />
          </button>
        )}
      </div>

      <div className="collaborators-list">
        {/* Current user always shown first */}
        {renderCurrentUser()}

        {/* Other collaborators */}
        {collaborators.map(renderCollaborator)}

        {/* Invite button for owners when no collaborators */}
        {isOwner && collaborators.length === 0 && (
          <div className="invite-prompt">
            <button 
              className="invite-prompt-button"
              onClick={onInviteClick}
            >
              <UserPlus size={16} />
              <span>Invite collaborators</span>
            </button>
            <p className="invite-prompt-text">
              Share your session to start collaborating
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollaboratorsSidebar;
