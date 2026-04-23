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

  async getFileByPath(path) {
    try {
      // Search through all files in localStorage to find the one with matching path
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('codecollab_file_')) {
          try {
            const file = JSON.parse(localStorage.getItem(key));
            if (file.path === path) {
              return file;
            }
          } catch (error) {
            // Skip invalid files
          }
        }
      }
      return null; // File not found
    } catch (error) {
      console.error('Error getting file by path:', error);
      return null;
    }
  }

  async syncVFSToFirebase(userId, vfsData) {
    try {
      // Validate input data
      if (!userId || !vfsData) {
        throw new Error('Missing userId or vfsData');
      }

      // Ensure proper data structure
      const normalizedVfsData = {
        files: vfsData.files || {},
        folders: Array.isArray(vfsData.folders) ? vfsData.folders : Object.keys(vfsData.folders || {})
      };

      const syncData = {
        userId,
        vfsData: normalizedVfsData,
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      // Store in localStorage with backup key as well
      const primaryKey = `codecollab_vfs_${userId}`;
      const backupKey = `codecollab_vfs_backup_${userId}`;
      
      localStorage.setItem(primaryKey, JSON.stringify(syncData));
      localStorage.setItem(backupKey, JSON.stringify(syncData));
      localStorage.setItem('codecollab_last_sync', new Date().toISOString());
      
      console.log('✅ VFS data synced to localStorage', {
        files: Object.keys(normalizedVfsData.files).length,
        folders: normalizedVfsData.folders.length,
        userId
      });
      
      return {
        success: true,
        data: {
          syncedFiles: Object.keys(normalizedVfsData.files || {}).length,
          syncedFolders: normalizedVfsData.folders.length,
          timestamp: syncData.timestamp
        }
      };
    } catch (error) {
      console.error('Failed to sync VFS to Firebase:', error);
      return { success: false, error: error.message };
    }
  }

  async loadFirebaseToVFS(userId) {
    try {
      if (!userId) {
        throw new Error('Missing userId');
      }

      // Try primary key first, then backup
      const primaryKey = `codecollab_vfs_${userId}`;
      const backupKey = `codecollab_vfs_backup_${userId}`;
      
      let syncData = localStorage.getItem(primaryKey);
      
      if (!syncData) {
        console.log('Primary VFS data not found, trying backup...');
        syncData = localStorage.getItem(backupKey);
      }
      
      if (!syncData) {
        console.log('No VFS data found for user:', userId);
        return {
          success: true,
          data: {
            vfsData: { files: {}, folders: [] },
            loadedFiles: 0,
            loadedFolders: 0
          }
        };
      }

      const { vfsData } = JSON.parse(syncData);
      
      // Ensure the data structure matches what VFS expects
      const normalizedVfsData = {
        files: vfsData.files || {},
        folders: Array.isArray(vfsData.folders) ? vfsData.folders : Object.keys(vfsData.folders || {})
      };
      
      console.log('✅ VFS data loaded from localStorage', {
        files: Object.keys(normalizedVfsData.files).length,
        folders: normalizedVfsData.folders.length,
        userId
      });
      
      return {
        success: true,
        data: {
          vfsData: normalizedVfsData,
          loadedFiles: Object.keys(normalizedVfsData.files).length,
          loadedFolders: normalizedVfsData.folders.length
        }
      };
    } catch (error) {
      console.error('Failed to load VFS from Firebase:', error);
      return { success: false, error: error.message };
    }
  }

  // Project management methods
  async syncUserProjects(userId, projectsData) {
    try {
      console.log('💾 Syncing user projects to storage:', userId, 'Projects:', Object.keys(projectsData.projects || {}).length);
      
      const key = `codecollab_projects_${userId}`;
      const serializedData = JSON.stringify({
        ...projectsData,
        lastSync: new Date().toISOString()
      });
      
      localStorage.setItem(key, serializedData);
      
      // Also store a backup with timestamp
      const backupKey = `codecollab_projects_backup_${userId}_${Date.now()}`;
      localStorage.setItem(backupKey, serializedData);
      
      // Clean old backups (keep only last 5)
      this.cleanupOldBackups(userId, 'projects');
      
      return { success: true, message: 'Projects synced successfully' };
    } catch (error) {
      console.error('Failed to sync projects:', error);
      return { success: false, error: error.message };
    }
  }

  async loadUserProjects(userId) {
    try {
      console.log('📂 Loading user projects for:', userId);
      
      const key = `codecollab_projects_${userId}`;
      const storedData = localStorage.getItem(key);
      
      if (storedData) {
        const projectsData = JSON.parse(storedData);
        console.log('✅ Loaded projects data:', Object.keys(projectsData.projects || {}).length, 'projects');
        
        return {
          success: true,
          data: projectsData
        };
      } else {
        console.log('📁 No projects found for user');
        return {
          success: true,
          data: {
            projects: {},
            activeProject: null,
            userId: userId
          }
        };
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      return { success: false, error: error.message };
    }
  }

  // Cleanup old backup files
  cleanupOldBackups(userId, type, keepCount = 5) {
    try {
      const prefix = `codecollab_${type}_backup_${userId}_`;
      const backupKeys = [];
      
      // Find all backup keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const timestamp = parseInt(key.split('_').pop());
          backupKeys.push({ key, timestamp });
        }
      }
      
      // Sort by timestamp and remove old ones
      backupKeys.sort((a, b) => b.timestamp - a.timestamp);
      
      if (backupKeys.length > keepCount) {
        const toRemove = backupKeys.slice(keepCount);
        toRemove.forEach(backup => {
          localStorage.removeItem(backup.key);
          console.log('🗑️ Removed old backup:', backup.key);
        });
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }
}
