/**
 * Conflict Resolver Utility
 * Handles conflict resolution for file operations and data synchronization
 */

class ConflictResolver {
  constructor() {
    this.strategies = new Map();
    this.setupDefaultStrategies();
  }

  /**
   * Setup default conflict resolution strategies
   */
  setupDefaultStrategies() {
    // Auto-merge strategy for simple text conflicts
    this.strategies.set('auto_merge', (conflict) => {
      const { localContent, remoteContent, baseContent } = conflict;
      
      // Simple line-based merge
      const localLines = localContent.split('\n');
      const remoteLines = remoteContent.split('\n');
      const baseLines = baseContent ? baseContent.split('\n') : [];
      
      const mergedLines = [];
      const maxLines = Math.max(localLines.length, remoteLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const localLine = localLines[i] || '';
        const remoteLine = remoteLines[i] || '';
        const baseLine = baseLines[i] || '';
        
        if (localLine === remoteLine) {
          mergedLines.push(localLine);
        } else if (localLine === baseLine) {
          // Remote changed, use remote
          mergedLines.push(remoteLine);
        } else if (remoteLine === baseLine) {
          // Local changed, use local
          mergedLines.push(localLine);
        } else {
          // Both changed, mark conflict
          mergedLines.push(`<<<<<<< LOCAL`);
          mergedLines.push(localLine);
          mergedLines.push(`=======`);
          mergedLines.push(remoteLine);
          mergedLines.push(`>>>>>>> REMOTE`);
        }
      }
      
      return {
        resolved: true,
        content: mergedLines.join('\n'),
        hasConflicts: mergedLines.some(line => line.includes('<<<<<<< LOCAL'))
      };
    });

    // Last writer wins strategy
    this.strategies.set('last_writer_wins', (conflict) => {
      const { remoteContent, remoteTimestamp, localTimestamp } = conflict;
      
      if (remoteTimestamp > localTimestamp) {
        return {
          resolved: true,
          content: remoteContent,
          hasConflicts: false
        };
      } else {
        return {
          resolved: true,
          content: conflict.localContent,
          hasConflicts: false
        };
      }
    });

    // Manual resolution strategy
    this.strategies.set('manual', (conflict) => {
      return {
        resolved: false,
        content: null,
        hasConflicts: true,
        requiresManualResolution: true,
        conflict
      };
    });
  }

  /**
   * Resolve a conflict using specified strategy
   */
  resolveConflict(conflict, strategy = 'auto_merge') {
    const resolver = this.strategies.get(strategy);
    
    if (!resolver) {
      throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }
    
    try {
      const result = resolver(conflict);
      
      console.log(`🔧 Conflict resolved using ${strategy}:`, {
        hasConflicts: result.hasConflicts,
        requiresManual: result.requiresManualResolution
      });
      
      return result;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      
      // Fallback to manual resolution
      return {
        resolved: false,
        content: null,
        hasConflicts: true,
        requiresManualResolution: true,
        error: error.message,
        conflict
      };
    }
  }

  /**
   * Register a custom resolution strategy
   */
  registerStrategy(name, resolverFunction) {
    this.strategies.set(name, resolverFunction);
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Detect conflict type
   */
  detectConflictType(conflict) {
    const { localContent, remoteContent, filePath } = conflict;
    
    // Check if it's a delete conflict
    if (!localContent && remoteContent) {
      return 'remote_add_local_delete';
    }
    
    if (localContent && !remoteContent) {
      return 'local_add_remote_delete';
    }
    
    // Check file type for specific handling
    const extension = filePath.split('.').pop().toLowerCase();
    
    if (['json', 'yaml', 'yml'].includes(extension)) {
      return 'structured_data';
    }
    
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp'].includes(extension)) {
      return 'source_code';
    }
    
    if (['md', 'txt', 'csv'].includes(extension)) {
      return 'text_file';
    }
    
    return 'generic';
  }

  /**
   * Create a conflict object
   */
  createConflict(localContent, remoteContent, filePath, metadata = {}) {
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      localContent,
      remoteContent,
      baseContent: metadata.baseContent || null,
      localTimestamp: metadata.localTimestamp || Date.now(),
      remoteTimestamp: metadata.remoteTimestamp || Date.now(),
      conflictType: this.detectConflictType({ localContent, remoteContent, filePath }),
      createdAt: Date.now(),
      metadata
    };
  }
}

// Export both the class and singleton instance
export { ConflictResolver };
export const conflictResolver = new ConflictResolver();
export default conflictResolver;
