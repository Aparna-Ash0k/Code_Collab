/**
 * SyncManager - Handles real-time synchronization and prevents race conditions
 * 
 * Features:
 * - Operation queuing and ordering
 * - Conflict detection and resolution
 * - Atomic operation handling
 * - Echo prevention
 * - Last-write-wins with timestamps
 */

class SyncManager {
  constructor() {
    this.operationQueue = [];
    this.activeOperations = new Map(); // filePath -> operation
    this.lastOperationTimestamps = new Map(); // filePath -> timestamp
    this.lockFile = new Set(); // files currently being processed
    this.pendingBroadcasts = new Map(); // operation_id -> broadcast_data
    this.userId = null;
    this.sessionId = null;
    this.isProcessing = false;
  }

  /**
   * Initialize sync manager with user and session context
   */
  initialize(userId, sessionId) {
    this.userId = userId;
    this.sessionId = sessionId;
    console.log('🔄 SyncManager initialized for user:', userId, 'session:', sessionId);
  }

  /**
   * Queue an operation for processing
   * Ensures operations are processed in order and handles conflicts
   */
  async queueOperation(operation) {
    const { type, filePath, data, userId, timestamp } = operation;
    
    // Create unique operation ID
    const operationId = `${type}_${filePath}_${timestamp}_${userId}`;
    
    // Check if this is our own operation (echo prevention)
    if (userId === this.userId) {
      console.log('🔄 Ignoring own operation echo:', operationId);
      return { success: true, reason: 'own_operation' };
    }

    // Check if file is currently locked
    if (this.lockFile.has(filePath)) {
      console.log('⏳ File locked, queuing operation:', operationId);
      this.operationQueue.push({ ...operation, operationId });
      return { success: true, reason: 'queued' };
    }

    // Check for conflicts with timestamp comparison
    const lastTimestamp = this.lastOperationTimestamps.get(filePath);
    if (lastTimestamp && timestamp < lastTimestamp) {
      console.log('⚠️ Operation timestamp older than last operation, discarding:', operationId);
      return { success: false, reason: 'outdated' };
    }

    // Process operation immediately
    return await this.processOperation({ ...operation, operationId });
  }

  /**
   * Process a single operation with conflict resolution
   */
  async processOperation(operation) {
    const { type, filePath, data, userId, timestamp, operationId } = operation;

    try {
      // Lock the file
      this.lockFile.add(filePath);
      this.activeOperations.set(filePath, operation);

      console.log('🔄 Processing operation:', operationId);

      let result;
      switch (type) {
        case 'file_create':
          result = await this.handleFileCreate(filePath, data, userId, timestamp);
          break;
        case 'file_update':
          result = await this.handleFileUpdate(filePath, data, userId, timestamp);
          break;
        case 'file_delete':
          result = await this.handleFileDelete(filePath, userId, timestamp);
          break;
        case 'file_rename':
          result = await this.handleFileRename(filePath, data.newPath, userId, timestamp);
          break;
        case 'folder_create':
          result = await this.handleFolderCreate(filePath, userId, timestamp);
          break;
        case 'folder_delete':
          result = await this.handleFolderDelete(filePath, userId, timestamp);
          break;
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      // Update last operation timestamp
      this.lastOperationTimestamps.set(filePath, timestamp);

      return { success: true, result, operationId };

    } catch (error) {
      console.error('❌ Failed to process operation:', operationId, error);
      return { success: false, error: error.message, operationId };
    } finally {
      // Unlock the file
      this.lockFile.delete(filePath);
      this.activeOperations.delete(filePath);

      // Process next queued operation for this file
      await this.processQueuedOperations(filePath);
    }
  }

  /**
   * Process any queued operations for a specific file
   */
  async processQueuedOperations(filePath) {
    const queuedIndex = this.operationQueue.findIndex(op => 
      op.filePath === filePath || 
      (op.type === 'file_rename' && op.data?.newPath === filePath)
    );

    if (queuedIndex !== -1) {
      const queuedOperation = this.operationQueue.splice(queuedIndex, 1)[0];
      console.log('🔄 Processing queued operation:', queuedOperation.operationId);
      await this.processOperation(queuedOperation);
    }
  }

  /**
   * Handle file creation with conflict detection
   */
  async handleFileCreate(filePath, data, userId, timestamp) {
    const { StorageManager } = await import('./StorageManager.js');
    
    // Check if file already exists
    const exists = await StorageManager.fileExists(filePath);
    if (exists) {
      console.log('⚠️ File already exists, converting to update:', filePath);
      return await this.handleFileUpdate(filePath, data, userId, timestamp);
    }

    // Create file through StorageManager
    const result = await StorageManager.createFile(filePath, data.content || '', {
      syncAcrossStorage: true,
      bypassEcho: true
    });

    return {
      type: 'file_created',
      filePath,
      content: data.content,
      autoOpen: data.autoOpen
    };
  }

  /**
   * Handle file updates with last-write-wins conflict resolution
   */
  async handleFileUpdate(filePath, data, userId, timestamp) {
    const { StorageManager } = await import('./StorageManager.js');
    
    // Get current file timestamp for conflict detection
    const fileInfo = await StorageManager.getFileInfo(filePath);
    if (fileInfo && fileInfo.lastModified && timestamp < fileInfo.lastModified) {
      console.log('⚠️ File update timestamp older than current file, discarding');
      return { type: 'update_discarded', reason: 'outdated' };
    }

    // Update file through StorageManager
    const result = await StorageManager.updateFile(filePath, data.content, {
      syncAcrossStorage: true,
      bypassEcho: true
    });

    return {
      type: 'file_updated',
      filePath,
      content: data.content
    };
  }

  /**
   * Handle file deletion with conflict detection
   */
  async handleFileDelete(filePath, userId, timestamp) {
    const { StorageManager } = await import('./StorageManager.js');
    
    // Check if file exists
    const exists = await StorageManager.fileExists(filePath);
    if (!exists) {
      console.log('ℹ️ File already deleted:', filePath);
      return { type: 'already_deleted', filePath };
    }

    // Delete file through StorageManager
    const result = await StorageManager.deleteFile(filePath, {
      syncAcrossStorage: true,
      bypassEcho: true
    });

    return {
      type: 'file_deleted',
      filePath
    };
  }

  /**
   * Handle file rename with conflict detection
   */
  async handleFileRename(oldPath, newPath, userId, timestamp) {
    const { StorageManager } = await import('./StorageManager.js');
    
    // Check if source file exists
    const sourceExists = await StorageManager.fileExists(oldPath);
    if (!sourceExists) {
      throw new Error(`Source file does not exist: ${oldPath}`);
    }

    // Check if destination already exists
    const destExists = await StorageManager.fileExists(newPath);
    if (destExists) {
      throw new Error(`Destination file already exists: ${newPath}`);
    }

    // Rename file through StorageManager
    const result = await StorageManager.renameFile(oldPath, newPath, {
      syncAcrossStorage: true,
      bypassEcho: true
    });

    return {
      type: 'file_renamed',
      oldPath,
      newPath
    };
  }

  /**
   * Handle folder creation
   */
  async handleFolderCreate(folderPath, userId, timestamp) {
    const { StorageManager } = await import('./StorageManager.js');
    
    // Check if folder already exists
    const exists = await StorageManager.folderExists(folderPath);
    if (exists) {
      console.log('ℹ️ Folder already exists:', folderPath);
      return { type: 'already_exists', folderPath };
    }

    // Create folder through StorageManager
    const result = await StorageManager.createFolder(folderPath, {
      syncAcrossStorage: true,
      bypassEcho: true
    });

    return {
      type: 'folder_created',
      folderPath
    };
  }

  /**
   * Handle folder deletion
   */
  async handleFolderDelete(folderPath, userId, timestamp) {
    const { StorageManager } = await import('./StorageManager.js');
    
    // Check if folder exists
    const exists = await StorageManager.folderExists(folderPath);
    if (!exists) {
      console.log('ℹ️ Folder already deleted:', folderPath);
      return { type: 'already_deleted', folderPath };
    }

    // Delete folder through StorageManager
    const result = await StorageManager.deleteFolder(folderPath, {
      syncAcrossStorage: true,
      bypassEcho: true
    });

    return {
      type: 'folder_deleted',
      folderPath
    };
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      queueLength: this.operationQueue.length,
      activeOperations: Array.from(this.activeOperations.entries()),
      lockedFiles: Array.from(this.lockFile),
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear all queued operations (for session reset)
   */
  clearQueue() {
    this.operationQueue = [];
    this.activeOperations.clear();
    this.lockFile.clear();
    this.lastOperationTimestamps.clear();
    console.log('🔄 SyncManager queue cleared');
  }

  /**
   * Validate operation before processing
   */
  validateOperation(operation) {
    const required = ['type', 'filePath', 'userId', 'timestamp'];
    for (const field of required) {
      if (!operation[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate timestamp is reasonable (not too old or in future)
    const now = Date.now();
    const maxAge = 60 * 1000; // 1 minute
    const maxFuture = 5 * 1000; // 5 seconds

    if (operation.timestamp < (now - maxAge)) {
      throw new Error('Operation timestamp too old');
    }
    if (operation.timestamp > (now + maxFuture)) {
      throw new Error('Operation timestamp in future');
    }

    return true;
  }
}

// Export singleton instance
const syncManager = new SyncManager();
export default syncManager;
