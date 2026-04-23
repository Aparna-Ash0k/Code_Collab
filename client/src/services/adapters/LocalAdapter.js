/**
 * Local Storage Adapter for FileSystemManager
 * 
 * Handles localStorage operations in the adapter pattern.
 * Provides persistent storage for authenticated users.
 */

import { EventEmitter } from 'events';

export class LocalAdapter extends EventEmitter {
  constructor(user) {
    super();
    this.user = user;
    this.isInitialized = false;
    this.storageKey = `codecollab_files_${user.id}`;
    this.metadataKey = `codecollab_metadata_${user.id}`;
  }

  async initialize() {
    try {
      // Verify localStorage is available
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage not available');
      }
      
      // Initialize storage structure if it doesn't exist
      if (!localStorage.getItem(this.storageKey)) {
        this.initializeStorage();
      }
      
      this.isInitialized = true;
      console.log('💾 Local adapter initialized');
    } catch (error) {
      console.error('Failed to initialize Local adapter:', error);
      throw error;
    }
  }

  initializeStorage() {
    const initialData = {
      files: {},
      folders: [],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: 1
      }
    };
    
    localStorage.setItem(this.storageKey, JSON.stringify(initialData));
    localStorage.setItem(this.metadataKey, JSON.stringify(initialData.metadata));
  }

  /**
   * Handle operation from FileSystemManager
   */
  async handleOperation(operation) {
    if (!this.isInitialized) {
      console.warn('Local adapter not initialized, skipping operation');
      return;
    }

    try {
      const { type, path, payload } = operation;
      
      console.log(`💾 Local handling: ${type} ${path}`);

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
      this.updateMetadata();
      
    } catch (error) {
      console.error('Local adapter operation failed:', error);
      this.emit('error', error);
    }
  }

  async createFile(path, payload) {
    const data = this.loadData();
    
    data.files[path] = {
      name: payload.name,
      content: payload.content || '',
      type: 'file',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      size: (payload.content || '').length,
      authorId: this.user.id
    };
    
    this.saveData(data);
  }

  async createFolder(path, payload) {
    const data = this.loadData();
    
    // Add to folders array if not already present
    if (!data.folders.includes(path)) {
      data.folders.push(path);
    }
    
    // Also add as a file entry with folder type
    data.files[path] = {
      name: payload.name,
      content: '',
      type: 'folder',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      size: 0,
      authorId: this.user.id
    };
    
    this.saveData(data);
  }

  async updateFile(path, payload) {
    const data = this.loadData();
    
    if (data.files[path]) {
      data.files[path] = {
        ...data.files[path],
        content: payload.content,
        lastModified: new Date().toISOString(),
        size: (payload.content || '').length
      };
    } else {
      // File doesn't exist, create it
      await this.createFile(path, payload);
      return;
    }
    
    this.saveData(data);
  }

  async deleteFile(path) {
    const data = this.loadData();
    
    // Remove from files
    delete data.files[path];
    
    // Remove from folders if it's a folder
    const folderIndex = data.folders.indexOf(path);
    if (folderIndex > -1) {
      data.folders.splice(folderIndex, 1);
    }
    
    // Remove any files/folders that are children of this path
    const pathPrefix = path + '/';
    Object.keys(data.files).forEach(filePath => {
      if (filePath.startsWith(pathPrefix)) {
        delete data.files[filePath];
      }
    });
    
    data.folders = data.folders.filter(folderPath => 
      !folderPath.startsWith(pathPrefix)
    );
    
    this.saveData(data);
  }

  async renameFile(oldPath, newPath) {
    const data = this.loadData();
    
    // Rename the file/folder itself
    if (data.files[oldPath]) {
      const fileData = data.files[oldPath];
      data.files[newPath] = {
        ...fileData,
        name: newPath.split('/').pop(),
        lastModified: new Date().toISOString()
      };
      delete data.files[oldPath];
    }
    
    // Update folders array
    const folderIndex = data.folders.indexOf(oldPath);
    if (folderIndex > -1) {
      data.folders[folderIndex] = newPath;
    }
    
    // Rename any children (for folder renames)
    const oldPrefix = oldPath + '/';
    const newPrefix = newPath + '/';
    
    Object.keys(data.files).forEach(filePath => {
      if (filePath.startsWith(oldPrefix)) {
        const newFilePath = filePath.replace(oldPrefix, newPrefix);
        data.files[newFilePath] = data.files[filePath];
        delete data.files[filePath];
      }
    });
    
    data.folders = data.folders.map(folderPath => 
      folderPath.startsWith(oldPrefix) 
        ? folderPath.replace(oldPrefix, newPrefix)
        : folderPath
    );
    
    this.saveData(data);
  }

  loadData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { files: {}, folders: [], metadata: {} };
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
      return { files: {}, folders: [], metadata: {} };
    }
  }

  saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save data to localStorage:', error);
      throw error;
    }
  }

  updateMetadata() {
    const metadata = {
      lastModified: new Date().toISOString(),
      version: (this.getMetadata().version || 0) + 1
    };
    
    localStorage.setItem(this.metadataKey, JSON.stringify(metadata));
  }

  getMetadata() {
    try {
      const metadata = localStorage.getItem(this.metadataKey);
      return metadata ? JSON.parse(metadata) : {};
    } catch (error) {
      console.error('Failed to load metadata from localStorage:', error);
      return {};
    }
  }

  /**
   * Get all files (for synchronization)
   */
  getAllFiles() {
    const data = this.loadData();
    return data.files;
  }

  /**
   * Get file content by path
   */
  getFile(path) {
    const data = this.loadData();
    return data.files[path] || null;
  }

  async cleanup() {
    this.isInitialized = false;
    this.removeAllListeners();
  }
}
