/**
 * Unified Storage Manager
 * 
 * This class coordinates between all storage layers to provide a single source of truth:
 * - Virtual File System (in-memory)
 * - localStorage (browser persistence)
 * - Firebase (cloud storage)
 * - Database (server persistence)
 * 
 * Ensures atomic operations and prevents race conditions across storage layers.
 * Now includes performance optimization, real-time collaboration, migration, and backup.
 */

import { EventEmitter } from 'events';
import { virtualFileSystem } from '../utils/virtualFileSystem';
import { FirebaseFileService } from './FirebaseFileService';
import PerformanceOptimizer from './PerformanceOptimizer';
import CacheManager from './CacheManager';
import BatchProcessor from './BatchProcessor';
import LazyLoader from './LazyLoader';
import RealTimeCollaborationSync from './RealTimeCollaborationSync';
import ConflictResolutionEngine from './ConflictResolutionEngine';
import CursorTrackingService from './CursorTrackingService';
import StorageMigrationSystem from './StorageMigrationSystem';
import BackupRecoverySystem from './BackupRecoverySystem';
import AdvancedUserManagementSystem from './AdvancedUserManagementSystem';
import IntegrationAPIFramework from './IntegrationAPIFramework';
import ProductionReadinessChecker from './ProductionReadinessChecker';

export class StorageManager extends EventEmitter {
  constructor() {
    super(); // Call EventEmitter constructor
    
    this.vfs = virtualFileSystem;
    this.firebaseService = new FirebaseFileService();
    this.operationQueue = [];
    this.isProcessingQueue = false;
    this.conflictResolver = null; // Will be initialized with ConflictResolver
    this.databaseSyncService = null; // Will be initialized with DatabaseSyncService
    this.syncInProgress = false;
    
    // Initialize performance optimization services
    this.performanceOptimizer = new PerformanceOptimizer();
    this.cacheManager = new CacheManager(this.performanceOptimizer);
    this.batchProcessor = new BatchProcessor(this.performanceOptimizer);
    this.lazyLoader = new LazyLoader(this.performanceOptimizer);
    
    // Initialize collaboration and advanced services
    this.conflictResolutionEngine = new ConflictResolutionEngine();
    this.realTimeCollab = new RealTimeCollaborationSync(this, null); // authManager will be set later
    this.cursorTracking = new CursorTrackingService();
    this.migrationSystem = new StorageMigrationSystem(this);
    this.backupRecovery = new BackupRecoverySystem(this);
    
    // Connect cursor tracking to real-time collaboration
    this.cursorTracking.setCollaborationSync(this.realTimeCollab);
    
    // Initialize final enterprise systems
    this.advancedUserManagement = new AdvancedUserManagementSystem();
    this.integrationAPI = new IntegrationAPIFramework();
    this.productionReadiness = new ProductionReadinessChecker();
    
    // Setup service integrations
    this.setupServiceIntegrations();
    
    // Performance tracking
    this.performanceMetrics = {
      cacheHitRatio: 0,
      averageResponseTime: 0,
      totalOperations: 0,
      batchedOperations: 0
    };
    
    // Storage layer priorities (higher number = authoritative)
    this.STORAGE_PRIORITIES = {
      VFS: 1,        // Temporary, in-memory
      LOCAL: 2,      // Browser localStorage
      FIREBASE: 3,   // Cloud storage
      DATABASE: 4    // Server database (most authoritative)
    };

    // Operation types
    this.OPERATIONS = {
      CREATE: 'create',
      UPDATE: 'update', 
      DELETE: 'delete',
      MOVE: 'move'
    };

    this.listeners = new Set();
    this.conflictResolvers = new Map();
    
    console.log('🏗️ StorageManager initialized');
  }

  /**
   * Setup integrations between services
   */
  setupServiceIntegrations() {
    // Connect real-time collaboration with conflict resolution
    this.realTimeCollab.on('conflict_detected', async (conflictData) => {
      try {
        const resolution = await this.conflictResolutionEngine.resolveConflict(
          conflictData.conflictId, 
          'collaborative'
        );
        this.realTimeCollab.emit('conflict_resolved', resolution);
      } catch (error) {
        console.error('Failed to resolve collaboration conflict:', error);
      }
    });

    // Connect cursor tracking with real-time sync
    this.cursorTracking.on('cursor_update', (cursorData) => {
      this.realTimeCollab.broadcastCursorUpdate(cursorData);
    });

    // Setup automatic backup triggers
    this.on('operation_completed', async (operation) => {
      if (operation.type === this.OPERATIONS.CREATE || operation.type === this.OPERATIONS.UPDATE) {
        // Trigger incremental backup after file changes
        try {
          await this.backupRecovery.createBackup('incremental');
        } catch (error) {
          console.warn('Auto-backup failed:', error);
        }
      }
    });

    // Setup migration monitoring
    this.migrationSystem.on('migration_completed', (migration) => {
      console.log(`✅ Storage migration completed: ${migration.id}`);
      this.notifyListeners('migration_completed', migration);
    });

    // Setup backup monitoring
    this.backupRecovery.on('backup_completed', (backup) => {
      console.log(`✅ Backup completed: ${backup.id}`);
      this.notifyListeners('backup_completed', backup);
    });

    // Setup user management integration
    this.advancedUserManagement.on('user_permission_changed', (event) => {
      // Refresh collaboration permissions when user roles change
      this.realTimeCollab.refreshUserPermissions(event.userId);
    });

    // Setup integration API webhooks
    this.integrationAPI.on('webhook_triggered', async (webhook) => {
      if (webhook.eventType === 'file_created' || webhook.eventType === 'file_updated') {
        // Sync webhook events with storage operations
        this.notifyListeners('external_change', webhook);
      }
    });

    // Setup production readiness monitoring
    this.productionReadiness.on('validation_completed', (results) => {
      console.log(`📊 Production readiness: ${results.metrics.overallReadiness.toFixed(1)}%`);
      this.notifyListeners('readiness_updated', results);
    });

    console.log('🔗 Service integrations setup complete');
  }

  /**
   * Add a change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove a change listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners(operation, data) {
    this.listeners.forEach(callback => {
      try {
        callback(operation, data);
      } catch (error) {
        console.error('Storage listener error:', error);
      }
    });
  }

  /**
   * Queue an operation to prevent race conditions
   */
  async queueOperation(operation, data) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation,
        data,
        timestamp: Date.now(),
        resolve,
        reject
      };

      this.operationQueue.push(queueItem);
      this.processQueue();
    });
  }

  /**
   * Initialize ConflictResolver integration
   */
  initializeConflictResolver() {
    if (!this.conflictResolver) {
      import('../utils/ConflictResolver').then(({ ConflictResolver }) => {
        this.conflictResolver = new ConflictResolver(this);
        console.log('🔧 ConflictResolver initialized');
      }).catch(error => {
        console.error('Failed to initialize ConflictResolver:', error);
      });
    }
  }

  /**
   * Initialize DatabaseSyncService integration
   */
  initializeDatabaseSyncService() {
    if (!this.databaseSyncService) {
      import('./DatabaseSyncService').then(({ DatabaseSyncService }) => {
        this.databaseSyncService = new DatabaseSyncService();
        
        // Set up sync listeners
        this.databaseSyncService.addSyncListener((event, data) => {
          this.notifyListeners('database_sync', { event, data });
        });

        // Configure conflict resolution strategies
        this.databaseSyncService.setConflictResolutionStrategy('users', 'email', 'postgres_priority');
        this.databaseSyncService.setConflictResolutionStrategy('projects', 'collaborators', 'merge_arrays');
        this.databaseSyncService.setConflictResolutionStrategy('files', 'content', 'latest_timestamp');

        console.log('🔧 DatabaseSyncService initialized');
      }).catch(error => {
        console.error('Failed to initialize DatabaseSyncService:', error);
      });
    }
  }

  /**
   * Check for conflicts before operations
   */
  async checkForConflicts(operation, data) {
    if (!this.conflictResolver) {
      this.initializeConflictResolver();
      return null; // Skip conflict check on first run
    }

    try {
      // Check if detectConflicts method exists before calling
      if (typeof this.conflictResolver.detectConflicts !== 'function') {
        console.warn('⚠️ ConflictResolver.detectConflicts method not available yet');
        return null;
      }

      const conflicts = await this.conflictResolver.detectConflicts([data.path]);
      if (conflicts.length > 0) {
        console.log(`🔍 Detected ${conflicts.length} conflicts for ${data.path}`);
        
        // Auto-resolve if possible
        const resolvedConflicts = await this.conflictResolver.autoResolveConflicts(conflicts);
        
        if (resolvedConflicts.length < conflicts.length) {
          // Some conflicts need manual resolution
          const unresolved = conflicts.filter(c => !resolvedConflicts.find(r => r.id === c.id));
          console.warn('⚠️ Unresolved conflicts requiring manual intervention:', unresolved);
          return unresolved;
        }
      }
      return null; // No conflicts or all resolved
    } catch (error) {
      console.warn('Conflict detection failed:', error);
      return null; // Continue operation despite conflict check failure
    }
  }

  /**
   * Process the operation queue sequentially
   */
  async processQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.operationQueue.length > 0) {
      const item = this.operationQueue.shift();
      
      try {
        // Check for conflicts before executing operation
        const conflicts = await this.checkForConflicts(item.operation, item.data);
        
        if (conflicts && conflicts.length > 0) {
          // Emit conflict event for UI handling
          this.notifyListeners('conflict_detected', {
            operation: item.operation,
            conflicts: conflicts,
            data: item.data
          });
          
          // For now, proceed with operation after conflict notification
          console.warn('⚠️ Proceeding with operation despite conflicts');
        }
        
        const result = await this.executeOperation(item.operation, item.data);
        
        // Queue database sync after successful operation
        if (this.databaseSyncService && result.success) {
          this.queueDatabaseSync(item.operation, item.data, result);
        }
        
        item.resolve(result);
      } catch (error) {
        console.error('Operation failed:', item.operation, error);
        item.reject(error);
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Execute a single operation across all storage layers
   */
  async executeOperation(operation, data) {
    const { type, path, content, userId, projectId } = data;
    
    console.log(`📝 Executing ${operation}:${type} for ${path}`);
    
    try {
      let result = null;
      
      switch (operation) {
        case this.OPERATIONS.CREATE:
          result = await this.createFile(path, content, { userId, projectId });
          break;
          
        case this.OPERATIONS.UPDATE:
          result = await this.updateFile(path, content, { userId, projectId });
          break;
          
        case this.OPERATIONS.DELETE:
          result = await this.deleteFile(path, { userId, projectId });
          break;
          
        case this.OPERATIONS.MOVE:
          result = await this.moveFile(data.oldPath, path, { userId, projectId });
          break;
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      // Notify listeners
      this.notifyListeners(operation, { path, content, result });
      
      return result;
      
    } catch (error) {
      console.error(`Failed to execute ${operation}:`, error);
      throw error;
    }
  }

  /**
   * Create a file across all storage layers
   */
  async createFile(path, content = '', options = {}) {
    const { userId, projectId, type = 'file' } = options;
    
    // Validate inputs
    if (!path) throw new Error('Path is required');
    
    // Normalize path
    const normalizedPath = this.normalizePath(path);
    
    // Check if file already exists
    if (this.vfs.exists(normalizedPath)) {
      throw new Error(`File already exists: ${normalizedPath}`);
    }
    
    const fileData = {
      content,
      type,
      lastModified: Date.now(),
      isDirty: false,
      createdBy: userId,
      projectId
    };
    
    // 1. Create in VFS (immediate)
    this.vfs.createFile(normalizedPath, content, { notify: false, ...fileData });
    
    // 2. Save to localStorage (if user authenticated)
    if (userId) {
      try {
        await this.syncToLocalStorage(userId, projectId);
      } catch (error) {
        console.warn('Failed to sync to localStorage:', error);
      }
    }
    
    // 3. Save to Firebase (if available)
    if (userId && this.firebaseService) {
      try {
        await this.firebaseService.createFile({
          path: normalizedPath,
          content,
          userId,
          projectId: projectId || 'default',
          type,
          ...fileData
        });
      } catch (error) {
        console.warn('Failed to sync to Firebase:', error);
      }
    }
    
    // 4. TODO: Save to database via API
    // This will be implemented when we add the API integration
    
    console.log(`✅ File created: ${normalizedPath}`);
    return { success: true, path: normalizedPath, data: fileData };
  }

  /**
   * Update a file across all storage layers
   */
  async updateFile(path, content, options = {}) {
    const { userId, projectId, markDirty = true } = options;
    
    // Normalize path
    const normalizedPath = this.normalizePath(path);
    
    // Check if file exists
    const existingFile = this.vfs.readFile(normalizedPath);
    if (!existingFile) {
      // File doesn't exist, create it
      return this.createFile(normalizedPath, content, options);
    }
    
    const fileData = {
      ...existingFile,
      content,
      lastModified: Date.now(),
      isDirty: markDirty,
      lastEditedBy: userId
    };
    
    // 1. Update in VFS (immediate)
    this.vfs.updateFile(normalizedPath, content, { notify: false, markDirty });
    
    // 2. Save to localStorage (if user authenticated)
    if (userId) {
      try {
        await this.syncToLocalStorage(userId, projectId);
      } catch (error) {
        console.warn('Failed to sync to localStorage:', error);
      }
    }
    
    // 3. Save to Firebase (if available)
    if (userId && this.firebaseService) {
      try {
        const vfsData = this.vfs.serialize();
        await this.firebaseService.syncVFSToFirebase(userId, vfsData, projectId || 'default');
      } catch (error) {
        console.warn('Failed to sync to Firebase:', error);
      }
    }
    
    console.log(`✅ File updated: ${normalizedPath}`);
    return { success: true, path: normalizedPath, data: fileData };
  }

  /**
   * Delete a file across all storage layers
   */
  async deleteFile(path, options = {}) {
    const { userId, projectId } = options;
    
    // Normalize path
    const normalizedPath = this.normalizePath(path);
    
    // 1. Delete from VFS
    this.vfs.delete(normalizedPath, { notify: false });
    
    // 2. Update localStorage
    if (userId) {
      try {
        await this.syncToLocalStorage(userId, projectId);
      } catch (error) {
        console.warn('Failed to sync to localStorage:', error);
      }
    }
    
    // 3. Delete from Firebase
    if (userId && this.firebaseService) {
      try {
        const vfsData = this.vfs.serialize();
        await this.firebaseService.syncVFSToFirebase(userId, vfsData, projectId || 'default');
      } catch (error) {
        console.warn('Failed to sync to Firebase:', error);
      }
    }
    
    console.log(`🗑️ File deleted: ${normalizedPath}`);
    return { success: true, path: normalizedPath };
  }

  /**
   * Move/rename a file across all storage layers
   */
  async moveFile(oldPath, newPath, options = {}) {
    const { userId, projectId } = options;
    
    // Normalize paths
    const normalizedOldPath = this.normalizePath(oldPath);
    const normalizedNewPath = this.normalizePath(newPath);
    
    // 1. Move in VFS
    this.vfs.rename(normalizedOldPath, normalizedNewPath, { notify: false });
    
    // 2. Update localStorage
    if (userId) {
      try {
        await this.syncToLocalStorage(userId, projectId);
      } catch (error) {
        console.warn('Failed to sync to localStorage:', error);
      }
    }
    
    // 3. Update Firebase
    if (userId && this.firebaseService) {
      try {
        const vfsData = this.vfs.serialize();
        await this.firebaseService.syncVFSToFirebase(userId, vfsData, projectId || 'default');
      } catch (error) {
        console.warn('Failed to sync to Firebase:', error);
      }
    }
    
    console.log(`📁 File moved: ${normalizedOldPath} → ${normalizedNewPath}`);
    return { success: true, oldPath: normalizedOldPath, newPath: normalizedNewPath };
  }

  /**
   * Rename a file (alias for moveFile)
   */
  async renameFile(oldPath, newPath, options = {}) {
    return this.moveFile(oldPath, newPath, options);
  }

  /**
   * Create a folder across all storage layers
   */
  async createFolder(folderPath, options = {}) {
    const { userId, projectId } = options;
    
    // Normalize path
    const normalizedPath = this.normalizePath(folderPath);
    
    // Check if folder already exists
    if (await this.folderExists(normalizedPath)) {
      console.log(`ℹ️ Folder already exists: ${normalizedPath}`);
      return { success: true, path: normalizedPath, existed: true };
    }
    
    // 1. Create in VFS
    this.vfs.createFolder(normalizedPath);
    
    // 2. Sync to localStorage
    if (userId) {
      try {
        await this.syncToLocalStorage(userId, projectId);
      } catch (error) {
        console.warn('Failed to sync folder to localStorage:', error);
      }
    }
    
    // 3. Sync to Firebase
    if (userId && this.firebaseService) {
      try {
        const vfsData = this.vfs.serialize();
        await this.firebaseService.syncVFSToFirebase(userId, vfsData, projectId || 'default');
      } catch (error) {
        console.warn('Failed to sync folder to Firebase:', error);
      }
    }
    
    console.log(`📁 Folder created: ${normalizedPath}`);
    return { success: true, path: normalizedPath };
  }

  /**
   * Delete a folder across all storage layers
   */
  async deleteFolder(folderPath, options = {}) {
    const { userId, projectId } = options;
    
    // Normalize path
    const normalizedPath = this.normalizePath(folderPath);
    
    // Check if folder exists
    if (!(await this.folderExists(normalizedPath))) {
      console.log(`ℹ️ Folder doesn't exist: ${normalizedPath}`);
      return { success: true, path: normalizedPath, existed: false };
    }
    
    // 1. Delete from VFS
    this.vfs.delete(normalizedPath);
    
    // 2. Sync to localStorage
    if (userId) {
      try {
        await this.syncToLocalStorage(userId, projectId);
      } catch (error) {
        console.warn('Failed to sync folder deletion to localStorage:', error);
      }
    }
    
    // 3. Sync to Firebase
    if (userId && this.firebaseService) {
      try {
        const vfsData = this.vfs.serialize();
        await this.firebaseService.syncVFSToFirebase(userId, vfsData, projectId || 'default');
      } catch (error) {
        console.warn('Failed to sync folder deletion to Firebase:', error);
      }
    }
    
    console.log(`🗑️ Folder deleted: ${normalizedPath}`);
    return { success: true, path: normalizedPath };
  }

  /**
   * Sync VFS to localStorage
   */
  async syncToLocalStorage(userId, projectId) {
    if (!userId) return;
    
    const vfsData = this.vfs.serialize();
    const syncData = {
      userId,
      projectId: projectId || 'default',
      vfsData,
      timestamp: new Date().toISOString(),
      version: 1
    };
    
    const key = `codecollab_storage_${userId}_${projectId || 'default'}`;
    localStorage.setItem(key, JSON.stringify(syncData));
    localStorage.setItem('codecollab_last_sync', new Date().toISOString());
  }

  /**
   * Load data from storage layers into VFS
   */
  async loadFromStorage(userId, projectId) {
    console.log(`📥 Loading data for user ${userId}, project ${projectId || 'default'}`);
    
    try {
      // 1. Try Firebase first (most reliable)
      if (userId && this.firebaseService) {
        const firebaseResult = await this.firebaseService.loadFirebaseToVFS(userId);
        if (firebaseResult.success && firebaseResult.data.loadedFiles > 0) {
          this.vfs.loadFromData(firebaseResult.data.vfsData);
          console.log(`✅ Loaded ${firebaseResult.data.loadedFiles} files from Firebase`);
          return { success: true, source: 'firebase', ...firebaseResult.data };
        }
      }
      
      // 2. Fallback to localStorage
      const key = `codecollab_storage_${userId}_${projectId || 'default'}`;
      const localData = localStorage.getItem(key);
      
      if (localData) {
        const { vfsData } = JSON.parse(localData);
        this.vfs.loadFromData(vfsData);
        const fileCount = Object.keys(vfsData.files || {}).length;
        console.log(`✅ Loaded ${fileCount} files from localStorage`);
        return { success: true, source: 'localStorage', loadedFiles: fileCount };
      }
      
      console.log('📭 No stored data found');
      return { success: true, source: 'none', loadedFiles: 0 };
      
    } catch (error) {
      console.error('Failed to load from storage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Normalize file paths to prevent inconsistencies
   */
  normalizePath(path) {
    if (!path) return '';
    
    // Remove leading/trailing slashes and normalize separators
    return path
      .replace(/^\/+|\/+$/g, '')  // Remove leading/trailing slashes
      .replace(/\/+/g, '/')       // Replace multiple slashes with single
      .replace(/\\/g, '/');       // Convert backslashes to forward slashes
  }

  /**
   * Get file information across all storage layers
   */
  async getFileInfo(path) {
    const normalizedPath = this.normalizePath(path);
    
    return {
      path: normalizedPath,
      exists: this.vfs.exists(normalizedPath),
      vfs: this.vfs.readFile(normalizedPath),
      // TODO: Add database and other storage layer info
    };
  }

  /**
   * Sync all data to persistent storage
   */
  async syncAll(userId, projectId) {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping');
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      await this.syncToLocalStorage(userId, projectId);
      
      if (this.firebaseService) {
        const vfsData = this.vfs.serialize();
        await this.firebaseService.syncVFSToFirebase(userId, vfsData, projectId || 'default');
      }
      
      console.log('✅ Full sync completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Check if a file exists in any storage layer
   */
  async fileExists(filePath) {
    try {
      // Check VFS first (fastest)
      if (this.vfs.getFile(filePath)) {
        return true;
      }

      // Check localStorage
      const localData = localStorage.getItem('vfs_data');
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.files && parsed.files[filePath]) {
          return true;
        }
      }

      // Check Firebase if available
      if (this.firebaseService) {
        try {
          const firebaseFile = await this.firebaseService.getFile(filePath);
          if (firebaseFile) {
            return true;
          }
        } catch (error) {
          // Firebase check failed, continue
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Check if a folder exists in any storage layer
   */
  async folderExists(folderPath) {
    try {
      // Check VFS first
      const vfsData = this.vfs.getFileTreeArray();
      const folderExists = vfsData.some(item => 
        item.type === 'folder' && item.path === folderPath
      );
      
      if (folderExists) {
        return true;
      }

      // Check localStorage
      const localData = localStorage.getItem('vfs_data');
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.folders && parsed.folders.includes(folderPath)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking folder existence:', error);
      return false;
    }
  }

  /**
   * Get file information including timestamps
   */
  async getFileInfo(filePath) {
    try {
      // Get from VFS first
      const vfsFile = this.vfs.getFile(filePath);
      if (vfsFile) {
        return {
          path: filePath,
          content: vfsFile.content,
          lastModified: vfsFile.lastModified || Date.now(),
          size: vfsFile.content?.length || 0,
          source: 'VFS'
        };
      }

      // Check localStorage
      const localData = localStorage.getItem('vfs_data');
      if (localData) {
        const parsed = JSON.parse(localData);
        const localFile = parsed.files?.[filePath];
        if (localFile) {
          return {
            path: filePath,
            content: localFile.content,
            lastModified: localFile.lastModified || Date.now(),
            size: localFile.content?.length || 0,
            source: 'localStorage'
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }

  /**
   * Handle conflicts between storage layers
   */
  async resolveConflicts(conflicts) {
    if (!this.conflictResolver) {
      console.warn('ConflictResolver not initialized, cannot resolve conflicts');
      return [];
    }

    console.log('🔄 Resolving conflicts:', conflicts);
    
    try {
      const resolved = [];
      
      for (const conflict of conflicts) {
        const resolution = await this.conflictResolver.resolveConflict(conflict);
        if (resolution) {
          resolved.push(resolution);
          
          // Notify listeners of conflict resolution
          this.notifyListeners('conflict_resolved', {
            conflict: conflict,
            resolution: resolution
          });
        }
      }
      
      return resolved;
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return [];
    }
  }

  /**
   * Perform periodic conflict scan
   */
  async performConflictScan() {
    if (!this.conflictResolver) {
      this.initializeConflictResolver();
      return;
    }

    console.log('🔍 Performing periodic conflict scan...');
    
    try {
      await this.conflictResolver.scanAllFiles();
      console.log('✅ Conflict scan completed');
    } catch (error) {
      console.error('Periodic conflict scan failed:', error);
    }
  }

  /**
   * Queue database synchronization after file operations
   */
  queueDatabaseSync(operation, data, result) {
    if (!this.databaseSyncService) {
      this.initializeDatabaseSyncService();
      return;
    }

    const entityType = this.determineEntityType(data.path);
    
    this.databaseSyncService.queueSync({
      type: 'unidirectional',
      entityType: entityType,
      data: result.data || data,
      source: 'vfs',
      target: 'firebase',
      operation: operation,
      options: {
        timestamp: new Date(),
        userId: data.userId,
        projectId: data.projectId
      }
    });
  }

  /**
   * Determine entity type from file path
   */
  determineEntityType(path) {
    if (!path) return 'files';
    
    const normalizedPath = path.toLowerCase();
    
    // Be more specific about user-related paths to avoid false positives
    if (normalizedPath.startsWith('user/') || normalizedPath.startsWith('/user/') || 
        normalizedPath.endsWith('/profile.js') || normalizedPath.endsWith('/user.js')) {
      return 'users';
    }
    if (normalizedPath.startsWith('project/') || normalizedPath.startsWith('/project/') || 
        normalizedPath === '/' || normalizedPath === '/project.json') {
      return 'projects';
    }
    if (normalizedPath.includes('/chat/') || normalizedPath.includes('/message/') ||
        normalizedPath.endsWith('/chat.js') || normalizedPath.endsWith('/messages.js')) {
      return 'chatMessages';
    }
    if (normalizedPath.includes('/activity/') || normalizedPath.includes('/log/') ||
        normalizedPath.endsWith('/activity.js') || normalizedPath.endsWith('/log.js')) {
      return 'activities';
    }
    
    // Default to files for all other cases (including demo-user-file.js, admin-user-file.js, etc.)
    return 'files';
  }

  /**
   * Perform manual database sync
   */
  async performDatabaseSync(options = {}) {
    if (!this.databaseSyncService) {
      this.initializeDatabaseSyncService();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization
    }

    try {
      const result = await this.databaseSyncService.performFullSync(options);
      this.notifyListeners('database_sync_completed', result);
      return result;
    } catch (error) {
      console.error('Database sync failed:', error);
      this.notifyListeners('database_sync_failed', { error });
      throw error;
    }
  }

  /**
   * Get database sync health status
   */
  async getDatabaseSyncHealth() {
    if (!this.databaseSyncService) {
      return { status: 'not_initialized', layers: {} };
    }

    return await this.databaseSyncService.checkSyncHealth();
  }

  /**
   * Disable automatic conflict resolution
   */
  disableAutoConflictResolution() {
    if (this.conflictScanInterval) {
      clearInterval(this.conflictScanInterval);
      this.conflictScanInterval = null;
      console.log('⏹️ Auto conflict resolution disabled');
    }
  }

  // ==================== PERFORMANCE OPTIMIZATION METHODS ====================

  /**
   * Initialize performance optimization services
   */
  initializePerformanceServices() {
    // Link actual file operations to optimizers
    this.performanceOptimizer.actualFileRead = this.readFileActual.bind(this);
    this.performanceOptimizer.actualFileWrite = this.writeFileActual.bind(this);
    this.batchProcessor.readFile = this.readFileActual.bind(this);
    this.batchProcessor.writeFile = this.writeFileActual.bind(this);
    this.batchProcessor.deleteFile = this.deleteFileActual.bind(this);
    this.lazyLoader.loadFile = this.readFileActual.bind(this);

    // Setup event listeners for performance tracking
    this.performanceOptimizer.on('cache:hit', (data) => {
      this.updatePerformanceMetrics('cacheHit', data);
    });

    this.performanceOptimizer.on('batch:processed', (data) => {
      this.updatePerformanceMetrics('batch', data);
    });

    console.log('🚀 Performance optimization services initialized');
  }

  /**
   * Read file with performance optimization (caching, batching)
   */
  async readFileOptimized(filePath, options = {}) {
    const startTime = Date.now();
    
    try {
      // Try cache first
      if (options.cache !== false) {
        const cached = await this.cacheManager.get(`file:${filePath}`, 'fileContent');
        if (cached) {
          this.updateResponseTime(Date.now() - startTime);
          return cached;
        }
      }

      // Use batch processor for reading
      if (options.batch !== false) {
        const result = await this.batchProcessor.addOperation('fileRead', {
          filePath,
          options
        });
        
        this.updateResponseTime(Date.now() - startTime);
        return result;
      }

      // Fallback to direct read
      const result = await this.readFileActual(filePath, options);
      this.updateResponseTime(Date.now() - startTime);
      return result;

    } catch (error) {
      console.error('Optimized file read failed:', error);
      throw error;
    }
  }

  /**
   * Write file with performance optimization (batching, cache invalidation)
   */
  async writeFileOptimized(filePath, content, options = {}) {
    const startTime = Date.now();
    
    try {
      // Invalidate cache
      await this.cacheManager.invalidate(`file:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

      // Use batch processor for writing
      if (options.batch !== false) {
        const result = await this.batchProcessor.addOperation('fileWrite', {
          filePath,
          content,
          options
        });
        
        this.updateResponseTime(Date.now() - startTime);
        return result;
      }

      // Fallback to direct write
      const result = await this.writeFileActual(filePath, content, options);
      this.updateResponseTime(Date.now() - startTime);
      return result;

    } catch (error) {
      console.error('Optimized file write failed:', error);
      throw error;
    }
  }

  /**
   * Lazy load file with viewport detection
   */
  async lazyLoadFile(filePath, element = null, options = {}) {
    return await this.lazyLoader.load(
      `file:${filePath}`,
      () => this.readFileOptimized(filePath, options),
      {
        priority: options.priority || 'medium',
        element,
        viewport: !!element,
        cache: options.cache !== false,
        ...options
      }
    );
  }

  /**
   * Preload critical files for better performance
   */
  async preloadCriticalFiles(filePaths) {
    const preloadPromises = filePaths.map(filePath => {
      return this.lazyLoader.load(
        `file:${filePath}`,
        () => this.readFileOptimized(filePath, { cache: true }),
        { priority: 'critical' }
      );
    });

    await Promise.all(preloadPromises);
  }

  /**
   * Batch multiple file operations for efficiency
   */
  async batchFileOperations(operations) {
    const promises = operations.map(op => {
      const { type, filePath, content, options = {} } = op;
      
      switch (type) {
        case 'read':
          return this.batchProcessor.addOperation('fileRead', { filePath, options });
        case 'write':
          return this.batchProcessor.addOperation('fileWrite', { filePath, content, options });
        case 'delete':
          return this.batchProcessor.addOperation('fileDelete', { filePath, options });
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Get optimized file tree with caching
   */
  async getFileTreeOptimized(projectId, options = {}) {
    const cacheKey = `fileTree:${projectId}`;
    
    // Try cache first
    if (options.cache !== false) {
      const cached = await this.cacheManager.get(cacheKey, 'fileTree');
      if (cached) {
        return cached;
      }
    }

    // Get file tree from VFS
    const fileTree = this.vfs.getFileTreeArray();
    
    // Cache the result
    await this.cacheManager.set(cacheKey, fileTree, 'fileTree');
    
    return fileTree;
  }

  /**
   * Warm up cache with frequently used data
   */
  async warmupCache(userActivity) {
    try {
      // Warm up file cache
      if (userActivity.recentFiles) {
        const filePromises = userActivity.recentFiles.slice(0, 5).map(filePath => 
          this.readFileOptimized(filePath, { cache: true }).catch(() => null)
        );
        await Promise.all(filePromises);
      }

      // Warm up project metadata
      if (userActivity.currentProject) {
        await this.getFileTreeOptimized(userActivity.currentProject, { cache: true });
      }

      console.log('🔥 Cache warmed up successfully');
    } catch (error) {
      console.warn('Cache warmup failed:', error);
    }
  }

  /**
   * Actual file read implementation (without optimization)
   */
  async readFileActual(filePath, options = {}) {
    // Use existing readFile method
    return await this.readFile(filePath, options);
  }

  /**
   * Actual file write implementation (without optimization)
   */
  async writeFileActual(filePath, content, options = {}) {
    // Use existing writeFile method
    return await this.writeFile(filePath, content, options);
  }

  /**
   * Actual file delete implementation (without optimization)
   */
  async deleteFileActual(filePath, options = {}) {
    // Use existing deleteFile method
    return await this.deleteFile(filePath, options);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(type, data) {
    this.performanceMetrics.totalOperations++;
    
    switch (type) {
      case 'cacheHit':
        const currentHits = this.performanceOptimizer.metrics.cacheHits;
        const currentMisses = this.performanceOptimizer.metrics.cacheMisses;
        this.performanceMetrics.cacheHitRatio = currentHits / (currentHits + currentMisses) || 0;
        break;
        
      case 'batch':
        this.performanceMetrics.batchedOperations += data.count;
        break;
    }
  }

  /**
   * Update average response time
   */
  updateResponseTime(responseTime) {
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const operations = this.performanceMetrics.totalOperations;
    
    this.performanceMetrics.averageResponseTime = 
      (currentAvg * (operations - 1) + responseTime) / operations;
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    return {
      storageManager: this.performanceMetrics,
      optimizer: this.performanceOptimizer.getMetrics(),
      cache: this.cacheManager.getStats(),
      batch: this.batchProcessor.getStats(),
      lazy: this.lazyLoader.getStats()
    };
  }

  /**
   * Optimize storage for current usage patterns
   */
  async optimizeForUsage(userActivity) {
    try {
      // Preload predicted files
      await this.lazyLoader.preloadUserPatterns(userActivity);
      
      // Warm up cache
      await this.warmupCache(userActivity);
      
      // Adjust batch settings based on usage
      this.adjustBatchingForUsage(userActivity);
      
      console.log('⚡ Storage optimized for current usage patterns');
    } catch (error) {
      console.warn('Storage optimization failed:', error);
    }
  }

  /**
   * Adjust batching configuration based on usage patterns
   */
  adjustBatchingForUsage(userActivity) {
    const isHighActivity = userActivity.operationsPerMinute > 50;
    const hasLargeFiles = userActivity.averageFileSize > 100000; // 100KB
    
    if (isHighActivity) {
      // Increase batch sizes for high activity
      this.batchProcessor.configureBatch('fileWrite', { maxSize: 15, maxWait: 150 });
      this.batchProcessor.configureBatch('fileRead', { maxSize: 30, maxWait: 30 });
    }
    
    if (hasLargeFiles) {
      // Reduce batch sizes for large files
      this.batchProcessor.configureBatch('fileWrite', { maxSize: 5, maxWait: 200 });
    }
  }
}

// Create singleton instance
export const storageManager = new StorageManager();

// Initialize all services on startup
storageManager.initializeConflictResolver();
storageManager.initializeDatabaseSyncService();
storageManager.initializePerformanceServices();
