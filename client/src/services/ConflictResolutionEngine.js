/**
 * Real-time Conflict Resolution Engine
 * Advanced conflict resolution for real-time collaborative editing
 */

import { EventEmitter } from 'events';

class ConflictResolutionEngine extends EventEmitter {
  constructor() {
    super();
    
    // Conflict detection and resolution
    this.activeConflicts = new Map(); // conflictId -> conflict data
    this.resolutionStrategies = new Map(); // strategy name -> handler
    this.conflictHistory = []; // For learning and pattern detection
    
    // Real-time state tracking
    this.documentVersions = new Map(); // filePath -> version info
    this.pendingOperations = new Map(); // operationId -> operation
    this.operationDependencies = new Map(); // operationId -> dependencies
    
    // Conflict detection thresholds
    this.thresholds = {
      simultaneousEditWindow: 1000, // 1 second
      positionOverlapThreshold: 5, // characters
      versionDriftThreshold: 10, // version difference
      conflictResolutionTimeout: 30000 // 30 seconds
    };
    
    // Resolution algorithms
    this.algorithms = {
      lastWriterWins: this.lastWriterWinsResolution.bind(this),
      firstWriterWins: this.firstWriterWinsResolution.bind(this),
      characterDiff: this.characterDiffResolution.bind(this),
      semanticMerge: this.semanticMergeResolution.bind(this),
      userChoice: this.userChoiceResolution.bind(this),
      automaticMerge: this.automaticMergeResolution.bind(this)
    };
    
    // Metrics
    this.metrics = {
      conflictsDetected: 0,
      conflictsResolved: 0,
      automaticResolutions: 0,
      manualResolutions: 0,
      resolutionTime: 0
    };
    
    this.initializeEngine();
  }

  /**
   * Initialize conflict resolution engine
   */
  initializeEngine() {
    // Register default resolution strategies
    this.registerStrategy('default', this.defaultResolutionStrategy.bind(this));
    this.registerStrategy('collaborative', this.collaborativeResolutionStrategy.bind(this));
    this.registerStrategy('conservative', this.conservativeResolutionStrategy.bind(this));
    this.registerStrategy('aggressive', this.aggressiveResolutionStrategy.bind(this));
    
    console.log('⚔️ Conflict resolution engine initialized');
  }

  // ==================== CONFLICT DETECTION ====================

  /**
   * Detect conflicts between operations
   */
  detectConflicts(operation1, operation2) {
    // Same file check
    if (operation1.filePath !== operation2.filePath) {
      return { hasConflict: false };
    }

    // Time-based conflict detection
    const timeDiff = Math.abs(operation1.timestamp - operation2.timestamp);
    if (timeDiff > this.thresholds.simultaneousEditWindow) {
      return { hasConflict: false };
    }

    // Position-based conflict detection
    const positionConflict = this.detectPositionConflict(operation1, operation2);
    if (positionConflict.hasConflict) {
      return {
        hasConflict: true,
        type: 'position',
        details: positionConflict,
        severity: this.calculateConflictSeverity(operation1, operation2)
      };
    }

    // Content-based conflict detection
    const contentConflict = this.detectContentConflict(operation1, operation2);
    if (contentConflict.hasConflict) {
      return {
        hasConflict: true,
        type: 'content',
        details: contentConflict,
        severity: this.calculateConflictSeverity(operation1, operation2)
      };
    }

    // Version-based conflict detection
    const versionConflict = this.detectVersionConflict(operation1, operation2);
    if (versionConflict.hasConflict) {
      return {
        hasConflict: true,
        type: 'version',
        details: versionConflict,
        severity: this.calculateConflictSeverity(operation1, operation2)
      };
    }

    return { hasConflict: false };
  }

  /**
   * Detect position-based conflicts
   */
  detectPositionConflict(op1, op2) {
    if (!op1.position || !op2.position) {
      return { hasConflict: false };
    }

    const pos1 = op1.position;
    const pos2 = op2.position;

    // Same line conflicts
    if (pos1.line === pos2.line) {
      const columnDiff = Math.abs(pos1.column - pos2.column);
      
      if (columnDiff <= this.thresholds.positionOverlapThreshold) {
        return {
          hasConflict: true,
          reason: 'overlapping_positions',
          distance: columnDiff,
          affectedRange: {
            start: Math.min(pos1.column, pos2.column),
            end: Math.max(pos1.column, pos2.column)
          }
        };
      }
    }

    // Adjacent line conflicts
    const lineDiff = Math.abs(pos1.line - pos2.line);
    if (lineDiff <= 1) {
      return {
        hasConflict: true,
        reason: 'adjacent_lines',
        distance: lineDiff
      };
    }

    return { hasConflict: false };
  }

  /**
   * Detect content-based conflicts
   */
  detectContentConflict(op1, op2) {
    if (!op1.content || !op2.content) {
      return { hasConflict: false };
    }

    // Check for overlapping content changes
    if (op1.type === 'text_replace' && op2.type === 'text_replace') {
      const range1 = { start: op1.position, end: op1.position + op1.length };
      const range2 = { start: op2.position, end: op2.position + op2.length };
      
      if (this.rangesOverlap(range1, range2)) {
        return {
          hasConflict: true,
          reason: 'overlapping_replacements',
          range1,
          range2,
          contentSimilarity: this.calculateContentSimilarity(op1.content, op2.content)
        };
      }
    }

    // Check for conflicting insertions/deletions
    if ((op1.type === 'text_insert' || op1.type === 'text_delete') &&
        (op2.type === 'text_insert' || op2.type === 'text_delete')) {
      
      const samePosition = op1.position.line === op2.position.line && 
                          op1.position.column === op2.position.column;
      
      if (samePosition) {
        return {
          hasConflict: true,
          reason: 'same_position_operations',
          operation1: op1.type,
          operation2: op2.type
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Detect version-based conflicts
   */
  detectVersionConflict(op1, op2) {
    if (!op1.version || !op2.version) {
      return { hasConflict: false };
    }

    const versionDiff = Math.abs(op1.version - op2.version);
    
    if (versionDiff > this.thresholds.versionDriftThreshold) {
      return {
        hasConflict: true,
        reason: 'version_drift',
        versionDiff,
        operation1Version: op1.version,
        operation2Version: op2.version
      };
    }

    return { hasConflict: false };
  }

  /**
   * Calculate conflict severity
   */
  calculateConflictSeverity(op1, op2) {
    let severity = 0;

    // Time proximity increases severity
    const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
    severity += Math.max(0, 1 - (timeDiff / this.thresholds.simultaneousEditWindow));

    // Position proximity increases severity
    if (op1.position && op2.position) {
      const lineDiff = Math.abs(op1.position.line - op2.position.line);
      const columnDiff = Math.abs(op1.position.column - op2.position.column);
      severity += Math.max(0, 1 - (lineDiff / 10) - (columnDiff / 50));
    }

    // Content size affects severity
    const content1Length = op1.content ? op1.content.length : 0;
    const content2Length = op2.content ? op2.content.length : 0;
    severity += Math.min(content1Length + content2Length, 100) / 200;

    return Math.min(severity, 1); // Cap at 1.0
  }

  // ==================== CONFLICT RESOLUTION ====================

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(conflictId, strategy = 'default', options = {}) {
    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    const startTime = Date.now();
    
    try {
      console.log(`🔧 Resolving conflict ${conflictId} using strategy: ${strategy}`);

      let resolution;
      
      if (this.algorithms[strategy]) {
        resolution = await this.algorithms[strategy](conflict, options);
      } else if (this.resolutionStrategies.has(strategy)) {
        const strategyHandler = this.resolutionStrategies.get(strategy);
        resolution = await strategyHandler(conflict, options);
      } else {
        throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      // Apply resolution
      const result = await this.applyResolution(conflict, resolution);
      
      // Update metrics
      const resolutionTime = Date.now() - startTime;
      this.updateMetrics(resolution.automatic ? 'automatic' : 'manual', resolutionTime);
      
      // Store in history
      this.conflictHistory.push({
        conflictId,
        strategy,
        resolution,
        result,
        resolutionTime,
        timestamp: Date.now()
      });

      // Remove from active conflicts
      this.activeConflicts.delete(conflictId);
      
      this.emit('conflict_resolved', {
        conflictId,
        strategy,
        resolution,
        result,
        resolutionTime
      });

      return result;

    } catch (error) {
      console.error(`Failed to resolve conflict ${conflictId}:`, error);
      this.emit('conflict_resolution_failed', { conflictId, strategy, error });
      throw error;
    }
  }

  /**
   * Create conflict record
   */
  createConflict(operation1, operation2, conflictDetails) {
    const conflictId = this.generateConflictId();
    
    const conflict = {
      id: conflictId,
      operation1,
      operation2,
      details: conflictDetails,
      createdAt: Date.now(),
      status: 'pending',
      filePath: operation1.filePath,
      participants: [operation1.userId, operation2.userId].filter((id, index, arr) => arr.indexOf(id) === index)
    };

    this.activeConflicts.set(conflictId, conflict);
    this.metrics.conflictsDetected++;
    
    this.emit('conflict_detected', conflict);
    
    return conflictId;
  }

  // ==================== RESOLUTION ALGORITHMS ====================

  /**
   * Last writer wins resolution
   */
  async lastWriterWinsResolution(conflict, options) {
    const { operation1, operation2 } = conflict;
    
    const winner = operation1.timestamp > operation2.timestamp ? operation1 : operation2;
    const loser = winner === operation1 ? operation2 : operation1;
    
    return {
      type: 'last_writer_wins',
      winner: winner.userId,
      loser: loser.userId,
      operation: winner,
      discardedOperation: loser,
      automatic: true,
      confidence: 0.8
    };
  }

  /**
   * First writer wins resolution
   */
  async firstWriterWinsResolution(conflict, options) {
    const { operation1, operation2 } = conflict;
    
    const winner = operation1.timestamp < operation2.timestamp ? operation1 : operation2;
    const loser = winner === operation1 ? operation2 : operation1;
    
    return {
      type: 'first_writer_wins',
      winner: winner.userId,
      loser: loser.userId,
      operation: winner,
      discardedOperation: loser,
      automatic: true,
      confidence: 0.7
    };
  }

  /**
   * Character-level diff resolution
   */
  async characterDiffResolution(conflict, options) {
    const { operation1, operation2 } = conflict;
    
    if (operation1.type !== 'text_replace' || operation2.type !== 'text_replace') {
      // Fallback to last writer wins
      return this.lastWriterWinsResolution(conflict, options);
    }

    // Perform three-way merge
    const originalContent = options.originalContent || '';
    const content1 = operation1.content;
    const content2 = operation2.content;
    
    const mergedContent = this.performThreeWayMerge(originalContent, content1, content2);
    
    return {
      type: 'character_diff',
      mergedContent,
      originalContent,
      contributions: {
        [operation1.userId]: content1,
        [operation2.userId]: content2
      },
      automatic: true,
      confidence: 0.9
    };
  }

  /**
   * Semantic merge resolution
   */
  async semanticMergeResolution(conflict, options) {
    const { operation1, operation2 } = conflict;
    
    // Analyze semantic context
    const semanticAnalysis = this.analyzeSemanticContext(operation1, operation2);
    
    if (semanticAnalysis.canMerge) {
      const mergedOperation = this.createSemanticMerge(operation1, operation2, semanticAnalysis);
      
      return {
        type: 'semantic_merge',
        mergedOperation,
        semanticAnalysis,
        automatic: true,
        confidence: semanticAnalysis.confidence
      };
    } else {
      // Fallback to user choice
      return this.userChoiceResolution(conflict, options);
    }
  }

  /**
   * User choice resolution (manual)
   */
  async userChoiceResolution(conflict, options) {
    return {
      type: 'user_choice',
      requiresUserInput: true,
      options: [
        { id: 'keep_op1', label: 'Keep first change', operation: conflict.operation1 },
        { id: 'keep_op2', label: 'Keep second change', operation: conflict.operation2 },
        { id: 'keep_both', label: 'Keep both changes' },
        { id: 'discard_both', label: 'Discard both changes' },
        { id: 'manual_edit', label: 'Edit manually' }
      ],
      automatic: false,
      confidence: 1.0
    };
  }

  /**
   * Automatic merge resolution
   */
  async automaticMergeResolution(conflict, options) {
    const { operation1, operation2 } = conflict;
    
    // Determine best merge strategy based on conflict type
    switch (conflict.details.type) {
      case 'position':
        return this.resolveBySpatialSeparation(conflict);
      case 'content':
        return this.characterDiffResolution(conflict, options);
      case 'version':
        return this.resolveByVersionMerge(conflict);
      default:
        return this.lastWriterWinsResolution(conflict, options);
    }
  }

  // ==================== RESOLUTION STRATEGIES ====================

  /**
   * Register custom resolution strategy
   */
  registerStrategy(name, handler) {
    this.resolutionStrategies.set(name, handler);
  }

  /**
   * Default resolution strategy
   */
  async defaultResolutionStrategy(conflict, options) {
    const severity = conflict.details.severity || 0;
    
    if (severity < 0.3) {
      return this.automaticMergeResolution(conflict, options);
    } else if (severity < 0.7) {
      return this.characterDiffResolution(conflict, options);
    } else {
      return this.userChoiceResolution(conflict, options);
    }
  }

  /**
   * Collaborative resolution strategy
   */
  async collaborativeResolutionStrategy(conflict, options) {
    // Always try to merge changes when possible
    try {
      const mergeResult = await this.semanticMergeResolution(conflict, options);
      if (mergeResult.confidence > 0.6) {
        return mergeResult;
      }
    } catch (error) {
      console.warn('Semantic merge failed, falling back:', error);
    }
    
    return this.characterDiffResolution(conflict, options);
  }

  /**
   * Conservative resolution strategy
   */
  async conservativeResolutionStrategy(conflict, options) {
    // Prefer first writer wins to avoid data loss
    return this.firstWriterWinsResolution(conflict, options);
  }

  /**
   * Aggressive resolution strategy
   */
  async aggressiveResolutionStrategy(conflict, options) {
    // Always try automatic resolution
    return this.automaticMergeResolution(conflict, options);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Perform three-way merge
   */
  performThreeWayMerge(original, content1, content2) {
    // Simple character-level merge
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const originalLines = original.split('\n');
    
    const merged = [];
    const maxLines = Math.max(lines1.length, lines2.length, originalLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      const originalLine = originalLines[i] || '';
      
      if (line1 === line2) {
        merged.push(line1);
      } else if (line1 === originalLine) {
        merged.push(line2);
      } else if (line2 === originalLine) {
        merged.push(line1);
      } else {
        // Conflict - combine both
        merged.push(`${line1} ${line2}`);
      }
    }
    
    return merged.join('\n');
  }

  /**
   * Analyze semantic context
   */
  analyzeSemanticContext(op1, op2) {
    // Simple semantic analysis
    const content1 = op1.content || '';
    const content2 = op2.content || '';
    
    // Check if operations are complementary
    const isComplementary = this.areOperationsComplementary(op1, op2);
    
    return {
      canMerge: isComplementary || content1.trim() !== content2.trim(),
      confidence: isComplementary ? 0.9 : 0.5,
      isComplementary,
      contentSimilarity: this.calculateContentSimilarity(content1, content2)
    };
  }

  /**
   * Check if operations are complementary
   */
  areOperationsComplementary(op1, op2) {
    // Insert + format
    if (op1.type === 'text_insert' && op2.type === 'text_format') {
      return true;
    }
    
    // Different lines, similar indentation
    if (op1.position && op2.position && op1.position.line !== op2.position.line) {
      const indent1 = (op1.content || '').match(/^\s*/)[0].length;
      const indent2 = (op2.content || '').match(/^\s*/)[0].length;
      return Math.abs(indent1 - indent2) <= 2;
    }
    
    return false;
  }

  /**
   * Calculate content similarity
   */
  calculateContentSimilarity(content1, content2) {
    if (!content1 || !content2) return 0;
    
    const set1 = new Set(content1.toLowerCase().split(''));
    const set2 = new Set(content2.toLowerCase().split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Check if ranges overlap
   */
  rangesOverlap(range1, range2) {
    return range1.start < range2.end && range2.start < range1.end;
  }

  /**
   * Apply resolution to conflict
   */
  async applyResolution(conflict, resolution) {
    console.log('🔧 Applying conflict resolution:', resolution.type);
    
    try {
      switch (resolution.type) {
        case 'last_writer_wins':
        case 'first_writer_wins':
          return await this.applyWinnerOperation(resolution.operation);
          
        case 'character_diff':
          return await this.applyMergedContent(conflict.filePath, resolution.mergedContent);
          
        case 'semantic_merge':
          return await this.applyMergedOperation(resolution.mergedOperation);
          
        case 'user_choice':
          // Emit event for UI to handle
          this.emit('user_choice_required', { conflict, resolution });
          return { success: true, requiresUserInput: true };
          
        default:
          throw new Error(`Unknown resolution type: ${resolution.type}`);
      }
    } catch (error) {
      console.error('Failed to apply resolution:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply winner operation
   */
  async applyWinnerOperation(operation) {
    // This would integrate with the storage manager
    console.log('Applying winner operation:', operation.type);
    return { success: true, operation };
  }

  /**
   * Apply merged content
   */
  async applyMergedContent(filePath, content) {
    // This would integrate with the storage manager
    console.log('Applying merged content to:', filePath);
    return { success: true, content };
  }

  /**
   * Apply merged operation
   */
  async applyMergedOperation(operation) {
    // This would integrate with the storage manager
    console.log('Applying merged operation:', operation.type);
    return { success: true, operation };
  }

  /**
   * Generate unique conflict ID
   */
  generateConflictId() {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update metrics
   */
  updateMetrics(type, resolutionTime) {
    this.metrics.conflictsResolved++;
    
    if (type === 'automatic') {
      this.metrics.automaticResolutions++;
    } else {
      this.metrics.manualResolutions++;
    }
    
    const currentAvg = this.metrics.resolutionTime;
    const count = this.metrics.conflictsResolved;
    this.metrics.resolutionTime = (currentAvg * (count - 1) + resolutionTime) / count;
  }

  /**
   * Get conflict resolution statistics
   */
  getStats() {
    return {
      ...this.metrics,
      activeConflicts: this.activeConflicts.size,
      conflictHistory: this.conflictHistory.length,
      averageResolutionTime: this.metrics.resolutionTime,
      automaticResolutionRate: this.metrics.automaticResolutions / Math.max(this.metrics.conflictsResolved, 1)
    };
  }

  /**
   * Get active conflicts
   */
  getActiveConflicts() {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Clear conflict history
   */
  clearHistory() {
    this.conflictHistory = [];
  }

  /**
   * Shutdown conflict resolution engine
   */
  shutdown() {
    this.activeConflicts.clear();
    this.conflictHistory = [];
    this.pendingOperations.clear();
    this.documentVersions.clear();
    
    this.emit('shutdown');
  }
}

export default ConflictResolutionEngine;
