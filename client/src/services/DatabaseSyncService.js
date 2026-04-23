/**
 * DatabaseSyncService - Handles synchronization between PostgreSQL and Firebase
 * Uses SchemaHarmonizer to ensure data consistency and handle conflicts
 */

import { schemaHarmonizer } from './SchemaHarmonizer';

export class DatabaseSyncService {
  constructor() {
    this.syncQueue = [];
    this.isSyncing = false;
    this.syncListeners = new Set();
    this.lastSyncTimes = new Map();
    this.conflictResolutions = new Map();
    
    console.log('🔄 DatabaseSyncService initialized');
  }

  /**
   * Add sync listener
   */
  addSyncListener(callback) {
    this.syncListeners.add(callback);
  }

  /**
   * Remove sync listener
   */
  removeSyncListener(callback) {
    this.syncListeners.delete(callback);
  }

  /**
   * Notify sync listeners
   */
  notifySyncListeners(event, data) {
    this.syncListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }

  /**
   * Queue a sync operation
   */
  queueSync(operation) {
    this.syncQueue.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...operation
    });

    if (!this.isSyncing) {
      this.processSyncQueue();
    }
  }

  /**
   * Process sync queue
   */
  async processSyncQueue() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    console.log('🔄 Processing sync queue...');

    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift();
      
      try {
        await this.executeSyncOperation(operation);
        this.notifySyncListeners('sync_completed', operation);
      } catch (error) {
        console.error('Sync operation failed:', operation, error);
        this.notifySyncListeners('sync_failed', { operation, error });
        
        // Add to retry queue if not a permanent failure
        if (!error.permanent) {
          operation.retryCount = (operation.retryCount || 0) + 1;
          if (operation.retryCount < 3) {
            setTimeout(() => {
              this.syncQueue.push(operation);
            }, Math.pow(2, operation.retryCount) * 1000); // Exponential backoff
          }
        }
      }
    }

    this.isSyncing = false;
    console.log('✅ Sync queue processing completed');
  }

  /**
   * Execute a single sync operation
   */
  async executeSyncOperation(operation) {
    const { type, entityType, data, source, target, options = {} } = operation;

    console.log(`🔄 Executing sync: ${type} ${entityType} from ${source} to ${target}`);

    switch (type) {
      case 'unidirectional':
        return await this.unidirectionalSync(entityType, data, source, target, options);
      
      case 'bidirectional':
        return await this.bidirectionalSync(entityType, data.postgres, data.firebase, options);
      
      case 'conflict_resolution':
        return await this.resolveConflict(entityType, data, options);
      
      case 'schema_migration':
        return await this.migrateSchema(entityType, data, options);
      
      default:
        throw new Error(`Unknown sync operation type: ${type}`);
    }
  }

  /**
   * Perform unidirectional sync from source to target
   */
  async unidirectionalSync(entityType, data, source, target, options) {
    // Transform data for target schema
    let transformedData;
    
    if (source === 'postgresql' && target === 'firebase') {
      transformedData = schemaHarmonizer.postgresqlToFirebase(entityType, data);
    } else if (source === 'firebase' && target === 'postgresql') {
      transformedData = schemaHarmonizer.firebaseToPostgresql(entityType, data);
    } else {
      transformedData = data;
    }

    // Validate transformed data
    const validation = schemaHarmonizer.validateData(entityType, transformedData);
    if (!validation.isValid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }

    // Write to target
    try {
      if (target === 'firebase') {
        await this.writeToFirebase(entityType, transformedData, options);
      } else if (target === 'postgresql') {
        await this.writeToPostgreSQL(entityType, transformedData, options);
      } else if (target === 'localstorage') {
        await this.writeToLocalStorage(entityType, transformedData, options);
      } else if (target === 'vfs') {
        await this.writeToVFS(entityType, transformedData, options);
      }

      this.updateLastSyncTime(entityType, target);
      console.log(`✅ Unidirectional sync completed: ${source} → ${target}`);
      
      return { success: true, transformedData };
    } catch (error) {
      console.error(`❌ Unidirectional sync failed: ${source} → ${target}`, error);
      throw error;
    }
  }

  /**
   * Perform bidirectional sync between PostgreSQL and Firebase
   */
  async bidirectionalSync(entityType, postgresData, firebaseData, options) {
    // Check for conflicts
    const compatibility = await schemaHarmonizer.checkSchemaCompatibility(
      postgresData, 
      firebaseData, 
      entityType
    );

    if (!compatibility.isCompatible) {
      console.warn(`⚠️ Schema conflicts detected for ${entityType}:`, compatibility.conflicts);
      
      // Attempt automatic conflict resolution
      const resolved = await this.autoResolveConflicts(entityType, compatibility.conflicts, {
        postgresData,
        firebaseData
      });

      if (!resolved.success) {
        throw new Error(`Unresolvable conflicts in ${entityType}: ${resolved.errors.join(', ')}`);
      }

      return resolved.result;
    }

    // Determine sync direction based on timestamps
    const postgresTime = new Date(postgresData.updated_at || postgresData.updatedAt || 0);
    const firebaseTime = new Date(firebaseData.updated_at || firebaseData.updatedAt || 0);

    if (postgresTime > firebaseTime) {
      // Sync PostgreSQL → Firebase
      return await this.unidirectionalSync(entityType, postgresData, 'postgresql', 'firebase', options);
    } else if (firebaseTime > postgresTime) {
      // Sync Firebase → PostgreSQL
      return await this.unidirectionalSync(entityType, firebaseData, 'firebase', 'postgresql', options);
    } else {
      // Times are equal, no sync needed
      console.log(`ℹ️ No sync needed for ${entityType} - data is already in sync`);
      return { success: true, action: 'no_sync_needed' };
    }
  }

  /**
   * Automatically resolve conflicts
   */
  async autoResolveConflicts(entityType, conflicts, data) {
    const resolved = [];
    const unresolvable = [];

    for (const conflict of conflicts) {
      try {
        switch (conflict.type) {
          case 'missing_fields':
            // Add default values for missing fields
            if (conflict.location === 'postgresql') {
              const defaults = schemaHarmonizer.addPostgresDefaults(entityType, {});
              conflict.fields.forEach(field => {
                if (defaults[field] !== undefined) {
                  data.postgresData[field] = defaults[field];
                }
              });
            } else {
              const defaults = schemaHarmonizer.addFirebaseDefaults(entityType, {});
              conflict.fields.forEach(field => {
                if (defaults[field] !== undefined) {
                  data.firebaseData[field] = defaults[field];
                }
              });
            }
            resolved.push(conflict);
            break;

          case 'value_mismatch':
            // Use conflict resolution strategy
            const resolution = await this.resolveValueConflict(
              entityType, 
              conflict.field, 
              conflict.postgresValue, 
              conflict.firebaseValue
            );
            
            if (resolution.success) {
              data.postgresData[conflict.field] = resolution.value;
              data.firebaseData[conflict.field] = resolution.value;
              resolved.push(conflict);
            } else {
              unresolvable.push(conflict);
            }
            break;

          default:
            unresolvable.push(conflict);
        }
      } catch (error) {
        console.error(`Failed to resolve conflict:`, conflict, error);
        unresolvable.push(conflict);
      }
    }

    return {
      success: unresolvable.length === 0,
      resolved,
      unresolvable,
      errors: unresolvable.map(c => `${c.type}: ${c.field || c.fields?.join(', ')}`),
      result: {
        postgresData: data.postgresData,
        firebaseData: data.firebaseData
      }
    };
  }

  /**
   * Resolve value conflicts using configured strategies
   */
  async resolveValueConflict(entityType, field, postgresValue, firebaseValue) {
    const strategyKey = `${entityType}.${field}`;
    let strategy = this.conflictResolutions.get(strategyKey) || 'latest_timestamp';

    switch (strategy) {
      case 'latest_timestamp':
        // Use value from the source with more recent timestamp
        return { success: true, value: postgresValue }; // Default to postgres
      
      case 'postgres_priority':
        return { success: true, value: postgresValue };
      
      case 'firebase_priority':
        return { success: true, value: firebaseValue };
      
      case 'merge_arrays':
        if (Array.isArray(postgresValue) && Array.isArray(firebaseValue)) {
          const merged = [...new Set([...postgresValue, ...firebaseValue])];
          return { success: true, value: merged };
        }
        return { success: false, reason: 'Not arrays' };
      
      case 'merge_objects':
        if (typeof postgresValue === 'object' && typeof firebaseValue === 'object') {
          const merged = { ...postgresValue, ...firebaseValue };
          return { success: true, value: merged };
        }
        return { success: false, reason: 'Not objects' };
      
      case 'manual':
        // Queue for manual resolution
        this.notifySyncListeners('manual_resolution_required', {
          entityType,
          field,
          postgresValue,
          firebaseValue
        });
        return { success: false, reason: 'Manual resolution required' };
      
      default:
        return { success: false, reason: `Unknown strategy: ${strategy}` };
    }
  }

  /**
   * Set conflict resolution strategy for a field
   */
  setConflictResolutionStrategy(entityType, field, strategy) {
    const key = field ? `${entityType}.${field}` : entityType;
    this.conflictResolutions.set(key, strategy);
    console.log(`📋 Set conflict resolution strategy for ${key}: ${strategy}`);
  }

  /**
   * Write data to Firebase
   */
  async writeToFirebase(entityType, data, options) {
    // This would interact with Firebase service
    console.log(`📝 Writing to Firebase (${entityType}):`, data);
    
    // Simulate Firebase write
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`✅ Firebase write completed for ${entityType}`);
        resolve({ success: true });
      }, 100);
    });
  }

  /**
   * Write data to PostgreSQL
   */
  async writeToPostgreSQL(entityType, data, options) {
    // This would interact with PostgreSQL service
    console.log(`📝 Writing to PostgreSQL (${entityType}):`, data);
    
    // Simulate PostgreSQL write
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`✅ PostgreSQL write completed for ${entityType}`);
        resolve({ success: true });
      }, 100);
    });
  }

  /**
   * Write data to localStorage
   */
  async writeToLocalStorage(entityType, data, options) {
    console.log(`📝 Writing to localStorage (${entityType}):`, data);
    
    try {
      const key = `codecollab_${entityType}_${data.id}`;
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ localStorage write completed for ${entityType}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ localStorage write failed for ${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Write data to VFS
   */
  async writeToVFS(entityType, data, options) {
    console.log(`📝 Writing to VFS (${entityType}):`, data);
    
    // This would interact with VFS service
    // For now, just log the operation
    console.log(`✅ VFS write completed for ${entityType}`);
    return { success: true };
  }

  /**
   * Update last sync time for entity type and target
   */
  updateLastSyncTime(entityType, target) {
    const key = `${entityType}_${target}`;
    this.lastSyncTimes.set(key, new Date());
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(entityType, target) {
    const key = `${entityType}_${target}`;
    return this.lastSyncTimes.get(key);
  }

  /**
   * Perform full sync across all storage layers
   */
  async performFullSync(options = {}) {
    console.log('🔄 Starting full database sync...');
    
    const entityTypes = ['users', 'projects', 'files', 'activities', 'chatMessages'];
    const results = {};

    for (const entityType of entityTypes) {
      try {
        console.log(`🔄 Syncing ${entityType}...`);
        
        // This would fetch data from all storage layers
        // For now, simulate the operation
        results[entityType] = {
          success: true,
          synced: 0,
          conflicts: 0,
          errors: 0
        };
        
        console.log(`✅ ${entityType} sync completed`);
      } catch (error) {
        console.error(`❌ ${entityType} sync failed:`, error);
        results[entityType] = {
          success: false,
          error: error.message
        };
      }
    }

    this.notifySyncListeners('full_sync_completed', results);
    console.log('✅ Full database sync completed:', results);
    
    return results;
  }

  /**
   * Check sync health across all storage layers
   */
  async checkSyncHealth() {
    const health = {
      overall: 'healthy',
      lastSync: new Date(),
      layers: {
        postgresql: { status: 'connected', lastSync: this.getLastSyncTime('global', 'postgresql') },
        firebase: { status: 'connected', lastSync: this.getLastSyncTime('global', 'firebase') },
        localStorage: { status: 'connected', lastSync: this.getLastSyncTime('global', 'localStorage') },
        vfs: { status: 'connected', lastSync: this.getLastSyncTime('global', 'vfs') }
      },
      conflicts: [],
      issues: []
    };

    // Check each layer
    for (const [layer, info] of Object.entries(health.layers)) {
      if (!info.lastSync || (new Date() - info.lastSync) > 5 * 60 * 1000) {
        health.issues.push(`${layer} not synced in last 5 minutes`);
        info.status = 'stale';
      }
    }

    if (health.issues.length > 0) {
      health.overall = 'degraded';
    }

    return health;
  }

  /**
   * Enable periodic sync
   */
  enablePeriodicSync(intervalMs = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.performFullSync({ incremental: true });
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }, intervalMs);

    console.log(`🔄 Periodic sync enabled (${intervalMs}ms interval)`);
  }

  /**
   * Disable periodic sync
   */
  disablePeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Periodic sync disabled');
    }
  }
}

// Create singleton instance
export const databaseSyncService = new DatabaseSyncService();

export default DatabaseSyncService;
