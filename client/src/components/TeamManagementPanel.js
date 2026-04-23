import React, { useState } from 'react';
import { usePermissions } from '../contexts/PermissionsContext';
import '../styles/vscode-theme.css';

const TeamManagementPanel = ({ isOpen, onClose }) => {
  const {
    projectMembers,
    getAllRoles,
    addProjectMember,
    removeProjectMember,
    updateUserRole,
    hasPermission,
    getUIPermissions,
    getCurrentUserRole,
    PERMISSIONS,
    ROLES
  } = usePermissions();

  const [activeTab, setActiveTab] = useState('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: ROLES.DEVELOPER.id
  });

  const uiPermissions = getUIPermissions();
  const allRoles = getAllRoles();
  const currentUserRole = getCurrentUserRole() || { name: 'Guest', color: '#6b7280' }; // Default fallback

  const handleInviteMember = (e) => {
    e.preventDefault();
    try {
      addProjectMember({
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
        avatar: null
      });
      setInviteForm({ email: '', name: '', role: ROLES.DEVELOPER.id });
      setShowInviteModal(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    try {
      updateUserRole(userId, newRole);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRemoveMember = (userId) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      try {
        removeProjectMember(userId);
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityStatus = (lastActive) => {
    const now = new Date();
    const lastActiveDate = new Date(lastActive);
    const diffInMinutes = (now - lastActiveDate) / (1000 * 60);
    
    if (diffInMinutes < 5) return { status: 'online', text: 'Online' };
    if (diffInMinutes < 30) return { status: 'away', text: 'Away' };
    return { status: 'offline', text: 'Offline' };
  };

  if (!isOpen) return null;

  return (
    <div className="team-management-overlay">
      <div className="team-management-panel">
        {/* Header */}
        <div className="team-management-header">
          <div className="team-management-title">
            <h2>Team Management</h2>
            <span className="team-management-subtitle">
              Manage project members and permissions
            </span>
          </div>
          <button className="team-management-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="team-management-nav">
          <button 
            className={`team-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Members ({projectMembers.length})
          </button>
          <button 
            className={`team-tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 15l-3-3h6l-3 3z" fill="currentColor"/>
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Roles ({Object.keys(allRoles).length})
          </button>
        </div>

        {/* Content */}
        <div className="team-management-content">
          {activeTab === 'members' && (
            <div className="members-tab">
              {/* Current User Info */}
              <div className="current-user-info">
                <div className="current-user-badge">
                  <div className="role-indicator" style={{ backgroundColor: currentUserRole.color }}>
                    {currentUserRole.name.charAt(0)}
                  </div>
                  <span>You are a <strong>{currentUserRole.name}</strong></span>
                </div>
                {uiPermissions.canManageUsers && (
                  <button 
                    className="invite-button"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                      <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2"/>
                      <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Invite Member
                  </button>
                )}
              </div>

              {/* Members List */}
              <div className="members-list">
                <div className="members-header">
                  <span>Team Members</span>
                </div>
                {projectMembers.map(member => {
                  const memberRole = allRoles[member.role] || { name: 'Unknown', color: '#6b7280' };
                  const activityStatus = getActivityStatus(member.lastActive);
                  
                  return (
                    <div key={member.id} className="member-item">
                      <div className="member-info">
                        <div className="member-avatar">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} />
                          ) : (
                            <div className="avatar-placeholder">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className={`activity-indicator ${activityStatus.status}`} 
                               title={activityStatus.text}></div>
                        </div>
                        <div className="member-details">
                          <div className="member-name">
                            {member.name}
                            {member.isCurrentUser && <span className="you-badge">You</span>}
                          </div>
                          <div className="member-email">{member.email}</div>
                          <div className="member-joined">
                            Joined {formatDate(member.joinedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="member-actions">
                        <div className="member-role">
                          {uiPermissions.canManageRoles && !member.isCurrentUser ? (
                            <select 
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="role-select"
                            >
                              {Object.values(allRoles).map(role => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span 
                              className="role-badge"
                              style={{ backgroundColor: memberRole.color }}
                            >
                              {memberRole.name}
                            </span>
                          )}
                        </div>
                        {uiPermissions.canManageUsers && !member.isCurrentUser && (
                          <button 
                            className="remove-member-btn"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remove member"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="roles-tab">
              <div className="roles-list">
                <div className="roles-header">
                  <span>Available Roles</span>
                  {uiPermissions.canManageRoles && (
                    <button className="create-role-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
                        <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      Create Role
                    </button>
                  )}
                </div>
                {Object.values(allRoles).map(role => (
                  <div key={role.id} className="role-item">
                    <div className="role-info">
                      <div className="role-header">
                        <div 
                          className="role-color-indicator"
                          style={{ backgroundColor: role.color || '#6b7280' }}
                        ></div>
                        <div className="role-name">{role.name}</div>
                        {role.isCustom && <span className="custom-badge">Custom</span>}
                      </div>
                      <div className="role-description">{role.description}</div>
                      <div className="role-permissions">
                        <span className="permissions-count">
                          {role.permissions?.length || 0} permissions
                        </span>
                        <div className="permission-tags">
                          {role.permissions.slice(0, 3).map(permission => (
                            <span key={permission} className="permission-tag">
                              {permission.replace('_', ' ')}
                            </span>
                          ))}
                          {role.permissions.length > 3 && (
                            <span className="permission-tag more">
                              +{role.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="role-actions">
                      <span className="members-count">
                        {projectMembers.filter(m => m.role === role.id).length} members
                      </span>
                      {role.isCustom && uiPermissions.canManageRoles && (
                        <div className="role-action-buttons">
                          <button className="edit-role-btn" title="Edit role">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                          </button>
                          <button className="delete-role-btn" title="Delete role">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="invite-modal-overlay">
          <div className="invite-modal">
            <div className="invite-modal-header">
              <h3>Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleInviteMember} className="invite-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter member name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                >
                  {Object.values(allRoles).map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="invite-modal-actions">
                <button type="button" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="invite-submit-btn">
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagementPanel;
