/**
 * Real-time Collaboration Sync Service
 * Enhanced real-time synchronization with conflict resolution, operational transformation,
 * and state management for collaborative editing and file operations
 */

import { EventEmitter } from 'events';
import ConflictResolutionEngine from './ConflictResolutionEngine.js';

class RealTimeCollaborationSync extends EventEmitter {
  constructor(storageManager, authManager) {
    super();
    
    this.storageManager = storageManager;
    this.authManager = authManager;
    this.conflictResolver = new ConflictResolutionEngine();
    
    // Connection state
    this.socket = null;
    this.sessionId = null;
    this.userId = null;
    this.isConnected = false;
    
    // Real-time state tracking
    this.activeUsers = new Map(); // userId -> user info
    this.fileLocks = new Map(); // filePath -> lock info
    this.pendingOperations = new Map(); // operationId -> operation
    this.operationHistory = []; // For operational transformation
    this.lastSyncTimestamp = 0;
    
    // Operational Transform (OT) state
    this.documentStates = new Map(); // filePath -> document state
    this.transformQueue = new Map(); // filePath -> queued operations
    this.revisionNumbers = new Map(); // filePath -> current revision
    
    // Cursor and selection tracking
    this.cursors = new Map(); // userId -> cursor position
    this.selections = new Map(); // userId -> selection range
    this.awareness = new Map(); // userId -> awareness data
    
    // Presence tracking
    this.userPresence = new Map(); // userId -> presence state
    this.fileActivity = new Map(); // filePath -> active users
    
    // Synchronization settings
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      operationTimeout: 5000, // 5 seconds
      maxPendingOps: 100,
      maxHistorySize: 1000,
      conflictResolutionStrategy: 'last-writer-wins',
      enableOT: true,
      enablePresence: true,
      debounceDelay: 100
    };
    
    // Performance metrics
    this.metrics = {
      operationsSync: 0,
      conflictsResolved: 0,
      transformationsApplied: 0,
      averageSyncLatency: 0,
      connectionDrops: 0
    };
    
    this.initializeSync();
  }

  /**
   * Initialize real-time synchronization
   */
  initializeSync() {
    // Start heartbeat monitoring
    this.startHeartbeat();
    
    // Setup cleanup intervals
    this.startCleanupTasks();
    
    console.log('🔄 Real-time collaboration sync initialized');
  }

  /**
   * Connect to real-time session
   */
  connect(socket, sessionId, userId, userInfo = {}) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.userId = userId;
    
    // Register user
    this.activeUsers.set(userId, {
      id: userId,
      name: userInfo.name || 'User',
      avatar: userInfo.avatar || null,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      status: 'online'
    });
    
    this.setupSocketListeners();
    this.isConnected = true;
    
    // Announce presence
    this.broadcastPresence('connected');
    
    // Request current session state
    this.requestSessionState();
    
    console.log(`🔗 Connected to real-time session: ${sessionId} as ${userId}`);
    this.emit('connected', { sessionId, userId });
  }

  /**
   * Disconnect from real-time session
   */
  disconnect() {
    if (this.socket) {
      this.broadcastPresence('disconnected');
      this.socket.off('realtime_operation');
      this.socket.off('user_presence');
      this.socket.off('cursor_update');
      this.socket.off('file_lock');
      this.socket.off('sync_state');
    }
    
    this.isConnected = false;
    this.socket = null;
    this.sessionId = null;
    
    // Clear state
    this.activeUsers.clear();
    this.cursors.clear();
    this.selections.clear();
    this.fileLocks.clear();
    
    console.log('🔌 Disconnected from real-time session');
    this.emit('disconnected');
  }

  /**
   * Setup socket event listeners
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Real-time operations
    this.socket.on('realtime_operation', (data) => {
      this.handleIncomingOperation(data);
    });

    // User presence updates
    this.socket.on('user_presence', (data) => {
      this.handlePresenceUpdate(data);
    });

    // Cursor and selection updates
    this.socket.on('cursor_update', (data) => {
      this.handleCursorUpdate(data);
    });

    // File lock management
    this.socket.on('file_lock', (data) => {
      this.handleFileLock(data);
    });

    // Sync state updates
    this.socket.on('sync_state', (data) => {
      this.handleSyncState(data);
    });

    // Connection events
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.metrics.connectionDrops++;
      this.emit('connection_lost');
    });

    this.socket.on('reconnect', () => {
      this.isConnected = true;
      this.requestSessionState();
      this.emit('reconnected');
    });
  }

  // ==================== OPERATIONAL TRANSFORMATION ====================

  /**
   * Apply operation with Operational Transformation
   */
  async applyOperationWithOT(operation) {
    const { filePath, type, content, revision, userId, timestamp } = operation;
    
    if (!this.config.enableOT) {
      return this.applyOperationDirect(operation);
    }

    try {
      const currentRevision = this.revisionNumbers.get(filePath) || 0;
      const documentState = this.documentStates.get(filePath) || { content: '', revision: 0 };

      // Check if operation needs transformation
      if (revision < currentRevision) {
        const transformedOp = await this.transformOperation(operation, filePath);
        if (!transformedOp) {
          console.warn('Operation could not be transformed, discarding:', operation);
          return { success: false, reason: 'transformation_failed' };
        }
        operation = transformedOp;
      }

      // Apply operation based on type
      let result;
      switch (type) {
        case 'text_insert':
          result = this.applyTextInsert(operation, documentState);
          break;
        case 'text_delete':
          result = this.applyTextDelete(operation, documentState);
          break;
        case 'text_replace':
          result = this.applyTextReplace(operation, documentState);
          break;
        case 'file_create':
          result = await this.applyFileCreate(operation);
          break;
        case 'file_delete':
          result = await this.applyFileDelete(operation);
          break;
        default:
          result = await this.applyOperationDirect(operation);
      }

      if (result.success) {
        // Update document state and revision
        this.documentStates.set(filePath, {
          content: result.content || documentState.content,
          revision: currentRevision + 1
        });
        this.revisionNumbers.set(filePath, currentRevision + 1);

        // Add to operation history
        this.operationHistory.push({
          ...operation,
          revision: currentRevision + 1,
          appliedAt: Date.now()
        });

        // Trim history if too large
        if (this.operationHistory.length > this.config.maxHistorySize) {
          this.operationHistory.shift();
        }

        this.metrics.transformationsApplied++;
        this.emit('operation_applied', { operation, result });
      }

      return result;

    } catch (error) {
      console.error('Failed to apply operation with OT:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Transform operation against concurrent operations
   */
  async transformOperation(operation, filePath) {
    const currentRevision = this.revisionNumbers.get(filePath) || 0;
    const targetRevision = operation.revision;

    // Get operations between target and current revision
    const concurrentOps = this.operationHistory.filter(op => 
      op.filePath === filePath && 
      op.revision > targetRevision && 
      op.revision <= currentRevision
    );

    if (concurrentOps.length === 0) {
      return operation;
    }

    // Apply operational transformation
    let transformedOp = { ...operation };

    for (const concurrentOp of concurrentOps) {
      transformedOp = this.transformAgainstOperation(transformedOp, concurrentOp);
      if (!transformedOp) {
        return null; // Transformation failed
      }
    }

    return transformedOp;
  }

  /**
   * Transform one operation against another
   */
  transformAgainstOperation(op1, op2) {
    // Check for conflicts first using advanced engine
    const conflictDetails = this.conflictResolver.detectConflicts(op1, op2);
    
    if (conflictDetails.hasConflict) {
      // Handle conflict with advanced resolution
      return this.handleOperationConflictSync(op1, op2, conflictDetails);
    }

    // Apply standard operational transformation
    return this.applyStandardTransformation(op1, op2);
  }

  /**
   * Apply standard operational transformation
   */
  applyStandardTransformation(op1, op2) {
    // Simple transformation for text operations
    if (op1.type === 'text_insert' && op2.type === 'text_insert') {
      if (op1.position <= op2.position) {
        return op1; // No transformation needed
      } else {
        return {
          ...op1,
          position: op1.position + op2.content.length
        };
      }
    }

    if (op1.type === 'text_delete' && op2.type === 'text_insert') {
      if (op1.position < op2.position) {
        return op1; // No transformation needed
      } else {
        return {
          ...op1,
          position: op1.position + op2.content.length
        };
      }
    }

    if (op1.type === 'text_insert' && op2.type === 'text_delete') {
      if (op1.position <= op2.position) {
        return op1; // No transformation needed
      } else if (op1.position > op2.position + op2.length) {
        return {
          ...op1,
          position: op1.position - op2.length
        };
      } else {
        // Insert position is within deleted range
        return {
          ...op1,
          position: op2.position
        };
      }
    }

    if (op1.type === 'text_delete' && op2.type === 'text_delete') {
      if (op1.position < op2.position) {
        return op1; // No transformation needed
      } else if (op1.position >= op2.position + op2.length) {
        return {
          ...op1,
          position: op1.position - op2.length
        };
      } else {
        // Overlapping deletes - resolve conflict
        const overlap = Math.min(op1.position + op1.length, op2.position + op2.length) - 
                       Math.max(op1.position, op2.position);
        
        if (overlap > 0) {
          return {
            ...op1,
            position: Math.min(op1.position, op2.position),
            length: op1.length - overlap
          };
        }
        return op1;
      }
    }

    // Default: return original operation
    return op1;
  }

  /**
   * Handle operation conflicts synchronously (for OT)
   */
  handleOperationConflictSync(op1, op2, conflictDetails) {
    try {
      // For OT, we need quick resolution strategies
      const severity = conflictDetails.severity || 0;
      
      if (severity < 0.3) {
        // Low severity - use automatic merge
        return this.quickAutoMerge(op1, op2, conflictDetails);
      } else if (severity < 0.7) {
        // Medium severity - prefer newer operation
        return op1.timestamp > op2.timestamp ? op1 : null;
      } else {
        // High severity - defer to async resolution
        this.scheduleAsyncConflictResolution(op1, op2, conflictDetails);
        return null; // Pause operation
      }
    } catch (error) {
      console.error('Sync conflict resolution failed:', error);
      // Fallback to last writer wins
      return op1.timestamp > op2.timestamp ? op1 : null;
    }
  }

  /**
   * Quick automatic merge for low-severity conflicts
   */
  quickAutoMerge(op1, op2, conflictDetails) {
    if (conflictDetails.type === 'position' && conflictDetails.details.reason === 'adjacent_lines') {
      // Adjacent lines can usually be merged safely
      return op1;
    }
    
    if (op1.type === 'text_insert' && op2.type === 'text_insert' && 
        Math.abs(op1.position - op2.position) > 5) {
      // Insert operations far apart can coexist
      return op1;
    }
    
    // Default to standard transformation
    return this.applyStandardTransformation(op1, op2);
  }

  /**
   * Schedule async conflict resolution for complex conflicts
   */
  scheduleAsyncConflictResolution(op1, op2, conflictDetails) {
    // Store for later async resolution
    const conflictId = this.conflictResolver.createConflict(op1, op2, conflictDetails);
    
    // Emit for UI handling
    this.emit('complex_conflict_detected', {
      conflictId,
      operation1: op1,
      operation2: op2,
      details: conflictDetails
    });
    
    // Schedule async resolution
    setTimeout(async () => {
      try {
        await this.resolveConflictAsync(conflictId);
      } catch (error) {
        console.error('Async conflict resolution failed:', error);
      }
    }, 100); // Small delay to not block OT
  }

  /**
   * Resolve conflict asynchronously
   */
  async resolveConflictAsync(conflictId) {
    try {
      const resolution = await this.conflictResolver.resolveConflict(conflictId, 'collaborative');
      
      if (resolution.success && !resolution.requiresUserInput) {
        this.emit('conflict_resolved_async', {
          conflictId,
          resolution
        });
      }
    } catch (error) {
      console.error('Async conflict resolution failed:', error);
    }
  }

  // ==================== OPERATION HANDLERS ====================

  /**
   * Apply text insertion operation
   */
  applyTextInsert(operation, documentState) {
    const { position, content } = operation;
    const currentContent = documentState.content;

    if (position < 0 || position > currentContent.length) {
      return { success: false, reason: 'invalid_position' };
    }

    const newContent = currentContent.slice(0, position) + content + currentContent.slice(position);
    
    return {
      success: true,
      content: newContent,
      operation: 'text_insert'
    };
  }

  /**
   * Apply text deletion operation
   */
  applyTextDelete(operation, documentState) {
    const { position, length } = operation;
    const currentContent = documentState.content;

    if (position < 0 || position + length > currentContent.length) {
      return { success: false, reason: 'invalid_range' };
    }

    const newContent = currentContent.slice(0, position) + currentContent.slice(position + length);
    
    return {
      success: true,
      content: newContent,
      operation: 'text_delete'
    };
  }

  /**
   * Apply text replacement operation
   */
  applyTextReplace(operation, documentState) {
    const { position, length, content } = operation;
    const currentContent = documentState.content;

    if (position < 0 || position + length > currentContent.length) {
      return { success: false, reason: 'invalid_range' };
    }

    const newContent = currentContent.slice(0, position) + content + currentContent.slice(position + length);
    
    return {
      success: true,
      content: newContent,
      operation: 'text_replace'
    };
  }

  /**
   * Apply file creation operation
   */
  async applyFileCreate(operation) {
    try {
      const result = await this.storageManager.createFile(operation.filePath, operation.content || '');
      return {
        success: true,
        operation: 'file_create',
        filePath: operation.filePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply file deletion operation
   */
  async applyFileDelete(operation) {
    try {
      const result = await this.storageManager.deleteFile(operation.filePath);
      return {
        success: true,
        operation: 'file_delete',
        filePath: operation.filePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply operation directly (without OT)
   */
  async applyOperationDirect(operation) {
    try {
      const result = await this.storageManager.queueOperation(operation.type, operation);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== REAL-TIME SYNC METHODS ====================

  /**
   * Send operation to other collaborators
   */
  broadcastOperation(operation) {
    if (!this.socket || !this.isConnected) return;

    const operationData = {
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      operationId: this.generateOperationId(),
      ...operation
    };

    this.socket.emit('realtime_operation', operationData);
    this.metrics.operationsSync++;
    
    console.log('📡 Broadcasting operation:', operation.type, operation.filePath);
  }

  /**
   * Handle incoming operation from other collaborators
   */
  async handleIncomingOperation(data) {
    const { userId, operationId, sessionId, timestamp, ...operation } = data;

    // Ignore own operations
    if (userId === this.userId) return;

    // Validate session
    if (sessionId !== this.sessionId) return;

    console.log('📥 Received operation:', operation.type, operation.filePath, 'from', userId);

    try {
      const startTime = Date.now();
      
      // Apply operation with conflict resolution
      const result = await this.applyOperationWithOT({
        ...operation,
        userId,
        timestamp
      });

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateSyncLatency(latency);

      if (result.success) {
        this.emit('remote_operation_applied', { operation, result, userId });
      } else {
        console.warn('Failed to apply remote operation:', result.reason);
        this.emit('remote_operation_failed', { operation, result, userId });
      }

    } catch (error) {
      console.error('Error handling incoming operation:', error);
      this.emit('sync_error', { error, operation, userId });
    }
  }

  // ==================== PRESENCE AND AWARENESS ====================

  /**
   * Update user presence
   */
  updatePresence(status, metadata = {}) {
    const presenceData = {
      userId: this.userId,
      status,
      timestamp: Date.now(),
      ...metadata
    };

    this.userPresence.set(this.userId, presenceData);
    this.broadcastPresence(status, metadata);
  }

  /**
   * Broadcast presence to other users
   */
  broadcastPresence(status, metadata = {}) {
    if (!this.socket || !this.isConnected) return;

    const presenceData = {
      sessionId: this.sessionId,
      userId: this.userId,
      status,
      timestamp: Date.now(),
      ...metadata
    };

    this.socket.emit('user_presence', presenceData);
  }

  /**
   * Handle presence updates from other users
   */
  handlePresenceUpdate(data) {
    const { userId, status, timestamp, ...metadata } = data;

    if (userId === this.userId) return;

    // Update user presence
    this.userPresence.set(userId, {
      userId,
      status,
      timestamp,
      ...metadata
    });

    // Update active users list
    if (this.activeUsers.has(userId)) {
      const user = this.activeUsers.get(userId);
      this.activeUsers.set(userId, {
        ...user,
        status,
        lastSeen: timestamp
      });
    }

    this.emit('presence_updated', { userId, status, metadata });
  }

  /**
   * Update cursor position
   */
  updateCursor(filePath, position, selection = null) {
    const cursorData = {
      filePath,
      position,
      selection,
      timestamp: Date.now()
    };

    this.cursors.set(this.userId, cursorData);
    this.broadcastCursor(cursorData);
  }

  /**
   * Broadcast cursor update
   */
  broadcastCursor(cursorData) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('cursor_update', {
      sessionId: this.sessionId,
      userId: this.userId,
      ...cursorData
    });
  }

  /**
   * Handle cursor updates from other users
   */
  handleCursorUpdate(data) {
    const { userId, filePath, position, selection, timestamp } = data;

    if (userId === this.userId) return;

    this.cursors.set(userId, {
      filePath,
      position,
      selection,
      timestamp
    });

    this.emit('cursor_updated', { userId, filePath, position, selection });
  }

  // ==================== FILE LOCKING ====================

  /**
   * Request file lock
   */
  requestFileLock(filePath, lockType = 'edit') {
    if (!this.socket || !this.isConnected) return false;

    const lockData = {
      sessionId: this.sessionId,
      userId: this.userId,
      filePath,
      lockType,
      timestamp: Date.now(),
      action: 'request'
    };

    this.socket.emit('file_lock', lockData);
    return true;
  }

  /**
   * Release file lock
   */
  releaseFileLock(filePath) {
    if (!this.socket || !this.isConnected) return false;

    const lockData = {
      sessionId: this.sessionId,
      userId: this.userId,
      filePath,
      action: 'release'
    };

    this.socket.emit('file_lock', lockData);
    
    // Remove from local locks
    this.fileLocks.delete(filePath);
    return true;
  }

  /**
   * Handle file lock events
   */
  handleFileLock(data) {
    const { userId, filePath, lockType, action, timestamp } = data;

    switch (action) {
      case 'granted':
        this.fileLocks.set(filePath, {
          userId,
          lockType,
          timestamp
        });
        this.emit('file_locked', { filePath, userId, lockType });
        break;

      case 'denied':
        this.emit('file_lock_denied', { filePath, userId, reason: data.reason });
        break;

      case 'released':
        this.fileLocks.delete(filePath);
        this.emit('file_unlocked', { filePath, userId });
        break;
    }
  }

  // ==================== SYNC STATE MANAGEMENT ====================

  /**
   * Request current session state
   */
  requestSessionState() {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('get_sync_state', {
      sessionId: this.sessionId,
      userId: this.userId,
      lastSync: this.lastSyncTimestamp
    });
  }

  /**
   * Handle sync state updates
   */
  handleSyncState(data) {
    const { operations, users, cursors, locks, timestamp } = data;

    // Apply missed operations
    if (operations && operations.length > 0) {
      operations.forEach(op => {
        this.handleIncomingOperation(op);
      });
    }

    // Update users
    if (users) {
      users.forEach(user => {
        this.activeUsers.set(user.id, user);
      });
    }

    // Update cursors
    if (cursors) {
      Object.entries(cursors).forEach(([userId, cursorData]) => {
        if (userId !== this.userId) {
          this.cursors.set(userId, cursorData);
        }
      });
    }

    // Update locks
    if (locks) {
      this.fileLocks.clear();
      Object.entries(locks).forEach(([filePath, lockData]) => {
        this.fileLocks.set(filePath, lockData);
      });
    }

    this.lastSyncTimestamp = timestamp || Date.now();
    this.emit('sync_state_updated', data);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `${this.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update sync latency metrics
   */
  updateSyncLatency(latency) {
    const currentAvg = this.metrics.averageSyncLatency;
    const count = this.metrics.operationsSync;
    
    this.metrics.averageSyncLatency = (currentAvg * (count - 1) + latency) / count;
  }

  /**
   * Start heartbeat monitoring
   */
  startHeartbeat() {
    setInterval(() => {
      if (this.isConnected && this.socket) {
        this.broadcastPresence('online', { heartbeat: true });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Start cleanup tasks
   */
  startCleanupTasks() {
    // Clean up old operations
    setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      this.operationHistory = this.operationHistory.filter(op => op.appliedAt > cutoff);
    }, 60 * 60 * 1000); // Every hour

    // Clean up stale presence data
    setInterval(() => {
      const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
      for (const [userId, presence] of this.userPresence) {
        if (presence.timestamp < cutoff) {
          this.userPresence.delete(userId);
          this.activeUsers.delete(userId);
          this.cursors.delete(userId);
        }
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Get collaboration statistics
   */
  getStats() {
    return {
      ...this.metrics,
      isConnected: this.isConnected,
      activeUsers: this.activeUsers.size,
      fileLocks: this.fileLocks.size,
      pendingOperations: this.pendingOperations.size,
      operationHistory: this.operationHistory.length,
      documentStates: this.documentStates.size
    };
  }

  /**
   * Get active collaborators
   */
  getActiveUsers() {
    return Array.from(this.activeUsers.values());
  }

  /**
   * Get file locks
   */
  getFileLocks() {
    return Object.fromEntries(this.fileLocks);
  }

  /**
   * Get user cursors
   */
  getUserCursors() {
    return Object.fromEntries(this.cursors);
  }

  /**
   * Check if file is locked by another user
   */
  isFileLocked(filePath) {
    const lock = this.fileLocks.get(filePath);
    return lock && lock.userId !== this.userId;
  }

  /**
   * Configure sync settings
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Shutdown collaboration sync
   */
  shutdown() {
    this.disconnect();
    this.activeUsers.clear();
    this.fileLocks.clear();
    this.pendingOperations.clear();
    this.operationHistory = [];
    this.documentStates.clear();
    this.cursors.clear();
    this.userPresence.clear();
    
    this.emit('shutdown');
  }
}

export default RealTimeCollaborationSync;
