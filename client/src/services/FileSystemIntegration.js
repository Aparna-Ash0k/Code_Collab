/**
 * Integration layer for FileSystemManager
 * 
 * This replaces the old StorageManager with the new FileSystemManager
 * and provides backward compatibility for existing code.
 */

import { getFileSystemManager, ADAPTER_ORIGINS } from './FileSystemManager.js';
import { FirebaseFileService } from './FirebaseFileService.js';

/**
 * Integration service that bridges the old FileSystemContext 
 * with the new FileSystemManager architecture
 */
export class FileSystemIntegration {
  constructor() {
    this.fileSystemManager = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the FileSystemManager with current context
   */
  async initialize(context) {
    try {
      this.fileSystemManager = getFileSystemManager();
      
      // Prepare adapter context
      const adapterContext = {
        user: context.user,
        socket: context.socket,
        session: context.session,
        firebaseService: context.user ? new FirebaseFileService() : null
      };
      
      await this.fileSystemManager.initialize(adapterContext);
      
      // Set up event listeners for UI updates
      this.setupEventListeners(context);
      
      this.isInitialized = true;
      console.log('🔗 FileSystemManager integration initialized');
      
      return this.fileSystemManager;
    } catch (error) {
      console.error('Failed to initialize FileSystemManager integration:', error);
      throw error;
    }
  }

  setupEventListeners(context) {
    // Listen for operation completion to update UI
    this.fileSystemManager.on('operation_completed', (data) => {
      const { operation } = data;
      
      // Emit custom events for UI updates
      const event = new CustomEvent('filesystem_operation_completed', {
        detail: {
          type: operation.type,
          path: operation.path,
          payload: operation.payload,
          canonicalState: this.fileSystemManager.getCanonicalState()
        }
      });
      
      window.dispatchEvent(event);
    });

    // Listen for operation failures
    this.fileSystemManager.on('operation_failed', (data) => {
      console.error('FileSystem operation failed:', data);
      
      const event = new CustomEvent('filesystem_operation_failed', {
        detail: data
      });
      
      window.dispatchEvent(event);
    });
  }

  /**
   * Create a file using the new architecture
   */
  async createFile(filePath, content = '', options = {}) {
    if (!this.isInitialized) {
      throw new Error('FileSystemManager not initialized');
    }

    const fileData = {
      path: filePath,
      name: options.name || filePath.split('/').pop(),
      content,
      type: 'file',
      userId: options.userId,
      projectId: options.projectId
    };

    return await this.fileSystemManager.createFile(fileData, ADAPTER_ORIGINS.USER);
  }

  /**
   * Update a file using the new architecture
   */
  async updateFile(filePath, content, options = {}) {
    if (!this.isInitialized) {
      throw new Error('FileSystemManager not initialized');
    }

    return await this.fileSystemManager.updateFile(filePath, content, ADAPTER_ORIGINS.USER);
  }

  /**
   * Create a folder using the new architecture
   */
  async createFolder(folderPath, options = {}) {
    if (!this.isInitialized) {
      throw new Error('FileSystemManager not initialized');
    }

    const folderData = {
      path: folderPath,
      name: options.name || folderPath.split('/').pop(),
      type: 'folder',
      userId: options.userId,
      projectId: options.projectId
    };

    return await this.fileSystemManager.createFolder(folderData, ADAPTER_ORIGINS.USER);
  }

  /**
   * Delete a file or folder using the new architecture
   */
  async deleteFile(filePath, options = {}) {
    if (!this.isInitialized) {
      throw new Error('FileSystemManager not initialized');
    }

    return await this.fileSystemManager.deleteFile(filePath, ADAPTER_ORIGINS.USER);
  }

  /**
   * Rename a file or folder using the new architecture
   */
  async renameFile(oldPath, newPath, options = {}) {
    if (!this.isInitialized) {
      throw new Error('FileSystemManager not initialized');
    }

    return await this.fileSystemManager.renameFile(oldPath, newPath, ADAPTER_ORIGINS.USER);
  }

  /**
   * Get file content
   */
  getFileContent(filePath) {
    if (!this.isInitialized) {
      return null;
    }

    return this.fileSystemManager.getFileContent(filePath);
  }

  /**
   * Check if file exists
   */
  fileExists(filePath) {
    if (!this.isInitialized) {
      return false;
    }

    return this.fileSystemManager.fileExists(filePath);
  }

  /**
   * Get all files as array for UI
   */
  getFilesArray() {
    if (!this.isInitialized) {
      return [];
    }

    return this.fileSystemManager.getFilesArray();
  }

  /**
   * Get file tree structure for UI display
   */
  getFileTreeArray() {
    if (!this.isInitialized) {
      return [];
    }

    // Get the VFS adapter and delegate to its getFileTreeArray method
    const vfsAdapter = this.fileSystemManager?.getAdapter?.('vfs');
    if (vfsAdapter && vfsAdapter.vfs && typeof vfsAdapter.vfs.getFileTreeArray === 'function') {
      return vfsAdapter.vfs.getFileTreeArray();
    }

    return [];
  }

  /**
   * Get canonical state
   */
  getCanonicalState() {
    if (!this.isInitialized) {
      return new Map();
    }

    return this.fileSystemManager.getCanonicalState();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.fileSystemManager) {
      await this.fileSystemManager.cleanup();
      this.fileSystemManager = null;
    }
    
    this.isInitialized = false;
  }
}

// Create singleton instance
let integrationInstance = null;

/**
 * Get the singleton FileSystemIntegration instance
 */
export function getFileSystemIntegration() {
  if (!integrationInstance) {
    integrationInstance = new FileSystemIntegration();
  }
  return integrationInstance;
}

/**
 * Initialize the FileSystemManager with context
 */
export async function initializeFileSystem(context) {
  const integration = getFileSystemIntegration();
  return await integration.initialize(context);
}

export default FileSystemIntegration;
