/**
 * Enhanced Server-Side Workspace Synchronization Handler
 * 
 * Handles:
 * - Complete workspace transfers to new session members
 * - Real-time Yjs updates broadcasting
 * - File and folder operation synchronization
 * - Session-based collaboration management
 */

class WorkspaceSyncServer {
  constructor(io, collaborationSessions) {
    this.io = io;
    this.sessions = collaborationSessions;
    
    // Track workspace hosts per session
    this.sessionHosts = new Map(); // sessionId -> hostUserId
    
    // Track pending workspace transfers
    this.pendingTransfers = new Map(); // transferId -> transferData
  }

  /**
   * Setup workspace sync event handlers for a socket
   */
  setupHandlers(socket) {
    console.log(`🔧 Setting up workspace sync handlers for user: ${socket.userName}`);

    // Yjs document updates
    socket.on('yjs_update', (data) => {
      this.handleYjsUpdate(socket, data);
    });

    // Workspace transfer requests
    socket.on('workspace_request', (data) => {
      this.handleWorkspaceRequest(socket, data);
    });

    // Workspace transfer to specific user
    socket.on('workspace_transfer_to_user', (data) => {
      this.handleWorkspaceTransferToUser(socket, data);
    });

    // Workspace broadcast to all session members
    socket.on('workspace_broadcast', (data) => {
      this.handleWorkspaceBroadcast(socket, data);
    });

    // File operations - DEPRECATED: Now handled by collaboration-server.js through Yjs
    // socket.on('file_operation_sync', (data) => {
    //   this.handleFileOperation(socket, data);
    // });

    // Folder operations - DEPRECATED: Now handled by collaboration-server.js through Yjs
    // socket.on('folder_operation_sync', (data) => {
    //   this.handleFolderOperation(socket, data);
    // });

    // Mark user as workspace host
    socket.on('register_workspace_host', (data) => {
      this.registerWorkspaceHost(socket, data);
    });

    // Handle socket disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handle Yjs document updates
   */
  handleYjsUpdate(socket, data) {
    try {
      const { sessionId, update, userId } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        console.warn(`⚠️ Yjs update from user not in session: ${userId}`);
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        console.warn(`⚠️ Yjs update for non-existent session: ${sessionId}`);
        return;
      }

      // Broadcast to all other users in the session
      socket.to(sessionId).emit('yjs_update', {
        update,
        userId,
        timestamp: Date.now()
      });

      // Store update in session for late joiners
      if (!session.yjsUpdates) {
        session.yjsUpdates = [];
      }
      
      session.yjsUpdates.push({
        update,
        userId,
        timestamp: Date.now()
      });

      // Keep only last 100 updates to prevent memory issues
      if (session.yjsUpdates.length > 100) {
        session.yjsUpdates = session.yjsUpdates.slice(-50);
      }

      console.log(`📝 Yjs update broadcasted in session ${sessionId} from ${socket.userName}`);

    } catch (error) {
      console.error('❌ Failed to handle Yjs update:', error);
      socket.emit('error', { type: 'yjs_update_failed', error: error.message });
    }
  }

  /**
   * Handle workspace request from new session member
   */
  handleWorkspaceRequest(socket, data) {
    try {
      const { sessionId, userId } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        socket.emit('error', { type: 'session_not_found', message: 'Session not found' });
        return;
      }

      // Find the workspace host
      const hostUserId = this.sessionHosts.get(sessionId);
      if (!hostUserId) {
        console.warn(`⚠️ No workspace host found for session: ${sessionId}`);
        // Try to use session creator as fallback
        const creatorId = session.creatorId;
        if (creatorId) {
          this.notifyWorkspaceHost(creatorId, sessionId, { userId, userName: socket.userName });
        } else {
          socket.emit('error', { type: 'no_host', message: 'No workspace host available' });
        }
        return;
      }

      // Notify the host about the workspace request
      this.notifyWorkspaceHost(hostUserId, sessionId, { userId, userName: socket.userName });

      console.log(`📥 Workspace request from ${socket.userName} forwarded to host in session ${sessionId}`);

    } catch (error) {
      console.error('❌ Failed to handle workspace request:', error);
      socket.emit('error', { type: 'workspace_request_failed', error: error.message });
    }
  }

  /**
   * Notify workspace host about a request
   */
  notifyWorkspaceHost(hostUserId, sessionId, requesterInfo) {
    // Find the host socket
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Look for host socket in session users
    for (const [socketId, userInfo] of Object.entries(session.users || {})) {
      if (userInfo.id === hostUserId) {
        const hostSocket = this.io.sockets.sockets.get(socketId);
        if (hostSocket) {
          hostSocket.emit('workspace_request', requesterInfo);
          break;
        }
      }
    }
  }

  /**
   * Handle workspace transfer to specific user
   */
  handleWorkspaceTransferToUser(socket, data) {
    try {
      const { sessionId, targetUserId, workspaceData } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        socket.emit('error', { type: 'session_not_found', message: 'Session not found' });
        return;
      }

      // Find target user socket
      let targetSocket = null;
      for (const [socketId, userInfo] of Object.entries(session.users || {})) {
        if (userInfo.id === targetUserId) {
          targetSocket = this.io.sockets.sockets.get(socketId);
          break;
        }
      }

      if (!targetSocket) {
        socket.emit('error', { type: 'target_user_not_found', message: 'Target user not connected' });
        return;
      }

      // Send workspace to target user
      targetSocket.emit('workspace_transfer', {
        workspaceData,
        senderId: socket.userId,
        senderName: socket.userName,
        timestamp: Date.now()
      });

      console.log(`📤 Workspace transferred from ${socket.userName} to user ${targetUserId} in session ${sessionId}`);
      console.log(`   - ${Object.keys(workspaceData.files || {}).length} files`);
      console.log(`   - ${(workspaceData.folders || []).length} folders`);

    } catch (error) {
      console.error('❌ Failed to handle workspace transfer to user:', error);
      socket.emit('error', { type: 'workspace_transfer_failed', error: error.message });
    }
  }

  /**
   * Handle workspace broadcast to all session members
   */
  handleWorkspaceBroadcast(socket, data) {
    try {
      const { sessionId, workspaceData } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      // Broadcast to all other users in the session
      socket.to(sessionId).emit('workspace_transfer', {
        workspaceData,
        senderId: socket.userId,
        senderName: socket.userName,
        timestamp: Date.now()
      });

      console.log(`📤 Workspace broadcasted by ${socket.userName} in session ${sessionId}`);
      console.log(`   - ${Object.keys(workspaceData.files || {}).length} files`);
      console.log(`   - ${(workspaceData.folders || []).length} folders`);

    } catch (error) {
      console.error('❌ Failed to handle workspace broadcast:', error);
      socket.emit('error', { type: 'workspace_broadcast_failed', error: error.message });
    }
  }

  /**
   * Handle file operations
   */
  handleFileOperation(socket, data) {
    try {
      const { sessionId, operation, filePath, content, metadata } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        return;
      }

      // Broadcast file operation to other session members
      socket.to(sessionId).emit('file_operation', {
        operation,
        filePath,
        content,
        metadata,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      });

      console.log(`📄 File operation '${operation}' on ${filePath} by ${socket.userName}`);

    } catch (error) {
      console.error('❌ Failed to handle file operation:', error);
    }
  }

  /**
   * Handle folder operations
   */
  handleFolderOperation(socket, data) {
    try {
      const { sessionId, operation, folderPath, metadata } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        return;
      }

      // Broadcast folder operation to other session members
      socket.to(sessionId).emit('folder_operation', {
        operation,
        folderPath,
        metadata,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      });

      console.log(`📁 Folder operation '${operation}' on ${folderPath} by ${socket.userName}`);

    } catch (error) {
      console.error('❌ Failed to handle folder operation:', error);
    }
  }

  /**
   * Register a user as workspace host for a session
   */
  registerWorkspaceHost(socket, data) {
    try {
      const { sessionId } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      // Set this user as the workspace host
      this.sessionHosts.set(sessionId, socket.userId);
      
      console.log(`👑 User ${socket.userName} registered as workspace host for session ${sessionId}`);
      
      socket.emit('workspace_host_registered', { sessionId });

    } catch (error) {
      console.error('❌ Failed to register workspace host:', error);
      socket.emit('error', { type: 'host_registration_failed', error: error.message });
    }
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(socket) {
    try {
      // If this user was a workspace host, clear the host
      if (socket.sessionId) {
        const currentHost = this.sessionHosts.get(socket.sessionId);
        if (currentHost === socket.userId) {
          this.sessionHosts.delete(socket.sessionId);
          console.log(`👑 Workspace host ${socket.userName} disconnected from session ${socket.sessionId}`);
          
          // Notify other session members that host disconnected
          socket.to(socket.sessionId).emit('workspace_host_disconnected', {
            sessionId: socket.sessionId,
            formerHostId: socket.userId,
            formerHostName: socket.userName
          });
        }
      }

    } catch (error) {
      console.error('❌ Failed to handle workspace sync disconnect:', error);
    }
  }

  /**
   * Send initial workspace state to joining user
   */
  async sendInitialWorkspaceState(socket, sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return;
      }

      // Send recent Yjs updates to help sync state
      if (session.yjsUpdates && session.yjsUpdates.length > 0) {
        socket.emit('initial_yjs_updates', {
          sessionId,
          updates: session.yjsUpdates.slice(-20) // Last 20 updates
        });
      }

      // Check if there's a workspace host to request full workspace from
      const hostUserId = this.sessionHosts.get(sessionId);
      if (hostUserId) {
        // Delay the workspace request to allow client setup
        setTimeout(() => {
          socket.emit('workspace_host_available', {
            sessionId,
            hostUserId
          });
        }, 1000);
      }

      console.log(`📋 Initial workspace state sent to ${socket.userName} in session ${sessionId}`);

    } catch (error) {
      console.error('❌ Failed to send initial workspace state:', error);
    }
  }

  /**
   * Get session workspace statistics
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const hostUserId = this.sessionHosts.get(sessionId);
    const userCount = Object.keys(session.users || {}).length;
    const yjsUpdateCount = session.yjsUpdates ? session.yjsUpdates.length : 0;

    return {
      sessionId,
      userCount,
      hostUserId,
      hasHost: !!hostUserId,
      yjsUpdateCount,
      lastActivity: session.lastActivity || null
    };
  }
}

module.exports = WorkspaceSyncServer;