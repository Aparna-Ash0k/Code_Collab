/**
 * VFS (Virtual File System) Adapter for FileSystemManager
 * 
 * Handles in-memory virtual file system operations in the adapter pattern.
 * Provides immediate UI updates and serves as the canonical state source.
 */

import { EventEmitter } from 'events';
import { virtualFileSystem } from '../../utils/virtualFileSystem';

export class VFSAdapter extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.vfs = virtualFileSystem;
  }

  async initialize() {
    try {
      // VFS is always available as it's in-memory
      this.isInitialized = true;
      console.log('📁 VFS adapter initialized');
    } catch (error) {
      console.error('Failed to initialize VFS adapter:', error);
      throw error;
    }
  }

  /**
   * Handle operation from FileSystemManager
   */
  async handleOperation(operation) {
    if (!this.isInitialized) {
      console.warn('VFS adapter not initialized, skipping operation');
      return;
    }

    try {
      const { type, path, payload } = operation;
      
      console.log(`📁 VFS handling: ${type} ${path}`);

      switch (type) {
        case 'create':
          await this.createFile(path, payload);
          break;
          
        case 'create_folder':
          await this.createFolder(path, payload);
          break;
          
        case 'update':
          await this.updateFile(path, payload);
          break;
          
        case 'delete':
          await this.deleteFile(path);
          break;
          
        case 'rename':
          await this.renameFile(payload.oldPath, payload.newPath);
          break;
          
        default:
          console.warn(`Unsupported operation type: ${type}`);
      }
      
      // Emit VFS state update for UI
      this.emitVFSUpdate();
      
    } catch (error) {
      console.error('VFS adapter operation failed:', error);
      this.emit('error', error);
    }
  }

  async createFile(path, payload) {
    // Use VFS createFile method with notification disabled to prevent echo
    this.vfs.createFile(path, payload.content || '', { 
      notify: false,
      type: 'file',
      isDirty: false,
      ...payload
    });
  }

  async createFolder(path, payload) {
    // Use VFS createFolder method with notification disabled
    this.vfs.createFolder(path, { 
      notify: false,
      ...payload
    });
  }

  async updateFile(path, payload) {
    // Check if file exists
    if (this.vfs.exists(path)) {
      this.vfs.updateFile(path, payload.content, { 
        notify: false,
        markDirty: false, // Managed by FileSystemManager
        ...payload
      });
    } else {
      // File doesn't exist, create it
      await this.createFile(path, payload);
    }
  }

  async deleteFile(path) {
    // Use VFS delete method with notification disabled
    this.vfs.delete(path, { notify: false });
  }

  async renameFile(oldPath, newPath) {
    // VFS rename implementation
    if (this.vfs.exists(oldPath)) {
      const fileData = this.vfs.readFile(oldPath);
      
      if (fileData) {
        // Create file at new path
        this.vfs.createFile(newPath, fileData.content, { 
          notify: false,
          ...fileData
        });
        
        // Delete old file
        this.vfs.delete(oldPath, { notify: false });
      } else {
        // It's a folder
        const folderData = this.vfs.folders.get(oldPath);
        if (folderData) {
          this.vfs.createFolder(newPath, { notify: false });
          this.vfs.delete(oldPath, { notify: false });
        }
      }
    }
  }

  /**
   * Emit VFS state update event for UI synchronization
   */
  emitVFSUpdate() {
    // Trigger UI update by dispatching custom event
    const event = new CustomEvent('vfs_state_update', {
      detail: {
        files: this.vfs.getFileTreeArray(),
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Get all files from VFS
   */
  getAllFiles() {
    return this.vfs.files;
  }

  /**
   * Get file content by path
   */
  getFileContent(path) {
    const fileData = this.vfs.readFile(path);
    return fileData ? fileData.content : null;
  }

  /**
   * Check if file exists
   */
  fileExists(path) {
    return this.vfs.exists(path);
  }

  /**
   * Get file tree array for UI
   */
  getFileTreeArray() {
    return this.vfs.getFileTreeArray();
  }

  async cleanup() {
    this.isInitialized = false;
    this.removeAllListeners();
  }
}
