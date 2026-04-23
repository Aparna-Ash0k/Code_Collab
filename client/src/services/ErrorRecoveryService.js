/**
 * ErrorRecoveryService - Comprehensive error recovery for failed file operations
 * Provides automatic retry, fallback mechanisms, and graceful degradation across storage layers
 */

import { PathUtils } from '../utils/PathUtils';

export class ErrorRecoveryService {
  constructor() {
    this.retryQueue = [];
    this.fallbackQueue = [];
    this.errorHistory = new Map();
    this.recoveryStrategies = new Map();
    this.recoveryListeners = new Set();
    this.isProcessingRecovery = false;
    this.maxRetries = 3;
    this.retryDelays = [1000, 3000, 10000]; // Progressive delays
    this.circuitBreakers = new Map();
    
    this.initializeRecoveryStrategies();
    console.log('🔧 ErrorRecoveryService initialized');
  }

  /**
   * Initialize default recovery strategies
   */
  initializeRecoveryStrategies() {
    // Storage layer fallback priority
    this.storageFallbackOrder = ['vfs', 'localstorage', 'firebase', 'database'];
    
    // Error type recovery strategies
    this.recoveryStrategies.set('network_error', {
      retry: true,
      maxRetries: 3,
      fallback: 'localstorage',
      circuitBreaker: true,
      degradation: 'offline_mode'
    });

    this.recoveryStrategies.set('permission_denied', {
      retry: false,
      fallback: 'readonly_mode',
      userAction: 'request_permission',
      degradation: 'read_only'
    });

    this.recoveryStrategies.set('quota_exceeded', {
      retry: false,
      fallback: 'database',
      cleanup: 'clear_cache',
      userAction: 'notify_quota_full',
      degradation: 'essential_only'
    });

    this.recoveryStrategies.set('file_not_found', {
      retry: true,
      maxRetries: 1,
      fallback: 'recreate_from_backup',
      recovery: 'restore_from_history'
    });

    this.recoveryStrategies.set('corruption_error', {
      retry: false,
      fallback: 'backup_restore',
      recovery: 'validate_and_repair',
      userAction: 'confirm_restore'
    });

    this.recoveryStrategies.set('timeout_error', {
      retry: true,
      maxRetries: 2,
      fallback: 'alternative_storage',
      circuitBreaker: true,
      degradation: 'reduced_functionality'
    });

    this.recoveryStrategies.set('version_conflict', {
      retry: false,
      fallback: 'manual_merge',
      userAction: 'resolve_conflict',
      recovery: 'merge_versions'
    });

    this.recoveryStrategies.set('storage_full', {
      retry: false,
      fallback: 'cleanup_and_retry',
      cleanup: 'remove_temp_files',
      userAction: 'manage_storage'
    });
  }

  /**
   * Add error recovery listener
   */
  addRecoveryListener(callback) {
    this.recoveryListeners.add(callback);
  }

  /**
   * Remove error recovery listener
   */
  removeRecoveryListener(callback) {
    this.recoveryListeners.delete(callback);
  }

  /**
   * Notify recovery listeners
   */
  notifyRecoveryListeners(event, data) {
    this.recoveryListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Recovery listener error:', error);
      }
    });
  }

  /**
   * Handle operation error and attempt recovery
   */
  async handleOperationError(error, operation, context = {}) {
    console.log('🚨 Handling operation error:', error.message, operation);
    
    const errorInfo = this.analyzeError(error, operation, context);
    this.recordError(errorInfo);

    // Check circuit breaker
    if (this.shouldCircuitBreak(errorInfo)) {
      console.log('⚡ Circuit breaker activated for:', errorInfo.category);
      return await this.handleCircuitBreaker(errorInfo);
    }

    // Attempt recovery based on error type
    const recovery = await this.attemptRecovery(errorInfo);
    
    if (recovery.success) {
      this.notifyRecoveryListeners('recovery_successful', { errorInfo, recovery });
      return recovery;
    } else {
      this.notifyRecoveryListeners('recovery_failed', { errorInfo, recovery });
      return await this.handleRecoveryFailure(errorInfo, recovery);
    }
  }

  /**
   * Analyze error to determine recovery strategy
   */
  analyzeError(error, operation, context) {
    const errorInfo = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      operation: operation,
      context: context,
      category: this.categorizeError(error),
      severity: this.assessSeverity(error, operation),
      storageLayer: context.storageLayer || 'unknown',
      filePath: context.filePath || operation.path,
      retryCount: 0
    };

    return errorInfo;
  }

  /**
   * Categorize error type
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network_error';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission_denied';
    }
    if (message.includes('quota') || message.includes('storage') || message.includes('space')) {
      return 'quota_exceeded';
    }
    if (message.includes('not found') || message.includes('missing')) {
      return 'file_not_found';
    }
    if (message.includes('corrupt') || message.includes('invalid') || message.includes('malformed')) {
      return 'corruption_error';
    }
    if (message.includes('timeout') || message.includes('took too long')) {
      return 'timeout_error';
    }
    if (message.includes('conflict') || message.includes('version')) {
      return 'version_conflict';
    }
    if (message.includes('full') || message.includes('exceeded capacity')) {
      return 'storage_full';
    }
    
    return 'unknown_error';
  }

  /**
   * Assess error severity
   */
  assessSeverity(error, operation) {
    // Critical operations
    if (operation.type === 'save' || operation.type === 'backup') {
      return 'critical';
    }
    
    // High severity for user-initiated operations
    if (operation.userInitiated) {
      return 'high';
    }
    
    // Medium severity for automatic operations
    if (operation.type === 'sync' || operation.type === 'autosave') {
      return 'medium';
    }
    
    // Low severity for background operations
    return 'low';
  }

  /**
   * Record error in history
   */
  recordError(errorInfo) {
    const key = `${errorInfo.category}_${errorInfo.storageLayer}`;
    
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    
    const history = this.errorHistory.get(key);
    history.push(errorInfo);
    
    // Keep only last 100 errors per category
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Check if circuit breaker should activate
   */
  shouldCircuitBreak(errorInfo) {
    const strategy = this.recoveryStrategies.get(errorInfo.category);
    if (!strategy?.circuitBreaker) return false;

    const key = `${errorInfo.category}_${errorInfo.storageLayer}`;
    const recentErrors = this.getRecentErrors(key, 5 * 60 * 1000); // 5 minutes
    
    return recentErrors.length >= 5; // 5 errors in 5 minutes
  }

  /**
   * Get recent errors for a category/storage layer
   */
  getRecentErrors(key, timeWindow) {
    const history = this.errorHistory.get(key) || [];
    const cutoff = new Date(Date.now() - timeWindow);
    
    return history.filter(error => error.timestamp > cutoff);
  }

  /**
   * Handle circuit breaker activation
   */
  async handleCircuitBreaker(errorInfo) {
    console.log('⚡ Circuit breaker activated');
    
    const breakerKey = `${errorInfo.category}_${errorInfo.storageLayer}`;
    this.circuitBreakers.set(breakerKey, {
      activatedAt: new Date(),
      errorInfo: errorInfo
    });

    // Attempt fallback to different storage layer
    const fallbackResult = await this.attemptStorageFallback(errorInfo);
    
    if (fallbackResult.success) {
      return fallbackResult;
    }

    // If fallback fails, enter degraded mode
    return await this.enterDegradedMode(errorInfo);
  }

  /**
   * Attempt error recovery
   */
  async attemptRecovery(errorInfo) {
    const strategy = this.recoveryStrategies.get(errorInfo.category);
    
    if (!strategy) {
      console.warn('No recovery strategy for error category:', errorInfo.category);
      return { success: false, reason: 'no_strategy' };
    }

    console.log('🔄 Attempting recovery with strategy:', strategy);

    // Try retry first if applicable
    if (strategy.retry && errorInfo.retryCount < (strategy.maxRetries || this.maxRetries)) {
      return await this.attemptRetry(errorInfo, strategy);
    }

    // Try fallback mechanisms
    if (strategy.fallback) {
      return await this.attemptFallback(errorInfo, strategy);
    }

    // Try cleanup and recovery
    if (strategy.cleanup) {
      return await this.attemptCleanupRecovery(errorInfo, strategy);
    }

    // Try restoration from backup/history
    if (strategy.recovery) {
      return await this.attemptDataRecovery(errorInfo, strategy);
    }

    return { success: false, reason: 'no_applicable_recovery' };
  }

  /**
   * Attempt retry with exponential backoff
   */
  async attemptRetry(errorInfo, strategy) {
    errorInfo.retryCount++;
    
    const delay = this.retryDelays[Math.min(errorInfo.retryCount - 1, this.retryDelays.length - 1)];
    
    console.log(`🔄 Retry attempt ${errorInfo.retryCount}/${strategy.maxRetries} after ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Queue operation for retry
      this.retryQueue.push({
        ...errorInfo,
        retryAt: new Date(Date.now() + delay),
        strategy: strategy
      });
      
      // Process retry queue if not already processing
      if (!this.isProcessingRecovery) {
        this.processRecoveryQueue();
      }
      
      return { success: true, method: 'retry', retryCount: errorInfo.retryCount };
      
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      return { success: false, reason: 'retry_failed', error: retryError };
    }
  }

  /**
   * Attempt fallback to alternative storage or method
   */
  async attemptFallback(errorInfo, strategy) {
    console.log('🔄 Attempting fallback:', strategy.fallback);
    
    switch (strategy.fallback) {
      case 'localstorage':
        return await this.fallbackToLocalStorage(errorInfo);
      
      case 'firebase':
        return await this.fallbackToFirebase(errorInfo);
      
      case 'database':
        return await this.fallbackToDatabase(errorInfo);
      
      case 'readonly_mode':
        return await this.fallbackToReadOnlyMode(errorInfo);
      
      case 'alternative_storage':
        return await this.attemptStorageFallback(errorInfo);
      
      case 'backup_restore':
        return await this.fallbackToBackupRestore(errorInfo);
      
      case 'manual_merge':
        return await this.fallbackToManualMerge(errorInfo);
      
      case 'cleanup_and_retry':
        return await this.fallbackToCleanupAndRetry(errorInfo);
      
      default:
        console.warn('Unknown fallback method:', strategy.fallback);
        return { success: false, reason: 'unknown_fallback' };
    }
  }

  /**
   * Attempt storage layer fallback
   */
  async attemptStorageFallback(errorInfo) {
    const currentStorageIndex = this.storageFallbackOrder.indexOf(errorInfo.storageLayer);
    const fallbackOptions = this.storageFallbackOrder.slice(currentStorageIndex + 1);
    
    for (const storageLayer of fallbackOptions) {
      try {
        console.log(`🔄 Trying fallback to ${storageLayer}`);
        
        const result = await this.executeOperationOnStorage(errorInfo.operation, storageLayer);
        
        if (result.success) {
          console.log(`✅ Fallback to ${storageLayer} successful`);
          return { 
            success: true, 
            method: 'storage_fallback', 
            storageLayer: storageLayer,
            result: result 
          };
        }
      } catch (fallbackError) {
        console.warn(`Fallback to ${storageLayer} failed:`, fallbackError);
        continue;
      }
    }
    
    return { success: false, reason: 'all_storage_fallbacks_failed' };
  }

  /**
   * Attempt cleanup recovery
   */
  async attemptCleanupRecovery(errorInfo, strategy) {
    console.log('🧹 Attempting cleanup recovery:', strategy.cleanup);
    
    try {
      switch (strategy.cleanup) {
        case 'clear_cache':
          await this.clearCache();
          break;
        
        case 'remove_temp_files':
          await this.removeTempFiles();
          break;
        
        case 'compact_storage':
          await this.compactStorage();
          break;
        
        default:
          console.warn('Unknown cleanup method:', strategy.cleanup);
          return { success: false, reason: 'unknown_cleanup' };
      }
      
      // Retry operation after cleanup
      const result = await this.executeOperationOnStorage(errorInfo.operation, errorInfo.storageLayer);
      
      return { 
        success: result.success, 
        method: 'cleanup_recovery',
        cleanup: strategy.cleanup,
        result: result 
      };
      
    } catch (cleanupError) {
      console.error('Cleanup recovery failed:', cleanupError);
      return { success: false, reason: 'cleanup_failed', error: cleanupError };
    }
  }

  /**
   * Attempt data recovery from backup/history
   */
  async attemptDataRecovery(errorInfo, strategy) {
    console.log('💾 Attempting data recovery:', strategy.recovery);
    
    try {
      switch (strategy.recovery) {
        case 'restore_from_history':
          return await this.restoreFromHistory(errorInfo);
        
        case 'validate_and_repair':
          return await this.validateAndRepair(errorInfo);
        
        case 'merge_versions':
          return await this.mergeVersions(errorInfo);
        
        case 'recreate_from_backup':
          return await this.recreateFromBackup(errorInfo);
        
        default:
          console.warn('Unknown recovery method:', strategy.recovery);
          return { success: false, reason: 'unknown_recovery' };
      }
    } catch (recoveryError) {
      console.error('Data recovery failed:', recoveryError);
      return { success: false, reason: 'data_recovery_failed', error: recoveryError };
    }
  }

  /**
   * Handle recovery failure - enter degraded mode
   */
  async handleRecoveryFailure(errorInfo, recoveryAttempt) {
    console.warn('🚨 All recovery attempts failed, entering degraded mode');
    
    const strategy = this.recoveryStrategies.get(errorInfo.category);
    const degradationLevel = strategy?.degradation || 'safe_mode';
    
    return await this.enterDegradedMode(errorInfo, degradationLevel);
  }

  /**
   * Enter degraded operation mode
   */
  async enterDegradedMode(errorInfo, degradationLevel = 'safe_mode') {
    console.log(`📉 Entering degraded mode: ${degradationLevel}`);
    
    const degradedState = {
      level: degradationLevel,
      triggeredBy: errorInfo,
      timestamp: new Date(),
      restrictions: this.getDegradationRestrictions(degradationLevel),
      fallbackOperations: this.getFallbackOperations(degradationLevel)
    };

    this.notifyRecoveryListeners('degraded_mode_entered', degradedState);
    
    return {
      success: true,
      method: 'degraded_mode',
      degradationLevel: degradationLevel,
      state: degradedState
    };
  }

  /**
   * Get restrictions for degradation level
   */
  getDegradationRestrictions(level) {
    switch (level) {
      case 'offline_mode':
        return ['no_remote_sync', 'local_storage_only', 'no_collaboration'];
      
      case 'read_only':
        return ['no_file_modifications', 'no_project_changes', 'view_only'];
      
      case 'essential_only':
        return ['no_autosave', 'no_background_sync', 'manual_saves_only'];
      
      case 'reduced_functionality':
        return ['limited_file_types', 'reduced_collaboration', 'basic_features_only'];
      
      case 'safe_mode':
        return ['minimal_operations', 'essential_functions_only', 'error_recovery_disabled'];
      
      default:
        return ['unknown_restrictions'];
    }
  }

  /**
   * Get fallback operations for degradation level
   */
  getFallbackOperations(level) {
    switch (level) {
      case 'offline_mode':
        return ['local_autosave', 'cache_operations', 'queue_sync'];
      
      case 'read_only':
        return ['view_files', 'export_data', 'read_project_info'];
      
      case 'essential_only':
        return ['manual_save', 'basic_editing', 'local_backup'];
      
      case 'reduced_functionality':
        return ['text_editing', 'basic_collaboration', 'limited_sync'];
      
      case 'safe_mode':
        return ['emergency_save', 'data_export', 'error_reporting'];
      
      default:
        return ['unknown_operations'];
    }
  }

  /**
   * Process recovery queue
   */
  async processRecoveryQueue() {
    if (this.isProcessingRecovery) return;
    
    this.isProcessingRecovery = true;
    console.log('🔄 Processing recovery queue...');

    while (this.retryQueue.length > 0) {
      const retryItem = this.retryQueue.shift();
      
      if (retryItem.retryAt <= new Date()) {
        try {
          const result = await this.executeOperationOnStorage(retryItem.operation, retryItem.storageLayer);
          
          if (result.success) {
            console.log('✅ Retry successful');
            this.notifyRecoveryListeners('retry_successful', { retryItem, result });
          } else {
            console.log('❌ Retry failed, attempting fallback');
            await this.attemptFallback(retryItem, retryItem.strategy);
          }
        } catch (error) {
          console.error('Retry execution failed:', error);
          await this.handleOperationError(error, retryItem.operation, retryItem.context);
        }
      } else {
        // Put back in queue if not ready
        this.retryQueue.unshift(retryItem);
        break;
      }
    }

    this.isProcessingRecovery = false;
  }

  // Placeholder methods for actual storage operations
  async executeOperationOnStorage(operation, storageLayer) {
    console.log(`Executing ${operation.type} on ${storageLayer}`);
    return { success: true, data: null };
  }

  async fallbackToLocalStorage(errorInfo) {
    return { success: true, method: 'localstorage_fallback' };
  }

  async fallbackToFirebase(errorInfo) {
    return { success: true, method: 'firebase_fallback' };
  }

  async fallbackToDatabase(errorInfo) {
    return { success: true, method: 'database_fallback' };
  }

  async fallbackToReadOnlyMode(errorInfo) {
    return { success: true, method: 'readonly_fallback' };
  }

  async fallbackToBackupRestore(errorInfo) {
    return { success: true, method: 'backup_restore_fallback' };
  }

  async fallbackToManualMerge(errorInfo) {
    return { success: true, method: 'manual_merge_fallback' };
  }

  async fallbackToCleanupAndRetry(errorInfo) {
    return { success: true, method: 'cleanup_retry_fallback' };
  }

  async clearCache() {
    console.log('🧹 Clearing cache');
  }

  async removeTempFiles() {
    console.log('🧹 Removing temporary files');
  }

  async compactStorage() {
    console.log('🧹 Compacting storage');
  }

  async restoreFromHistory(errorInfo) {
    return { success: true, method: 'history_restore' };
  }

  async validateAndRepair(errorInfo) {
    return { success: true, method: 'validate_repair' };
  }

  async mergeVersions(errorInfo) {
    return { success: true, method: 'version_merge' };
  }

  async recreateFromBackup(errorInfo) {
    return { success: true, method: 'backup_recreate' };
  }

  /**
   * Get error recovery statistics
   */
  getRecoveryStats() {
    const stats = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsByStorage: {},
      recoverySuccessRate: 0,
      activeCircuitBreakers: this.circuitBreakers.size,
      queuedRetries: this.retryQueue.length
    };

    this.errorHistory.forEach((errors, key) => {
      stats.totalErrors += errors.length;
      
      errors.forEach(error => {
        stats.errorsByCategory[error.category] = 
          (stats.errorsByCategory[error.category] || 0) + 1;
        stats.errorsByStorage[error.storageLayer] = 
          (stats.errorsByStorage[error.storageLayer] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers() {
    this.circuitBreakers.clear();
    console.log('⚡ All circuit breakers reset');
  }

  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.errorHistory.clear();
    console.log('🧹 Error history cleared');
  }
}

// Create singleton instance
export const errorRecoveryService = new ErrorRecoveryService();

export default ErrorRecoveryService;
