/**
 * Real-Time Project Synchronization Service
 * Handles real-time project sharing, file operations, and state management
 */

import EventEmitter from 'events';

export class RealTimeProjectSync extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.sessionId = null;
    this.userId = null;
    this.projectId = null;
    this.isOwner = false;
    this.projectState = {
      id: null,
      name: '',
      description: '',
      type: 'general',
      owner: null,
      collaborators: new Map(),
      files: new Map(), // filePath -> fileData
      folders: new Set(),
      metadata: {
        createdAt: null,
        lastModified: null,
        version: 1
      }
    };
    this.pendingOperations = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the sync service
   */
  initialize(socket, sessionId, userId) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.userId = userId;
    
    if (this.socket) {
      this.setupSocketListeners();
      console.log('🔄 RealTimeProjectSync initialized for session:', sessionId);
    }
  }

  /**
   * Setup socket event listeners
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Project initialization events
    this.socket.on('project_collaboration_started', this.handleProjectStarted.bind(this));
    this.socket.on('project_state_sync', this.handleProjectStateSync.bind(this));
    this.socket.on('collaborator_joined_project', this.handleCollaboratorJoined.bind(this));
    this.socket.on('collaborator_left_project', this.handleCollaboratorLeft.bind(this));

    // File operation events
    this.socket.on('project_file_created', this.handleFileCreated.bind(this));
    this.socket.on('project_file_updated', this.handleFileUpdated.bind(this));
    this.socket.on('project_file_deleted', this.handleFileDeleted.bind(this));
    this.socket.on('project_file_renamed', this.handleFileRenamed.bind(this));
    
    // Folder operation events
    this.socket.on('project_folder_created', this.handleFolderCreated.bind(this));
    this.socket.on('project_folder_deleted', this.handleFolderDeleted.bind(this));
    this.socket.on('project_folder_renamed', this.handleFolderRenamed.bind(this));

    // Error handling
    this.socket.on('project_operation_error', this.handleOperationError.bind(this));
  }

  /**
   * Start project collaboration
   */
  async startProjectCollaboration(mode, projectData) {
    if (!this.socket || !this.sessionId) {
      throw new Error('Socket or session not available');
    }

    const collaborationPayload = {
      sessionId: this.sessionId,
      userId: this.userId,
      mode, // 'existing' or 'new'
      project: {
        id: this.generateProjectId(),
        name: projectData.name,
        description: projectData.description,
        type: projectData.type,
        owner: this.userId,
        files: projectData.files || [],
        folders: projectData.folders || [],
        metadata: {
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1
        }
      },
      timestamp: Date.now()
    };

    console.log('🚀 Starting project collaboration:', collaborationPayload.project.name);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Project collaboration start timeout'));
      }, 10000);

      this.socket.once('project_collaboration_started', (response) => {
        clearTimeout(timeout);
        if (response.success) {
          this.projectId = response.project.id;
          this.isOwner = response.project.owner === this.userId;
          // Convert plain objects back to Maps for proper state management
          this.projectState = {
            ...response.project,
            collaborators: new Map(Object.entries(response.project.collaborators || {})),
            files: new Map(
              response.project.files && Array.isArray(response.project.files)
                ? response.project.files.map(file => [file.path, file])
                : Object.entries(response.project.files || {})
            )
          };
          this.isInitialized = true;
          console.log('✅ Project collaboration started successfully');
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to start collaboration'));
        }
      });

      this.socket.emit('start_project_collaboration', collaborationPayload);
    });
  }

  /**
   * Join existing project collaboration
   */
  async joinProjectCollaboration(projectId) {
    if (!this.socket || !this.sessionId) {
      throw new Error('Socket or session not available');
    }

    console.log('🔗 Joining project collaboration:', projectId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Project join timeout'));
      }, 10000);

      this.socket.once('project_state_sync', (response) => {
        clearTimeout(timeout);
        if (response.success) {
          this.projectId = projectId;
          this.isOwner = response.project.owner === this.userId;
          // Convert plain objects back to Maps for proper state management
          this.projectState = {
            ...response.project,
            collaborators: new Map(Object.entries(response.project.collaborators || {})),
            files: new Map(
              response.project.files && Array.isArray(response.project.files)
                ? response.project.files.map(file => [file.path, file])
                : Object.entries(response.project.files || {})
            )
          };
          this.isInitialized = true;
          console.log('✅ Joined project collaboration successfully');
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to join project'));
        }
      });

      this.socket.emit('join_project_collaboration', {
        sessionId: this.sessionId,
        userId: this.userId,
        projectId
      });
    });
  }

  /**
   * Create a file in the collaborative project
   */
  async createFile(filePath, content = '', metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Project sync not initialized');
    }

    const operation = {
      id: this.generateOperationId(),
      type: 'file_create',
      projectId: this.projectId,
      sessionId: this.sessionId,
      userId: this.userId,
      filePath,
      content,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        createdBy: this.userId
      },
      timestamp: Date.now()
    };

    this.pendingOperations.set(operation.id, operation);
    this.socket.emit('project_file_operation', operation);

    console.log('📝 Creating file:', filePath);
    return operation.id;
  }

  /**
   * Update a file in the collaborative project
   */
  async updateFile(filePath, content, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Project sync not initialized');
    }

    const operation = {
      id: this.generateOperationId(),
      type: 'file_update',
      projectId: this.projectId,
      sessionId: this.sessionId,
      userId: this.userId,
      filePath,
      content,
      metadata: {
        ...metadata,
        lastModified: new Date().toISOString(),
        lastModifiedBy: this.userId
      },
      timestamp: Date.now()
    };

    this.pendingOperations.set(operation.id, operation);
    this.socket.emit('project_file_operation', operation);

    console.log('✏️ Updating file:', filePath);
    return operation.id;
  }

  /**
   * Delete a file from the collaborative project
   */
  async deleteFile(filePath) {
    if (!this.isInitialized) {
      throw new Error('Project sync not initialized');
    }

    const operation = {
      id: this.generateOperationId(),
      type: 'file_delete',
      projectId: this.projectId,
      sessionId: this.sessionId,
      userId: this.userId,
      filePath,
      timestamp: Date.now()
    };

    this.pendingOperations.set(operation.id, operation);
    this.socket.emit('project_file_operation', operation);

    console.log('🗑️ Deleting file:', filePath);
    return operation.id;
  }

  /**
   * Rename a file in the collaborative project
   */
  async renameFile(oldPath, newPath) {
    if (!this.isInitialized) {
      throw new Error('Project sync not initialized');
    }

    const operation = {
      id: this.generateOperationId(),
      type: 'file_rename',
      projectId: this.projectId,
      sessionId: this.sessionId,
      userId: this.userId,
      oldPath,
      newPath,
      timestamp: Date.now()
    };

    this.pendingOperations.set(operation.id, operation);
    this.socket.emit('project_file_operation', operation);

    console.log('📝 Renaming file:', oldPath, '->', newPath);
    return operation.id;
  }

  /**
   * Create a folder in the collaborative project
   */
  async createFolder(folderPath, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Project sync not initialized');
    }

    const operation = {
      id: this.generateOperationId(),
      type: 'folder_create',
      projectId: this.projectId,
      sessionId: this.sessionId,
      userId: this.userId,
      folderPath,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        createdBy: this.userId
      },
      timestamp: Date.now()
    };

    this.pendingOperations.set(operation.id, operation);
    this.socket.emit('project_folder_operation', operation);

    console.log('📁 Creating folder:', folderPath);
    return operation.id;
  }

  /**
   * Delete a folder from the collaborative project
   */
  async deleteFolder(folderPath) {
    if (!this.isInitialized) {
      throw new Error('Project sync not initialized');
    }

    const operation = {
      id: this.generateOperationId(),
      type: 'folder_delete',
      projectId: this.projectId,
      sessionId: this.sessionId,
      userId: this.userId,
      folderPath,
      timestamp: Date.now()
    };

    this.pendingOperations.set(operation.id, operation);
    this.socket.emit('project_folder_operation', operation);

    console.log('🗑️ Deleting folder:', folderPath);
    return operation.id;
  }

  /**
   * Get current project state
   */
  getProjectState() {
    return { ...this.projectState };
  }

  /**
   * Get project files as array
   */
  getProjectFiles() {
    return Array.from(this.projectState.files.values());
  }

  /**
   * Get project folders as array
   */
  getProjectFolders() {
    return Array.from(this.projectState.folders);
  }

  /**
   * Check if user has permission for operation
   */
  hasPermission(operation) {
    // Owner has all permissions
    if (this.isOwner) return true;

    // Check collaborator permissions
    const collaborator = this.projectState.collaborators.get(this.userId);
    if (!collaborator) return false;

    switch (operation) {
      case 'read':
        return true; // All collaborators can read
      case 'write':
        return collaborator.permissions.includes('write');
      case 'delete':
        return collaborator.permissions.includes('delete');
      case 'manage':
        return collaborator.permissions.includes('manage');
      default:
        return false;
    }
  }

  // Event Handlers
  handleProjectStarted(data) {
    console.log('📁 Project collaboration started:', data);
    this.emit('project_started', data);
  }

  handleProjectStateSync(data) {
    console.log('🔄 Project state synchronized:', data);
    
    if (data.project) {
      // Convert plain objects back to Maps for proper state management
      this.projectState = {
        ...data.project,
        collaborators: new Map(Object.entries(data.project.collaborators || {})),
        files: new Map(
          data.project.files && Array.isArray(data.project.files)
            ? data.project.files.map(file => [file.path, file])
            : Object.entries(data.project.files || {})
        )
      };
      this.projectId = data.project.id;
      this.isOwner = data.project.owner === this.userId;
    }
    
    this.emit('project_synced', data);
  }

  handleCollaboratorJoined(data) {
    console.log('👤 Collaborator joined project:', data.userId);
    
    if (data.collaborator) {
      this.projectState.collaborators.set(data.userId, data.collaborator);
    }
    
    this.emit('collaborator_joined', data);
  }

  handleCollaboratorLeft(data) {
    console.log('👤 Collaborator left project:', data.userId);
    
    this.projectState.collaborators.delete(data.userId);
    this.emit('collaborator_left', data);
  }

  handleFileCreated(data) {
    console.log('📝 File created:', data.filePath);
    
    if (data.file) {
      this.projectState.files.set(data.filePath, data.file);
    }
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('file_created', data);
  }

  handleFileUpdated(data) {
    console.log('✏️ File updated:', data.filePath);
    
    if (data.file) {
      this.projectState.files.set(data.filePath, data.file);
    }
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('file_updated', data);
  }

  handleFileDeleted(data) {
    console.log('🗑️ File deleted:', data.filePath);
    
    this.projectState.files.delete(data.filePath);
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('file_deleted', data);
  }

  handleFileRenamed(data) {
    console.log('📝 File renamed:', data.oldPath, '->', data.newPath);
    
    if (this.projectState.files.has(data.oldPath)) {
      const fileData = this.projectState.files.get(data.oldPath);
      this.projectState.files.delete(data.oldPath);
      this.projectState.files.set(data.newPath, fileData);
    }
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('file_renamed', data);
  }

  handleFolderCreated(data) {
    console.log('📁 Folder created:', data.folderPath);
    
    this.projectState.folders.add(data.folderPath);
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('folder_created', data);
  }

  handleFolderDeleted(data) {
    console.log('🗑️ Folder deleted:', data.folderPath);
    
    this.projectState.folders.delete(data.folderPath);
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('folder_deleted', data);
  }

  handleFolderRenamed(data) {
    console.log('📝 Folder renamed:', data.oldPath, '->', data.newPath);
    
    if (this.projectState.folders.has(data.oldPath)) {
      this.projectState.folders.delete(data.oldPath);
      this.projectState.folders.add(data.newPath);
    }
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('folder_renamed', data);
  }

  handleOperationError(data) {
    console.error('❌ Project operation error:', data);
    
    // Remove from pending operations
    if (data.operationId) {
      this.pendingOperations.delete(data.operationId);
    }
    
    this.emit('operation_error', data);
  }

  // Utility methods
  generateProjectId() {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.socket) {
      // Remove all listeners
      this.socket.off('project_collaboration_started');
      this.socket.off('project_state_sync');
      this.socket.off('collaborator_joined_project');
      this.socket.off('collaborator_left_project');
      this.socket.off('project_file_created');
      this.socket.off('project_file_updated');
      this.socket.off('project_file_deleted');
      this.socket.off('project_file_renamed');
      this.socket.off('project_folder_created');
      this.socket.off('project_folder_deleted');
      this.socket.off('project_folder_renamed');
      this.socket.off('project_operation_error');
    }
    
    // Clear state
    this.projectState = {
      id: null,
      name: '',
      description: '',
      type: 'general',
      owner: null,
      collaborators: new Map(),
      files: new Map(),
      folders: new Set(),
      metadata: {
        createdAt: null,
        lastModified: null,
        version: 1
      }
    };
    this.pendingOperations.clear();
    this.isInitialized = false;
    
    console.log('🔴 RealTimeProjectSync shutdown');
  }
}

// Export singleton instance
export const projectSyncService = new RealTimeProjectSync();
