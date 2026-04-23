import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Crown, 
  Edit, 
  Eye, 
  Shield, 
  UserX, 
  Settings,
  Clock,
  MapPin,
  Mail,
  AlertTriangle,
  MoreHorizontal,
  UserPlus,
  Search,
  Filter
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import ModernModal from './ModernModal';
import toast from 'react-hot-toast';

const TeamManagementModal = ({ isOpen, onClose }) => {
  const { session } = useSession();
  const { user } = useAuth();
  
  if (!isOpen || !session) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [teamMembers, setTeamMembers] = useState([]);

  // Initialize team members from real session data
  useEffect(() => {
    const initializeTeamMembers = () => {
      const sessionUsers = session?.users || [];
      const currentUser = user;
      
      // Combine session users with current user data
      const allUsers = new Map();
      
      // Add current user as owner if authenticated
      if (currentUser?.id) {
        allUsers.set(currentUser.id, {
          id: currentUser.id,
          name: currentUser.name || currentUser.email?.split('@')[0] || 'Unknown User',
          email: currentUser.email || '',
          role: 'owner',
          joinedAt: currentUser.createdAt ? new Date(currentUser.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          lastSeen: 'Active now',
          isOnline: true,
          avatar: currentUser.avatar,
          location: currentUser.location || '',
          isCurrentUser: true
        });
      }
      
      // Add session users as collaborators
      sessionUsers.forEach(sessionUser => {
        if (sessionUser.id && sessionUser.id !== currentUser?.id) {
          allUsers.set(sessionUser.id, {
            id: sessionUser.id,
            name: sessionUser.name || sessionUser.email?.split('@')[0] || 'Collaborator',
            email: sessionUser.email || '',
            role: sessionUser.role || 'editor',
            joinedAt: sessionUser.joinedAt ? new Date(sessionUser.joinedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            lastSeen: sessionUser.isOnline ? 'Active now' : formatLastActivity(sessionUser.lastActivity),
            isOnline: sessionUser.isOnline || false,
            avatar: sessionUser.avatar,
            location: sessionUser.location || '',
            isCurrentUser: false
          });
        }
      });
      
      setTeamMembers(Array.from(allUsers.values()));
    };

    initializeTeamMembers();
  }, [session?.users, user]);

  // Helper function to format last activity
  const formatLastActivity = (lastActivity) => {
    if (!lastActivity) return 'recently';
    
    const now = new Date();
    const activityDate = new Date(lastActivity);
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return activityDate.toLocaleDateString();
  };

  // Mock team data - in production this would come from your backend
  const mockTeamMembers = [
    {
      id: 'user1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'owner',
      joinedAt: '2024-01-15',
      lastSeen: '2 minutes ago',
      isOnline: true,
      avatar: null,
      location: 'New York, US'
    },
    {
      id: 'user2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      role: 'editor',
      joinedAt: '2024-01-16',
      lastSeen: 'Active now',
      isOnline: true,
      avatar: null,
      location: 'London, UK'
    },
    {
      id: 'user3',
      name: 'Mike Johnson',
      email: 'mike.j@example.com',
      role: 'editor',
      joinedAt: '2024-01-17',
      lastSeen: '1 hour ago',
      isOnline: false,
      avatar: null,
      location: 'Toronto, CA'
    }
  ];

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = (memberId, newRole) => {
    console.log(`Changing role for ${memberId} to ${newRole}`);
    toast.success(`Role updated to ${newRole}`);
  };

  const handleRemoveMember = (memberId, memberName) => {
    console.log(`Removing member ${memberId}`);
    toast.success(`${memberName} removed from team`);
  };

  const handleBulkAction = (action) => {
    if (selectedMembers.size === 0) {
      toast.error('No members selected');
      return;
    }

    console.log(`Bulk action: ${action} for members:`, Array.from(selectedMembers));
    toast.success(`${action} applied to ${selectedMembers.size} member${selectedMembers.size > 1 ? 's' : ''}`);
    setSelectedMembers(new Set());
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner':
        return <Crown size={16} className="text-yellow-500" />;
      case 'editor':
        return <Edit size={16} className="text-blue-500" />;
      case 'viewer':
        return <Eye size={16} className="text-gray-500" />;
      default:
        return <Shield size={16} className="text-gray-400" />;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'owner':
        return 'badge-warning';
      case 'editor':
        return 'badge-primary';
      case 'viewer':
        return 'badge-secondary';
      default:
        return 'badge-info';
    }
  };

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      title="Team Management"
      subtitle={`Manage access and permissions for "${session.name}"`}
      maxWidth="xl"
      headerActions={
        <div className="header-badges">
          <div className="badge badge-info">
            <Users size={12} />
            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
          </div>
          <div className="badge badge-success">
            {teamMembers.filter(m => m.isOnline).length} online
          </div>
        </div>
      }
    >
      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-input-group">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search members by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input search-input"
          />
        </div>
        
        <div className="filter-group">
          <Filter size={16} className="filter-icon" />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="form-select filter-select"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owners</option>
            <option value="editor">Editors</option>
            <option value="viewer">Viewers</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedMembers.size > 0 && (
        <div className="bulk-actions-bar">
          <div className="bulk-selection">
            {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''} selected
          </div>
          <div className="bulk-buttons">
            <button
              onClick={() => handleBulkAction('Change Role')}
              className="button button-outline button-sm"
            >
              <Edit size={14} />
              Change Role
            </button>
            <button
              onClick={() => handleBulkAction('Remove')}
              className="button button-danger button-sm"
            >
              <UserX size={14} />
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="team-members-container">
        {filteredMembers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-icon" />
            <h3>No members found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="team-members-list">
            {filteredMembers.map((member) => (
              <div key={member.id} className={`member-card ${selectedMembers.has(member.id) ? 'selected' : ''}`}>
                <div className="member-select">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(member.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedMembers);
                      if (e.target.checked) {
                        newSelected.add(member.id);
                      } else {
                        newSelected.delete(member.id);
                      }
                      setSelectedMembers(newSelected);
                    }}
                    className="form-checkbox"
                  />
                </div>

                <div className="member-avatar">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="avatar-image" />
                  ) : (
                    <div className="avatar-placeholder">
                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                  )}
                  {member.isOnline && <div className="online-indicator" />}
                </div>

                <div className="member-info">
                  <div className="member-header">
                    <h4 className="member-name">{member.name}</h4>
                    <div className={`badge ${getRoleBadgeClass(member.role)}`}>
                      {getRoleIcon(member.role)}
                      {member.role}
                    </div>
                  </div>
                  
                  <div className="member-details">
                    <div className="detail-item">
                      <Mail size={12} />
                      <span>{member.email}</span>
                    </div>
                    <div className="detail-item">
                      <Clock size={12} />
                      <span>{member.lastSeen}</span>
                    </div>
                    {member.location && (
                      <div className="detail-item">
                        <MapPin size={12} />
                        <span>{member.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="member-meta">
                    <span className="join-date">Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                    {member.isOnline && <span className="online-status">● Online</span>}
                  </div>
                </div>

                <div className="member-actions">
                  <div className="role-selector">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className="form-select role-select"
                      disabled={member.id === user?.id} // Can't change own role
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>

                  <div className="action-buttons">
                    <button
                      className="action-button"
                      title="More options"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {member.id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        className="action-button danger"
                        title="Remove member"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Statistics */}
      <div className="team-stats">
        <div className="stat-card">
          <div className="stat-header">
            <Crown size={16} className="text-yellow-500" />
            <span>Owners</span>
          </div>
          <div className="stat-value">{teamMembers.filter(m => m.role === 'owner').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <Edit size={16} className="text-blue-500" />
            <span>Editors</span>
          </div>
          <div className="stat-value">{teamMembers.filter(m => m.role === 'editor').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <Eye size={16} className="text-gray-500" />
            <span>Viewers</span>
          </div>
          <div className="stat-value">{teamMembers.filter(m => m.role === 'viewer').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <Clock size={16} className="text-green-500" />
            <span>Online Now</span>
          </div>
          <div className="stat-value">{teamMembers.filter(m => m.isOnline).length}</div>
        </div>
      </div>

      {/* Permission Info */}
      <div className="info-box info-box-info">
        <div className="info-header">
          <Shield size={16} />
          <strong>Role Permissions</strong>
        </div>
        <div className="permissions-grid">
          <div className="permission-item">
            <Crown size={14} className="text-yellow-500" />
            <strong>Owner:</strong> Full control, user management, session settings
          </div>
          <div className="permission-item">
            <Edit size={14} className="text-blue-500" />
            <strong>Editor:</strong> Create, edit, delete files, real-time collaboration
          </div>
          <div className="permission-item">
            <Eye size={14} className="text-gray-500" />
            <strong>Viewer:</strong> Read-only access, see live changes
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="button-group">
        <button
          onClick={() => {
            // Open invite modal or handle invite action
            console.log('Opening invite modal');
            toast.success('Opening invite collaborators...');
          }}
          className="button button-primary"
        >
          <UserPlus size={16} />
          Invite More Members
        </button>
        <button
          onClick={() => {
            // Open session settings
            console.log('Opening session settings');
            toast.success('Opening session settings...');
          }}
          className="button button-outline"
        >
          <Settings size={16} />
          Session Settings
        </button>
        <button
          onClick={onClose}
          className="button button-secondary"
        >
          Close
        </button>
      </div>
    </ModernModal>
  );
};

export default TeamManagementModal;
