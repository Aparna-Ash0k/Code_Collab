/**
 * Batch Processor
 * Optimizes operations by batching, queuing, and intelligent scheduling
 */

class BatchProcessor {
  constructor(performanceOptimizer) {
    this.optimizer = performanceOptimizer;
    
    // Batch queues by operation type
    this.queues = {
      fileRead: [],
      fileWrite: [],
      fileDelete: [],
      dbInsert: [],
      dbUpdate: [],
      dbDelete: [],
      dbQuery: [],
      validation: [],
      notification: [],
      sync: []
    };
    
    // Batch configuration by operation type
    this.batchConfigs = {
      fileRead: {
        maxSize: 20,
        maxWait: 50,
        priority: 2,
        parallelism: 5
      },
      fileWrite: {
        maxSize: 10,
        maxWait: 100,
        priority: 3,
        parallelism: 3,
        deduplication: true
      },
      fileDelete: {
        maxSize: 15,
        maxWait: 200,
        priority: 2,
        parallelism: 2
      },
      dbInsert: {
        maxSize: 50,
        maxWait: 200,
        priority: 2,
        parallelism: 3,
        transaction: true
      },
      dbUpdate: {
        maxSize: 30,
        maxWait: 150,
        priority: 2,
        parallelism: 3,
        transaction: true,
        deduplication: true
      },
      dbDelete: {
        maxSize: 25,
        maxWait: 200,
        priority: 2,
        parallelism: 2,
        transaction: true
      },
      dbQuery: {
        maxSize: 40,
        maxWait: 50,
        priority: 1,
        parallelism: 8,
        caching: true
      },
      validation: {
        maxSize: 100,
        maxWait: 25,
        priority: 1,
        parallelism: 10
      },
      notification: {
        maxSize: 50,
        maxWait: 1000,
        priority: 0,
        parallelism: 2,
        deduplication: true
      },
      sync: {
        maxSize: 20,
        maxWait: 300,
        priority: 3,
        parallelism: 2,
        deduplication: true
      }
    };
    
    // Active batch timers
    this.timers = new Map();
    
    // Processing state
    this.processing = new Set();
    this.stats = {
      totalOperations: 0,
      batchedOperations: 0,
      savedOperations: 0,
      errors: 0
    };
    
    // Rate limiting
    this.rateLimits = new Map();
    this.rateLimitWindow = 1000; // 1 second
    
    this.initializeProcessor();
  }

  /**
   * Initialize the batch processor
   */
  initializeProcessor() {
    // Start periodic cleanup
    setInterval(() => {
      this.cleanupExpiredOperations();
    }, 5000);
    
    // Start rate limit cleanup
    setInterval(() => {
      this.cleanupRateLimits();
    }, this.rateLimitWindow);
  }

  /**
   * Add operation to batch queue
   */
  async addOperation(type, operation, options = {}) {
    const config = this.batchConfigs[type];
    if (!config) {
      throw new Error(`Unknown operation type: ${type}`);
    }

    // Check rate limiting
    if (this.isRateLimited(type)) {
      throw new Error(`Rate limit exceeded for operation type: ${type}`);
    }

    // Create operation wrapper
    const batchOperation = {
      id: this.generateOperationId(),
      type,
      operation,
      options,
      timestamp: Date.now(),
      priority: options.priority || config.priority,
      retries: 0,
      maxRetries: options.maxRetries || 3,
      promise: null
    };

    // Create promise for the operation
    batchOperation.promise = new Promise((resolve, reject) => {
      batchOperation.resolve = resolve;
      batchOperation.reject = reject;
    });

    // Add to appropriate queue
    this.queues[type].push(batchOperation);
    this.stats.totalOperations++;

    // Apply deduplication if enabled
    if (config.deduplication) {
      this.deduplicateQueue(type);
    }

    // Trigger batch processing
    this.scheduleBatchProcessing(type);

    return batchOperation.promise;
  }

  /**
   * Schedule batch processing for operation type
   */
  scheduleBatchProcessing(type) {
    const config = this.batchConfigs[type];
    const queue = this.queues[type];

    // Process immediately if queue is full
    if (queue.length >= config.maxSize) {
      this.processBatch(type);
      return;
    }

    // Set timer if not already set
    if (!this.timers.has(type)) {
      const timer = setTimeout(() => {
        this.processBatch(type);
      }, config.maxWait);
      
      this.timers.set(type, timer);
    }
  }

  /**
   * Process batch for specific operation type
   */
  async processBatch(type) {
    if (this.processing.has(type)) {
      return; // Already processing this type
    }

    const config = this.batchConfigs[type];
    const queue = this.queues[type];

    if (queue.length === 0) {
      return;
    }

    // Clear timer
    if (this.timers.has(type)) {
      clearTimeout(this.timers.get(type));
      this.timers.delete(type);
    }

    // Mark as processing
    this.processing.add(type);

    try {
      // Extract operations to process
      const operationsToProcess = queue.splice(0, config.maxSize);
      this.stats.batchedOperations += operationsToProcess.length;

      // Group operations by parallelism
      const batches = this.groupOperationsForParallelism(operationsToProcess, config.parallelism);

      // Process batches
      for (const batch of batches) {
        await this.processBatchGroup(type, batch, config);
      }

      // Calculate savings
      const saved = Math.max(0, operationsToProcess.length - batches.length);
      this.stats.savedOperations += saved;

      this.optimizer.emit('batch:processed', {
        type,
        count: operationsToProcess.length,
        batches: batches.length,
        saved
      });

    } catch (error) {
      this.stats.errors++;
      this.optimizer.emit('batch:error', { type, error });
    } finally {
      // Mark as no longer processing
      this.processing.delete(type);
      
      // Schedule next batch if queue still has items
      if (queue.length > 0) {
        this.scheduleBatchProcessing(type);
      }
    }
  }

  /**
   * Process a group of operations in parallel
   */
  async processBatchGroup(type, operations, config) {
    const processPromises = operations.map(async (op) => {
      try {
        let result;
        
        // Execute based on operation type
        switch (type) {
          case 'fileRead':
            result = await this.processFileRead(op);
            break;
          case 'fileWrite':
            result = await this.processFileWrite(op);
            break;
          case 'fileDelete':
            result = await this.processFileDelete(op);
            break;
          case 'dbInsert':
            result = await this.processDbInsert(op);
            break;
          case 'dbUpdate':
            result = await this.processDbUpdate(op);
            break;
          case 'dbDelete':
            result = await this.processDbDelete(op);
            break;
          case 'dbQuery':
            result = await this.processDbQuery(op);
            break;
          case 'validation':
            result = await this.processValidation(op);
            break;
          case 'notification':
            result = await this.processNotification(op);
            break;
          case 'sync':
            result = await this.processSync(op);
            break;
          default:
            throw new Error(`Unknown operation type: ${type}`);
        }

        op.resolve(result);
        
      } catch (error) {
        // Retry logic
        if (op.retries < op.maxRetries) {
          op.retries++;
          // Re-add to queue for retry
          this.queues[type].unshift(op);
          this.scheduleBatchProcessing(type);
        } else {
          op.reject(error);
        }
      }
    });

    // Handle transaction-based operations
    if (config.transaction && (type.startsWith('db'))) {
      await this.executeInTransaction(processPromises);
    } else {
      await Promise.all(processPromises);
    }
  }

  /**
   * Group operations for parallel processing
   */
  groupOperationsForParallelism(operations, parallelism) {
    const groups = [];
    
    for (let i = 0; i < operations.length; i += parallelism) {
      groups.push(operations.slice(i, i + parallelism));
    }
    
    return groups;
  }

  /**
   * Apply deduplication to queue
   */
  deduplicateQueue(type) {
    const queue = this.queues[type];
    const seen = new Map();
    const deduplicatedQueue = [];

    for (const op of queue) {
      const key = this.getDeduplicationKey(op);
      
      if (seen.has(key)) {
        // Merge with existing operation or replace
        const existing = seen.get(key);
        if (op.timestamp > existing.timestamp) {
          // Replace with newer operation
          const index = deduplicatedQueue.indexOf(existing);
          if (index !== -1) {
            deduplicatedQueue[index] = op;
            seen.set(key, op);
          }
        }
        // Reject the duplicate operation
        op.reject(new Error('Operation deduplicated'));
      } else {
        seen.set(key, op);
        deduplicatedQueue.push(op);
      }
    }

    this.queues[type] = deduplicatedQueue;
  }

  /**
   * Get deduplication key for operation
   */
  getDeduplicationKey(operation) {
    const { type, operation: op } = operation;
    
    switch (type) {
      case 'fileWrite':
        return `${type}:${op.filePath}`;
      case 'fileRead':
        return `${type}:${op.filePath}`;
      case 'fileDelete':
        return `${type}:${op.filePath}`;
      case 'dbUpdate':
        return `${type}:${op.table}:${op.id || op.where}`;
      case 'dbDelete':
        return `${type}:${op.table}:${op.id || op.where}`;
      case 'notification':
        return `${type}:${op.userId}:${op.type}`;
      case 'sync':
        return `${type}:${op.resourceId}`;
      default:
        return `${type}:${JSON.stringify(op)}`;
    }
  }

  // ==================== OPERATION PROCESSORS ====================

  async processFileRead(operation) {
    const { filePath, options = {} } = operation.operation;
    
    // Check cache first
    if (options.cache !== false) {
      const cached = await this.optimizer.getCached(`file:${filePath}`);
      if (cached) {
        return cached;
      }
    }
    
    // Read file (this would integrate with actual file system)
    const content = await this.readFile(filePath, options);
    
    // Cache result
    if (options.cache !== false) {
      await this.optimizer.setCached(`file:${filePath}`, content, {
        ttl: 2 * 60 * 1000, // 2 minutes
        priority: 2
      });
    }
    
    return content;
  }

  async processFileWrite(operation) {
    const { filePath, content, options = {} } = operation.operation;
    
    // Invalidate cache
    await this.optimizer.clearCache(`file:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    
    // Write file (this would integrate with actual file system)
    const result = await this.writeFile(filePath, content, options);
    
    // Update cache with new content
    if (options.cache !== false) {
      await this.optimizer.setCached(`file:${filePath}`, content, {
        ttl: 2 * 60 * 1000,
        priority: 2
      });
    }
    
    return result;
  }

  async processFileDelete(operation) {
    const { filePath, options = {} } = operation.operation;
    
    // Invalidate cache
    await this.optimizer.clearCache(`file:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    
    // Delete file (this would integrate with actual file system)
    return await this.deleteFile(filePath, options);
  }

  async processDbInsert(operation) {
    const { table, data, options = {} } = operation.operation;
    return await this.insertRecord(table, data, options);
  }

  async processDbUpdate(operation) {
    const { table, data, where, options = {} } = operation.operation;
    
    // Invalidate related cache
    await this.optimizer.clearCache(`db:${table}:*`);
    
    return await this.updateRecord(table, data, where, options);
  }

  async processDbDelete(operation) {
    const { table, where, options = {} } = operation.operation;
    
    // Invalidate related cache
    await this.optimizer.clearCache(`db:${table}:*`);
    
    return await this.deleteRecord(table, where, options);
  }

  async processDbQuery(operation) {
    const { query, params = [], options = {} } = operation.operation;
    const cacheKey = `query:${query}:${JSON.stringify(params)}`;
    
    // Check cache first
    if (options.cache !== false) {
      const cached = await this.optimizer.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // Execute query
    const result = await this.executeQuery(query, params, options);
    
    // Cache result
    if (options.cache !== false) {
      await this.optimizer.setCached(cacheKey, result, {
        ttl: options.cacheTTL || 1 * 60 * 1000, // 1 minute
        priority: 1
      });
    }
    
    return result;
  }

  async processValidation(operation) {
    const { validator, data, options = {} } = operation.operation;
    return await validator(data, options);
  }

  async processNotification(operation) {
    const { userId, type, data, options = {} } = operation.operation;
    return await this.sendNotification(userId, type, data, options);
  }

  async processSync(operation) {
    const { resourceId, syncType, data, options = {} } = operation.operation;
    return await this.syncResource(resourceId, syncType, data, options);
  }

  // ==================== INTEGRATION PLACEHOLDERS ====================

  async readFile(filePath, options) {
    throw new Error('readFile must be implemented by integrating service');
  }

  async writeFile(filePath, content, options) {
    throw new Error('writeFile must be implemented by integrating service');
  }

  async deleteFile(filePath, options) {
    throw new Error('deleteFile must be implemented by integrating service');
  }

  async insertRecord(table, data, options) {
    throw new Error('insertRecord must be implemented by integrating service');
  }

  async updateRecord(table, data, where, options) {
    throw new Error('updateRecord must be implemented by integrating service');
  }

  async deleteRecord(table, where, options) {
    throw new Error('deleteRecord must be implemented by integrating service');
  }

  async executeQuery(query, params, options) {
    throw new Error('executeQuery must be implemented by integrating service');
  }

  async executeInTransaction(operations) {
    throw new Error('executeInTransaction must be implemented by integrating service');
  }

  async sendNotification(userId, type, data, options) {
    throw new Error('sendNotification must be implemented by integrating service');
  }

  async syncResource(resourceId, syncType, data, options) {
    throw new Error('syncResource must be implemented by integrating service');
  }

  // ==================== UTILITY METHODS ====================

  generateOperationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  isRateLimited(type) {
    const key = `rate:${type}`;
    const now = Date.now();
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 1, window: now });
      return false;
    }
    
    const limit = this.rateLimits.get(key);
    
    // Reset window if expired
    if (now - limit.window > this.rateLimitWindow) {
      limit.count = 1;
      limit.window = now;
      return false;
    }
    
    // Check limits (these could be configurable)
    const maxOpsPerSecond = this.getMaxOperationsPerSecond(type);
    if (limit.count >= maxOpsPerSecond) {
      return true;
    }
    
    limit.count++;
    return false;
  }

  getMaxOperationsPerSecond(type) {
    const limits = {
      fileRead: 100,
      fileWrite: 50,
      fileDelete: 20,
      dbInsert: 200,
      dbUpdate: 100,
      dbDelete: 50,
      dbQuery: 500,
      validation: 1000,
      notification: 10,
      sync: 20
    };
    
    return limits[type] || 100;
  }

  cleanupRateLimits() {
    const now = Date.now();
    
    for (const [key, limit] of this.rateLimits) {
      if (now - limit.window > this.rateLimitWindow * 2) {
        this.rateLimits.delete(key);
      }
    }
  }

  cleanupExpiredOperations() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [type, queue] of Object.entries(this.queues)) {
      const validOperations = queue.filter(op => {
        if (now - op.timestamp > maxAge) {
          op.reject(new Error('Operation expired'));
          return false;
        }
        return true;
      });
      
      this.queues[type] = validOperations;
    }
  }

  /**
   * Get batch processor statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSizes: Object.fromEntries(
        Object.entries(this.queues).map(([type, queue]) => [type, queue.length])
      ),
      processing: Array.from(this.processing),
      activeTimers: this.timers.size,
      rateLimits: this.rateLimits.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalOperations: 0,
      batchedOperations: 0,
      savedOperations: 0,
      errors: 0
    };
  }

  /**
   * Configure batch settings
   */
  configureBatch(type, config) {
    if (this.batchConfigs[type]) {
      this.batchConfigs[type] = { ...this.batchConfigs[type], ...config };
    }
  }

  /**
   * Flush all queues immediately
   */
  async flushAll() {
    const flushPromises = Object.keys(this.queues).map(type => 
      this.processBatch(type)
    );
    
    await Promise.all(flushPromises);
  }

  /**
   * Shutdown batch processor gracefully
   */
  async shutdown() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    
    // Flush all remaining operations
    await this.flushAll();
    
    this.optimizer.emit('batch:shutdown');
  }
}

export default BatchProcessor;
