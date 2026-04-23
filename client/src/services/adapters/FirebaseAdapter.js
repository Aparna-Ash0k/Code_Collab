/**
 * Firebase Adapter for FileSystemManager
 * 
 * Handles Firebase Firestore operations in the adapter pattern.
 * Implements the standard adapter interface for cloud storage.
 */

import { EventEmitter } from 'events';

export class FirebaseAdapter extends EventEmitter {
  constructor(firebaseService, user) {
    super();
    this.firebaseService = firebaseService;
    this.user = user;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Verify Firebase service is available
      if (!this.firebaseService) {
        throw new Error('Firebase service not available');
      }
      
      this.isInitialized = true;
      console.log('🔥 Firebase adapter initialized');
    } catch (error) {
      console.error('Failed to initialize Firebase adapter:', error);
      throw error;
    }
  }

  /**
   * Handle operation from FileSystemManager
   */
  async handleOperation(operation) {
    if (!this.isInitialized) {
      console.warn('Firebase adapter not initialized, skipping operation');
      return;
    }

    try {
      const { type, path, payload, metadata } = operation;
      
      console.log(`🔥 Firebase handling: ${type} ${path}`);

      switch (type) {
        case 'create':
          await this.createFile(path, payload, metadata);
          break;
          
        case 'create_folder':
          await this.createFolder(path, payload, metadata);
          break;
          
        case 'update':
          await this.updateFile(path, payload, metadata);
          break;
          
        case 'delete':
          await this.deleteFile(path, metadata);
          break;
          
        case 'rename':
          await this.renameFile(payload.oldPath, payload.newPath, metadata);
          break;
          
        default:
          console.warn(`Unsupported operation type: ${type}`);
      }
      
    } catch (error) {
      console.error('Firebase adapter operation failed:', error);
      this.emit('error', error);
    }
  }

  async createFile(path, payload, metadata) {
    const fileData = {
      path,
      name: payload.name,
      content: payload.content || '',
      type: 'file',
      isDirectory: false,
      size: (payload.content || '').length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorId: this.user.id,
      authorName: this.user.name || this.user.email,
      projectId: metadata?.projectId || 'default'
    };

    // Save to Firebase through the service
    await this.firebaseService.createFile(fileData, this.user.id);
  }

  async createFolder(path, payload, metadata) {
    const folderData = {
      path,
      name: payload.name,
      content: '',
      type: 'folder',
      isDirectory: true,
      size: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorId: this.user.id,
      authorName: this.user.name || this.user.email,
      projectId: metadata?.projectId || 'default'
    };

    // Save folder to Firebase
    await this.firebaseService.createFile(folderData, this.user.id);
  }

  async updateFile(path, payload, metadata) {
    // Get existing file
    const existingFile = await this.firebaseService.getFileByPath(path);
    
    if (existingFile) {
      const updatedData = {
        ...existingFile,
        content: payload.content,
        size: (payload.content || '').length,
        updatedAt: new Date().toISOString(),
        lastEditedBy: this.user.id
      };
      
      await this.firebaseService.updateFile(existingFile.id, updatedData);
    } else {
      // File doesn't exist, create it
      await this.createFile(path, payload, metadata);
    }
  }

  async deleteFile(path, metadata) {
    const existingFile = await this.firebaseService.getFileByPath(path);
    
    if (existingFile) {
      await this.firebaseService.deleteFile(existingFile.id);
    }
  }

  async renameFile(oldPath, newPath, metadata) {
    const existingFile = await this.firebaseService.getFileByPath(oldPath);
    
    if (existingFile) {
      const updatedData = {
        ...existingFile,
        path: newPath,
        name: newPath.split('/').pop(),
        updatedAt: new Date().toISOString()
      };
      
      await this.firebaseService.updateFile(existingFile.id, updatedData);
    }
  }

  async cleanup() {
    this.isInitialized = false;
    this.removeAllListeners();
  }
}
