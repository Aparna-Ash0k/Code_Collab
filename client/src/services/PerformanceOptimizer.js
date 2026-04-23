/**
 * Performance Optimizer Service
 * Provides caching, batching, and lazy loading strategies for storage operations
 */

import { EventEmitter } from 'events';

class PerformanceOptimizer extends EventEmitter {
  constructor() {
    super();
    
    // Caching system
    this.cache = new Map();
    this.cacheMetadata = new Map(); // For TTL and access tracking
    this.maxCacheSize = 1000;
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    
    // Batching system
    this.batchQueue = new Map(); // Operation type -> operations array
    this.batchTimers = new Map(); // Operation type -> timer
    this.batchDelay = 50; // ms
    this.maxBatchSize = 20;
    
    // Lazy loading system
    this.lazyLoadQueue = new Set();
    this.lazyLoadInProgress = new Set();
    this.loadThrottleDelay = 100; // ms
    
    // Memory monitoring
    this.memoryThreshold = 0.8; // 80% of available memory
    this.lastGC = Date.now();
    this.gcInterval = 2 * 60 * 1000; // 2 minutes
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchedOperations: 0,
      lazyLoads: 0,
      memoryCleanups: 0
    };
    
    this.startPerformanceMonitoring();
  }

  // ==================== CACHING SYSTEM ====================

  /**
   * Get item from cache with LRU eviction
   */
  getCached(key, options = {}) {
    if (!this.cache.has(key)) {
      this.metrics.cacheMisses++;
      return null;
    }

    const metadata = this.cacheMetadata.get(key);
    const now = Date.now();

    // Check TTL
    if (metadata.ttl && now > metadata.createdAt + metadata.ttl) {
      this.cache.delete(key);
      this.cacheMetadata.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    // Update access time for LRU
    metadata.lastAccess = now;
    metadata.accessCount++;
    this.metrics.cacheHits++;

    const value = this.cache.get(key);
    
    // Clone if requested to prevent mutation
    if (options.clone) {
      return JSON.parse(JSON.stringify(value));
    }
    
    return value;
  }

  /**
   * Set item in cache with automatic eviction
   */
  setCached(key, value, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    const priority = options.priority || 1; // Higher number = higher priority
    const now = Date.now();

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.cacheMetadata.delete(key);
    }

    // Evict if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    // Store value and metadata
    this.cache.set(key, value);
    this.cacheMetadata.set(key, {
      createdAt: now,
      lastAccess: now,
      accessCount: 0,
      ttl,
      priority,
      size: this.estimateSize(value)
    });

    this.emit('cache:set', { key, size: this.cache.size });
  }

  /**
   * Evict least recently used items
   */
  evictLRU() {
    const entries = Array.from(this.cacheMetadata.entries());
    
    // Sort by priority (low first), then by last access time
    entries.sort((a, b) => {
      const [, metaA] = a;
      const [, metaB] = b;
      
      if (metaA.priority !== metaB.priority) {
        return metaA.priority - metaB.priority;
      }
      
      return metaA.lastAccess - metaB.lastAccess;
    });

    // Remove 20% of cache
    const removeCount = Math.max(1, Math.floor(this.cache.size * 0.2));
    
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.cacheMetadata.delete(key);
    }

    this.emit('cache:evicted', { removed: removeCount, remaining: this.cache.size });
  }

  /**
   * Clear cache with optional pattern matching
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      this.cacheMetadata.clear();
      this.emit('cache:cleared', { pattern: 'all' });
      return;
    }

    const regex = new RegExp(pattern);
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheMetadata.delete(key);
    });

    this.emit('cache:cleared', { pattern, removed: keysToDelete.length });
  }

  // ==================== BATCHING SYSTEM ====================

  /**
   * Add operation to batch queue
   */
  addToBatch(operationType, operation, options = {}) {
    const { immediate = false, timeout = this.batchDelay } = options;

    if (!this.batchQueue.has(operationType)) {
      this.batchQueue.set(operationType, []);
    }

    const batch = this.batchQueue.get(operationType);
    batch.push(operation);

    // Execute immediately if requested or batch is full
    if (immediate || batch.length >= this.maxBatchSize) {
      this.executeBatch(operationType);
      return;
    }

    // Set/reset timer for this operation type
    if (this.batchTimers.has(operationType)) {
      clearTimeout(this.batchTimers.get(operationType));
    }

    const timer = setTimeout(() => {
      this.executeBatch(operationType);
    }, timeout);

    this.batchTimers.set(operationType, timer);
  }

  /**
   * Execute batched operations
   */
  async executeBatch(operationType) {
    const batch = this.batchQueue.get(operationType);
    if (!batch || batch.length === 0) return;

    // Clear timer and queue
    if (this.batchTimers.has(operationType)) {
      clearTimeout(this.batchTimers.get(operationType));
      this.batchTimers.delete(operationType);
    }
    this.batchQueue.set(operationType, []);

    try {
      this.metrics.batchedOperations += batch.length;
      
      switch (operationType) {
        case 'fileRead':
          await this.executeBatchedFileReads(batch);
          break;
        case 'fileWrite':
          await this.executeBatchedFileWrites(batch);
          break;
        case 'dbQuery':
          await this.executeBatchedQueries(batch);
          break;
        case 'validation':
          await this.executeBatchedValidations(batch);
          break;
        default:
          // Generic batch execution
          await this.executeGenericBatch(batch);
      }

      this.emit('batch:executed', { type: operationType, count: batch.length });
    } catch (error) {
      this.emit('batch:error', { type: operationType, error, batch });
      throw error;
    }
  }

  /**
   * Execute batched file read operations
   */
  async executeBatchedFileReads(operations) {
    const results = new Map();
    const uniquePaths = [...new Set(operations.map(op => op.filePath))];

    // Read all unique files in parallel
    const readPromises = uniquePaths.map(async (filePath) => {
      try {
        const content = await this.readFileOptimized(filePath);
        results.set(filePath, { success: true, content });
      } catch (error) {
        results.set(filePath, { success: false, error });
      }
    });

    await Promise.all(readPromises);

    // Resolve all operation promises
    operations.forEach(op => {
      const result = results.get(op.filePath);
      if (result.success) {
        op.resolve(result.content);
      } else {
        op.reject(result.error);
      }
    });
  }

  /**
   * Execute batched file write operations
   */
  async executeBatchedFileWrites(operations) {
    // Group by file path to handle multiple writes to same file
    const fileGroups = new Map();
    
    operations.forEach(op => {
      if (!fileGroups.has(op.filePath)) {
        fileGroups.set(op.filePath, []);
      }
      fileGroups.get(op.filePath).push(op);
    });

    // Process each file group
    for (const [filePath, ops] of fileGroups) {
      try {
        // Use the last write operation's content (most recent)
        const lastOp = ops[ops.length - 1];
        await this.writeFileOptimized(filePath, lastOp.content, lastOp.options);
        
        // Resolve all operations for this file
        ops.forEach(op => op.resolve());
      } catch (error) {
        // Reject all operations for this file
        ops.forEach(op => op.reject(error));
      }
    }
  }

  /**
   * Execute batched database queries
   */
  async executeBatchedQueries(operations) {
    // Group by query type for better batching
    const queryGroups = new Map();
    
    operations.forEach(op => {
      const type = op.type || 'generic';
      if (!queryGroups.has(type)) {
        queryGroups.set(type, []);
      }
      queryGroups.get(type).push(op);
    });

    // Execute each group in parallel
    const groupPromises = Array.from(queryGroups.entries()).map(async ([type, ops]) => {
      try {
        const result = await this.executeBatchedQueryGroup(type, ops);
        return { type, success: true, result };
      } catch (error) {
        return { type, success: false, error, ops };
      }
    });

    const results = await Promise.all(groupPromises);
    
    // Process results
    results.forEach(({ type, success, result, error, ops }) => {
      if (success) {
        // Distribute results to operations
        ops.forEach((op, index) => {
          op.resolve(result[index] || result);
        });
      } else {
        // Reject all operations in this group
        ops.forEach(op => op.reject(error));
      }
    });
  }

  // ==================== LAZY LOADING SYSTEM ====================

  /**
   * Schedule lazy loading of resource
   */
  scheduleLazyLoad(resourceId, loadFunction, options = {}) {
    const { priority = 1, dependencies = [] } = options;

    if (this.lazyLoadInProgress.has(resourceId) || this.lazyLoadQueue.has(resourceId)) {
      return;
    }

    const lazyItem = {
      id: resourceId,
      loadFunction,
      priority,
      dependencies,
      scheduledAt: Date.now()
    };

    this.lazyLoadQueue.add(lazyItem);
    
    // Schedule execution
    setTimeout(() => {
      this.processLazyLoadQueue();
    }, this.loadThrottleDelay);
  }

  /**
   * Process lazy load queue with priority and dependency resolution
   */
  async processLazyLoadQueue() {
    if (this.lazyLoadQueue.size === 0) return;

    // Convert to array and sort by priority
    const items = Array.from(this.lazyLoadQueue).sort((a, b) => {
      return b.priority - a.priority || a.scheduledAt - b.scheduledAt;
    });

    // Find items ready to load (dependencies satisfied)
    const readyItems = items.filter(item => {
      return item.dependencies.every(dep => !this.lazyLoadInProgress.has(dep));
    });

    if (readyItems.length === 0) {
      // Schedule retry if items are waiting on dependencies
      setTimeout(() => this.processLazyLoadQueue(), this.loadThrottleDelay * 2);
      return;
    }

    // Process up to 3 items concurrently
    const toProcess = readyItems.slice(0, 3);
    
    const loadPromises = toProcess.map(async (item) => {
      this.lazyLoadQueue.delete(item);
      this.lazyLoadInProgress.add(item.id);

      try {
        const result = await item.loadFunction();
        this.metrics.lazyLoads++;
        this.emit('lazy:loaded', { id: item.id, result });
        return { id: item.id, success: true, result };
      } catch (error) {
        this.emit('lazy:error', { id: item.id, error });
        return { id: item.id, success: false, error };
      } finally {
        this.lazyLoadInProgress.delete(item.id);
      }
    });

    await Promise.all(loadPromises);

    // Continue processing if more items remain
    if (this.lazyLoadQueue.size > 0) {
      setTimeout(() => this.processLazyLoadQueue(), this.loadThrottleDelay);
    }
  }

  // ==================== MEMORY MANAGEMENT ====================

  /**
   * Start performance monitoring and cleanup
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.performMemoryCleanup();
    }, this.gcInterval);

    // Monitor memory usage if available
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      setInterval(() => {
        this.checkMemoryUsage();
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    const now = Date.now();
    
    // Clean expired cache entries
    let expiredCount = 0;
    for (const [key, metadata] of this.cacheMetadata) {
      if (metadata.ttl && now > metadata.createdAt + metadata.ttl) {
        this.cache.delete(key);
        this.cacheMetadata.delete(key);
        expiredCount++;
      }
    }

    // Clean old lazy load items
    const oldItems = Array.from(this.lazyLoadQueue).filter(item => {
      return now - item.scheduledAt > 5 * 60 * 1000; // 5 minutes old
    });
    
    oldItems.forEach(item => this.lazyLoadQueue.delete(item));

    this.metrics.memoryCleanups++;
    this.lastGC = now;

    this.emit('cleanup:completed', {
      expiredCache: expiredCount,
      oldLazyItems: oldItems.length,
      cacheSize: this.cache.size
    });
  }

  /**
   * Check memory usage and trigger aggressive cleanup if needed
   */
  checkMemoryUsage() {
    if (typeof window === 'undefined' || !window.performance?.memory) return;

    const memory = window.performance.memory;
    const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    if (usageRatio > this.memoryThreshold) {
      // Aggressive cleanup
      const currentSize = this.cache.size;
      const targetSize = Math.floor(currentSize * 0.5);
      
      while (this.cache.size > targetSize) {
        this.evictLRU();
      }

      this.emit('memory:pressure', {
        usage: usageRatio,
        cacheReduced: currentSize - this.cache.size
      });
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Estimate object size in bytes
   */
  estimateSize(obj) {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      batchQueueSizes: Object.fromEntries(
        Array.from(this.batchQueue.entries()).map(([type, ops]) => [type, ops.length])
      ),
      lazyLoadQueue: this.lazyLoadQueue.size,
      lazyLoadInProgress: this.lazyLoadInProgress.size
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchedOperations: 0,
      lazyLoads: 0,
      memoryCleanups: 0
    };
  }

  // ==================== INTEGRATION HELPERS ====================

  /**
   * Optimized file read with caching
   */
  async readFileOptimized(filePath) {
    const cacheKey = `file:${filePath}`;
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      return cached;
    }

    // This would integrate with actual file reading logic
    const content = await this.actualFileRead(filePath);
    this.setCached(cacheKey, content, { ttl: 2 * 60 * 1000 }); // Cache for 2 minutes
    
    return content;
  }

  /**
   * Optimized file write with debouncing
   */
  async writeFileOptimized(filePath, content, options = {}) {
    // Invalidate cache
    this.clearCache(`file:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    
    // This would integrate with actual file writing logic
    return await this.actualFileWrite(filePath, content, options);
  }

  /**
   * Placeholder methods for actual implementation integration
   */
  async actualFileRead(filePath) {
    throw new Error('actualFileRead must be implemented by integrating service');
  }

  async actualFileWrite(filePath, content, options) {
    throw new Error('actualFileWrite must be implemented by integrating service');
  }

  async executeBatchedQueryGroup(type, operations) {
    throw new Error('executeBatchedQueryGroup must be implemented by integrating service');
  }

  async executeBatchedValidations(operations) {
    // Default implementation for validation batching
    const results = await Promise.all(
      operations.map(op => op.validationFunction(op.data))
    );
    
    operations.forEach((op, index) => {
      op.resolve(results[index]);
    });
  }

  async executeGenericBatch(operations) {
    // Default implementation for generic operations
    const results = await Promise.all(
      operations.map(op => op.execute())
    );
    
    operations.forEach((op, index) => {
      op.resolve(results[index]);
    });
  }
}

export default PerformanceOptimizer;
