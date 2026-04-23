/**
 * Firebase File Storage Service
 * Handles permanent storage of user files and folders with localStorage fallback
 */

import { databaseService } from '../utils/firebase';

export class FirebaseFileService {
  constructor() {
    this.dbService = databaseService;
    this.cache = new Map();
    this.listeners = new Map();
  }

  // Simple localStorage-based file operations
  async createFile(fileData) {
    const file = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...fileData,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: 1
    };

    localStorage.setItem(`codecollab_file_${file.id}`, JSON.stringify(file));
    console.log('✅ File created:', file.name);
    return { success: true, data: file };
  }

  async updateFile(fileId, updates) {
    try {
      const fileData = localStorage.getItem(`codecollab_file_${fileId}`);
      if (!fileData) throw new Error('File not found');
      
      const file = JSON.parse(fileData);
      const updatedFile = { ...file, ...updates, lastModified: new Date().toISOString() };
      
      localStorage.setItem(`codecollab_file_${fileId}`, JSON.stringify(updatedFile));
      return { success: true, data: updatedFile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteFile(fileId) {
    localStorage.removeItem(`codecollab_file_${fileId}`);
    return { success: true };
  }

  async getUserFiles(userId) {
    const files = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('codecollab_file_')) {
        try {
          const file = JSON.parse(localStorage.getItem(key));
          if (file.userId === userId) files.push(file);
        } catch (error) {
          // Skip invalid files
        }
      }
    }
    return { success: true, data: files };
  }

  async createFolder(folderData) {
    const folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...folderData,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    localStorage.setItem(`codecollab_folder_${folder.id}`, JSON.stringify(folder));
    return { success: true, data: folder };
  }

  async updateFolder(folderId, updates) {
    try {
      const folderData = localStorage.getItem(`codecollab_folder_${folderId}`);
      if (!folderData) throw new Error('Folder not found');
      
      const folder = JSON.parse(folderData);
      const updatedFolder = { ...folder, ...updates, lastModified: new Date().toISOString() };
      
      localStorage.setItem(`codecollab_folder_${folderId}`, JSON.stringify(updatedFolder));
      return { success: true, data: updatedFolder };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteFolder(folderId) {
    localStorage.removeItem(`codecollab_folder_${folderId}`);
    return { success: true };
  }

  async getUserFolders(userId) {
    const folders = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('codecollab_folder_')) {
        try {
          const folder = JSON.parse(localStorage.getItem(key));
          if (folder.userId === userId) folders.push(folder);
        } catch (error) {
          // Skip invalid folders
        }
      }
    }
    return { success: true, data: folders };
  }

  async syncVFSToFirebase(userId, vfsData) {
    // Simple implementation: just store the VFS data
    const syncData = {
      userId,
      vfsData,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`codecollab_vfs_${userId}`, JSON.stringify(syncData));
    console.log('✅ VFS data synced to localStorage');
    
    return {
      success: true,
      data: {
        syncedFiles: Object.keys(vfsData.files || {}).length,
        syncedFolders: Object.keys(vfsData.folders || {}).length,
        timestamp: syncData.timestamp
      }
    };
  }

  async loadFirebaseToVFS(userId) {
    try {
      const syncData = localStorage.getItem(`codecollab_vfs_${userId}`);
      if (!syncData) {
        return {
          success: true,
          data: {
            vfsData: { files: {}, folders: {}, root: '/' },
            loadedFiles: 0,
            loadedFolders: 0
          }
        };
      }

      const { vfsData } = JSON.parse(syncData);
      return {
        success: true,
        data: {
          vfsData,
          loadedFiles: Object.keys(vfsData.files || {}).length,
          loadedFolders: Object.keys(vfsData.folders || {}).length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
