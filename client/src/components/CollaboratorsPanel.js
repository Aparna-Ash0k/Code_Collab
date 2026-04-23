import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Crown, 
  Shield, 
  Eye, 
  Edit3, 
  MoreVertical, 
  Mail,
  MessageCircle,
  UserX,
  Settings,
  FolderOpen,
  Rocket
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCollaboration } from '../contexts/CollaborationContext';
import AuthGuard from './AuthGuard';

const CollaboratorItem = ({ collaborator, onUpdateRole, onRemove, onMessage, isOwner }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return <Crown size={12} className="text-vscode-warning" />;
      case 'editor': return <Edit3 size={12} className="text-vscode-accent" />;
      case 'viewer': return <Eye size={12} className="text-vscode-text-muted" />;
      default: return <Shield size={12} className="text-vscode-text-muted" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-vscode-success';
      case 'away': return 'bg-vscode-warning';
      case 'busy': return 'bg-vscode-error';
      default: return 'bg-vscode-text-muted';
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 hover:bg-vscode-hover rounded group">
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-vscode-accent flex items-center justify-center text-white text-sm font-medium">
          {collaborator.avatar || collaborator.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-vscode-panel ${getStatusColor(collaborator.status)}`}></div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-vscode-text font-medium truncate">
            {collaborator.name}
          </span>
          {getRoleIcon(collaborator.role)}
        </div>
        <div className="text-xs text-vscode-text-muted truncate">
          {collaborator.email}
        </div>
        <div className="text-xs text-vscode-text-secondary">
          {collaborator.lastActivity}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMessage(collaborator)}
          className="p-1 hover:bg-vscode-bg rounded text-vscode-text-secondary hover:text-vscode-text"
          title="Send Message"
        >
          <MessageCircle size={12} />
        </button>
        
        {isOwner && collaborator.role !== 'owner' && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-vscode-bg rounded text-vscode-text-secondary hover:text-vscode-text"
              title="More Options"
            >
              <MoreVertical size={12} />
            </button>
            
            {showMenu && (
              <div className="absolute top-full right-0 mt-1 bg-vscode-panel border border-vscode-border rounded shadow-lg z-50 min-w-32">
                <div className="py-1">
                  <button 
                    onClick={() => onUpdateRole(collaborator.id, 'editor')}
                    className="w-full text-left px-3 py-1 text-xs text-vscode-text hover:bg-vscode-hover flex items-center gap-2"
                  >
                    <Edit3 size={10} />
                    Make Editor
                  </button>
                  <button 
                    onClick={() => onUpdateRole(collaborator.id, 'viewer')}
                    className="w-full text-left px-3 py-1 text-xs text-vscode-text hover:bg-vscode-hover flex items-center gap-2"
                  >
                    <Eye size={10} />
                    Make Viewer
                  </button>
                  <hr className="border-vscode-border my-1" />
                  <button 
                    onClick={() => onRemove(collaborator.id)}
                    className="w-full text-left px-3 py-1 text-xs text-vscode-error hover:bg-vscode-hover flex items-center gap-2"
                  >
                    <UserX size={10} />
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CollaboratorsPanel = () => {
  const { user } = useAuth();
  
  const [collaborators, setCollaborators] = useState([
    {
      id: user?.id || 1,
      name: user?.name || "You",
      email: user?.email || "user@codecollab.com",
      role: "owner",
      status: "online",
      avatar: user?.name?.charAt(0)?.toUpperCase() || "U",
      lastActivity: "now",
      joinedAt: "3 days ago"
    },
    {
      id: 2,
      name: "John Doe",
      email: "john@example.com",
      role: "editor",
      status: "online",
      avatar: "JD",
      lastActivity: "2 mins ago",
      joinedAt: "2 hours ago"
    },
    {
      id: 3,
      name: "Jane Smith",
      email: "jane@example.com",
      role: "editor",
      status: "away",
      avatar: "JS",
      lastActivity: "15 mins ago",
      joinedAt: "4 hours ago"
    },
    {
      id: 4,
      name: "Mike Johnson",
      email: "mike@example.com",
      role: "viewer",
      status: "online",
      avatar: "MJ",
      lastActivity: "1 min ago",
      joinedAt: "1 day ago"
    }
  ]);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');

  const currentUser = collaborators.find(c => c.id === (user?.id || 1));
  const onlineCollaborators = collaborators.filter(c => c.status === 'online');
  const awayCollaborators = collaborators.filter(c => c.status === 'away');

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    // Simulate sending invite
    console.log(`Inviting ${inviteEmail} as ${inviteRole}`);
    setInviteEmail('');
    setShowInviteForm(false);
    
    // Add pending invitation to UI
    // In real app, this would be handled by the server
  };

  const handleUpdateRole = (userId, newRole) => {
    setCollaborators(prev => 
      prev.map(c => c.id === userId ? { ...c, role: newRole } : c)
    );
  };

  const handleRemoveCollaborator = (userId) => {
    if (window.confirm('Are you sure you want to remove this collaborator?')) {
      setCollaborators(prev => prev.filter(c => c.id !== userId));
    }
  };

  const handleMessage = (collaborator) => {
    console.log(`Opening chat with ${collaborator.name}`);
    // Switch to chat panel and start conversation
  };

  return (
    <AuthGuard
      fallback={
        <div className="p-4 text-center">
          <div className="text-text-tertiary text-sm mb-3">
            Collaborators panel is only available for authenticated users
          </div>
          <button
            onClick={() => {/* This will be handled by the parent component */}}
            className="px-3 py-1 bg-bg-accent text-white text-sm rounded hover:bg-bg-accent-hover"
          >
            Sign In to Collaborate
          </button>
        </div>
      }
    >
      <div className="bg-vscode-panel h-full overflow-y-auto text-sm">
      {/* Header */}
      <div className="p-3 border-b border-vscode-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-vscode-text uppercase tracking-wide">
            Collaborators
          </h3>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="p-1 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text"
            title="Invite Collaborator"
          >
            <UserPlus size={12} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-vscode-bg rounded">
            <div className="text-vscode-success font-medium">{onlineCollaborators.length}</div>
            <div className="text-vscode-text-muted">Online</div>
          </div>
          <div className="text-center p-2 bg-vscode-bg rounded">
            <div className="text-vscode-accent font-medium">{collaborators.length}</div>
            <div className="text-vscode-text-muted">Total</div>
          </div>
          <div className="text-center p-2 bg-vscode-bg rounded">
            <div className="text-vscode-warning font-medium">{awayCollaborators.length}</div>
            <div className="text-vscode-text-muted">Away</div>
          </div>
        </div>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <form onSubmit={handleInvite} className="p-3 border-b border-vscode-border bg-vscode-bg">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-vscode-text-muted block mb-1">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full px-2 py-1 bg-vscode-panel border border-vscode-border rounded text-vscode-text text-xs focus:outline-none focus:border-vscode-accent"
                required
              />
            </div>
            <div>
              <label className="text-xs text-vscode-text-muted block mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-2 py-1 bg-vscode-panel border border-vscode-border rounded text-vscode-text text-xs focus:outline-none focus:border-vscode-accent"
              >
                <option value="editor">Editor (can edit files)</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1 bg-vscode-accent hover:bg-vscode-accent-hover text-white rounded text-xs font-medium"
              >
                <Mail size={10} className="inline mr-1" />
                Send Invite
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-3 py-1 bg-vscode-hover hover:bg-vscode-text-muted text-vscode-text rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Online Collaborators */}
      {onlineCollaborators.length > 0 && (
        <div className="p-3 border-b border-vscode-border">
          <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-vscode-success rounded-full"></div>
            Online Now ({onlineCollaborators.length})
          </div>
          <div className="space-y-1">
            {onlineCollaborators.map((collaborator) => (
              <CollaboratorItem
                key={collaborator.id}
                collaborator={collaborator}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveCollaborator}
                onMessage={handleMessage}
                isOwner={currentUser?.id === collaborator.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Away Collaborators */}
      {awayCollaborators.length > 0 && (
        <div className="p-3 border-b border-vscode-border">
          <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-vscode-warning rounded-full"></div>
            Away ({awayCollaborators.length})
          </div>
          <div className="space-y-1">
            {awayCollaborators.map((collaborator) => (
              <CollaboratorItem
                key={collaborator.id}
                collaborator={collaborator}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveCollaborator}
                onMessage={handleMessage}
                isOwner={currentUser?.id === collaborator.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Permissions Guide */}
      <div className="p-3">
        <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3">
          Role Permissions
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Crown size={12} className="text-vscode-warning" />
            <span className="text-vscode-text">Owner:</span>
            <span className="text-vscode-text-muted">Full project control</span>
          </div>
          <div className="flex items-center gap-2">
            <Edit3 size={12} className="text-vscode-accent" />
            <span className="text-vscode-text">Editor:</span>
            <span className="text-vscode-text-muted">Can edit and create files</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye size={12} className="text-vscode-text-muted" />
            <span className="text-vscode-text">Viewer:</span>
            <span className="text-vscode-text-muted">Read-only access</span>
          </div>
        </div>
      </div>
      </div>
    </AuthGuard>
  );
};

export default CollaboratorsPanel;
