/**
 * Virtual File System
 * 
 * In-memory file system for CodeCollab
 * Provides immediate file operations and UI updates
 */

class VirtualFileSystem {
  constructor() {
    this.files = new Map();
    this.folders = new Set();
    this.listeners = new Set();
  }

  /**
   * Create a file
   */
  createFile(path, content = '', options = {}) {
    const { notify = true, ...fileData } = options;
    
    const normalizedPath = this.normalizePath(path);
    
    if (this.files.has(normalizedPath)) {
      if (!options.overwrite) {
        throw new Error(`File already exists: ${normalizedPath}`);
      }
    }
    
    const file = {
      content,
      type: 'file',
      created: Date.now(),
      lastModified: Date.now(),
      isDirty: false,
      ...fileData
    };
    
    this.files.set(normalizedPath, file);
    
    if (notify) {
      this.notifyListeners('create', normalizedPath, file);
    }
    
    return file;
  }

  /**
   * Create a folder
   */
  createFolder(path, options = {}) {
    const { notify = true } = options;
    
    const normalizedPath = this.normalizePath(path);
    
    if (!normalizedPath.endsWith('/')) {
      this.folders.add(normalizedPath + '/');
    } else {
      this.folders.add(normalizedPath);
    }
    
    if (notify) {
      this.notifyListeners('createFolder', normalizedPath);
    }
  }

  /**
   * Update file content
   */
  updateFile(path, content, options = {}) {
    const { notify = true, markDirty = true } = options;
    
    const normalizedPath = this.normalizePath(path);
    const existing = this.files.get(normalizedPath);
    
    if (!existing) {
      // File doesn't exist, create it
      return this.createFile(normalizedPath, content, { notify, ...options });
    }
    
    const updated = {
      ...existing,
      content,
      lastModified: Date.now(),
      isDirty: markDirty
    };
    
    this.files.set(normalizedPath, updated);
    
    if (notify) {
      this.notifyListeners('update', normalizedPath, updated);
    }
    
    return updated;
  }

  /**
   * Read file content
   */
  readFile(path) {
    const normalizedPath = this.normalizePath(path);
    return this.files.get(normalizedPath);
  }

  /**
   * Check if file or folder exists
   */
  exists(path) {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath) || this.folders.has(normalizedPath) || this.folders.has(normalizedPath + '/');
  }

  /**
   * Delete file or folder
   */
  delete(path, options = {}) {
    const { notify = true } = options;
    
    const normalizedPath = this.normalizePath(path);
    
    // Delete file
    if (this.files.has(normalizedPath)) {
      this.files.delete(normalizedPath);
      
      if (notify) {
        this.notifyListeners('delete', normalizedPath);
      }
      return true;
    }
    
    // Delete folder and its contents
    const folderPath = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';
    if (this.folders.has(folderPath)) {
      this.folders.delete(folderPath);
      
      // Delete all files in folder
      for (const [filePath] of this.files) {
        if (filePath.startsWith(folderPath)) {
          this.files.delete(filePath);
        }
      }
      
      // Delete all subfolders
      for (const subFolderPath of this.folders) {
        if (subFolderPath.startsWith(folderPath) && subFolderPath !== folderPath) {
          this.folders.delete(subFolderPath);
        }
      }
      
      if (notify) {
        this.notifyListeners('delete', normalizedPath);
      }
      return true;
    }
    
    return false;
  }

  /**
   * Get file tree as array for UI
   */
  getFileTreeArray() {
    const items = [];
    
    // Add folders
    for (const folderPath of this.folders) {
      const cleanPath = folderPath.replace(/\/$/, '');
      if (cleanPath) {
        items.push({
          name: cleanPath.split('/').pop(),
          path: cleanPath,
          type: 'folder',
          isFolder: true
        });
      }
    }
    
    // Add files
    for (const [filePath, fileData] of this.files) {
      items.push({
        name: filePath.split('/').pop(),
        path: filePath,
        type: 'file',
        isFolder: false,
        content: fileData.content,
        isDirty: fileData.isDirty || false,
        lastModified: fileData.lastModified
      });
    }
    
    return items.sort((a, b) => {
      // Folders first, then files
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Serialize to JSON
   */
  serialize() {
    const filesObj = {};
    for (const [path, data] of this.files) {
      filesObj[path] = data;
    }
    
    return {
      files: filesObj,
      folders: Array.from(this.folders)
    };
  }

  /**
   * Load from serialized data
   */
  loadFromData(data) {
    if (data.files) {
      this.files.clear();
      for (const [path, fileData] of Object.entries(data.files)) {
        this.files.set(path, fileData);
      }
    }
    
    if (data.folders) {
      this.folders.clear();
      for (const folderPath of data.folders) {
        this.folders.add(folderPath);
      }
    }
    
    this.notifyListeners('load');
  }

  /**
   * Clear all files and folders
   */
  clear() {
    this.files.clear();
    this.folders.clear();
    this.notifyListeners('clear');
  }

  /**
   * Normalize file paths
   */
  normalizePath(path) {
    if (!path) return '';
    return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(action, path, data) {
    for (const listener of this.listeners) {
      try {
        listener(action, path, data);
      } catch (error) {
        console.error('VFS listener error:', error);
      }
    }
  }
}

// Create singleton instance
export const virtualFileSystem = new VirtualFileSystem();

export default virtualFileSystem;
