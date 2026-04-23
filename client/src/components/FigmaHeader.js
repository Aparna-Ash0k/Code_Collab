import React, { useState, useEffect, useRef } from 'react';
import { Users, Wifi, WifiOff, Settings, Bell, Sun, Moon, Share, Key, UserPlus, LogOut, User, ChevronDown, Sidebar, MessageCircle, MousePointer, Columns, Clock, Folder } from 'lucide-react';
import TinyProfileModal from './TinyProfileModal';
import TinyRecentFilesModal from './TinyRecentFilesModal';
import ProjectSelectorModal from './ProjectSelectorModal';
import RoomButton from './RoomButton';
import { useSession } from '../contexts/SessionContext';

const FigmaHeader = ({ 
  projectName = "CodeCollab", 
  isConnected = false, 
  collaborators = [], 
  user,
  isAuthenticated,
  onLogin,
  onLogout,
  onSettings,
  onProfile,
  onRecentFiles,
  theme = 'light',
  onThemeToggle,
  onSessionManager,
  onJoinSession,
  sessionInfo,
  rightPanelOpen = true,
  onToggleRightPanel,
  activeRightPanel = 'cursors',
  onSwitchRightPanel,
  splitScreenMode = false,
  onToggleSplitScreen,
  canUseSplitScreen = false,
  onTeamManagement,
  onProjectSharing,
  currentProject,
  onProjectChange,
  socket
}) => {
  const [showTinyProfile, setShowTinyProfile] = useState(false);
  const [showTinyRecentFiles, setShowTinyRecentFiles] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const { leaveSession } = useSession();

  // User color assignment function
  const getUserColor = (index) => {
    const colors = [
      'user-color-1', 'user-color-2', 'user-color-3', 
      'user-color-4', 'user-color-5', 'user-color-6'
    ];
    return colors[index % colors.length];
  };

  // Get user initials
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleProjectSelect = (project) => {
    if (onProjectChange) {
      onProjectChange(project);
    }
  };

  return (
    <header className="figma-header compact-header">
      <div className="project-info">
        <button 
          className="project-title project-selector-button"
          onClick={() => setShowProjectModal(true)}
          title="Select project"
        >
          <div className="logo-container" style={{ 
            width: '16px', 
            height: '16px', 
            backgroundColor: '#007acc', 
            borderRadius: '4px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            <img 
              src="/logo512.png" 
              alt="CodeCollab Logo" 
              style={{ width: '14px', height: '14px', objectFit: 'contain' }}
            />
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentProject ? currentProject.name : projectName}
          </span>
          <ChevronDown size={12} className="ml-1 opacity-60" />
        </button>
        <div className="project-status">
          {/* Show collaboration status only when in a session */}
          {sessionInfo ? (
            <>
              <div className={`status-indicator ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Live' : 'Offline'}</span>
              <span className="text-gray-400">•</span>
              <span>Collaborating</span>
            </>
          ) : (
            <>
              <div className="status-indicator bg-blue-500"></div>
              <span>Local</span>
              <span className="text-gray-400">•</span>
              <span>Editing</span>
            </>
          )}
        </div>
      </div>

      <div className="header-actions">
        {/* Recent Files Button */}
        <button
          onClick={() => setShowTinyRecentFiles(true)}
          className="header-button"
          title="Recent Files"
        >
          <Clock size={14} />
        </button>

        {/* Room Collaboration Button */}
        <RoomButton socket={socket} />

        {/* Session Actions - Single button for both join and create */}
        {isAuthenticated && (
          <button 
            onClick={sessionInfo ? onSessionManager : onJoinSession}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            title={sessionInfo ? "Manage Session & Invite Collaborators" : "Join or Create Session"}
          >
            <UserPlus size={16} className="text-gray-600" />
          </button>
        )}

        {/* Project Sharing */}
        {isAuthenticated && sessionInfo && (
          <button 
            onClick={onProjectSharing}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            title="Share Project or Start New Project"
          >
            <Share size={16} className="text-gray-600" />
          </button>
        )}

        {/* Theme Toggle */}
        <button 
          onClick={onThemeToggle}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon size={16} className="text-gray-600" /> : <Sun size={16} className="text-gray-600" />}
        </button>

        {/* Split Screen Toggle */}
        <button 
          onClick={onToggleSplitScreen}
          disabled={!canUseSplitScreen}
          className={`p-1.5 rounded-md transition-colors ${
            splitScreenMode 
              ? 'bg-blue-100 text-blue-600' 
              : canUseSplitScreen 
                ? 'hover:bg-gray-100 text-gray-600' 
                : 'text-gray-300 cursor-not-allowed'
          }`}
          title={
            !canUseSplitScreen 
              ? 'Open at least 2 files to use split screen' 
              : splitScreenMode 
                ? 'Exit split screen (Ctrl+\\)' 
                : 'Enter split screen (Ctrl+\\)'
          }
        >
          <Columns size={16} />
        </button>

        {/* Right Panel Toggle - Only show during active collaboration sessions */}
        {sessionInfo && (
          <button
            onClick={onToggleRightPanel}
            className={`p-1.5 rounded-md transition-colors ${
              rightPanelOpen 
                ? 'bg-blue-100 text-blue-600' 
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={rightPanelOpen ? 'Hide collaboration panel' : 'Show collaboration panel'}
          >
            <Sidebar size={16} />
          </button>
        )}

        {/* Team Management - Only show during active collaboration sessions */}
        {isAuthenticated && sessionInfo && (
          <button 
            onClick={onTeamManagement}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            title="Team Management"
          >
            <Users size={16} className="text-gray-600" />
          </button>
        )}

        {/* Settings */}
        <button 
          onClick={onSettings}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <Settings size={16} className="text-gray-600" />
        </button>

        {/* Connection Status - Only show when authenticated and connected to session */}
        {isAuthenticated && sessionInfo && (
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
          </div>
        )}

        {/* Collaborators Avatars */}
        <div className="user-avatars">
          {isAuthenticated && user && (
            <div className="relative">
              <button
                onClick={() => setShowTinyProfile(true)}
                className={`user-avatar ${getUserColor(0)} hover:ring-2 hover:ring-blue-300 transition-all cursor-pointer flex items-center`}
                title={user.name || user.email}
              >
                {getInitials(user.name || user.email)}
                <ChevronDown size={12} className="ml-1 opacity-60" />
              </button>
            </div>
          )}
          
          {/* Collaborator Avatars - Only show during active collaboration sessions */}
          {sessionInfo && collaborators.slice(0, 4).map((collaborator, index) => (
            <div
              key={collaborator.id || index}
              className={`user-avatar ${getUserColor(index + 1)}`}
              title={collaborator.name}
            >
              {getInitials(collaborator.name)}
            </div>
          ))}
          
          {sessionInfo && collaborators.length > 4 && (
            <div className="user-avatar bg-gray-400">
              +{collaborators.length - 4}
            </div>
          )}
          
          {!isAuthenticated && (
            <button
              onClick={onLogin}
              className="user-avatar bg-blue-500 hover:bg-blue-600 transition-colors"
              title="Sign in to collaborate"
            >
              <Users size={16} />
            </button>
          )}
        </div>

        {/* Online Count - Only show when authenticated */}
        {isAuthenticated && (
          <div className="text-sm text-gray-600">
            {sessionInfo?.userCount || 1} online
          </div>
        )}
      </div>

      {/* Tiny Modals */}
      <TinyProfileModal 
        isOpen={showTinyProfile}
        onClose={() => setShowTinyProfile(false)}
        onProfile={onProfile}
        onLogout={onLogout}
      />

      <TinyRecentFilesModal 
        isOpen={showTinyRecentFiles}
        onClose={() => setShowTinyRecentFiles(false)}
      />

      <ProjectSelectorModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onProjectSelect={handleProjectSelect}
        currentProject={currentProject}
      />
    </header>
  );
};

export default FigmaHeader;
