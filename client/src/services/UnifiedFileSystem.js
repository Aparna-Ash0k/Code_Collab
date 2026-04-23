/**
 * Unified File System Service
 * 
 * This service integrates:
 * - YjsFileSystem for collaborative editing
 * - WorkspaceSync for real-time synchronization  
 * - FileSystemManager for unified operations
 * - FileSystemIntegration for compatibility
 * 
 * Replaces the fragmented VFS/StorageManager/ProjectSync approach
 */

import { yjsFileSystem } from './YjsFileSystem';
import { getFileSystemIntegration } from './FileSystemIntegration';
import WorkspaceSync from './WorkspaceSync';
import { EventEmitter } from 'events';

export class UnifiedFileSystem extends EventEmitter {
  constructor() {
    super();
    
    this.yjsFileSystem = null;
    this.workspaceSync = null;
    this.fileSystemIntegration = null;
    this.isInitialized = false;
    
    // Current user and session context
    this.user = null;
    this.session = null;
    this.socket = null;
  }

  /**
   * Initialize the unified file system
   */
  async initialize(context) {
    try {
      const { user, token, session, socket, workspaceProvider } = context;
      
      this.user = user;
      this.token = token;
      this.session = session;
      this.socket = socket;
      this.workspaceProvider = workspaceProvider; // Function to get current workspace state

      console.log('🔄 Initializing Unified File System...');

      // 1. Initialize YjsFileSystem for collaborative editing
      if (user) {
        this.yjsFileSystem = yjsFileSystem;
        await this.yjsFileSystem.initialize(user, token);
        console.log('✅ YjsFileSystem initialized');
      }

      // 2. Initialize FileSystemIntegration for unified operations
      this.fileSystemIntegration = getFileSystemIntegration();
      await this.fileSystemIntegration.initialize(context);
      console.log('✅ FileSystemIntegration initialized');

      // 3. Initialize WorkspaceSync for real-time collaboration
      this.workspaceSync = new WorkspaceSync(
        this.createFileSystemManagerInterface(),
        { getCurrentUser: () => user }
      );
      
      // Set up WorkspaceSync event listeners
      this.setupWorkspaceSyncListeners();
      console.log('✅ WorkspaceSync initialized');

      this.isInitialized = true;
      console.log('🎯 Unified File System fully initialized');

      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Unified File System:', error);
      throw error;
    }
  }

  /**
   * Create FileSystemManager interface for WorkspaceSync
   */
  createFileSystemManagerInterface() {
    return {
      exportWorkspace: async () => {
        const files = new Map();
        const folders = new Set();
        let filesArray = [];

        try {
          // 1. First try to get current workspace from the provider (current tabs/state)
          if (this.workspaceProvider) {
            try {
              const currentWorkspace = await this.workspaceProvider();
              if (currentWorkspace?.files) {
                currentWorkspace.files.forEach((fileData, filePath) => {
                  files.set(filePath, fileData);
                });
                console.log(`📁 Found ${currentWorkspace.files.size} files from workspaceProvider`);
              }
              if (currentWorkspace?.folders) {
                currentWorkspace.folders.forEach(folderPath => {
                  folders.add(folderPath);
                });
              }
              if (currentWorkspace?.tree) {
                filesArray = currentWorkspace.tree;
              }
            } catch (error) {
              console.warn('Error getting workspace from provider:', error);
            }
          }

          // 2. Also get files from YjsFileSystem if available
          if (this.yjsFileSystem) {
            this.yjsFileSystem.files.forEach((yText, filePath) => {
              const content = yText.toString();
              const metadata = this.yjsFileSystem.getFileMetadata(filePath);
              
              // Only add if not already from workspace provider (provider takes precedence)
              if (!files.has(filePath)) {
                files.set(filePath, {
                  name: filePath.split('/').pop(),
                  content: content,
                  type: metadata?.type || 'file',
                  size: content.length,
                  lastModified: metadata?.lastModified || Date.now(),
                  createdAt: metadata?.createdAt || Date.now()
                });
              }
            });
            console.log(`📁 Found ${this.yjsFileSystem.files.size} files from YjsFileSystem`);
          }

          // 3. Finally get files from FileSystemIntegration as fallback
          if (this.fileSystemIntegration?.isInitialized && files.size === 0) {
            const integrationFiles = this.fileSystemIntegration.getFilesArray();
            integrationFiles.forEach(file => {
              if (file.type === 'folder') {
                folders.add(file.path);
              } else {
                files.set(file.path, {
                  name: file.name,
                  content: file.content || '',
                  type: file.type || 'file',
                  size: file.size || 0,
                  lastModified: file.lastModified || Date.now(),
                  createdAt: file.createdAt || Date.now()
                });
              }
            });
            console.log(`📁 Found ${integrationFiles.length} files from FileSystemIntegration`);
          }

          console.log(`📤 Exporting workspace: ${files.size} files, ${folders.size} folders`);
          return { files, folders, tree: filesArray };
        } catch (error) {
          console.warn('Error exporting workspace:', error);
          return { files: new Map(), folders: new Set(), tree: [] };
        }
      },

      writeFile: async (filePath, content, options = {}) => {
        if (options.skipSync) return;
        await this.updateFile(filePath, content);
      },

      createFolder: async (folderPath, options = {}) => {
        if (options.skipSync) return;
        await this.createFolder(folderPath);
      },

      deleteFile: async (filePath, options = {}) => {
        if (options.skipSync) return;
        await this.deleteFile(filePath);
      },

      deleteFolder: async (folderPath, options = {}) => {
        if (options.skipSync) return;
        await this.deleteFile(folderPath); // FileSystemIntegration handles both files and folders
      },

      updateTree: async (tree, options = {}) => {
        if (options.skipSync) return;
        this.emit('tree_updated', tree);
      }
    };
  }

  /**
   * Set up WorkspaceSync event listeners
   */
  setupWorkspaceSyncListeners() {
    this.workspaceSync.on('connected', ({ sessionId, userId, isHost }) => {
      console.log(`🔗 WorkspaceSync connected to session ${sessionId} as ${isHost ? 'HOST' : 'MEMBER'}`);
      this.emit('connected', { sessionId, userId, isHost });
    });

    this.workspaceSync.on('workspace_synced', ({ fileCount, folderCount }) => {
      console.log(`✅ Workspace synced: ${fileCount} files, ${folderCount} folders`);
      this.emit('workspace_synced', { fileCount, folderCount });
    });

    this.workspaceSync.on('file_changed', ({ filePath, content, source }) => {
      console.log(`📝 File changed via ${source}: ${filePath}`);
      this.emit('file_changed', { filePath, content, source });
    });

    this.workspaceSync.on('collaborator_joined', (collaborator) => {
      console.log(`👥 Collaborator joined: ${collaborator.name}`);
      this.emit('collaborator_joined', collaborator);
    });

    this.workspaceSync.on('error', ({ type, error }) => {
      console.error(`❌ WorkspaceSync error (${type}):`, error);
      this.emit('error', { type, error });
    });
  }

  /**
   * Connect to collaboration session
   */
  async connectToSession(socket, sessionId, userId, isHost = false) {
    if (!this.workspaceSync) {
      throw new Error('WorkspaceSync not initialized');
    }

    this.socket = socket;
    await this.workspaceSync.connect(socket, sessionId, userId, isHost);
    
    // Register as workspace host if this user is the session creator
    if (isHost) {
      socket.emit('register_workspace_host', { sessionId });
      console.log(`📡 Registered as workspace host for session: ${sessionId}`);
    }
  }

  /**
   * UNIFIED FILE OPERATIONS
   * These replace all VFS/StorageManager/ProjectSync calls
   */

  /**
   * Check if currently in a collaboration room
   */
  isInCollaborationRoom() {
    return this.yjsFileSystem && this.yjsFileSystem.currentRoom;
  }

  /**
   * Create a new file
   */
  async createFile(filePath, content = '', metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Unified File System not initialized');
    }

    try {
      console.log(`📝 Creating file: ${filePath}`);

      // 1. Create via FileSystemIntegration (handles all adapters)
      await this.fileSystemIntegration.createFile(filePath, content, {
        userId: this.user?.id || this.user?.uid,
        sessionId: this.session?.id,
        ...metadata
      });

      // 2. Add to YjsFileSystem if available
      if (this.yjsFileSystem) {
        if (this.isInCollaborationRoom()) {
          await this.yjsFileSystem.createFileInRoom(filePath, content, metadata);
        } else {
          await this.yjsFileSystem.createFile(filePath, content, metadata);
        }
      }

      // 3. Sync via WorkspaceSync for real-time collaboration
      if (this.workspaceSync) {
        this.workspaceSync.syncFileChange(filePath, content, {
          name: filePath.split('/').pop(),
          type: 'file',
          lastModified: Date.now(),
          ...metadata
        });
      }

      console.log(`✅ File created successfully: ${filePath}`);
      this.emit('file_created', { filePath, content, metadata });

      return { success: true, path: filePath };
    } catch (error) {
      console.error(`❌ Failed to create file ${filePath}:`, error);
      this.emit('error', { type: 'file_create_failed', filePath, error });
      throw error;
    }
  }

  /**
   * Update an existing file
   */
  async updateFile(filePath, content, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Unified File System not initialized');
    }

    try {
      console.log(`📝 Updating file: ${filePath}`);

      // 1. Update via FileSystemIntegration
      await this.fileSystemIntegration.updateFile(filePath, content, {
        userId: this.user?.id || this.user?.uid,
        sessionId: this.session?.id,
        ...metadata
      });

      // 2. Update in YjsFileSystem if available
      if (this.yjsFileSystem) {
        if (this.isInCollaborationRoom()) {
          await this.yjsFileSystem.updateFileInRoom(filePath, content);
        } else {
          const yText = this.yjsFileSystem.getFile(filePath);
          if (yText) {
            // Update Yjs text with operational transforms
            const currentContent = yText.toString();
            if (currentContent !== content) {
              yText.delete(0, yText.length);
              yText.insert(0, content);
            }
          }
        }
      }

      // 3. Sync via WorkspaceSync
      if (this.workspaceSync) {
        this.workspaceSync.syncFileChange(filePath, content, {
          name: filePath.split('/').pop(),
          type: 'file',
          lastModified: Date.now(),
          ...metadata
        });
      }

      console.log(`✅ File updated successfully: ${filePath}`);
      this.emit('file_updated', { filePath, content, metadata });

      return { success: true, path: filePath };
    } catch (error) {
      console.error(`❌ Failed to update file ${filePath}:`, error);
      this.emit('error', { type: 'file_update_failed', filePath, error });
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath) {
    if (!this.isInitialized) {
      throw new Error('Unified File System not initialized');
    }

    try {
      console.log(`🗑️ Deleting file: ${filePath}`);

      // 1. Delete via FileSystemIntegration
      await this.fileSystemIntegration.deleteFile(filePath);

      // 2. Remove from YjsFileSystem if available
      if (this.yjsFileSystem) {
        if (this.isInCollaborationRoom()) {
          await this.yjsFileSystem.deleteFileInRoom(filePath);
        } else {
          await this.yjsFileSystem.deleteFile(filePath);
        }
      }

      // 3. Sync deletion via WorkspaceSync
      if (this.workspaceSync) {
        this.workspaceSync.syncFileDelete(filePath);
      }

      console.log(`✅ File deleted successfully: ${filePath}`);
      this.emit('file_deleted', { filePath });

      return { success: true, path: filePath };
    } catch (error) {
      console.error(`❌ Failed to delete file ${filePath}:`, error);
      this.emit('error', { type: 'file_delete_failed', filePath, error });
      throw error;
    }
  }

  /**
   * Create a folder
   */
  async createFolder(folderPath, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Unified File System not initialized');
    }

    try {
      console.log(`📁 Creating folder: ${folderPath}`);

      // 1. Create via FileSystemIntegration
      await this.fileSystemIntegration.createFolder(folderPath, {
        userId: this.user?.id || this.user?.uid,
        sessionId: this.session?.id,
        ...metadata
      });

      // 2. Add to YjsFileSystem if available
      if (this.yjsFileSystem) {
        if (this.isInCollaborationRoom()) {
          await this.yjsFileSystem.createFolderInRoom(folderPath);
        } else {
          await this.yjsFileSystem.createFolder(folderPath);
        }
      }

      // 3. Sync via WorkspaceSync
      if (this.workspaceSync) {
        this.workspaceSync.syncFolderCreate(folderPath);
      }

      console.log(`✅ Folder created successfully: ${folderPath}`);
      this.emit('folder_created', { folderPath, metadata });

      return { success: true, path: folderPath };
    } catch (error) {
      console.error(`❌ Failed to create folder ${folderPath}:`, error);
      this.emit('error', { type: 'folder_create_failed', folderPath, error });
      throw error;
    }
  }

  /**
   * Rename a file or folder
   */
  async renameFile(oldPath, newPath) {
    if (!this.isInitialized) {
      throw new Error('Unified File System not initialized');
    }

    try {
      console.log(`🔄 Renaming: ${oldPath} -> ${newPath}`);

      // 1. Rename via FileSystemIntegration
      await this.fileSystemIntegration.renameFile(oldPath, newPath);

      // 2. Handle in YjsFileSystem (delete old, create new)
      if (this.yjsFileSystem) {
        const yText = this.yjsFileSystem.getFile(oldPath);
        if (yText) {
          const content = yText.toString();
          await this.yjsFileSystem.deleteFile(oldPath);
          await this.yjsFileSystem.createFile(newPath, content);
        }
      }

      // 3. Sync via WorkspaceSync
      if (this.workspaceSync) {
        const fileContent = this.getFileContent(oldPath);
        this.workspaceSync.syncFileDelete(oldPath);
        this.workspaceSync.syncFileChange(newPath, fileContent || '', {
          name: newPath.split('/').pop(),
          type: 'file',
          lastModified: Date.now()
        });
      }

      console.log(`✅ File renamed successfully: ${oldPath} -> ${newPath}`);
      this.emit('file_renamed', { oldPath, newPath });

      return { success: true, oldPath, newPath };
    } catch (error) {
      console.error(`❌ Failed to rename file ${oldPath}:`, error);
      this.emit('error', { type: 'file_rename_failed', oldPath, newPath, error });
      throw error;
    }
  }

  /**
   * Get file content
   */
  getFileContent(filePath) {
    if (!this.isInitialized) {
      return null;
    }

    // Try YjsFileSystem first (most up-to-date)
    if (this.yjsFileSystem) {
      const yText = this.yjsFileSystem.getFile(filePath);
      if (yText) {
        return yText.toString();
      }
    }

    // Fall back to FileSystemIntegration
    return this.fileSystemIntegration?.getFileContent(filePath) || null;
  }

  /**
   * Check if file exists
   */
  fileExists(filePath) {
    if (!this.isInitialized) {
      return false;
    }

    return this.fileSystemIntegration?.fileExists(filePath) || false;
  }

  /**
   * Get all files as array (for UI)
   */
  getFilesArray() {
    if (!this.isInitialized) {
      return [];
    }

    return this.fileSystemIntegration?.getFilesArray() || [];
  }

  /**
   * Get file tree structure for UI display
   */
  getFileTreeArray() {
    if (!this.isInitialized) {
      return [];
    }

    // Delegate to FileSystemIntegration which manages the VFS
    return this.fileSystemIntegration?.getFileTreeArray?.() || [];
  }

  /**
   * Read file content (for compatibility with old VFS interface)
   */
  readFile(filePath) {
    if (!this.isInitialized) {
      return null;
    }

    // Delegate to FileSystemIntegration VFS adapter
    const vfsAdapter = this.fileSystemIntegration?.fileSystemManager?.getAdapter?.('vfs');
    if (vfsAdapter && vfsAdapter.vfs && typeof vfsAdapter.vfs.readFile === 'function') {
      return vfsAdapter.vfs.readFile(filePath);
    }

    return null;
  }

  /**
   * Check if VFS has a file (compatibility method)
   */
  hasFile(filePath) {
    if (!this.isInitialized) {
      return false;
    }

    // Delegate to FileSystemIntegration VFS adapter
    const vfsAdapter = this.fileSystemIntegration?.fileSystemManager?.getAdapter?.('vfs');
    if (vfsAdapter && vfsAdapter.vfs && vfsAdapter.vfs.files) {
      return vfsAdapter.vfs.files.has(filePath);
    }

    return false;
  }

  /**
   * Load data into VFS (compatibility method)
   */
  loadFromData(data) {
    if (!this.isInitialized) {
      return;
    }

    // Delegate to FileSystemIntegration VFS adapter
    const vfsAdapter = this.fileSystemIntegration?.fileSystemManager?.getAdapter?.('vfs');
    if (vfsAdapter && vfsAdapter.vfs && typeof vfsAdapter.vfs.loadFromData === 'function') {
      vfsAdapter.vfs.loadFromData(data);
    }
  }

  /**
   * Get the FileSystemManager instance for direct event listening
   */
  getFileSystemManager() {
    if (!this.isInitialized) {
      return null;
    }
    return this.fileSystemIntegration?.fileSystemManager || null;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up Unified File System...');
    
    if (this.workspaceSync) {
      this.workspaceSync.disconnect();
      this.workspaceSync = null;
    }

    if (this.fileSystemIntegration) {
      await this.fileSystemIntegration.cleanup();
      this.fileSystemIntegration = null;
    }

    this.yjsFileSystem = null;
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

// Export singleton instance
let unifiedFileSystemInstance = null;

export function getUnifiedFileSystem() {
  if (!unifiedFileSystemInstance) {
    unifiedFileSystemInstance = new UnifiedFileSystem();
  }
  return unifiedFileSystemInstance;
}

export default UnifiedFileSystem;