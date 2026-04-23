/**
 * Collaboration Room Manager
 * 
 * Handles room-based collaboration with workspace synchronization:
 * 1. Owner creates room and stores workspace in database
 * 2. Collaborators join room and receive complete workspace
 * 3. Real-time sync between all participants
 */

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

class CollaborationRoomManager extends EventEmitter {
  constructor(databaseService) {
    super();
    this.databaseService = databaseService;
    this.activeRooms = new Map(); // roomId -> RoomData
    this.userRooms = new Map(); // userId -> roomId
    this.socketRooms = new Map(); // socketId -> roomId
  }

  /**
   * Create a new collaboration room
   */
  async createRoom(ownerId, ownerName, ownerSocket, workspaceData) {
    const roomId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create room data structure
    const roomData = {
      id: roomId,
      ownerId,
      ownerName,
      ownerSocketId: ownerSocket.id,
      createdAt: timestamp,
      lastActivity: timestamp,
      participants: new Map([
        [ownerId, {
          id: ownerId,
          name: ownerName,
          role: 'owner',
          socketId: ownerSocket.id,
          joinedAt: timestamp,
          lastSeen: timestamp,
          status: 'online'
        }]
      ]),
      workspace: {
        files: new Map(),
        folders: new Set(),
        metadata: {
          version: 1,
          lastModified: timestamp,
          totalFiles: 0,
          totalSize: 0
        }
      },
      settings: {
        isPublic: false,
        allowEditing: true,
        maxParticipants: 50,
        autoSave: true
      }
    };

    try {
      // Store workspace in database
      await this.storeWorkspaceInDatabase(roomId, workspaceData, ownerId);

      // Update room data with workspace
      this.processWorkspaceData(roomData, workspaceData);

      // Store room in memory
      this.activeRooms.set(roomId, roomData);
      this.userRooms.set(ownerId, roomId);
      this.socketRooms.set(ownerSocket.id, roomId);

      // Join owner to room
      ownerSocket.join(roomId);

      console.log(`🏠 Room created: ${roomId} by ${ownerName} with ${roomData.workspace.metadata.totalFiles} files`);

      this.emit('room_created', {
        roomId,
        ownerId,
        ownerName,
        workspace: this.getWorkspaceSummary(roomData.workspace)
      });

      return {
        success: true,
        roomId,
        workspace: roomData.workspace,
        participants: Array.from(roomData.participants.values())
      };

    } catch (error) {
      console.error('❌ Failed to create room:', error);
      throw new Error(`Failed to create collaboration room: ${error.message}`);
    }
  }

  /**
   * Join an existing collaboration room
   */
  async joinRoom(roomId, userId, userName, userSocket) {
    try {
      const roomData = this.activeRooms.get(roomId);
      if (!roomData) {
        throw new Error('Room not found');
      }

      // Check if room is at capacity
      if (roomData.participants.size >= roomData.settings.maxParticipants) {
        throw new Error('Room is at maximum capacity');
      }

      // Check if user is already in another room
      const existingRoomId = this.userRooms.get(userId);
      if (existingRoomId && existingRoomId !== roomId) {
        await this.leaveRoom(userId, userSocket);
      }

      const timestamp = new Date().toISOString();

      // Add participant to room
      roomData.participants.set(userId, {
        id: userId,
        name: userName,
        role: userId === roomData.ownerId ? 'owner' : 'collaborator',
        socketId: userSocket.id,
        joinedAt: timestamp,
        lastSeen: timestamp,
        status: 'online'
      });

      // Update tracking maps
      this.userRooms.set(userId, roomId);
      this.socketRooms.set(userSocket.id, roomId);

      // Join socket to room
      userSocket.join(roomId);

      // Load complete workspace from database
      const workspaceData = await this.loadWorkspaceFromDatabase(roomId);

      // Update room activity
      roomData.lastActivity = timestamp;

      console.log(`🚪 User ${userName} joined room ${roomId} (${roomData.participants.size}/${roomData.settings.maxParticipants} participants)`);

      // Notify other participants
      userSocket.to(roomId).emit('participant_joined', {
        userId,
        userName,
        role: roomData.participants.get(userId).role,
        joinedAt: timestamp,
        totalParticipants: roomData.participants.size
      });

      this.emit('user_joined', {
        roomId,
        userId,
        userName,
        participantCount: roomData.participants.size
      });

      // Send complete workspace to joining user
      return {
        success: true,
        roomId,
        workspace: workspaceData,
        participants: Array.from(roomData.participants.values()),
        roomSettings: roomData.settings,
        userRole: roomData.participants.get(userId).role
      };

    } catch (error) {
      console.error('❌ Failed to join room:', error);
      throw new Error(`Failed to join room: ${error.message}`);
    }
  }

  /**
   * Leave a collaboration room
   */
  async leaveRoom(userId, userSocket) {
    try {
      const roomId = this.userRooms.get(userId);
      if (!roomId) return false;

      const roomData = this.activeRooms.get(roomId);
      if (!roomData) return false;

      const participant = roomData.participants.get(userId);
      if (!participant) return false;

      // Remove participant
      roomData.participants.delete(userId);
      this.userRooms.delete(userId);
      this.socketRooms.delete(userSocket.id);

      // Leave socket room
      userSocket.leave(roomId);

      console.log(`🚶 User ${participant.name} left room ${roomId} (${roomData.participants.size} remaining)`);

      // If owner leaves, transfer ownership or close room
      if (userId === roomData.ownerId && roomData.participants.size > 0) {
        const newOwner = Array.from(roomData.participants.values())[0];
        roomData.ownerId = newOwner.id;
        roomData.ownerName = newOwner.name;
        newOwner.role = 'owner';

        console.log(`👑 Ownership transferred to ${newOwner.name} for room ${roomId}`);
        
        userSocket.to(roomId).emit('ownership_transferred', {
          newOwnerId: newOwner.id,
          newOwnerName: newOwner.name
        });
      }

      // If room is empty, mark for cleanup
      if (roomData.participants.size === 0) {
        console.log(`🏚️ Room ${roomId} is empty, marking for cleanup`);
        setTimeout(() => this.cleanupRoom(roomId), 60000); // Cleanup after 1 minute
      } else {
        // Notify remaining participants
        userSocket.to(roomId).emit('participant_left', {
          userId,
          userName: participant.name,
          remainingParticipants: roomData.participants.size
        });
      }

      this.emit('user_left', {
        roomId,
        userId,
        userName: participant.name,
        participantCount: roomData.participants.size
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to leave room:', error);
      return false;
    }
  }

  /**
   * Update workspace in real-time
   */
  async updateWorkspace(roomId, userId, updateData) {
    try {
      const roomData = this.activeRooms.get(roomId);
      if (!roomData) {
        throw new Error('Room not found');
      }

      const participant = roomData.participants.get(userId);
      if (!participant) {
        throw new Error('User not in room');
      }

      // Update workspace data
      await this.processWorkspaceUpdate(roomData, updateData, userId);

      // Store updated workspace in database
      await this.updateWorkspaceInDatabase(roomId, updateData, userId);

      // Update room metadata
      roomData.lastActivity = new Date().toISOString();
      participant.lastSeen = roomData.lastActivity;

      this.emit('workspace_updated', {
        roomId,
        userId,
        updateType: updateData.type,
        timestamp: roomData.lastActivity
      });

      return {
        success: true,
        version: roomData.workspace.metadata.version,
        lastModified: roomData.lastActivity
      };

    } catch (error) {
      console.error('❌ Failed to update workspace:', error);
      throw new Error(`Failed to update workspace: ${error.message}`);
    }
  }

  /**
   * Store complete workspace in database
   */
  async storeWorkspaceInDatabase(roomId, workspaceData, ownerId) {
    const workspaceDoc = {
      roomId,
      ownerId,
      version: 1,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      files: this.serializeFiles(workspaceData.files || []),
      folders: workspaceData.folders || [],
      metadata: {
        totalFiles: (workspaceData.files || []).length,
        totalSize: this.calculateWorkspaceSize(workspaceData.files || []),
        fileTypes: this.analyzeFileTypes(workspaceData.files || [])
      }
    };

    await this.databaseService.storeWorkspace(roomId, workspaceDoc);
    console.log(`💾 Workspace stored for room ${roomId}: ${workspaceDoc.metadata.totalFiles} files`);
  }

  /**
   * Load workspace from database
   */
  async loadWorkspaceFromDatabase(roomId) {
    try {
      const workspaceDoc = await this.databaseService.loadWorkspace(roomId);
      if (!workspaceDoc) {
        throw new Error('Workspace not found in database');
      }

      return {
        files: this.deserializeFiles(workspaceDoc.files),
        folders: workspaceDoc.folders,
        metadata: workspaceDoc.metadata,
        version: workspaceDoc.version,
        lastModified: workspaceDoc.lastModified
      };

    } catch (error) {
      console.error(`❌ Failed to load workspace for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Update workspace in database
   */
  async updateWorkspaceInDatabase(roomId, updateData, userId) {
    const update = {
      version: Date.now(), // Use timestamp as version
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId,
      updateType: updateData.type,
      ...updateData.data
    };

    await this.databaseService.updateWorkspace(roomId, update);
  }

  /**
   * Process workspace data for room
   */
  processWorkspaceData(roomData, workspaceData) {
    if (workspaceData.files) {
      workspaceData.files.forEach(file => {
        roomData.workspace.files.set(file.path, {
          path: file.path,
          name: file.name,
          content: file.content || '',
          type: file.type || 'text',
          size: (file.content || '').length,
          createdAt: file.createdAt || new Date().toISOString(),
          modifiedAt: file.modifiedAt || new Date().toISOString()
        });
      });
    }

    if (workspaceData.folders) {
      workspaceData.folders.forEach(folder => {
        roomData.workspace.folders.add(folder);
      });
    }

    // Update metadata
    roomData.workspace.metadata.totalFiles = roomData.workspace.files.size;
    roomData.workspace.metadata.totalSize = this.calculateWorkspaceSize(
      Array.from(roomData.workspace.files.values())
    );
    roomData.workspace.metadata.lastModified = new Date().toISOString();
    roomData.workspace.metadata.version++;
  }

  /**
   * Process workspace update
   */
  async processWorkspaceUpdate(roomData, updateData, userId) {
    switch (updateData.type) {
      case 'file_created':
        roomData.workspace.files.set(updateData.filePath, {
          path: updateData.filePath,
          name: updateData.fileName,
          content: updateData.content || '',
          type: updateData.fileType || 'text',
          size: (updateData.content || '').length,
          createdAt: new Date().toISOString(),
          createdBy: userId
        });
        break;

      case 'file_updated':
        const existingFile = roomData.workspace.files.get(updateData.filePath);
        if (existingFile) {
          existingFile.content = updateData.content;
          existingFile.size = updateData.content.length;
          existingFile.modifiedAt = new Date().toISOString();
          existingFile.modifiedBy = userId;
        }
        break;

      case 'file_deleted':
        roomData.workspace.files.delete(updateData.filePath);
        break;

      case 'folder_created':
        roomData.workspace.folders.add(updateData.folderPath);
        break;

      case 'folder_deleted':
        roomData.workspace.folders.delete(updateData.folderPath);
        // Also delete all files in folder
        for (const [filePath] of roomData.workspace.files) {
          if (filePath.startsWith(updateData.folderPath + '/')) {
            roomData.workspace.files.delete(filePath);
          }
        }
        break;
    }

    // Update metadata
    roomData.workspace.metadata.version++;
    roomData.workspace.metadata.lastModified = new Date().toISOString();
    roomData.workspace.metadata.totalFiles = roomData.workspace.files.size;
    roomData.workspace.metadata.totalSize = this.calculateWorkspaceSize(
      Array.from(roomData.workspace.files.values())
    );
  }

  /**
   * Get room information
   */
  getRoomInfo(roomId) {
    const roomData = this.activeRooms.get(roomId);
    if (!roomData) return null;

    return {
      id: roomData.id,
      ownerId: roomData.ownerId,
      ownerName: roomData.ownerName,
      createdAt: roomData.createdAt,
      lastActivity: roomData.lastActivity,
      participantCount: roomData.participants.size,
      participants: Array.from(roomData.participants.values()),
      workspace: this.getWorkspaceSummary(roomData.workspace),
      settings: roomData.settings
    };
  }

  /**
   * Get workspace summary
   */
  getWorkspaceSummary(workspace) {
    return {
      fileCount: workspace.files.size,
      folderCount: workspace.folders.size,
      totalSize: workspace.metadata.totalSize,
      version: workspace.metadata.version,
      lastModified: workspace.metadata.lastModified
    };
  }

  /**
   * Utility methods
   */
  serializeFiles(files) {
    return files.map(file => ({
      path: file.path,
      name: file.name || file.path.split('/').pop(),
      content: file.content || '',
      type: file.type || 'text',
      size: (file.content || '').length,
      createdAt: file.createdAt || new Date().toISOString(),
      modifiedAt: file.modifiedAt || new Date().toISOString()
    }));
  }

  deserializeFiles(files) {
    return files.map(file => ({
      path: file.path,
      name: file.name,
      content: file.content,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      modifiedAt: file.modifiedAt
    }));
  }

  calculateWorkspaceSize(files) {
    return files.reduce((total, file) => total + (file.size || 0), 0);
  }

  analyzeFileTypes(files) {
    const types = {};
    files.forEach(file => {
      const ext = file.path.split('.').pop() || 'unknown';
      types[ext] = (types[ext] || 0) + 1;
    });
    return types;
  }

  /**
   * Cleanup empty room
   */
  async cleanupRoom(roomId) {
    const roomData = this.activeRooms.get(roomId);
    if (!roomData || roomData.participants.size > 0) return;

    try {
      // Archive workspace in database
      await this.databaseService.archiveWorkspace(roomId);
      
      // Remove from memory
      this.activeRooms.delete(roomId);

      console.log(`🧹 Cleaned up empty room: ${roomId}`);
      
      this.emit('room_cleaned', { roomId });

    } catch (error) {
      console.error(`❌ Failed to cleanup room ${roomId}:`, error);
    }
  }

  /**
   * Get all active rooms
   */
  getActiveRooms() {
    const rooms = [];
    for (const [roomId, roomData] of this.activeRooms) {
      rooms.push(this.getRoomInfo(roomId));
    }
    return rooms;
  }

  /**
   * Get room statistics
   */
  getStatistics() {
    return {
      totalRooms: this.activeRooms.size,
      totalParticipants: Array.from(this.activeRooms.values())
        .reduce((sum, room) => sum + room.participants.size, 0),
      averageParticipantsPerRoom: this.activeRooms.size > 0 
        ? Array.from(this.activeRooms.values())
          .reduce((sum, room) => sum + room.participants.size, 0) / this.activeRooms.size
        : 0
    };
  }
}

module.exports = CollaborationRoomManager;