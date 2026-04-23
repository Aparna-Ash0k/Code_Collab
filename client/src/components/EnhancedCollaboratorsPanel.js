import React, { useState } from 'react';
import { Users, MessageCircle, MousePointer, X, Settings } from 'lucide-react';
import { useCollaboration } from '../contexts/CollaborationContext';
import { useAuth } from '../contexts/AuthContext';
import LiveCursors from './LiveCursors';
import FigmaChatPanel from './FigmaChatPanel';
import './EnhancedCollaboratorsPanel.css';

const EnhancedCollaboratorsPanel = ({ 
  isOpen, 
  onClose, 
  activePanel = 'cursors',
  onSwitchPanel,
  collaborators: propCollaborators = [],
  currentUser,
  sessionInfo,
  messages = [],
  onSendMessage,
  isConnected = false
}) => {
  const [showAccessControls, setShowAccessControls] = useState(false);
  
  // Safely get collaboration context
  let collaboration = null;
  try {
    collaboration = useCollaboration();
  } catch (error) {
    console.debug('Collaboration context not available in EnhancedCollaboratorsPanel');
  }
  
  const { 
    getActiveCollaborators = () => [], 
    getUserAccessLevel = () => 'viewer', 
    updateUserAccessRights = () => {},
    isProjectOwner = () => false,
    projectMetadata = null,
    projectMode = null 
  } = collaboration || {};
  
  const { user } = useAuth();

  // Use collaborators from props if available, otherwise use context
  const collaborators = propCollaborators.length > 0 ? propCollaborators : getActiveCollaborators();
  const currentUserAccess = getUserAccessLevel(user?.id || user?.uid);
  const isOwner = isProjectOwner(user?.id || user?.uid);

  if (!isOpen) return null;

  const handleAccessLevelChange = (userId, newAccessLevel) => {
    if (!isOwner) return;
    updateUserAccessRights(userId, newAccessLevel);
  };

  const getAccessLevelColor = (accessLevel) => {
    switch (accessLevel) {
      case 'owner': return '#28a745';
      case 'editor': return '#007acc';
      case 'viewer': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getAccessLevelIcon = (accessLevel) => {
    switch (accessLevel) {
      case 'owner': return '👑';
      case 'editor': return '✏️';
      case 'viewer': return '👁️';
      default: return '❓';
    }
  };

  const formatJoinTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="figma-right-panel">
      {/* Right Panel Header */}
      <div className="figma-right-panel-header">
        <div className="figma-right-panel-tabs">
          <button 
            className={`figma-right-panel-tab ${activePanel === 'cursors' ? 'active' : ''}`}
            onClick={() => onSwitchPanel && onSwitchPanel('cursors')}
          >
            <MousePointer size={16} />
            Live Cursors
          </button>
          <button 
            className={`figma-right-panel-tab ${activePanel === 'chat' ? 'active' : ''}`}
            onClick={() => onSwitchPanel && onSwitchPanel('chat')}
          >
            <MessageCircle size={16} />
            Chat
          </button>
        </div>
        <button 
          className="figma-right-panel-close"
          onClick={onClose}
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Right Panel Content */}
      <div className="figma-right-panel-content">
        {activePanel === 'cursors' && <LiveCursors />}
        
        {activePanel === 'chat' && (
          <FigmaChatPanel
            messages={messages}
            onSendMessage={onSendMessage}
            currentUser={currentUser}
            collaborators={collaborators}
            isConnected={isConnected}
            sessionInfo={sessionInfo}
          />
        )}
      </div>
    </div>
  );
};

export default EnhancedCollaboratorsPanel;