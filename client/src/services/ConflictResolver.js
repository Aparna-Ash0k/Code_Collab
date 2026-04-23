/**
 * ConflictResolver - Automatic conflict detection and resolution system
 * 
 * Handles conflicts between storage layers (VFS, localStorage, Firebase, Database)
 * with intelligent resolution strategies:
 * - Last-write-wins with timestamps
 * - Content merge for text files
 * - User-choice prompts for complex conflicts
 * - Backup creation for data safety
 */

import { storageManager } from './StorageManager';
import PathUtils from '../utils/PathUtils';

export class ConflictResolver {
  constructor() {
    this.conflicts = new Map(); // filePath -> conflict data
    this.resolutionStrategies = new Map(); // conflict type -> resolution function
    this.backups = new Map(); // filePath -> backup data
    this.listeners = new Set(); // conflict event listeners
    
    // Initialize resolution strategies
    this.initializeStrategies();
    
    console.log('🔧 ConflictResolver initialized');
  }

  /**
   * Initialize conflict resolution strategies
   */
  initializeStrategies() {
    // Last-write-wins strategy (default)
    this.resolutionStrategies.set('timestamp', this.resolveByTimestamp.bind(this));
    
    // Content merge strategy for text files
    this.resolutionStrategies.set('merge', this.resolveByMerge.bind(this));
    
    // User choice strategy (manual resolution)
    this.resolutionStrategies.set('user', this.resolveByUserChoice.bind(this));
    
    // Backup and replace strategy
    this.resolutionStrategies.set('backup', this.resolveByBackup.bind(this));
    
    // Size-based strategy (keep larger file)
    this.resolutionStrategies.set('size', this.resolveBySize.bind(this));
  }

  /**
   * Detect conflicts between storage layers for a specific file
   */
  async detectConflicts(filePath) {
    const normalizedPath = PathUtils.normalize(filePath);
    
    try {
      // Get file data from all storage layers
      const versions = await this.getAllVersions(normalizedPath);
      
      if (versions.length <= 1) {
        // No conflict if only one version exists
        return null;
      }

      // Check for conflicts
      const conflict = this.analyzeVersions(normalizedPath, versions);
      
      if (conflict) {
        this.conflicts.set(normalizedPath, conflict);
        this.notifyListeners('conflict_detected', { filePath: normalizedPath, conflict });
        console.log(`⚠️ Conflict detected for: ${normalizedPath}`, conflict);
        return conflict;
      }

      return null;
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return null;
    }
  }

  /**
   * Get file versions from all storage layers
   */
  async getAllVersions(filePath) {
    const versions = [];

    try {
      // VFS version
      const vfsFile = storageManager.vfs.getFile(filePath);
      if (vfsFile) {
        versions.push({
          source: 'VFS',
          content: vfsFile.content,
          lastModified: vfsFile.lastModified || Date.now(),
          size: vfsFile.content?.length || 0,
          priority: 1
        });
      }

      // localStorage version
      const localData = localStorage.getItem('vfs_data');
      if (localData) {
        const parsed = JSON.parse(localData);
        const localFile = parsed.files?.[filePath];
        if (localFile) {
          versions.push({
            source: 'localStorage',
            content: localFile.content,
            lastModified: localFile.lastModified || Date.now(),
            size: localFile.content?.length || 0,
            priority: 2
          });
        }
      }

      // Firebase version
      if (storageManager.firebaseService) {
        try {
          const firebaseFile = await storageManager.firebaseService.getFile(filePath);
          if (firebaseFile) {
            versions.push({
              source: 'Firebase',
              content: firebaseFile.content,
              lastModified: firebaseFile.lastModified || Date.now(),
              size: firebaseFile.content?.length || 0,
              priority: 3
            });
          }
        } catch (error) {
          // Firebase unavailable - continue
        }
      }

      // TODO: Database version (when implemented)
      // versions.push({ source: 'Database', ... });

    } catch (error) {
      console.error('Error getting file versions:', error);
    }

    return versions;
  }

  /**
   * Analyze versions to determine if there's a conflict
   */
  analyzeVersions(filePath, versions) {
    if (versions.length <= 1) return null;

    // Check for content differences
    const uniqueContents = new Set(versions.map(v => v.content));
    const uniqueTimestamps = new Set(versions.map(v => v.lastModified));

    if (uniqueContents.size === 1) {
      // Same content everywhere - no conflict
      return null;
    }

    // Determine conflict type
    let conflictType = 'content';
    if (uniqueTimestamps.size > 1) {
      conflictType = 'timestamp';
    }

    // Check if files are text and can be merged
    const canMerge = versions.every(v => this.isTextFile(filePath, v.content));

    return {
      filePath,
      type: conflictType,
      versions,
      canMerge,
      detectedAt: Date.now(),
      resolved: false,
      strategy: null,
      resolution: null
    };
  }

  /**
   * Resolve conflicts automatically or with user input
   */
  async resolveConflict(filePath, strategy = 'auto') {
    const conflict = this.conflicts.get(filePath);
    if (!conflict) {
      console.warn('No conflict found for:', filePath);
      return false;
    }

    try {
      let resolvedStrategy = strategy;
      
      // Auto-select strategy if not specified
      if (strategy === 'auto') {
        resolvedStrategy = this.selectAutoStrategy(conflict);
      }

      const resolution = await this.resolutionStrategies.get(resolvedStrategy)?.(conflict);
      
      if (resolution) {
        // Apply resolution
        await this.applyResolution(filePath, resolution);
        
        // Mark as resolved
        conflict.resolved = true;
        conflict.strategy = resolvedStrategy;
        conflict.resolution = resolution;
        conflict.resolvedAt = Date.now();

        this.notifyListeners('conflict_resolved', { filePath, conflict, resolution });
        console.log(`✅ Conflict resolved for ${filePath} using ${resolvedStrategy} strategy`);
        
        return true;
      } else {
        console.error('Failed to resolve conflict - no resolution strategy found');
        return false;
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return false;
    }
  }

  /**
   * Auto-select resolution strategy based on conflict characteristics
   */
  selectAutoStrategy(conflict) {
    const { versions, canMerge, type } = conflict;

    // If it's a text file and small, try to merge
    if (canMerge && versions.every(v => v.size < 10000)) {
      return 'merge';
    }

    // If timestamps are very different, use timestamp strategy
    const timestamps = versions.map(v => v.lastModified);
    const timeDiff = Math.max(...timestamps) - Math.min(...timestamps);
    if (timeDiff > 60000) { // More than 1 minute difference
      return 'timestamp';
    }

    // Default to user choice for complex cases
    return 'user';
  }

  /**
   * Resolve by timestamp (last-write-wins)
   */
  async resolveByTimestamp(conflict) {
    const { versions } = conflict;
    
    // Find version with latest timestamp
    const latest = versions.reduce((latest, current) => 
      current.lastModified > latest.lastModified ? current : latest
    );

    return {
      type: 'timestamp',
      chosenVersion: latest,
      reason: `Latest version from ${latest.source} (${new Date(latest.lastModified).toLocaleString()})`
    };
  }

  /**
   * Resolve by content merge (for text files)
   */
  async resolveByMerge(conflict) {
    const { versions, filePath } = conflict;
    
    if (!this.isTextFile(filePath)) {
      return null;
    }

    try {
      // Simple merge strategy - combine unique lines
      const allLines = new Set();
      const mergeInfo = [];

      versions.forEach(version => {
        const lines = version.content.split('\n');
        lines.forEach(line => allLines.add(line));
        mergeInfo.push({
          source: version.source,
          lineCount: lines.length,
          timestamp: version.lastModified
        });
      });

      const mergedContent = Array.from(allLines).join('\n');

      return {
        type: 'merge',
        mergedContent,
        sources: mergeInfo,
        reason: `Merged content from ${versions.length} sources`
      };
    } catch (error) {
      console.error('Merge failed:', error);
      return null;
    }
  }

  /**
   * Resolve by user choice (requires UI component)
   */
  async resolveByUserChoice(conflict) {
    // This would trigger a UI modal for user to choose
    // For now, return a default choice
    const { versions } = conflict;
    const highestPriority = versions.reduce((highest, current) => 
      current.priority > highest.priority ? current : highest
    );

    return {
      type: 'user',
      chosenVersion: highestPriority,
      reason: `Default choice: highest priority source (${highestPriority.source})`
    };
  }

  /**
   * Resolve by creating backup and using newest
   */
  async resolveByBackup(conflict) {
    const { filePath, versions } = conflict;
    
    // Create backups of all versions except the newest
    const latest = versions.reduce((latest, current) => 
      current.lastModified > latest.lastModified ? current : latest
    );

    const backups = versions.filter(v => v !== latest).map((version, index) => ({
      fileName: `${filePath}.backup.${version.source}.${Date.now()}.${index}`,
      content: version.content,
      source: version.source,
      originalTimestamp: version.lastModified
    }));

    // Store backups
    this.backups.set(filePath, backups);

    return {
      type: 'backup',
      chosenVersion: latest,
      backups,
      reason: `Used latest version, created ${backups.length} backups`
    };
  }

  /**
   * Resolve by file size (keep larger file)
   */
  async resolveBySize(conflict) {
    const { versions } = conflict;
    
    const largest = versions.reduce((largest, current) => 
      current.size > largest.size ? current : largest
    );

    return {
      type: 'size',
      chosenVersion: largest,
      reason: `Largest file from ${largest.source} (${largest.size} bytes)`
    };
  }

  /**
   * Apply resolution to all storage layers
   */
  async applyResolution(filePath, resolution) {
    const { type, chosenVersion, mergedContent, backups } = resolution;

    try {
      // Determine final content
      let finalContent = mergedContent || chosenVersion?.content;
      let finalTimestamp = chosenVersion?.lastModified || Date.now();

      if (!finalContent) {
        throw new Error('No content to apply');
      }

      // Apply to all storage layers through StorageManager
      await storageManager.updateFile(filePath, finalContent, {
        timestamp: finalTimestamp,
        syncAcrossStorage: true,
        conflictResolution: true
      });

      // Store backups if created
      if (backups && backups.length > 0) {
        await this.storeBackups(backups);
      }

      console.log(`✅ Applied ${type} resolution to ${filePath}`);
      return true;
    } catch (error) {
      console.error('Failed to apply resolution:', error);
      return false;
    }
  }

  /**
   * Store backup files
   */
  async storeBackups(backups) {
    for (const backup of backups) {
      try {
        // Store in a special backup location
        const backupPath = `__backups__/${backup.fileName}`;
        await storageManager.createFile(backupPath, backup.content, {
          isBackup: true,
          originalSource: backup.source,
          originalTimestamp: backup.originalTimestamp
        });
      } catch (error) {
        console.warn('Failed to store backup:', backup.fileName, error);
      }
    }
  }

  /**
   * Check if file is a text file that can be merged
   */
  isTextFile(filePath, content = '') {
    const textExtensions = ['.txt', '.md', '.js', '.ts', '.html', '.css', '.json', '.yml', '.yaml', '.xml', '.csv'];
    const extension = PathUtils.getExtension(filePath);
    
    if (textExtensions.includes(extension.toLowerCase())) {
      return true;
    }

    // Check content for binary data
    if (content && typeof content === 'string') {
      // Simple heuristic: if it contains null bytes, it's likely binary
      return !content.includes('\0');
    }

    return false;
  }

  /**
   * Scan all files for conflicts
   */
  async scanAllFiles() {
    const conflicts = [];
    
    try {
      // Get all file paths from VFS
      const vfsFiles = storageManager.vfs.getAllFiles();
      
      for (const filePath of vfsFiles.keys()) {
        const conflict = await this.detectConflicts(filePath);
        if (conflict) {
          conflicts.push(conflict);
        }
      }

      console.log(`🔍 Scanned ${vfsFiles.size} files, found ${conflicts.length} conflicts`);
      return conflicts;
    } catch (error) {
      console.error('Error scanning files for conflicts:', error);
      return [];
    }
  }

  /**
   * Auto-resolve all detected conflicts
   */
  async autoResolveAll() {
    const resolvedCount = { success: 0, failed: 0 };
    
    for (const [filePath, conflict] of this.conflicts) {
      if (!conflict.resolved) {
        const success = await this.resolveConflict(filePath, 'auto');
        if (success) {
          resolvedCount.success++;
        } else {
          resolvedCount.failed++;
        }
      }
    }

    console.log(`🔧 Auto-resolved ${resolvedCount.success} conflicts, ${resolvedCount.failed} failed`);
    return resolvedCount;
  }

  /**
   * Add conflict event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of conflict events
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in conflict listener:', error);
      }
    });
  }

  /**
   * Get conflict status
   */
  getStatus() {
    const total = this.conflicts.size;
    const resolved = Array.from(this.conflicts.values()).filter(c => c.resolved).length;
    const pending = total - resolved;

    return {
      total,
      resolved,
      pending,
      conflicts: Array.from(this.conflicts.entries())
    };
  }

  /**
   * Clear resolved conflicts
   */
  clearResolved() {
    for (const [filePath, conflict] of this.conflicts) {
      if (conflict.resolved) {
        this.conflicts.delete(filePath);
      }
    }
  }
}

// Export singleton instance
const conflictResolver = new ConflictResolver();
export default conflictResolver;
