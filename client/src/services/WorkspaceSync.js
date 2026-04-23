/**
 * Unified Workspace Synchronization Service
 * 
 * Handles complete workspace transfer and real-time synchronization:
 * - Complete workspace transfer to new session members
 * - Real-time file and folder operations
 * - Code-level collaborative editing via Yjs
 * - Conflict resolution and operational transforms
 */

import * as Y from 'yjs';
import { io } from 'socket.io-client';
import { EventEmitter } from 'events';

class WorkspaceSync extends EventEmitter {
  constructor(fileSystemManager, authManager) {
    super();
    
    this.fileSystemManager = fileSystemManager;
    this.authManager = authManager;
    
    // Yjs document for collaborative editing
    this.ydoc = new Y.Doc();
    
    // Socket.IO connection
    this.socket = null;
    this.sessionId = null;
    this.userId = null;
    this.isHost = false;
    
    // Workspace state
    this.workspaceState = {
      files: new Map(),           // filePath -> fileContent
      folders: new Set(),         // folder paths
      metadata: new Map(),        // filePath -> metadata
      tree: null                  // file tree structure
    };
    
    // Real-time maps
    this.yjsFiles = this.ydoc.getMap('files');           // Y.Map<path, Y.Text>
    this.yjsFolders = this.ydoc.getMap('folders');       // Y.Map<path, folderData>
    this.yjsMetadata = this.ydoc.getMap('metadata');     // Y.Map<path, metadata>
    this.yjsTree = this.ydoc.getMap('tree');             // Y.Map for file tree
    
    // Collaboration state
    this.collaborators = new Map();
    this.pendingOperations = new Map();
    this.operationQueue = [];
    
    this.setupYjsListeners();
  }

  /**
   * Connect to collaboration session
   */
  async connect(socket, sessionId, userId, isHost = false) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.userId = userId;
    this.isHost = isHost;
    
    this.setupSocketListeners();
    
    if (isHost) {
      // Host: Push current workspace to new members
      await this.initializeWorkspaceAsHost();
    } else {
      // Member: Request workspace from host
      this.requestWorkspaceFromHost();
    }
    
    console.log(`🔗 WorkspaceSync connected to session ${sessionId} as ${isHost ? 'HOST' : 'MEMBER'}`);
    this.emit('connected', { sessionId, userId, isHost });
  }

  /**
   * Setup Yjs change listeners
   */
  setupYjsListeners() {
    // File content changes
    this.yjsFiles.observe((event, transaction) => {
      if (transaction.origin === 'remote') {
        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            const yText = this.yjsFiles.get(key);
            const content = yText.toString();
            this.handleRemoteFileChange(key, content);
          } else if (change.action === 'delete') {
            this.handleRemoteFileDelete(key);
          }
        });
      }
    });

    // Folder structure changes
    this.yjsFolders.observe((event, transaction) => {
      if (transaction.origin === 'remote') {
        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add') {
            const folderData = this.yjsFolders.get(key);
            this.handleRemoteFolderCreate(key, folderData);
          } else if (change.action === 'delete') {
            this.handleRemoteFolderDelete(key);
          }
        });
      }
    });

    // Metadata changes
    this.yjsMetadata.observe((event, transaction) => {
      if (transaction.origin === 'remote') {
        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            const metadata = this.yjsMetadata.get(key);
            this.handleRemoteMetadataUpdate(key, metadata);
          }
        });
      }
    });

    // Document updates for Socket.IO broadcasting
    this.ydoc.on('update', (update, origin, doc, transaction) => {
      if (origin !== 'socket' && this.socket && this.sessionId) {
        this.socket.emit('yjs_update', {
          sessionId: this.sessionId,
          update: Array.from(update),
          userId: this.userId
        });
      }
    });
  }

  /**
   * Setup Socket.IO event listeners
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Yjs updates from other clients
    this.socket.on('yjs_update', ({ update, userId }) => {
      if (userId !== this.userId) {
        const updateArray = new Uint8Array(update);
        Y.applyUpdate(this.ydoc, updateArray, 'socket');
      }
    });

    // Complete workspace transfer
    this.socket.on('workspace_transfer', async (data) => {
      await this.receiveCompleteWorkspace(data);
    });

    // Workspace request from new member
    this.socket.on('workspace_request', ({ userId, userName }) => {
      if (this.isHost) {
        console.log(`📤 Sending workspace to new member: ${userName}`);
        this.sendCompleteWorkspace(userId);
      }
    });

    // Individual file operations
    this.socket.on('file_operation', (operation) => {
      this.handleRemoteFileOperation(operation);
    });

    // Folder operations
    this.socket.on('folder_operation', (operation) => {
      this.handleRemoteFolderOperation(operation);
    });

    // New collaborator joined
    this.socket.on('collaborator_joined', ({ collaborator }) => {
      this.collaborators.set(collaborator.id, collaborator);
      this.emit('collaborator_joined', collaborator);
      
      // If we're the host, send workspace to new member
      if (this.isHost) {
        setTimeout(() => {
          this.sendCompleteWorkspace(collaborator.id);
        }, 1000); // Give them time to set up listeners
      }
    });

    // Collaborator left
    this.socket.on('collaborator_left', ({ collaboratorId }) => {
      this.collaborators.delete(collaboratorId);
      this.emit('collaborator_left', collaboratorId);
    });
  }

  /**
   * Initialize workspace as session host
   */
  async initializeWorkspaceAsHost() {
    try {
      // Load current workspace state
      const currentWorkspace = await this.fileSystemManager.exportWorkspace();
      
      // Initialize Yjs documents with current state
      this.ydoc.transact(() => {
        // Clear existing data
        this.yjsFiles.clear();
        this.yjsFolders.clear();
        this.yjsMetadata.clear();
        
        // Add files
        if (currentWorkspace.files) {
          currentWorkspace.files.forEach((fileData, filePath) => {
            const yText = new Y.Text();
            yText.insert(0, fileData.content || '');
            this.yjsFiles.set(filePath, yText);
            
            // Add metadata
            this.yjsMetadata.set(filePath, {
              name: fileData.name,
              type: fileData.type,
              size: fileData.size || 0,
              lastModified: fileData.lastModified || Date.now(),
              createdAt: fileData.createdAt || Date.now()
            });
          });
        }
        
        // Add folders
        if (currentWorkspace.folders) {
          currentWorkspace.folders.forEach(folderPath => {
            this.yjsFolders.set(folderPath, {
              path: folderPath,
              name: folderPath.split('/').pop(),
              createdAt: Date.now()
            });
          });
        }
        
        // Set file tree
        if (currentWorkspace.tree) {
          this.yjsTree.set('structure', currentWorkspace.tree);
        }
      }, 'initialization');
      
      console.log('✅ Workspace initialized as host with', currentWorkspace.files?.size || 0, 'files');
      
    } catch (error) {
      console.error('❌ Failed to initialize workspace as host:', error);
      this.emit('error', { type: 'initialization_failed', error });
    }
  }

  /**
   * Request workspace from host
   */
  requestWorkspaceFromHost() {
    if (this.socket && this.sessionId) {
      console.log('📥 Requesting workspace from host...');
      this.socket.emit('workspace_request', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  /**
   * Send complete workspace to a specific user or all users
   */
  async sendCompleteWorkspace(targetUserId = null) {
    try {
      const workspaceData = {
        files: {},
        folders: [],
        metadata: {},
        tree: this.yjsTree.get('structure') || null,
        timestamp: Date.now(),
        senderId: this.userId
      };

      // Collect files
      this.yjsFiles.forEach((yText, filePath) => {
        workspaceData.files[filePath] = yText.toString();
      });

      // Collect folders
      this.yjsFolders.forEach((folderData, folderPath) => {
        workspaceData.folders.push(folderPath);
      });

      // Collect metadata
      this.yjsMetadata.forEach((metadata, filePath) => {
        workspaceData.metadata[filePath] = metadata;
      });

      console.log(`📤 Sending workspace: ${Object.keys(workspaceData.files).length} files, ${workspaceData.folders.length} folders`);

      // Send to specific user or broadcast to all
      if (targetUserId) {
        this.socket.emit('workspace_transfer_to_user', {
          sessionId: this.sessionId,
          targetUserId: targetUserId,
          workspaceData: workspaceData
        });
      } else {
        this.socket.emit('workspace_broadcast', {
          sessionId: this.sessionId,
          workspaceData: workspaceData
        });
      }

    } catch (error) {
      console.error('❌ Failed to send workspace:', error);
      this.emit('error', { type: 'workspace_send_failed', error });
    }
  }

  /**
   * Receive and apply complete workspace
   */
  async receiveCompleteWorkspace(data) {
    try {
      const { workspaceData, senderId } = data;
      
      console.log(`📥 Receiving workspace from ${senderId}: ${Object.keys(workspaceData.files || {}).length} files`);

      // Apply workspace to Yjs document
      this.ydoc.transact(() => {
        // Clear existing data
        this.yjsFiles.clear();
        this.yjsFolders.clear();
        this.yjsMetadata.clear();
        this.yjsTree.clear();

        // Add files
        Object.entries(workspaceData.files || {}).forEach(([filePath, content]) => {
          const yText = new Y.Text();
          yText.insert(0, content);
          this.yjsFiles.set(filePath, yText);
        });

        // Add folders
        (workspaceData.folders || []).forEach(folderPath => {
          this.yjsFolders.set(folderPath, {
            path: folderPath,
            name: folderPath.split('/').pop(),
            createdAt: Date.now()
          });
        });

        // Add metadata
        Object.entries(workspaceData.metadata || {}).forEach(([filePath, metadata]) => {
          this.yjsMetadata.set(filePath, metadata);
        });

        // Set tree structure
        if (workspaceData.tree) {
          this.yjsTree.set('structure', workspaceData.tree);
        }
      }, 'workspace_sync');

      // Apply to local file system
      await this.applyWorkspaceToFileSystem(workspaceData);
      
      console.log('✅ Workspace received and applied successfully');
      this.emit('workspace_synced', { 
        fileCount: Object.keys(workspaceData.files || {}).length,
        folderCount: (workspaceData.folders || []).length
      });

    } catch (error) {
      console.error('❌ Failed to receive workspace:', error);
      this.emit('error', { type: 'workspace_receive_failed', error });
    }
  }

  /**
   * Apply workspace data to local file system
   */
  async applyWorkspaceToFileSystem(workspaceData) {
    try {
      // Create folders first
      for (const folderPath of (workspaceData.folders || [])) {
        await this.fileSystemManager.createFolder(folderPath, { skipSync: true });
      }

      // Create files
      for (const [filePath, content] of Object.entries(workspaceData.files || {})) {
        const metadata = workspaceData.metadata?.[filePath];
        await this.fileSystemManager.writeFile(filePath, content, { 
          metadata,
          skipSync: true 
        });
      }

      // Update tree structure
      if (workspaceData.tree) {
        await this.fileSystemManager.updateTree(workspaceData.tree, { skipSync: true });
      }

    } catch (error) {
      console.error('❌ Failed to apply workspace to file system:', error);
      throw error;
    }
  }

  /**
   * Sync local file change to Yjs
   */
  syncFileChange(filePath, content, metadata = null) {
    this.ydoc.transact(() => {
      let yText = this.yjsFiles.get(filePath);
      if (!yText) {
        yText = new Y.Text();
        this.yjsFiles.set(filePath, yText);
      }

      // Update content
      const currentContent = yText.toString();
      if (currentContent !== content) {
        yText.delete(0, yText.length);
        yText.insert(0, content);
      }

      // Update metadata
      if (metadata) {
        this.yjsMetadata.set(filePath, {
          ...this.yjsMetadata.get(filePath),
          ...metadata,
          lastModified: Date.now()
        });
      }
    }, 'local_change');
  }

  /**
   * Sync local folder creation to Yjs
   */
  syncFolderCreate(folderPath) {
    this.ydoc.transact(() => {
      this.yjsFolders.set(folderPath, {
        path: folderPath,
        name: folderPath.split('/').pop(),
        createdAt: Date.now()
      });
    }, 'local_change');
  }

  /**
   * Sync local folder deletion to Yjs
   */
  syncFolderDelete(folderPath) {
    this.ydoc.transact(() => {
      this.yjsFolders.delete(folderPath);
    }, 'local_change');
  }

  /**
   * Sync local file deletion to Yjs
   */
  syncFileDelete(filePath) {
    this.ydoc.transact(() => {
      this.yjsFiles.delete(filePath);
      this.yjsMetadata.delete(filePath);
    }, 'local_change');
  }

  /**
   * Handle remote file changes
   */
  async handleRemoteFileChange(filePath, content) {
    try {
      await this.fileSystemManager.writeFile(filePath, content, { 
        skipSync: true,
        source: 'remote'
      });
      
      this.emit('file_changed', { filePath, content, source: 'remote' });
      
    } catch (error) {
      console.error('❌ Failed to handle remote file change:', error);
    }
  }

  /**
   * Handle remote file deletion
   */
  async handleRemoteFileDelete(filePath) {
    try {
      await this.fileSystemManager.deleteFile(filePath, { 
        skipSync: true,
        source: 'remote'
      });
      
      this.emit('file_deleted', { filePath, source: 'remote' });
      
    } catch (error) {
      console.error('❌ Failed to handle remote file deletion:', error);
    }
  }

  /**
   * Handle remote folder creation
   */
  async handleRemoteFolderCreate(folderPath, folderData) {
    try {
      await this.fileSystemManager.createFolder(folderPath, { 
        skipSync: true,
        source: 'remote'
      });
      
      this.emit('folder_created', { folderPath, folderData, source: 'remote' });
      
    } catch (error) {
      console.error('❌ Failed to handle remote folder creation:', error);
    }
  }

  /**
   * Handle remote folder deletion
   */
  async handleRemoteFolderDelete(folderPath) {
    try {
      await this.fileSystemManager.deleteFolder(folderPath, { 
        skipSync: true,
        source: 'remote'
      });
      
      this.emit('folder_deleted', { folderPath, source: 'remote' });
      
    } catch (error) {
      console.error('❌ Failed to handle remote folder deletion:', error);
    }
  }

  /**
   * Handle remote metadata updates
   */
  handleRemoteMetadataUpdate(filePath, metadata) {
    this.emit('metadata_updated', { filePath, metadata, source: 'remote' });
  }

  /**
   * Get current workspace state
   */
  getWorkspaceState() {
    const state = {
      files: new Map(),
      folders: new Set(),
      metadata: new Map(),
      tree: this.yjsTree.get('structure')
    };

    this.yjsFiles.forEach((yText, filePath) => {
      state.files.set(filePath, yText.toString());
    });

    this.yjsFolders.forEach((folderData, folderPath) => {
      state.folders.add(folderPath);
    });

    this.yjsMetadata.forEach((metadata, filePath) => {
      state.metadata.set(filePath, metadata);
    });

    return state;
  }

  /**
   * Get Yjs document for Monaco binding
   */
  getYjsDocument() {
    return this.ydoc;
  }

  /**
   * Get Yjs text for a specific file
   */
  getYjsText(filePath) {
    return this.yjsFiles.get(filePath);
  }

  /**
   * Create Yjs text for a new file
   */
  createYjsText(filePath, initialContent = '') {
    const yText = new Y.Text();
    if (initialContent) {
      yText.insert(0, initialContent);
    }
    this.yjsFiles.set(filePath, yText);
    return yText;
  }

  /**
   * Disconnect from session
   */
  disconnect() {
    if (this.socket) {
      this.socket.off('yjs_update');
      this.socket.off('workspace_transfer');
      this.socket.off('workspace_request');
      this.socket.off('file_operation');
      this.socket.off('folder_operation');
      this.socket.off('collaborator_joined');
      this.socket.off('collaborator_left');
    }

    this.socket = null;
    this.sessionId = null;
    this.userId = null;
    this.isHost = false;
    this.collaborators.clear();
    
    console.log('🔌 WorkspaceSync disconnected');
    this.emit('disconnected');
  }

  /**
   * Get collaboration statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      isHost: this.isHost,
      collaboratorCount: this.collaborators.size,
      fileCount: this.yjsFiles.size,
      folderCount: this.yjsFolders.size,
      connected: !!this.socket
    };
  }
}

export default WorkspaceSync;