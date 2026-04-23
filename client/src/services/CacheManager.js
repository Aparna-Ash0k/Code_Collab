/**
 * Cache Manager
 * Specialized caching strategies for different data types and storage layers
 */

class CacheManager {
  constructor(performanceOptimizer) {
    this.optimizer = performanceOptimizer;
    
    // Cache layers with different strategies
    this.layers = {
      memory: new Map(), // Fast in-memory cache
      persistent: null,  // Will be localStorage/IndexedDB
      distributed: null  // Will be Firebase for shared cache
    };
    
    // Cache strategies by data type
    this.strategies = {
      fileContent: {
        ttl: 5 * 60 * 1000, // 5 minutes
        maxSize: 500, // Max files in cache
        priority: 2,
        compressionThreshold: 10240 // Compress files > 10KB
      },
      fileTree: {
        ttl: 10 * 60 * 1000, // 10 minutes
        maxSize: 50,
        priority: 3,
        invalidateOnModification: true
      },
      userPreferences: {
        ttl: 30 * 60 * 1000, // 30 minutes
        maxSize: 100,
        priority: 4,
        persistent: true
      },
      projectMetadata: {
        ttl: 15 * 60 * 1000, // 15 minutes
        maxSize: 200,
        priority: 3,
        distributed: true
      },
      collaboratorState: {
        ttl: 30 * 1000, // 30 seconds
        maxSize: 1000,
        priority: 1,
        realtime: true
      },
      searchResults: {
        ttl: 2 * 60 * 1000, // 2 minutes
        maxSize: 100,
        priority: 1
      }
    };
    
    // Compression support
    this.compressionEnabled = true;
    this.compressionCache = new Map();
    
    this.initializeLayers();
  }

  /**
   * Initialize cache layers
   */
  async initializeLayers() {
    try {
      // Initialize persistent layer (localStorage with fallback)
      if (typeof window !== 'undefined' && window.localStorage) {
        this.layers.persistent = {
          get: (key) => {
            try {
              const item = localStorage.getItem(`codecollab_cache_${key}`);
              return item ? JSON.parse(item) : null;
            } catch {
              return null;
            }
          },
          set: (key, value, ttl) => {
            try {
              const item = {
                value,
                expires: Date.now() + ttl
              };
              localStorage.setItem(`codecollab_cache_${key}`, JSON.stringify(item));
              return true;
            } catch {
              return false;
            }
          },
          delete: (key) => {
            try {
              localStorage.removeItem(`codecollab_cache_${key}`);
              return true;
            } catch {
              return false;
            }
          }
        };
      }
      
      // Initialize distributed layer placeholder
      this.layers.distributed = {
        get: async (key) => {
          // This would integrate with Firebase or other distributed cache
          return null;
        },
        set: async (key, value, ttl) => {
          // This would integrate with Firebase or other distributed cache
          return false;
        },
        delete: async (key) => {
          // This would integrate with Firebase or other distributed cache
          return false;
        }
      };
      
    } catch (error) {
      console.warn('Failed to initialize cache layers:', error);
    }
  }

  /**
   * Get cached item with multi-layer strategy
   */
  async get(key, dataType = 'default') {
    const strategy = this.strategies[dataType] || this.strategies.default || {};
    
    try {
      // 1. Check memory cache first (fastest)
      let result = this.getFromMemory(key);
      if (result !== null) {
        this.optimizer.emit('cache:hit', { layer: 'memory', key, dataType });
        return result;
      }

      // 2. Check persistent cache if strategy allows
      if (strategy.persistent && this.layers.persistent) {
        result = this.getFromPersistent(key);
        if (result !== null) {
          // Promote to memory cache
          this.setInMemory(key, result, strategy);
          this.optimizer.emit('cache:hit', { layer: 'persistent', key, dataType });
          return result;
        }
      }

      // 3. Check distributed cache if strategy allows
      if (strategy.distributed && this.layers.distributed) {
        result = await this.getFromDistributed(key);
        if (result !== null) {
          // Promote to memory and persistent cache
          this.setInMemory(key, result, strategy);
          if (strategy.persistent) {
            this.setInPersistent(key, result, strategy);
          }
          this.optimizer.emit('cache:hit', { layer: 'distributed', key, dataType });
          return result;
        }
      }

      this.optimizer.emit('cache:miss', { key, dataType });
      return null;
      
    } catch (error) {
      this.optimizer.emit('cache:error', { operation: 'get', key, dataType, error });
      return null;
    }
  }

  /**
   * Set cached item with multi-layer strategy
   */
  async set(key, value, dataType = 'default', options = {}) {
    const strategy = { ...this.strategies[dataType], ...options };
    
    try {
      // Compress if needed
      const processedValue = await this.processValueForStorage(value, strategy);

      // 1. Always set in memory cache
      this.setInMemory(key, processedValue, strategy);

      // 2. Set in persistent cache if strategy allows
      if (strategy.persistent && this.layers.persistent) {
        this.setInPersistent(key, processedValue, strategy);
      }

      // 3. Set in distributed cache if strategy allows
      if (strategy.distributed && this.layers.distributed) {
        await this.setInDistributed(key, processedValue, strategy);
      }

      this.optimizer.emit('cache:set', { key, dataType, layers: this.getActiveLayers(strategy) });
      
    } catch (error) {
      this.optimizer.emit('cache:error', { operation: 'set', key, dataType, error });
    }
  }

  /**
   * Delete cached item from all layers
   */
  async delete(key, dataType = 'default') {
    const strategy = this.strategies[dataType] || {};
    
    try {
      // Delete from all layers
      this.layers.memory.delete(key);
      
      if (this.layers.persistent) {
        this.layers.persistent.delete(key);
      }
      
      if (this.layers.distributed) {
        await this.layers.distributed.delete(key);
      }

      this.optimizer.emit('cache:delete', { key, dataType });
      
    } catch (error) {
      this.optimizer.emit('cache:error', { operation: 'delete', key, dataType, error });
    }
  }

  /**
   * Invalidate cache entries by pattern or data type
   */
  async invalidate(pattern, dataType = null) {
    try {
      const keysToDelete = [];
      
      if (typeof pattern === 'string') {
        const regex = new RegExp(pattern);
        
        // Find matching keys in memory cache
        for (const key of this.layers.memory.keys()) {
          if (regex.test(key)) {
            keysToDelete.push(key);
          }
        }
      } else if (dataType) {
        // Invalidate by data type (would need to track data types by key)
        // This is a simplified implementation
        for (const key of this.layers.memory.keys()) {
          if (key.includes(dataType)) {
            keysToDelete.push(key);
          }
        }
      }

      // Delete all matching keys
      const deletePromises = keysToDelete.map(key => this.delete(key));
      await Promise.all(deletePromises);

      this.optimizer.emit('cache:invalidated', { pattern, dataType, count: keysToDelete.length });
      
    } catch (error) {
      this.optimizer.emit('cache:error', { operation: 'invalidate', pattern, dataType, error });
    }
  }

  // ==================== MEMORY LAYER METHODS ====================

  getFromMemory(key) {
    const item = this.layers.memory.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expires && Date.now() > item.expires) {
      this.layers.memory.delete(key);
      return null;
    }

    // Update access tracking
    item.lastAccess = Date.now();
    item.accessCount = (item.accessCount || 0) + 1;

    return this.decompressValue(item.value);
  }

  setInMemory(key, value, strategy) {
    const ttl = strategy.ttl || 5 * 60 * 1000;
    const expires = Date.now() + ttl;

    // Check cache size limits
    if (this.layers.memory.size >= (strategy.maxSize || 1000)) {
      this.evictFromMemory(strategy);
    }

    this.layers.memory.set(key, {
      value: this.compressValue(value, strategy),
      expires,
      priority: strategy.priority || 1,
      lastAccess: Date.now(),
      accessCount: 1,
      dataType: strategy.dataType
    });
  }

  evictFromMemory(strategy) {
    const entries = Array.from(this.layers.memory.entries());
    
    // Sort by priority (low first), then by last access
    entries.sort((a, b) => {
      const [, itemA] = a;
      const [, itemB] = b;
      
      if (itemA.priority !== itemB.priority) {
        return itemA.priority - itemB.priority;
      }
      
      return itemA.lastAccess - itemB.lastAccess;
    });

    // Remove 25% of cache
    const removeCount = Math.max(1, Math.floor(entries.length * 0.25));
    
    for (let i = 0; i < removeCount; i++) {
      const [key] = entries[i];
      this.layers.memory.delete(key);
    }
  }

  // ==================== PERSISTENT LAYER METHODS ====================

  getFromPersistent(key) {
    if (!this.layers.persistent) return null;

    const item = this.layers.persistent.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expires && Date.now() > item.expires) {
      this.layers.persistent.delete(key);
      return null;
    }

    return this.decompressValue(item.value);
  }

  setInPersistent(key, value, strategy) {
    if (!this.layers.persistent) return;

    const ttl = strategy.ttl || 5 * 60 * 1000;
    this.layers.persistent.set(key, this.compressValue(value, strategy), ttl);
  }

  // ==================== DISTRIBUTED LAYER METHODS ====================

  async getFromDistributed(key) {
    if (!this.layers.distributed) return null;

    try {
      const item = await this.layers.distributed.get(key);
      if (!item) return null;

      // Check expiration
      if (item.expires && Date.now() > item.expires) {
        await this.layers.distributed.delete(key);
        return null;
      }

      return this.decompressValue(item.value);
    } catch (error) {
      console.warn('Distributed cache get error:', error);
      return null;
    }
  }

  async setInDistributed(key, value, strategy) {
    if (!this.layers.distributed) return;

    try {
      const ttl = strategy.ttl || 5 * 60 * 1000;
      await this.layers.distributed.set(key, this.compressValue(value, strategy), ttl);
    } catch (error) {
      console.warn('Distributed cache set error:', error);
    }
  }

  // ==================== COMPRESSION METHODS ====================

  compressValue(value, strategy) {
    if (!this.compressionEnabled || !strategy.compressionThreshold) {
      return value;
    }

    const serialized = JSON.stringify(value);
    
    if (serialized.length < strategy.compressionThreshold) {
      return value;
    }

    try {
      // Simple compression using browser's built-in compression
      if (typeof window !== 'undefined' && window.CompressionStream) {
        // This is a placeholder - real implementation would use compression
        return {
          compressed: true,
          data: value, // Would be compressed data
          originalSize: serialized.length
        };
      }
      
      return value;
    } catch (error) {
      console.warn('Compression failed:', error);
      return value;
    }
  }

  decompressValue(value) {
    if (!value || typeof value !== 'object' || !value.compressed) {
      return value;
    }

    try {
      // Simple decompression
      return value.data;
    } catch (error) {
      console.warn('Decompression failed:', error);
      return value;
    }
  }

  // ==================== VALUE PROCESSING ====================

  async processValueForStorage(value, strategy) {
    let processedValue = value;

    // Clone to prevent mutation
    if (strategy.clone !== false) {
      try {
        processedValue = JSON.parse(JSON.stringify(value));
      } catch (error) {
        // If cloning fails, use original value
        processedValue = value;
      }
    }

    // Apply data type specific processing
    if (strategy.dataType) {
      processedValue = await this.applyDataTypeProcessing(processedValue, strategy.dataType);
    }

    return processedValue;
  }

  async applyDataTypeProcessing(value, dataType) {
    switch (dataType) {
      case 'fileContent':
        // Normalize line endings and trim whitespace
        if (typeof value === 'string') {
          return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        }
        break;
        
      case 'fileTree':
        // Sort and normalize file tree
        if (Array.isArray(value)) {
          return value.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
        }
        break;
        
      case 'searchResults':
        // Deduplicate and limit search results
        if (Array.isArray(value)) {
          const seen = new Set();
          return value.filter(item => {
            const key = `${item.file}:${item.line}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 100); // Limit to 100 results
        }
        break;
    }
    
    return value;
  }

  // ==================== UTILITY METHODS ====================

  getActiveLayers(strategy) {
    const layers = ['memory'];
    if (strategy.persistent) layers.push('persistent');
    if (strategy.distributed) layers.push('distributed');
    return layers;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memoryStats = {
      size: this.layers.memory.size,
      entries: Array.from(this.layers.memory.entries()).map(([key, item]) => ({
        key,
        size: JSON.stringify(item.value).length,
        priority: item.priority,
        lastAccess: item.lastAccess,
        accessCount: item.accessCount
      }))
    };

    return {
      memory: memoryStats,
      compression: {
        enabled: this.compressionEnabled,
        cacheSize: this.compressionCache.size
      },
      strategies: Object.keys(this.strategies)
    };
  }

  /**
   * Clear all caches
   */
  async clearAll() {
    this.layers.memory.clear();
    
    if (this.layers.persistent) {
      // Clear persistent cache (localStorage entries)
      try {
        const keys = Object.keys(localStorage).filter(key => 
          key.startsWith('codecollab_cache_')
        );
        keys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('Failed to clear persistent cache:', error);
      }
    }

    this.optimizer.emit('cache:cleared', { scope: 'all' });
  }

  /**
   * Warmup cache with frequently used data
   */
  async warmup(data) {
    const warmupPromises = [];

    if (data.projects) {
      warmupPromises.push(
        this.set('projects:list', data.projects, 'projectMetadata')
      );
    }

    if (data.userPreferences) {
      warmupPromises.push(
        this.set('user:preferences', data.userPreferences, 'userPreferences')
      );
    }

    if (data.recentFiles) {
      data.recentFiles.forEach(file => {
        warmupPromises.push(
          this.set(`file:${file.path}`, file.content, 'fileContent')
        );
      });
    }

    await Promise.all(warmupPromises);
    this.optimizer.emit('cache:warmed', { items: warmupPromises.length });
  }
}

export default CacheManager;
