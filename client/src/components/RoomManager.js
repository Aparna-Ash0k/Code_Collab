/**
 * Room Manager Component
 * 
 * Provides UI for creating and joining collaboration rooms
 */

import React, { useState, useContext, useEffect } from 'react';
import './RoomManager.css';
import { useAuth } from '../contexts/AuthContext';
import { FileSystemContext } from '../contexts/FileSystemContext';

const RoomManager = ({ socket, onRoomJoined, onRoomCreated, onClose }) => {
  const { user } = useAuth();
  const { fileTree, createFile } = useContext(FileSystemContext);
  
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Create room form state
  const [createForm, setCreateForm] = useState({
    roomName: '',
    description: '',
    includeCurrentWorkspace: true
  });
  
  // Join room form state
  const [joinForm, setJoinForm] = useState({
    roomId: ''
  });
  
  // Connected room state
  const [connectedRoom, setConnectedRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for room events
    socket.on('room_created', (data) => {
      console.log('🏗️ Room created:', data);
      const roomData = {
        roomId: data.roomId,
        roomName: data.projectId || 'Collaboration Room',
        description: 'Real-time collaboration room',
        ownerName: data.creator?.name || user?.name,
        ownerEmail: data.creator?.email || user?.email,
        createdAt: Date.now(),
        participants: data.participants || []
      };
      
      setConnectedRoom(roomData);
      setRoomParticipants(data.participants || []);
      setSuccess(`Room created successfully! Room ID: ${data.roomId}`);
      setLoading(false);
      setError(null);
      
      // Store active room in localStorage for real-time sync
      localStorage.setItem('activeCollaborationRoom', JSON.stringify(roomData));
      
      if (onRoomCreated) {
        onRoomCreated(data);
      }
    });

    socket.on('room_state', (data) => {
      console.log('🚪 Joined room:', data);
      const roomData = {
        roomId: data.roomId,
        roomName: data.projectId || 'Collaboration Room',
        description: 'Real-time collaboration room',
        ownerName: user?.name,
        ownerEmail: user?.email,
        createdAt: Date.now(),
        participants: data.participants || []
      };
      
      setConnectedRoom(roomData);
      setRoomParticipants(data.participants || []);
      setSuccess(`Joined room successfully! Room ID: ${data.roomId}`);
      setLoading(false);
      setError(null);
      
      // Store active room in localStorage for real-time sync
      localStorage.setItem('activeCollaborationRoom', JSON.stringify(roomData));
      
      if (onRoomJoined) {
        onRoomJoined(data);
      }
    });

    socket.on('room_left', (data) => {
      console.log('👋 Left room:', data);
      setConnectedRoom(null);
      setRoomParticipants([]);
      setSuccess('Left room successfully');
    });

    socket.on('user_joined', (data) => {
      console.log('👤 User joined room:', data);
      setRoomParticipants(data.participants || []);
    });

    socket.on('user_left', (data) => {
      console.log('👤 User left room:', data);
      setRoomParticipants(data.participants || []);
    });

    socket.on('room_workspace_updated', (data) => {
      console.log('🔄 Room workspace updated:', data);
      // Handle workspace updates from other users
      handleWorkspaceUpdate(data);
    });

    socket.on('room_error', (data) => {
      console.error('❌ Room error:', data);
      setError(data.error);
      setLoading(false);
    });

    return () => {
      socket.off('room_created');
      socket.off('room_state');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('error');
    };
  }, [socket, createFile, onRoomJoined, onRoomCreated]);

  const handleWorkspaceUpdate = (data) => {
    const { update } = data;
    
    console.log('🔄 Handling workspace update:', update.updateType);
    
    switch (update.updateType) {
      case 'file_created':
        if (createFile) {
          createFile(update.filePath, update.content || '');
        }
        break;
        
      case 'file_updated':
        // For now, log the update - we'll need a proper update method
        console.log('📝 File updated:', update.filePath, 'Content length:', update.content?.length);
        break;
        
      case 'file_deleted':
        // For now, log the deletion - we'll need a proper delete method
        console.log('🗑️ File deleted:', update.filePath);
        break;
        
      case 'folder_created':
        // For now, log the folder creation - we'll need a proper folder creation method
        console.log('📁 Folder created:', update.folderPath);
        break;
        
      case 'folder_deleted':
        // For now, log the folder deletion - we'll need a proper delete method
        console.log('📁 Folder deleted:', update.folderPath);
        break;
        
      default:
        console.warn('Unknown workspace update type:', update.updateType);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    
    if (!createForm.roomName.trim()) {
      setError('Room name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    // Prepare workspace data if including current workspace
    let workspace = { files: [], folders: [] };
    
    if (createForm.includeCurrentWorkspace && fileTree) {
      workspace = {
        files: extractFilesFromTree(fileTree),
        folders: extractFoldersFromTree(fileTree)
      };
    }
    
    socket.emit('create_room', {
      projectId: createForm.roomName.trim(),
      initialWorkspace: workspace
    });
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    
    if (!joinForm.roomId.trim()) {
      setError('Room ID is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    socket.emit('join_room', {
      roomId: joinForm.roomId.trim()
    });
  };

  const handleLeaveRoom = () => {
    if (connectedRoom && socket) {
      socket.emit('leave_room', {
        roomId: connectedRoom.roomId
      });
      
      // Clear active room from localStorage
      localStorage.removeItem('activeCollaborationRoom');
    }
  };

  const extractFilesFromTree = (tree) => {
    const files = [];
    
    const traverse = (items, currentPath = '') => {
      items.forEach(item => {
        if (item.type === 'file') {
          files.push({
            path: currentPath ? `${currentPath}/${item.name}` : item.name,
            name: item.name,
            content: item.content || '',
            type: item.fileType || 'text',
            size: (item.content || '').length,
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || user?.id
          });
        } else if (item.type === 'folder' && item.children) {
          traverse(item.children, currentPath ? `${currentPath}/${item.name}` : item.name);
        }
      });
    };
    
    if (Array.isArray(tree)) {
      traverse(tree);
    } else if (tree.children) {
      traverse(tree.children);
    }
    
    return files;
  };

  const extractFoldersFromTree = (tree) => {
    const folders = [];
    
    const traverse = (items, currentPath = '') => {
      items.forEach(item => {
        if (item.type === 'folder') {
          const folderPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          folders.push(folderPath);
          
          if (item.children) {
            traverse(item.children, folderPath);
          }
        }
      });
    };
    
    if (Array.isArray(tree)) {
      traverse(tree);
    } else if (tree.children) {
      traverse(tree.children);
    }
    
    return folders;
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (!user) {
    return (
      <div className="room-manager" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
        <div className="room-manager-content">
          <div className="room-manager-header">
            <h2>🔐 Authentication Required</h2>
            {onClose && (
              <button className="close-button" onClick={onClose} title="Close">
                ✕
              </button>
            )}
          </div>
          <p>Please sign in to create or join collaboration rooms.</p>
        </div>
      </div>
    );
  }

  if (connectedRoom) {
    return (
      <div className="room-manager" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
        <div className="room-manager-content">
          <div className="room-manager-header">
            <h2>🏠 Connected to Room</h2>
            {onClose && (
              <button className="close-button" onClick={onClose} title="Close">
                ✕
              </button>
            )}
          </div>
          <div className="connected-room">
            <div className="room-info">
              <div className="room-details">
                <h3>{connectedRoom.roomName || 'Collaboration Room'}</h3>
                <div className="room-id-section">
                  <p className="room-id-label"><strong>🔗 Share this Room ID:</strong></p>
                  <div className="room-id-display">
                    <code className="room-id-code">{connectedRoom.roomId}</code>
                    <button 
                      className="copy-room-id-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(connectedRoom.roomId);
                        setSuccess('Room ID copied to clipboard!');
                      }}
                      title="Copy Room ID"
                    >
                      📋
                    </button>
                  </div>
                </div>
                {connectedRoom.description && (
                  <p className="room-description">{connectedRoom.description}</p>
                )}
                <p className="room-owner">
                  Owner: {connectedRoom.ownerName} ({connectedRoom.ownerEmail})
                </p>
                <p className="room-created">
                  Created: {new Date(connectedRoom.createdAt).toLocaleString()}
                </p>
              </div>
              
              {roomParticipants.length > 0 && (
                <div className="room-participants">
                  <h4>👥 Participants ({roomParticipants.length})</h4>
                  <ul>
                    {roomParticipants.map(participant => (
                      <li key={participant.userId}>
                        {participant.userName} ({participant.userEmail})
                        {participant.joinedAt && (
                          <span className="join-time">
                            - joined {new Date(participant.joinedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="room-actions">
              <button
                onClick={handleLeaveRoom}
                className="btn btn-secondary"
                disabled={loading}
              >
                👋 Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room-manager" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className="room-manager-content">
        <div className="room-manager-header">
          <h2>🏠 Collaboration Rooms</h2>
          {onClose && (
            <button className="close-button" onClick={onClose} title="Close">
              ✕
            </button>
          )}
        </div>
        
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            🏗️ Create Room
          </button>
          <button
            className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            🚪 Join Room
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            ✅ {success}
          </div>
        )}

        {activeTab === 'create' && (
          <form onSubmit={handleCreateRoom} className="room-form">
            <h3>Create New Room</h3>
            
            <div className="form-group">
              <label>Room Name *</label>
              <input
                type="text"
                value={createForm.roomName}
                onChange={(e) => setCreateForm(prev => ({
                  ...prev,
                  roomName: e.target.value
                }))}
                placeholder="My Awesome Project"
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                placeholder="Describe your collaboration project..."
                rows="3"
                disabled={loading}
              />
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={createForm.includeCurrentWorkspace}
                  onChange={(e) => setCreateForm(prev => ({
                    ...prev,
                    includeCurrentWorkspace: e.target.checked
                  }))}
                  disabled={loading}
                />
                Include current workspace files
              </label>
              <small>Share your current project files with collaborators</small>
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !createForm.roomName.trim()}
            >
              {loading ? '🔄 Creating...' : '🏗️ Create Room'}
            </button>
          </form>
        )}

        {activeTab === 'join' && (
          <form onSubmit={handleJoinRoom} className="room-form">
            <h3>Join Existing Room</h3>
            
            <div className="form-group">
              <label>Room ID *</label>
              <input
                type="text"
                value={joinForm.roomId}
                onChange={(e) => setJoinForm(prev => ({
                  ...prev,
                  roomId: e.target.value
                }))}
                placeholder="Enter room ID (e.g., room_abc123...)"
                disabled={loading}
                required
              />
              <small>Ask the room owner for the room ID</small>
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !joinForm.roomId.trim()}
            >
              {loading ? '🔄 Joining...' : '🚪 Join Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RoomManager;