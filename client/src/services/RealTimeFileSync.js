/**
 * Real-Time File Synchronization Service
 * 
 * Handles real-time file operations (create, update, delete) using Socket.IO websockets.
 * Integrates with FileSystemContext for seamless collaboration.
 */

import { EventEmitter } from 'events';

class RealTimeFileSync extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.isInitialized = false;
    this.fileSystemContext = null;
    this.isProcessingRemoteOperation = false;
  }

  /**
   * Initialize the service with Socket.IO connection and room info
   */
  initialize(socket, roomId, userId, userName, fileSystemContext) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.fileSystemContext = fileSystemContext;
    this.isInitialized = true;

    this.setupSocketListeners();
    console.log('🗂️ RealTimeFileSync initialized for room:', roomId);
  }

  /**
   * Setup Socket.IO event listeners for file synchronization
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Listen for file changes from other users
    this.socket.on('file_changed', (data) => {
      if (data.userId === this.userId) return; // Ignore own operations
      
      console.log('📁 Received file operation:', data.action, data.fileMeta?.path, 'from user:', data.userId);
      this.handleRemoteFileOperation(data);
    });

    // Listen for file content requests (when users ask for existing files)
    this.socket.on('file_content_requested', (data) => {
      if (data.requestedBy === this.userId) return; // Don't respond to own requests
      
      console.log('📥 File content requested:', data.filePath, 'by user:', data.requestedBy);
      this.handleFileContentRequest(data);
    });

    // Listen for file content responses
    this.socket.on('file_content_response', (data) => {
      console.log('📤 Received file content response:', data.filePath);
      this.handleFileContentResponse(data);
    });

    // Listen for workspace push events (initial file sharing)
    this.socket.on('workspace_push', (data) => {
      if (data.pushedBy?.uid === this.userId) return; // Ignore own pushes
      
      console.log('📦 Received workspace push from:', data.pushedBy?.name);
      this.handleWorkspacePush(data);
    });

    // Listen for workspace requests
    this.socket.on('workspace_requested', (data) => {
      console.log('📥 Workspace requested by:', data.requestedBy?.name);
      this.handleWorkspaceRequest(data);
    });

    // Listen for new user joining who needs workspace
    this.socket.on('new_user_needs_workspace', (data) => {
      console.log('📥 New user needs workspace:', data.newUser?.name);
      this.handleNewUserWorkspaceRequest(data);
    });

    // Listen for workspace files being shared
    this.socket.on('workspace_files_shared', (data) => {
      console.log('📦 Received workspace files from:', data.sharedBy?.name);
      this.handleWorkspaceFilesReceived(data);
    });

    // Listen for individual file shares
    this.socket.on('file_shared_by_user', (data) => {
      console.log('📤 Received file from user:', data.sharedBy?.name, 'File:', data.filePath);
      this.handleFileSharedByUser(data);
    });

    console.log('🎧 Socket.IO listeners set up for real-time file sync');
  }

  /**
   * Handle remote file operations from other users
   */
  async handleRemoteFileOperation(data) {
    if (!this.fileSystemContext || this.isProcessingRemoteOperation) return;

    this.isProcessingRemoteOperation = true;

    try {
      const { action, fileMeta } = data;
      const { path, content } = fileMeta;

      switch (action) {
        case 'created':
          console.log('📝 Creating file from remote:', path);
          if (this.fileSystemContext.createFile) {
            await this.fileSystemContext.createFile(path, content || '');
            this.emit('remote_file_created', { path, content, userId: data.userId });
          }
          break;

        case 'updated':
          console.log('✏️ Updating file from remote:', path);
          if (this.fileSystemContext.updateFile) {
            await this.fileSystemContext.updateFile(path, content || '');
            this.emit('remote_file_updated', { path, content, userId: data.userId });
          }
          break;

        case 'deleted':
          console.log('🗑️ Deleting file from remote:', path);
          if (this.fileSystemContext.deleteFile) {
            await this.fileSystemContext.deleteFile(path);
            this.emit('remote_file_deleted', { path, userId: data.userId });
          }
          break;

        default:
          console.warn('⚠️ Unknown file operation:', action);
      }
    } catch (error) {
      console.error('❌ Failed to handle remote file operation:', error);
    } finally {
      setTimeout(() => {
        this.isProcessingRemoteOperation = false;
      }, 100);
    }
  }

  /**
   * Handle file content requests from other users
   */
  async handleFileContentRequest(data) {
    if (!this.fileSystemContext) return;

    try {
      const { filePath, requesterId } = data;
      
      // Get file content from local file system
      let content = '';
      if (this.fileSystemContext.readFile) {
        try {
          content = await this.fileSystemContext.readFile(filePath) || '';
        } catch (error) {
          console.log('📁 File not found locally:', filePath);
        }
      }

      // Send response directly to the requester
      this.socket.to(requesterId).emit('file_content_response', {
        filePath,
        content,
        version: 1,
        providedBy: this.userId
      });

      console.log('📤 Sent file content for:', filePath, 'to user:', data.requestedBy);
    } catch (error) {
      console.error('❌ Failed to handle file content request:', error);
    }
  }

  /**
   * Handle file content responses
   */
  async handleFileContentResponse(data) {
    const { filePath, content, providedBy } = data;
    
    if (content && content.trim()) {
      // Update local file with received content
      try {
        if (this.fileSystemContext.createFile) {
          await this.fileSystemContext.createFile(filePath, content);
          console.log('📥 Received and created file:', filePath);
          this.emit('file_content_received', { filePath, content, providedBy });
        }
      } catch (error) {
        console.error('❌ Failed to create file from response:', error);
      }
    }
  }

  /**
   * Handle workspace push (initial file sharing)  
   */
  async handleWorkspacePush(data) {
    if (!this.fileSystemContext) return;

    const { storagePath, projectMeta, pushedBy } = data;
    
    console.log('📦 Processing workspace push with project meta:', projectMeta);
    
    // For now, we'll request the workspace files from the room creator
    this.requestWorkspaceFiles();
    
    this.emit('workspace_received', { storagePath, projectMeta, pushedBy });
  }

  /**
   * Handle workspace requests
   */
  async handleWorkspaceRequest(data) {
    if (!this.fileSystemContext) return;

    console.log('📤 Preparing to share workspace...');
    
    try {
      // Get current file tree and share it
      const fileTree = this.fileSystemContext.fileTree || [];
      const workspace = await this.extractWorkspaceData(fileTree);
      
      // Send workspace data to the requester
      this.shareWorkspace(workspace);
      
    } catch (error) {
      console.error('❌ Failed to share workspace:', error);
    }
  }

  /**
   * Handle new user joining who needs workspace files
   */
  async handleNewUserWorkspaceRequest(data) {
    if (!this.fileSystemContext) return;

    console.log('📤 Sharing workspace with new user:', data.newUser?.name);
    
    try {
      // Get current file tree and extract workspace data
      const fileTree = this.fileSystemContext.fileTree || [];
      const workspace = await this.extractWorkspaceData(fileTree);
      
      if (workspace.files.length > 0) {
        // Share workspace files with the room
        this.socket.emit('share_workspace_files', {
          roomId: this.roomId,
          files: workspace.files,
          folders: workspace.folders
        });
        
        console.log('📤 Shared', workspace.files.length, 'files with new user');
      }
      
    } catch (error) {
      console.error('❌ Failed to share workspace with new user:', error);
    }
  }

  /**
   * Handle workspace files being received from other users
   */
  async handleWorkspaceFilesReceived(data) {
    if (!this.fileSystemContext || this.isProcessingRemoteOperation) return;

    this.isProcessingRemoteOperation = true;

    try {
      const { files, folders, sharedBy } = data;
      
      console.log('📦 Processing', files?.length || 0, 'workspace files from', sharedBy?.name);
      
      // Create folders first
      if (folders && folders.length > 0) {
        for (const folderPath of folders) {
          // TODO: Add folder creation support if available
          console.log('📁 Folder:', folderPath);
        }
      }
      
      // Create files
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (this.fileSystemContext.createFile && file.path && file.content !== undefined) {
              await this.fileSystemContext.createFile(file.path, file.content);
              console.log('📝 Created file from workspace:', file.path);
              
              // Small delay to prevent overwhelming
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (error) {
            console.warn('Failed to create file from workspace:', file.path, error);
          }
        }
        
        this.emit('workspace_loaded', { fileCount: files.length, sharedBy });
      }
      
    } catch (error) {
      console.error('❌ Failed to process workspace files:', error);
    } finally {
      setTimeout(() => {
        this.isProcessingRemoteOperation = false;
      }, 500);
    }
  }

  /**
   * Handle individual file shared by user
   */
  async handleFileSharedByUser(data) {
    if (!this.fileSystemContext || this.isProcessingRemoteOperation) return;

    this.isProcessingRemoteOperation = true;

    try {
      const { filePath, content, sharedBy } = data;
      
      if (this.fileSystemContext.createFile && filePath && content !== undefined) {
        await this.fileSystemContext.createFile(filePath, content);
        console.log('📝 Created shared file:', filePath, 'from', sharedBy?.name);
        
        this.emit('file_received', { filePath, content, sharedBy });
      }
      
    } catch (error) {
      console.error('❌ Failed to create shared file:', error);
    } finally {
      setTimeout(() => {
        this.isProcessingRemoteOperation = false;
      }, 100);
    }
  }

  /**
   * Broadcast file creation to other users
   */
  broadcastFileCreate(filePath, content = '') {
    if (!this.socket || !this.roomId || this.isProcessingRemoteOperation) return;

    this.socket.emit('file_create', {
      fileMeta: {
        path: filePath,
        content: content,
        type: 'file',
        createdBy: this.userId,
        createdAt: Date.now()
      }
    });

    console.log('📤 Broadcasted file creation:', filePath);
  }

  /**
   * Broadcast file update to other users
   */
  broadcastFileUpdate(filePath, content) {
    if (!this.socket || !this.roomId || this.isProcessingRemoteOperation) return;

    this.socket.emit('file_update', {
      fileMeta: {
        path: filePath,
        content: content,
        type: 'file',
        updatedBy: this.userId,
        updatedAt: Date.now()
      }
    });

    console.log('📤 Broadcasted file update:', filePath);
  }

  /**
   * Broadcast file deletion to other users
   */
  broadcastFileDelete(filePath) {
    if (!this.socket || !this.roomId || this.isProcessingRemoteOperation) return;

    this.socket.emit('file_delete', {
      fileMeta: {
        path: filePath,
        type: 'file',
        deletedBy: this.userId,
        deletedAt: Date.now()
      }
    });

    console.log('📤 Broadcasted file deletion:', filePath);
  }

  /**
   * Request workspace files from room
   */
  requestWorkspaceFiles() {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('request_workspace');
    console.log('📥 Requested workspace files from room');
  }

  /**
   * Share workspace with room
   */
  async shareWorkspace(workspace) {
    if (!this.socket || !this.roomId) return;

    // Create each file for other users
    if (workspace.files && workspace.files.length > 0) {
      for (const file of workspace.files) {
        this.broadcastFileCreate(file.path, file.content);
        // Add small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log('📤 Shared workspace with', workspace.files?.length || 0, 'files');
  }

  /**
   * Extract workspace data from file tree
   */
  async extractWorkspaceData(fileTree) {
    const files = [];
    const folders = [];

    const traverseTree = async (items, currentPath = '') => {
      for (const item of items) {
        if (item.type === 'file') {
          const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
          
          // Get file content
          let content = '';
          try {
            if (this.fileSystemContext.readFile) {
              content = await this.fileSystemContext.readFile(filePath) || '';
            } else if (item.content !== undefined) {
              content = item.content;
            }
          } catch (error) {
            console.warn('Failed to read file content:', filePath);
          }

          files.push({
            path: filePath,
            name: item.name,
            content: content,
            type: item.fileType || 'text',
            size: content.length,
            createdAt: new Date().toISOString(),
            createdBy: this.userId
          });
        } else if (item.type === 'folder') {
          const folderPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          folders.push(folderPath);
          
          if (item.children) {
            await traverseTree(item.children, folderPath);
          }
        }
      }
    };

    if (Array.isArray(fileTree)) {
      await traverseTree(fileTree);
    } else if (fileTree.children) {
      await traverseTree(fileTree.children);
    }

    return { files, folders };
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      roomId: this.roomId,
      userId: this.userId,
      isProcessingRemoteOperation: this.isProcessingRemoteOperation
    };
  }

  /**
   * Cleanup the service
   */
  destroy() {
    // Remove socket listeners
    if (this.socket) {
      this.socket.off('file_changed');
      this.socket.off('file_content_requested');
      this.socket.off('file_content_response');
      this.socket.off('workspace_push');
      this.socket.off('workspace_requested');
      this.socket.off('new_user_needs_workspace');
      this.socket.off('workspace_files_shared');
      this.socket.off('file_shared_by_user');
    }

    // Clear state
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.fileSystemContext = null;
    this.isInitialized = false;
    this.isProcessingRemoteOperation = false;

    console.log('🗑️ RealTimeFileSync destroyed');
  }
}

// Export singleton instance
export const realTimeFileSync = new RealTimeFileSync();
export default RealTimeFileSync;