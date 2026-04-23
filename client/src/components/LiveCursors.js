import React, { useState, useEffect } from 'react';
import { Mouse, Eye, Code, FileText, Users, Clock } from 'lucide-react';
import { useCollaboration } from '../contexts/CollaborationContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { useFileSystem } from '../contexts/FileSystemContext';

const CursorIndicator = ({ user, position, color, isActive, onFollow }) => (
  <div 
    className={`group flex items-center gap-2 p-2 rounded hover:bg-vscode-hover transition-all relative ${
      isActive ? 'bg-vscode-hover' : ''
    }`}
  >
    <div 
      className="w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    ></div>
    <div className="flex-1 min-w-0">
      <div className="text-sm text-vscode-text truncate">{user.name}</div>
      <div className="text-xs text-vscode-text-muted">
        {position.file ? (
          <span className="flex items-center gap-1">
            <FileText size={10} />
            {position.file} • Line {position.line}, Col {position.column}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Eye size={10} />
            Viewing project
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1">
      {user.isEditing && (
        <div className="w-2 h-2 bg-vscode-warning rounded-full animate-pulse" title="Currently editing"></div>
      )}
      <div className={`text-xs px-1 py-0.5 rounded ${
        user.isOwner ? 'bg-vscode-warning text-black' :
        user.role === 'editor' ? 'bg-vscode-accent text-white' :
        'bg-vscode-text-muted text-vscode-bg'
      }`}>
        {user.isOwner ? 'owner' : user.role || 'member'}
      </div>
    </div>
    {position.file && onFollow && (
      <button
        onClick={() => onFollow(user.id, position)}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-vscode-bg rounded text-vscode-text-secondary hover:text-vscode-text transition-opacity"
        title={`Jump to ${user.name}'s cursor`}
      >
        <Mouse size={12} />
      </button>
    )}
  </div>
);

const ActivityItem = ({ activity, timeAgo }) => (
  <div className="flex items-center gap-2 text-xs py-1">
    <div 
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: activity.userColor }}
    ></div>
    <span className="text-vscode-text">{activity.userName}</span>
    <span className="text-vscode-text-muted">editing</span>
    <span className="text-vscode-accent truncate">{activity.fileName}</span>
    <span className="text-vscode-text-muted">• {timeAgo}</span>
  </div>
);

const LiveCursors = () => {
  const { 
    cursors, 
    fileActivities, 
    collaborators, 
    getCursorsForFile, 
    getCollaboratorsArray, 
    getFileActivitiesArray 
  } = useCollaboration();
  const { session } = useSession();
  const { user } = useAuth();
  const { getCurrentTab, openFile, setActiveTab, tabs } = useFileSystem();
  
  const [selectedUser, setSelectedUser] = useState(null);
  
  const currentTab = getCurrentTab();
  const currentFilePath = currentTab?.filePath;

  // Get collaborators array
  const collaboratorsArray = getCollaboratorsArray();
  const fileActivitiesArray = getFileActivitiesArray();

  // Get cursors for current file
  const currentFileCursors = currentFilePath ? getCursorsForFile(currentFilePath) : [];

  // Convert cursor data to display format
  const activeCursors = currentFileCursors.map(cursor => ({
    id: cursor.userId,
    name: cursor.userName,
    email: '',
    role: 'editor',
    color: cursor.userColor,
    isOnline: true,
    isEditing: true,
    isOwner: collaborators.get(cursor.userId)?.isOwner || false,
    position: {
      file: cursor.fileName,
      line: cursor.position?.lineNumber || 1,
      column: cursor.position?.column || 1
    },
    lastActivity: getTimeAgo(cursor.timestamp)
  }));

  // Convert file activities to display format
  const recentActivities = fileActivitiesArray
    .filter(activity => activity.filePath !== currentFilePath) // Don't show current file
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10); // Show last 10 activities

  // Format time ago
  function getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  // Handle following a user's cursor
  const handleFollowUser = (userId, position) => {
    if (!position.file) return;

    // Find if file is already open in tabs
    const existingTab = tabs.find(tab => 
      tab.fileName === position.file || 
      tab.filePath?.endsWith(position.file)
    );

    if (existingTab) {
      // Switch to existing tab
      setActiveTab(existingTab.id);
    } else {
      // Try to open the file
      const fileActivity = fileActivitiesArray.find(activity => 
        activity.fileName === position.file && activity.userId === userId
      );
      
      if (fileActivity) {
        // Open the file (content will be loaded from VFS)
        openFile(fileActivity.fileName, '', fileActivity.filePath);
      }
    }

    console.log(`Following ${userId} to ${position.file}:${position.line}:${position.column}`);
  };

  // Handle jumping to activity file
  const handleJumpToActivity = (activity) => {
    // Find if file is already open
    const existingTab = tabs.find(tab => 
      tab.fileName === activity.fileName || 
      tab.filePath === activity.filePath
    );

    if (existingTab) {
      setActiveTab(existingTab.id);
    } else {
      openFile(activity.fileName, '', activity.filePath);
    }
  };

  return (
    <div className="bg-vscode-panel h-full overflow-y-auto text-sm">
      {/* Header */}
      <div className="p-3 border-b border-vscode-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-vscode-text uppercase tracking-wide">
            Live Cursors
          </h3>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-vscode-success rounded-full"></div>
            <span className="text-xs text-vscode-text-muted">
              {activeCursors.length + (currentFilePath ? 1 : 0)} active
            </span>
          </div>
        </div>
        <div className="text-xs text-vscode-text-muted mt-1">
          {currentFilePath ? (
            <span className="flex items-center gap-1">
              <FileText size={10} />
              {currentTab?.fileName || 'Current file'}
            </span>
          ) : (
            'No file selected'
          )}
        </div>
      </div>

      {/* Current File Cursors */}
      {currentFilePath && (
        <div className="p-3 border-b border-vscode-border">
          <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3">
            Editing This File ({activeCursors.length + 1})
          </div>
          <div className="space-y-1">
            {/* Current user */}
            <div className="flex items-center gap-2 p-2 rounded bg-vscode-hover bg-opacity-50">
              <div className="w-3 h-3 rounded-full bg-vscode-accent"></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-vscode-text truncate">
                  {user?.name || user?.displayName || 'You'}
                </div>
                <div className="text-xs text-vscode-text-muted">
                  <span className="flex items-center gap-1">
                    <Code size={10} />
                    You are here
                  </span>
                </div>
              </div>
              <div className="text-xs px-1 py-0.5 rounded bg-vscode-accent text-white">
                you
              </div>
            </div>
            
            {/* Other users' cursors */}
            {activeCursors.map((cursor) => (
              <CursorIndicator 
                key={cursor.id}
                user={cursor} 
                position={cursor.position} 
                color={cursor.color}
                isActive={selectedUser === cursor.id}
                onFollow={handleFollowUser}
              />
            ))}
          </div>
        </div>
      )}

      {/* File Activities - Users editing other files */}
      {recentActivities.length > 0 && (
        <div className="p-3 border-b border-vscode-border">
          <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3">
            Editing Other Files ({recentActivities.length})
          </div>
          <div className="space-y-1">
            {recentActivities.map((activity, index) => (
              <div 
                key={`${activity.userId}-${index}`}
                className="group flex items-center gap-2 p-2 rounded hover:bg-vscode-hover cursor-pointer transition-all"
                onClick={() => handleJumpToActivity(activity)}
                title={`Jump to ${activity.fileName}`}
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activity.userColor }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-vscode-text truncate">{activity.userName}</div>
                  <div className="text-xs text-vscode-text-muted">
                    <span className="flex items-center gap-1">
                      <FileText size={10} />
                      <span className="truncate">{activity.fileName}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-vscode-warning rounded-full animate-pulse" title="Currently editing"></div>
                  <div className="text-xs text-vscode-text-muted">
                    {getTimeAgo(activity.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Collaborators */}
      {collaboratorsArray.length > 0 && (
        <div className="p-3 border-b border-vscode-border">
          <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3">
            Session Members ({collaboratorsArray.length + 1})
          </div>
          <div className="space-y-1">
            {/* Current user */}
            <div className="flex items-center gap-2 p-2 rounded">
              <div className="w-3 h-3 rounded-full bg-vscode-accent"></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-vscode-text truncate">
                  {user?.name || user?.displayName || 'You'}
                </div>
                <div className="text-xs text-vscode-text-muted">
                  {user?.email || 'Current user'}
                </div>
              </div>
              <div className="text-xs px-1 py-0.5 rounded bg-vscode-warning text-black">
                {session?.creatorId === (user?.id || user?.uid) ? 'owner' : 'you'}
              </div>
            </div>
            
            {/* Other collaborators */}
            {collaboratorsArray.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center gap-2 p-2 rounded">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: collaborator.color }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-vscode-text truncate">{collaborator.name}</div>
                  <div className="text-xs text-vscode-text-muted">
                    {collaborator.email || 'Collaborator'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-vscode-success rounded-full" title="Online"></div>
                  <div className={`text-xs px-1 py-0.5 rounded ${
                    collaborator.isOwner ? 'bg-vscode-warning text-black' :
                    'bg-vscode-accent text-white'
                  }`}>
                    {collaborator.isOwner ? 'owner' : 'member'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!session && (
        <div className="p-3 text-center">
          <div className="text-text-tertiary text-sm mb-3">
            <Users size={32} className="mx-auto opacity-30 mb-3" />
            <p className="text-lg font-medium mb-2">No Active Session</p>
            <p className="text-sm opacity-75 mb-4">Join a collaboration session to see live cursors</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="p-3">
        <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-3">
          Tips
        </div>
        <div className="space-y-2 text-xs text-vscode-text-muted">
          <div className="flex items-center gap-2">
            <Mouse size={10} />
            <span>Click follow button to jump to user's cursor</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={10} />
            <span>Click file activities to open files</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={10} />
            <span>Positions update in real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCursors;
