/**
 * Centralized FileSystemManager with Adapter Pattern
 * 
 * This is the SINGLE CANONICAL INTERFACE for ALL file operations.
 * It solves the synchronization issues by:
 * 1. Normalizing all operations into a consistent format
 * 2. Managing canonical state in-memory
 * 3. Broadcasting to all adapters except the origin
 * 4. Providing conflict resolution
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

// Import adapters
import { FirebaseAdapter } from './adapters/FirebaseAdapter.js';
import { SocketAdapter } from './adapters/SocketAdapter.js';
import { LocalAdapter } from './adapters/LocalAdapter.js';
import { IndexedDBAdapter } from './adapters/IndexedDBAdapter.js';
import { VFSAdapter } from './adapters/VFSAdapter.js';

/**
 * Operation types supported by the FileSystemManager
 */
export const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update', 
  DELETE: 'delete',
  RENAME: 'rename',
  MOVE: 'move',
  CREATE_FOLDER: 'create_folder'
};

/**
 * Adapter origins - each storage system gets a unique identifier
 */
export const ADAPTER_ORIGINS = {
  VFS: 'vfs',
  FIREBASE: 'firebase',
  SOCKET: 'socket',
  LOCAL: 'local',
  INDEXEDDB: 'indexeddb',
  USER: 'user' // Direct user action
};

/**
 * Centralized FileSystemManager
 * 
 * This class provides a single canonical interface for all file operations.
 * It ensures consistency across all storage adapters and prevents race conditions.
 */
export class FileSystemManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.adapters = new Map();
    this.canonicalState = new Map(); // In-memory canonical file state
    this.operationQueue = [];
    this.processingQueue = false;
    this.conflictResolver = new ConflictResolver();
    
    // Configuration
    this.config = {
      enableConflictResolution: true,
      echoPreventionTimeout: 2000,
      operationTimeout: 5000,
      ...options
    };
    
    // Operation tracking for echo prevention
    this.recentOperations = new Map(); // operationId -> { timestamp, origin }
    
    console.log('🎯 FileSystemManager initialized with adapter pattern');
  }

  /**
   * Initialize adapters based on available services
   */
  async initialize(context = {}) {
    const { user, socket, session, firebaseService } = context;
    
    console.log('🔄 Initializing FileSystemManager adapters...');
    
    // Always available - VFS adapter (in-memory)
    this.addAdapter(ADAPTER_ORIGINS.VFS, new VFSAdapter());
    
    // Socket adapter (if in session)
    if (socket && session) {
      this.addAdapter(ADAPTER_ORIGINS.SOCKET, new SocketAdapter(socket, session));
    }
    
    // Local storage adapter (if user authenticated)
    if (user) {
      this.addAdapter(ADAPTER_ORIGINS.LOCAL, new LocalAdapter(user));
    }
    
    // Firebase adapter (if service available)
    if (user && firebaseService) {
      this.addAdapter(ADAPTER_ORIGINS.FIREBASE, new FirebaseAdapter(firebaseService, user));
    }
    
    // IndexedDB adapter (for guest users or offline mode)
    if (!user || !firebaseService) {
      this.addAdapter(ADAPTER_ORIGINS.INDEXEDDB, new IndexedDBAdapter());
    }
    
    // Initialize all adapters
    for (const [origin, adapter] of this.adapters) {
      try {
        if (adapter.initialize) {
          await adapter.initialize();
        }
        console.log(`✅ ${origin} adapter initialized`);
      } catch (error) {
        console.warn(`⚠️ Failed to initialize ${origin} adapter:`, error);
      }
    }
    
    console.log(`🎯 FileSystemManager ready with ${this.adapters.size} adapters`);
  }
  
  /**
   * Add an adapter to the manager
   */
  addAdapter(origin, adapter) {
    this.adapters.set(origin, adapter);
    
    // Set up adapter event listeners
    adapter.on('operation', (operation) => {
      this.handleIncomingOperation(operation, origin);
    });
    
    adapter.on('error', (error) => {
      console.error(`❌ Adapter error (${origin}):`, error);
      this.emit('adapter_error', { origin, error });
    });
  }

  /**
   * Handle incoming operations from adapters
   */
  async handleIncomingOperation(operation, origin) {
    try {
      // Validate operation object
      if (!operation || typeof operation !== 'object') {
        console.error(`❌ Invalid operation received from ${origin}: operation is ${operation ? typeof operation : 'null/undefined'}`);
        return;
      }
      
      if (!operation.type || !operation.path) {
        console.error(`❌ Invalid operation received from ${origin}: missing type or path`, operation);
        return;
      }
      
      // Check if this is an echo of our own operation
      if (this.isEchoOperation(operation, origin)) {
        console.log(`🔄 Skipping echo operation from ${origin}:`, operation.type, operation.path);
        return;
      }
      
      console.log(`📥 Incoming operation from ${origin}:`, operation.type, operation.path);
      
      // Process the operation through the canonical interface
      await this.processOperation(operation, origin, false); // false = don't broadcast back to origin
    } catch (error) {
      console.error(`❌ Error handling incoming operation from ${origin}:`, error);
      console.error('Operation data:', operation);
    }
  }

  /**
   * Check if an operation is an echo of a recent operation we sent
   */
  isEchoOperation(operation, origin) {
    const now = Date.now();
    
    // Clean up old operations
    for (const [opId, opData] of this.recentOperations.entries()) {
      if (now - opData.timestamp > this.config.echoPreventionTimeout) {
        this.recentOperations.delete(opId);
      }
    }
    
    // Check if this operation matches a recent one we sent
    const operationKey = `${operation.type}_${operation.path}_${operation.timestamp}`;
    return this.recentOperations.has(operationKey);
  }

  /**
   * MAIN FILE OPERATION METHODS
   * These are the single canonical interface methods
   */

  /**
   * Create a file - SINGLE CANONICAL INTERFACE
   */
  async createFile(fileData, origin = ADAPTER_ORIGINS.USER) {
    const operation = this.normalizeOperation({
      id: uuid(),
      type: OPERATION_TYPES.CREATE,
      path: fileData.path,
      timestamp: Date.now(),
      origin,
      payload: {
        name: fileData.name || fileData.path.split('/').pop(),
        content: fileData.content || '',
        type: 'file',
        ...fileData
      }
    });

    return await this.processOperation(operation, origin, true);
  }

  /**
   * Update a file - SINGLE CANONICAL INTERFACE
   */
  async updateFile(path, content, origin = ADAPTER_ORIGINS.USER) {
    const operation = this.normalizeOperation({
      id: uuid(),
      type: OPERATION_TYPES.UPDATE,
      path,
      timestamp: Date.now(),
      origin,
      payload: {
        content,
        lastModified: Date.now()
      }
    });

    return await this.processOperation(operation, origin, true);
  }

  /**
   * Create a folder - SINGLE CANONICAL INTERFACE  
   */
  async createFolder(folderData, origin = ADAPTER_ORIGINS.USER) {
    const operation = this.normalizeOperation({
      id: uuid(),
      type: OPERATION_TYPES.CREATE_FOLDER,
      path: folderData.path,
      timestamp: Date.now(),
      origin,
      payload: {
        name: folderData.name || folderData.path.split('/').pop(),
        type: 'folder',
        ...folderData
      }
    });

    return await this.processOperation(operation, origin, true);
  }

  /**
   * Delete a file or folder - SINGLE CANONICAL INTERFACE
   */
  async deleteFile(path, origin = ADAPTER_ORIGINS.USER) {
    const operation = this.normalizeOperation({
      id: uuid(),
      type: OPERATION_TYPES.DELETE,
      path,
      timestamp: Date.now(),
      origin,
      payload: {}
    });

    return await this.processOperation(operation, origin, true);
  }

  /**
   * Rename a file or folder - SINGLE CANONICAL INTERFACE
   */
  async renameFile(oldPath, newPath, origin = ADAPTER_ORIGINS.USER) {
    const operation = this.normalizeOperation({
      id: uuid(),
      type: OPERATION_TYPES.RENAME,
      path: oldPath,
      timestamp: Date.now(),
      origin,
      payload: {
        oldPath,
        newPath
      }
    });

    return await this.processOperation(operation, origin, true);
  }

  /**
   * Normalize operation into consistent format
   */
  normalizeOperation(operation) {
    return {
      id: operation.id || uuid(),
      type: operation.type,
      path: this.normalizePath(operation.path),
      timestamp: operation.timestamp || Date.now(),
      origin: operation.origin,
      payload: operation.payload || {},
      metadata: {
        userId: operation.userId,
        sessionId: operation.sessionId,
        ...operation.metadata
      }
    };
  }

  /**
   * Normalize file paths
   */
  normalizePath(path) {
    if (!path) return '';
    
    // Remove leading/trailing slashes and normalize separators
    return path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  /**
   * Process operation through canonical state and broadcast to adapters
   */
  async processOperation(operation, origin, shouldBroadcast = true) {
    try {
      // Validate operation object
      if (!operation || typeof operation !== 'object') {
        throw new Error(`Invalid operation: operation is ${operation ? typeof operation : 'null/undefined'}`);
      }
      
      if (!operation.type) {
        throw new Error(`Invalid operation: missing 'type' property in operation object: ${JSON.stringify(operation)}`);
      }
      
      if (!operation.path) {
        throw new Error(`Invalid operation: missing 'path' property in operation object: ${JSON.stringify(operation)}`);
      }
      
      console.log(`🎯 Processing operation: ${operation.type} ${operation.path} from ${origin}`);
      
      // 1. Apply to canonical state with conflict resolution
      const stateResult = await this.applyToCanonicalState(operation);
      
      if (!stateResult.success) {
        if (stateResult.reason === 'conflict') {
          // Handle conflict resolution
          const resolvedOperation = await this.conflictResolver.resolve(operation, stateResult.conflictingState);
          if (resolvedOperation) {
            return await this.processOperation(resolvedOperation, origin, shouldBroadcast);
          } else {
            throw new Error(`Conflict resolution failed for operation: ${operation.type} ${operation.path}`);
          }
        } else {
          // Handle other errors (invalid operations, etc.)
          throw new Error(`Operation failed: ${stateResult.error || stateResult.reason}`);
        }
      }
      
      // 2. Track operation for echo prevention
      if (shouldBroadcast) {
        const operationKey = `${operation.type}_${operation.path}_${operation.timestamp}`;
        this.recentOperations.set(operationKey, {
          timestamp: Date.now(),
          origin
        });
      }
      
      // 3. Broadcast to all adapters except the origin
      if (shouldBroadcast) {
        await this.broadcastToAdapters(operation, origin);
      }
      
      // 4. Emit event for UI updates
      this.emit('operation_completed', {
        operation,
        canonicalState: this.getCanonicalState()
      });
      
      console.log(`✅ Operation completed: ${operation.type} ${operation.path}`);
      
      return {
        success: true,
        operation,
        canonicalState: this.getCanonicalState()
      };
      
    } catch (error) {
      const operationType = operation?.type || 'unknown';
      const operationPath = operation?.path || 'unknown';
      console.error(`❌ Operation failed: ${operationType} ${operationPath}:`, error);
      
      this.emit('operation_failed', {
        operation,
        error
      });
      
      return {
        success: false,
        error: error.message,
        operation
      };
    }
  }

  /**
   * Apply operation to canonical in-memory state
   */
  async applyToCanonicalState(operation) {
    // Guard against undefined operation
    if (!operation) {
      console.error('❌ applyToCanonicalState called with undefined operation');
      return {
        success: false,
        reason: 'invalid_operation',
        error: 'Operation is undefined'
      };
    }

    const { type, path, payload } = operation;
    
    // Guard against invalid operation properties
    if (!type) {
      console.error('❌ applyToCanonicalState: operation missing type');
      return {
        success: false,
        reason: 'invalid_operation',
        error: 'Operation type is undefined'
      };
    }
    
    if (!path) {
      console.error('❌ applyToCanonicalState: operation missing path');
      return {
        success: false,
        reason: 'invalid_operation',
        error: 'Operation path is undefined'
      };
    }
    
    try {
      // Handle operations with and without payload object
      // Some operations (especially from socket adapters) have content directly on the operation
      const operationPayload = payload || {};
      const content = operationPayload.content || operation.content || '';
      const fileType = operationPayload.type || operation.type === OPERATION_TYPES.CREATE_FOLDER ? 'folder' : 'file';
      
      switch (type) {
        case OPERATION_TYPES.CREATE:
        case OPERATION_TYPES.CREATE_FOLDER:
          // Check if file/folder already exists
          if (this.canonicalState.has(path)) {
            return {
              success: false,
              reason: 'conflict',
              conflictingState: this.canonicalState.get(path)
            };
          }
          
          this.canonicalState.set(path, {
            type: fileType,
            content: content,
            created: operation.timestamp,
            lastModified: operation.timestamp,
            ...operationPayload
          });
          break;
          
        case OPERATION_TYPES.UPDATE:
          const existing = this.canonicalState.get(path);
          if (!existing) {
            // File doesn't exist, create it
            this.canonicalState.set(path, {
              type: 'file',
              content: content,
              created: operation.timestamp,
              lastModified: operation.timestamp,
              ...operationPayload
            });
          } else {
            // Update existing file
            this.canonicalState.set(path, {
              ...existing,
              content: content,
              lastModified: operation.timestamp,
              ...operationPayload
            });
          }
          break;
          
        case OPERATION_TYPES.DELETE:
          this.canonicalState.delete(path);
          break;
          
        case OPERATION_TYPES.RENAME:
          const fileData = this.canonicalState.get(path);
          if (fileData) {
            this.canonicalState.delete(path);
            const newPath = operationPayload.newPath || operation.newPath;
            if (newPath) {
              this.canonicalState.set(newPath, {
                ...fileData,
                lastModified: operation.timestamp
              });
            } else {
              console.error('❌ Rename operation missing newPath');
            }
          }
          break;
          
        default:
          console.warn(`Unknown operation type: ${type}`);
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('Failed to apply operation to canonical state:', error);
      return {
        success: false,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Broadcast operation to all adapters except the origin
   */
  async broadcastToAdapters(operation, excludeOrigin) {
    const promises = [];
    
    for (const [origin, adapter] of this.adapters) {
      if (origin !== excludeOrigin) {
        console.log(`📡 Broadcasting ${operation.type} to ${origin} adapter`);
        
        const promise = this.safeAdapterCall(adapter, 'handleOperation', operation)
          .catch(error => {
            console.warn(`⚠️ Adapter ${origin} failed to handle operation:`, error);
          });
          
        promises.push(promise);
      }
    }
    
    await Promise.allSettled(promises);
  }

  /**
   * Safely call adapter methods with timeout
   */
  async safeAdapterCall(adapter, method, ...args) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Adapter ${method} timed out`));
      }, this.config.operationTimeout);
      
      try {
        const result = adapter[method](...args);
        
        if (result && typeof result.then === 'function') {
          result
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
        } else {
          clearTimeout(timeout);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Get current canonical state
   */
  getCanonicalState() {
    return new Map(this.canonicalState);
  }

  /**
   * Get files as array (for UI)
   */
  getFilesArray() {
    return Array.from(this.canonicalState.entries()).map(([path, data]) => ({
      path,
      name: path.split('/').pop(),
      ...data
    }));
  }

  /**
   * Get file content
   */
  getFileContent(path) {
    const normalized = this.normalizePath(path);
    const fileData = this.canonicalState.get(normalized);
    return fileData?.content || null;
  }

  /**
   * Check if file exists
   */
  fileExists(path) {
    const normalized = this.normalizePath(path);
    return this.canonicalState.has(normalized);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up FileSystemManager...');
    
    // Cleanup all adapters
    for (const [origin, adapter] of this.adapters) {
      try {
        if (adapter.cleanup) {
          await adapter.cleanup();
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup ${origin} adapter:`, error);
      }
    }
    
    this.adapters.clear();
    this.canonicalState.clear();
    this.recentOperations.clear();
    this.removeAllListeners();
  }
}

/**
 * Simple conflict resolver
 * In a more advanced system, this could implement sophisticated merge strategies
 */
class ConflictResolver {
  async resolve(operation, conflictingState) {
    // For now, implement last-write-wins with timestamp comparison
    if (operation.timestamp > conflictingState.lastModified) {
      console.log(`🔀 Conflict resolved: operation wins (newer timestamp)`);
      return operation;
    } else {
      console.log(`🔀 Conflict resolved: existing state wins (newer timestamp)`);
      return null; // Don't apply the operation
    }
  }
}

// Singleton instance
let fileSystemManagerInstance = null;

/**
 * Get the singleton FileSystemManager instance
 */
export function getFileSystemManager(options = {}) {
  if (!fileSystemManagerInstance) {
    fileSystemManagerInstance = new FileSystemManager(options);
  }
  return fileSystemManagerInstance;
}

/**
 * Initialize the global FileSystemManager
 */
export async function initializeFileSystemManager(context) {
  const manager = getFileSystemManager();
  await manager.initialize(context);
  return manager;
}

export default FileSystemManager;
