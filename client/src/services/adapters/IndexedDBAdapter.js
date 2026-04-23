/**
 * IndexedDB Adapter for FileSystemManager
 * 
 * Handles IndexedDB operations in the adapter pattern.
 * Provides offline storage for guest users and enhanced storage capacity.
 */

import { EventEmitter } from 'events';

export class IndexedDBAdapter extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.dbName = 'CodeCollabFS';
    this.dbVersion = 1;
    this.db = null;
  }

  async initialize() {
    try {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        throw new Error('IndexedDB not available');
      }
      
      // Open/create database
      this.db = await this.openDatabase();
      
      this.isInitialized = true;
      console.log('🗄️ IndexedDB adapter initialized');
    } catch (error) {
      console.error('Failed to initialize IndexedDB adapter:', error);
      throw error;
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create files object store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'path' });
          filesStore.createIndex('type', 'type', { unique: false });
          filesStore.createIndex('created', 'created', { unique: false });
          filesStore.createIndex('lastModified', 'lastModified', { unique: false });
        }
        
        // Create metadata object store
        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Handle operation from FileSystemManager
   */
  async handleOperation(operation) {
    if (!this.isInitialized) {
      console.warn('IndexedDB adapter not initialized, skipping operation');
      return;
    }

    try {
      const { type, path, payload } = operation;
      
      console.log(`🗄️ IndexedDB handling: ${type} ${path}`);

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
      
      // Update metadata
      await this.updateMetadata();
      
    } catch (error) {
      console.error('IndexedDB adapter operation failed:', error);
      this.emit('error', error);
    }
  }

  async createFile(path, payload) {
    const fileData = {
      path,
      name: payload.name,
      content: payload.content || '',
      type: 'file',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      size: (payload.content || '').length
    };
    
    await this.putFile(fileData);
  }

  async createFolder(path, payload) {
    const folderData = {
      path,
      name: payload.name,
      content: '',
      type: 'folder',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      size: 0
    };
    
    await this.putFile(folderData);
  }

  async updateFile(path, payload) {
    const existingFile = await this.getFile(path);
    
    if (existingFile) {
      const updatedFile = {
        ...existingFile,
        content: payload.content,
        lastModified: new Date().toISOString(),
        size: (payload.content || '').length
      };
      
      await this.putFile(updatedFile);
    } else {
      // File doesn't exist, create it
      await this.createFile(path, payload);
    }
  }

  async deleteFile(path) {
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    
    // Delete the file/folder
    await this.promiseFromRequest(store.delete(path));
    
    // Delete any children (for folder deletions)
    const pathPrefix = path + '/';
    const allFiles = await this.getAllFiles();
    
    for (const file of allFiles) {
      if (file.path.startsWith(pathPrefix)) {
        await this.promiseFromRequest(store.delete(file.path));
      }
    }
  }

  async renameFile(oldPath, newPath) {
    const existingFile = await this.getFile(oldPath);
    
    if (existingFile) {
      // Create new file with updated path and name
      const updatedFile = {
        ...existingFile,
        path: newPath,
        name: newPath.split('/').pop(),
        lastModified: new Date().toISOString()
      };
      
      // Add the renamed file
      await this.putFile(updatedFile);
      
      // Delete the old file
      await this.deleteFile(oldPath);
      
      // Handle renaming children (for folder renames)
      const oldPrefix = oldPath + '/';
      const newPrefix = newPath + '/';
      const allFiles = await this.getAllFiles();
      
      for (const file of allFiles) {
        if (file.path.startsWith(oldPrefix)) {
          const newFilePath = file.path.replace(oldPrefix, newPrefix);
          const renamedFile = {
            ...file,
            path: newFilePath,
            lastModified: new Date().toISOString()
          };
          
          await this.putFile(renamedFile);
          await this.deleteFileByPath(file.path);
        }
      }
    }
  }

  async putFile(fileData) {
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    
    await this.promiseFromRequest(store.put(fileData));
  }

  async getFile(path) {
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    
    return await this.promiseFromRequest(store.get(path));
  }

  async deleteFileByPath(path) {
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    
    await this.promiseFromRequest(store.delete(path));
  }

  async getAllFiles() {
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    
    return await this.promiseFromRequest(store.getAll());
  }

  async updateMetadata() {
    const metadata = {
      key: 'last_modified',
      value: new Date().toISOString()
    };
    
    const transaction = this.db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    
    await this.promiseFromRequest(store.put(metadata));
  }

  promiseFromRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all files (for synchronization)
   */
  async getFiles() {
    return await this.getAllFiles();
  }

  /**
   * Get file content by path
   */
  async getFileContent(path) {
    const file = await this.getFile(path);
    return file ? file.content : null;
  }

  async cleanup() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.isInitialized = false;
    this.removeAllListeners();
  }
}
