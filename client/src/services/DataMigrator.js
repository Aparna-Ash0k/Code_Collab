/**
 * Data Migration Script
 * 
 * Migrates from the current 7-layer file system to the new Yjs-based architecture
 * Handles:
 * - LocalStorage data extraction
 * - VFS to Firestore conversion
 * - File content migration
 * - Project creation
 * - Snapshot generation
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '../utils/firebase';
import { FirebaseSchema } from '../config/firebase-schema';

export class DataMigrator {
  constructor() {
    this.migrationLog = [];
    this.errors = [];
    this.stats = {
      projectsCreated: 0,
      filesMigrated: 0,
      snapshotsCreated: 0,
      errors: 0
    };
  }

  /**
   * Main migration entry point
   */
  async migrateFromLegacySystem(userId, options = {}) {
    const { 
      dryRun = false, 
      includeSnapshots = true,
      cleanupAfter = false 
    } = options;

    this.log('🚀 Starting migration from legacy file system');
    this.log(`User: ${userId}, Dry Run: ${dryRun}`);

    try {
      // Step 1: Extract legacy data
      const legacyData = await this.extractLegacyData();
      this.log(`📁 Extracted ${Object.keys(legacyData.projects || {}).length} projects`);

      // Step 2: Validate extracted data
      const validationResults = this.validateLegacyData(legacyData);
      if (!validationResults.isValid) {
        throw new Error(`Validation failed: ${validationResults.errors.join(', ')}`);
      }

      if (!dryRun) {
        // Step 3: Create Firebase projects
        const migratedProjects = await this.migrateProjects(legacyData, userId);
        
        // Step 4: Migrate files
        await this.migrateFiles(migratedProjects, legacyData);
        
        // Step 5: Create snapshots
        if (includeSnapshots) {
          await this.createSnapshots(migratedProjects);
        }
        
        // Step 6: Cleanup legacy data
        if (cleanupAfter) {
          await this.cleanupLegacyData();
        }
      }

      this.log('✅ Migration completed successfully');
      return {
        success: true,
        stats: this.stats,
        log: this.migrationLog,
        projects: this.stats.projectsCreated
      };

    } catch (error) {
      this.logError('❌ Migration failed', error);
      return {
        success: false,
        error: error.message,
        stats: this.stats,
        log: this.migrationLog,
        errors: this.errors
      };
    }
  }

  /**
   * Extract data from all legacy storage systems
   */
  async extractLegacyData() {
    const legacyData = {
      projects: {},
      files: {},
      userPreferences: {},
      metadata: {}
    };

    // Extract from localStorage
    try {
      const vfsData = localStorage.getItem('vfs_data');
      const userProjects = localStorage.getItem('user_projects');
      const preferences = localStorage.getItem('user_preferences');

      if (vfsData) {
        const parsed = JSON.parse(vfsData);
        if (parsed.vfsData) {
          legacyData.files = parsed.vfsData.files || {};
          legacyData.folders = parsed.vfsData.folders || [];
        }
      }

      if (userProjects) {
        legacyData.projects = JSON.parse(userProjects);
      }

      if (preferences) {
        legacyData.userPreferences = JSON.parse(preferences);
      }

      this.log(`📦 Extracted from localStorage: ${Object.keys(legacyData.files).length} files`);
    } catch (error) {
      this.logError('Failed to extract localStorage data', error);
    }

    // Extract from sessionStorage
    try {
      const sessionData = sessionStorage.getItem('current_workspace');
      if (sessionData) {
        const workspace = JSON.parse(sessionData);
        legacyData.currentWorkspace = workspace;
      }
    } catch (error) {
      this.logError('Failed to extract sessionStorage data', error);
    }

    // Extract from IndexedDB (if using guest mode)
    try {
      const guestData = await this.extractFromIndexedDB();
      if (guestData) {
        legacyData.guestProjects = guestData;
      }
    } catch (error) {
      this.logError('Failed to extract IndexedDB data', error);
    }

    // Check current VFS instances
    try {
      if (window.virtualFileSystem) {
        const vfsFiles = window.virtualFileSystem.serialize();
        legacyData.currentVFS = vfsFiles;
      }
      
      if (window.enhancedFileSystem) {
        const enhancedFiles = window.enhancedFileSystem.serialize();
        legacyData.enhancedVFS = enhancedFiles;
      }
    } catch (error) {
      this.logError('Failed to extract current VFS data', error);
    }

    return legacyData;
  }

  /**
   * Extract data from IndexedDB for guest users
   */
  async extractFromIndexedDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open('CodeCollabGuest', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('projects')) {
          resolve(null);
          return;
        }

        const transaction = db.transaction(['projects'], 'readonly');
        const store = transaction.objectStore('projects');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result);
        };

        getAllRequest.onerror = () => {
          resolve(null);
        };
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Validate extracted legacy data
   */
  validateLegacyData(legacyData) {
    const errors = [];
    
    if (!legacyData.files && !legacyData.currentVFS && !legacyData.enhancedVFS) {
      errors.push('No file data found in any legacy system');
    }

    // Check for corrupted file data
    Object.entries(legacyData.files || {}).forEach(([path, fileData]) => {
      if (!fileData || typeof fileData !== 'object') {
        errors.push(`Invalid file data for: ${path}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Migrate projects to Firebase
   */
  async migrateProjects(legacyData, userId) {
    const migratedProjects = [];
    
    // Create default project if no projects exist
    let projects = legacyData.projects || {};
    
    if (Object.keys(projects).length === 0) {
      projects = {
        'default': {
          name: 'My Project',
          description: 'Migrated from legacy system',
          createdAt: new Date().toISOString()
        }
      };
    }

    for (const [projectKey, projectData] of Object.entries(projects)) {
      try {
        const projectId = await FirebaseSchema.initializeProject({
          name: projectData.name || `Project ${projectKey}`,
          ownerUid: userId,
          description: projectData.description || 'Migrated from legacy system',
          visibility: projectData.visibility || 'private',
          language: projectData.language || 'javascript'
        });

        migratedProjects.push({
          id: projectId,
          legacyKey: projectKey,
          data: projectData
        });

        this.stats.projectsCreated++;
        this.log(`📂 Created project: ${projectData.name} (${projectId})`);

      } catch (error) {
        this.logError(`Failed to create project ${projectKey}`, error);
      }
    }

    return migratedProjects;
  }

  /**
   * Migrate files to Firebase
   */
  async migrateFiles(projects, legacyData) {
    const batch = writeBatch(db);
    let batchCount = 0;
    const BATCH_SIZE = 450; // Firestore limit is 500

    // Combine all file sources
    const allFiles = {
      ...legacyData.files,
      ...(legacyData.currentVFS?.files || {}),
      ...(legacyData.enhancedVFS?.files || {})
    };

    const allFolders = [
      ...(legacyData.folders || []),
      ...(legacyData.currentVFS?.folders || []),
      ...(legacyData.enhancedVFS?.folders || [])
    ];

    // Determine which project each file belongs to
    const projectForFile = (filePath) => {
      // Simple logic: assign to first project, or create project-specific logic
      return projects[0] || projects.find(p => p.legacyKey === 'default');
    };

    // Migrate folders first
    for (const folderPath of allFolders) {
      try {
        const project = projectForFile(folderPath);
        if (!project) continue;

        const fileId = this.generateFileId();
        const folderRef = doc(db, 'projects', project.id, 'files', fileId);
        
        batch.set(folderRef, {
          id: fileId,
          path: folderPath,
          name: this.getFileName(folderPath),
          type: 'folder',
          isDirectory: true,
          size: 0,
          updatedAt: serverTimestamp(),
          updatedByUid: project.data.ownerUid || 'system',
          parentPath: this.getParentPath(folderPath)
        });

        batchCount++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }

      } catch (error) {
        this.logError(`Failed to migrate folder ${folderPath}`, error);
      }
    }

    // Migrate files
    for (const [filePath, fileData] of Object.entries(allFiles)) {
      try {
        const project = projectForFile(filePath);
        if (!project) continue;

        const fileId = this.generateFileId();
        const fileRef = doc(db, 'projects', project.id, 'files', fileId);
        
        const content = fileData.content || '';
        const isLargeFile = content.length > 1000000; // 1MB threshold

        let storagePath = null;
        let contentText = content;

        // Upload large files to Storage
        if (isLargeFile) {
          try {
            const blob = new Blob([content], { type: 'text/plain' });
            const storageRef = ref(storage, `projects/${project.id}/files/${fileId}.txt`);
            await uploadBytes(storageRef, blob);
            storagePath = `projects/${project.id}/files/${fileId}.txt`;
            contentText = null; // Don't store large content in Firestore
          } catch (storageError) {
            this.logError(`Failed to upload large file ${filePath} to storage`, storageError);
            // Fallback: truncate content
            contentText = content.substring(0, 100000) + '\n... [TRUNCATED]';
          }
        }

        batch.set(fileRef, {
          id: fileId,
          path: filePath,
          name: this.getFileName(filePath),
          type: 'file',
          mime: this.detectMimeType(filePath),
          isDirectory: false,
          size: content.length,
          contentText,
          storagePath,
          updatedAt: serverTimestamp(),
          updatedByUid: project.data.ownerUid || 'system',
          parentPath: this.getParentPath(filePath),
          checksum: this.generateChecksum(content),
          metadata: {
            language: this.detectLanguage(filePath),
            migrated: true,
            originalSource: this.detectOriginalSource(fileData)
          }
        });

        batchCount++;
        this.stats.filesMigrated++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }

      } catch (error) {
        this.logError(`Failed to migrate file ${filePath}`, error);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
    }

    this.log(`📄 Migrated ${this.stats.filesMigrated} files`);
  }

  /**
   * Create snapshots for migrated projects
   */
  async createSnapshots(projects) {
    for (const project of projects) {
      try {
        // Get all files for this project
        const filesSnapshot = await getDocs(
          collection(db, 'projects', project.id, 'files')
        );

        const snapshotData = {
          files: {},
          folders: [],
          metadata: {
            projectId: project.id,
            createdAt: new Date().toISOString(),
            source: 'migration',
            originalData: project.data
          }
        };

        filesSnapshot.forEach((fileDoc) => {
          const fileData = fileDoc.data();
          if (fileData.type === 'folder') {
            snapshotData.folders.push(fileData.path);
          } else {
            snapshotData.files[fileData.path] = {
              content: fileData.contentText || '',
              type: fileData.type,
              size: fileData.size,
              lastModified: new Date().toISOString()
            };
          }
        });

        // Upload snapshot to Storage
        const snapshotBlob = new Blob([JSON.stringify(snapshotData, null, 2)], {
          type: 'application/json'
        });
        
        const snapshotId = this.generateSnapshotId();
        const storagePath = `snapshots/${project.id}/${snapshotId}.json`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, snapshotBlob);

        // Create snapshot metadata in Firestore
        await FirebaseSchema.createSnapshot(project.id, {
          createdByUid: project.data.ownerUid || 'system',
          storagePath,
          message: 'Initial snapshot from legacy system migration',
          fileCount: Object.keys(snapshotData.files).length,
          folderCount: snapshotData.folders.length,
          size: snapshotBlob.size
        });

        this.stats.snapshotsCreated++;
        this.log(`📸 Created snapshot for project: ${project.data.name}`);

      } catch (error) {
        this.logError(`Failed to create snapshot for project ${project.id}`, error);
      }
    }
  }

  /**
   * Clean up legacy data after successful migration
   */
  async cleanupLegacyData() {
    try {
      // Clear localStorage
      localStorage.removeItem('vfs_data');
      localStorage.removeItem('user_projects');
      localStorage.removeItem('codecollab_files');
      
      // Clear sessionStorage
      sessionStorage.removeItem('current_workspace');
      
      // Clear IndexedDB
      await this.clearIndexedDB();
      
      this.log('🧹 Legacy data cleaned up');
    } catch (error) {
      this.logError('Failed to cleanup legacy data', error);
    }
  }

  /**
   * Clear IndexedDB data
   */
  async clearIndexedDB() {
    return new Promise((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase('CodeCollabGuest');
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => resolve(); // Don't fail migration if cleanup fails
    });
  }

  // Utility methods
  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSnapshotId() {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getFileName(path) {
    return path.split('/').pop() || path;
  }

  getParentPath(path) {
    const parts = path.split('/');
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  }

  detectMimeType(path) {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const mimeMap = {
      'js': 'text/javascript',
      'jsx': 'text/javascript',
      'ts': 'text/typescript',
      'tsx': 'text/typescript',
      'py': 'text/x-python',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown',
      'json': 'application/json'
    };
    return mimeMap[ext] || 'text/plain';
  }

  detectLanguage(path) {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'md': 'markdown'
    };
    return langMap[ext] || 'text';
  }

  detectOriginalSource(fileData) {
    if (fileData.enhanced) return 'enhanced-vfs';
    if (fileData.legacy) return 'legacy-vfs';
    if (fileData.storage) return 'storage-manager';
    return 'unknown';
  }

  generateChecksum(content) {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  log(message) {
    console.log(`[Migration] ${message}`);
    this.migrationLog.push({
      timestamp: new Date().toISOString(),
      message,
      type: 'info'
    });
  }

  logError(message, error) {
    console.error(`[Migration] ${message}:`, error);
    this.migrationLog.push({
      timestamp: new Date().toISOString(),
      message: `${message}: ${error.message}`,
      type: 'error'
    });
    this.errors.push({ message, error: error.message });
    this.stats.errors++;
  }
}

// Export singleton instance
export const dataMigrator = new DataMigrator();
export default dataMigrator;
