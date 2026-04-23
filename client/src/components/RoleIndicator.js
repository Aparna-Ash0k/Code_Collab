import React, { useContext } from 'react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { CollaborationContext } from '../contexts/CollaborationContext';
import { SessionContext } from '../contexts/SessionContext';
import './RoleIndicator.css';

const RoleIndicator = () => {
  const { currentProject, userRole } = useContext(ProjectSystemContext);
  const { isCollaborating, session } = useContext(CollaborationContext);
  const { user } = useContext(SessionContext);

  if (!currentProject || !user) {
    return null;
  }

  const getRoleInfo = () => {
    if (isCollaborating && session?.project) {
      // In collaboration mode
      if (session.isOwner) {
        return {
          role: 'Owner',
          icon: '👑',
          description: 'Project owner (sharing)',
          className: 'owner-collab'
        };
      } else {
        const role = session.collaborators?.find(c => c.id === user.id)?.role || 'viewer';
        return {
          role: role.charAt(0).toUpperCase() + role.slice(1),
          icon: role === 'editor' ? '✏️' : '👁️',
          description: `Collaborating as ${role}`,
          className: `${role}-collab`
        };
      }
    } else {
      // Solo mode
      return {
        role: userRole || 'Owner',
        icon: '👤',
        description: 'Working solo',
        className: 'solo'
      };
    }
  };

  const roleInfo = getRoleInfo();

  const getPermissionsText = () => {
    if (isCollaborating && session?.project) {
      if (session.isOwner) {
        return 'Full access • Can manage collaborators';
      } else {
        const role = session.collaborators?.find(c => c.id === user.id)?.role || 'viewer';
        switch (role) {
          case 'editor':
            return 'Can edit files • Cannot manage project';
          case 'viewer':
            return 'Read-only access';
          default:
            return 'Limited access';
        }
      }
    } else {
      return 'Full project access';
    }
  };

  return (
    <div className={`role-indicator ${roleInfo.className}`}>
      <div className="role-badge">
        <span className="role-icon">{roleInfo.icon}</span>
        <span className="role-text">{roleInfo.role}</span>
      </div>
      
      <div className="role-tooltip">
        <div className="tooltip-header">
          <span className="role-icon">{roleInfo.icon}</span>
          <span className="role-title">{roleInfo.description}</span>
        </div>
        <div className="permissions-text">
          {getPermissionsText()}
        </div>
        
        {isCollaborating && session?.project && (
          <div className="collaboration-info">
            <div className="session-info">
              Session: {session.sessionId}
            </div>
            {session.collaborators?.length > 0 && (
              <div className="collaborators-count">
                {session.collaborators.length} collaborator{session.collaborators.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleIndicator;
