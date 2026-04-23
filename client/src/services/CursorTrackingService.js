/**
 * Cursor Tracking Service
 * Real-time cursor position and selection synchronization for collaborative editing
 */

import { EventEmitter } from 'events';

class CursorTrackingService extends EventEmitter {
  constructor(collaborationSync = null) {
    super();
    
    this.collaborationSync = collaborationSync;
    
    // Cursor state
    this.localCursor = null;
    this.remoteCursors = new Map(); // userId -> cursor data
    this.selections = new Map(); // userId -> selection data
    this.cursorColors = new Map(); // userId -> color
    
    // Cursor visibility and animation
    this.visibleCursors = new Set();
    this.animatingCursors = new Set();
    this.cursorTimeouts = new Map();
    
    // Configuration
    this.config = {
      cursorTimeout: 5000, // Hide cursor after 5s of inactivity
      updateThrottle: 100, // Throttle updates to 100ms
      maxCursors: 10, // Maximum visible cursors
      fadeOutDuration: 500, // Fade out animation duration
      colors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ]
    };
    
    // Throttled update function
    this.throttledUpdate = this.throttle(this.sendCursorUpdate.bind(this), this.config.updateThrottle);
    
    this.initializeCursorTracking();
  }

  /**
   * Initialize cursor tracking
   */
  initializeCursorTracking() {
    // Only initialize if collaboration sync is available
    if (this.collaborationSync) {
      // Listen to collaboration sync events
      this.collaborationSync.on('cursor_updated', (data) => {
        this.handleRemoteCursorUpdate(data);
      });

      this.collaborationSync.on('user_presence', (data) => {
        this.handleUserPresenceChange(data);
      });

      this.collaborationSync.on('disconnected', () => {
        this.clearAllCursors();
      });

      console.log('👆 Cursor tracking service initialized with collaboration sync');
    } else {
      console.log('👆 Cursor tracking service initialized in standalone mode');
    }
  }

  // ==================== LOCAL CURSOR MANAGEMENT ====================

  /**
   * Update local cursor position
   */
  updateLocalCursor(filePath, position, selection = null, editorElement = null) {
    const cursorData = {
      filePath,
      position,
      selection,
      timestamp: Date.now(),
      editorElement
    };

    this.localCursor = cursorData;
    this.throttledUpdate(cursorData);
    
    this.emit('local_cursor_updated', cursorData);
  }

  /**
   * Send cursor update to other collaborators
   */
  sendCursorUpdate(cursorData) {
    if (!this.collaborationSync || !this.collaborationSync.isConnected) return;

    // Don't send if position hasn't changed significantly
    if (this.isDuplicateUpdate(cursorData)) return;

    const updateData = {
      filePath: cursorData.filePath,
      position: cursorData.position,
      selection: cursorData.selection,
      timestamp: cursorData.timestamp
    };

    this.collaborationSync.updateCursor(
      updateData.filePath,
      updateData.position,
      updateData.selection
    );

    console.log('📍 Sent cursor update:', updateData.filePath, updateData.position);
  }

  /**
   * Check if cursor update is duplicate
   */
  isDuplicateUpdate(newCursor) {
    if (!this.localCursor) return false;

    const lastCursor = this.localCursor;
    
    return (
      lastCursor.filePath === newCursor.filePath &&
      lastCursor.position.line === newCursor.position.line &&
      lastCursor.position.column === newCursor.position.column &&
      JSON.stringify(lastCursor.selection) === JSON.stringify(newCursor.selection)
    );
  }

  // ==================== REMOTE CURSOR MANAGEMENT ====================

  /**
   * Handle remote cursor updates
   */
  handleRemoteCursorUpdate(data) {
    const { userId, filePath, position, selection } = data;

    // Assign color if not assigned
    if (!this.cursorColors.has(userId)) {
      this.assignCursorColor(userId);
    }

    // Update cursor data
    this.remoteCursors.set(userId, {
      userId,
      filePath,
      position,
      selection,
      timestamp: Date.now(),
      color: this.cursorColors.get(userId)
    });

    // Update selection if provided
    if (selection) {
      this.selections.set(userId, {
        userId,
        filePath,
        selection,
        timestamp: Date.now(),
        color: this.cursorColors.get(userId)
      });
    }

    // Show cursor
    this.showCursor(userId);
    this.resetCursorTimeout(userId);

    this.emit('remote_cursor_updated', {
      userId,
      filePath,
      position,
      selection,
      color: this.cursorColors.get(userId)
    });
  }

  /**
   * Handle user presence changes
   */
  handleUserPresenceChange(data) {
    const { userId, status } = data;

    if (status === 'disconnected' || status === 'offline') {
      this.removeCursor(userId);
    } else if (status === 'connected' || status === 'online') {
      this.showCursor(userId);
    }
  }

  /**
   * Assign color to user cursor
   */
  assignCursorColor(userId) {
    // Use hash of userId to consistently assign colors
    const hash = this.hashString(userId);
    const colorIndex = hash % this.config.colors.length;
    const color = this.config.colors[colorIndex];
    
    this.cursorColors.set(userId, color);
    return color;
  }

  /**
   * Hash string for consistent color assignment
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // ==================== CURSOR VISIBILITY ====================

  /**
   * Show cursor for user
   */
  showCursor(userId) {
    this.visibleCursors.add(userId);
    this.emit('cursor_show', { userId });
  }

  /**
   * Hide cursor for user
   */
  hideCursor(userId) {
    this.visibleCursors.delete(userId);
    this.emit('cursor_hide', { userId });
  }

  /**
   * Remove cursor completely
   */
  removeCursor(userId) {
    this.remoteCursors.delete(userId);
    this.selections.delete(userId);
    this.visibleCursors.delete(userId);
    this.clearCursorTimeout(userId);
    
    this.emit('cursor_removed', { userId });
  }

  /**
   * Clear all cursors
   */
  clearAllCursors() {
    this.remoteCursors.clear();
    this.selections.clear();
    this.visibleCursors.clear();
    this.cursorTimeouts.forEach(timeout => clearTimeout(timeout));
    this.cursorTimeouts.clear();
    
    this.emit('all_cursors_cleared');
  }

  /**
   * Reset cursor timeout
   */
  resetCursorTimeout(userId) {
    this.clearCursorTimeout(userId);
    
    const timeout = setTimeout(() => {
      this.hideCursor(userId);
    }, this.config.cursorTimeout);
    
    this.cursorTimeouts.set(userId, timeout);
  }

  /**
   * Clear cursor timeout
   */
  clearCursorTimeout(userId) {
    const timeout = this.cursorTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.cursorTimeouts.delete(userId);
    }
  }

  // ==================== CURSOR RENDERING HELPERS ====================

  /**
   * Get cursor data for rendering
   */
  getCursorData(userId) {
    return this.remoteCursors.get(userId);
  }

  /**
   * Get all visible cursors for a file
   */
  getVisibleCursorsForFile(filePath) {
    const cursors = [];
    
    for (const userId of this.visibleCursors) {
      const cursor = this.remoteCursors.get(userId);
      if (cursor && cursor.filePath === filePath) {
        cursors.push(cursor);
      }
    }
    
    return cursors;
  }

  /**
   * Get selection data for a user
   */
  getSelectionData(userId) {
    return this.selections.get(userId);
  }

  /**
   * Get all visible selections for a file
   */
  getVisibleSelectionsForFile(filePath) {
    const selections = [];
    
    for (const userId of this.visibleCursors) {
      const selection = this.selections.get(userId);
      if (selection && selection.filePath === filePath) {
        selections.push(selection);
      }
    }
    
    return selections;
  }

  /**
   * Convert position to screen coordinates
   */
  positionToCoordinates(position, editorElement) {
    if (!editorElement) return null;

    try {
      // This would need to be implemented based on the specific editor
      // For Monaco Editor, CodeMirror, or custom editor
      const { line, column } = position;
      
      // Get line element
      const lineElement = editorElement.querySelector(`[data-line="${line}"]`);
      if (!lineElement) return null;

      // Calculate character position
      const lineRect = lineElement.getBoundingClientRect();
      const charWidth = this.getCharacterWidth(editorElement);
      
      return {
        x: lineRect.left + (column * charWidth),
        y: lineRect.top,
        height: lineRect.height
      };
    } catch (error) {
      console.warn('Failed to convert position to coordinates:', error);
      return null;
    }
  }

  /**
   * Get character width for editor
   */
  getCharacterWidth(editorElement) {
    // Cache character width calculation
    if (editorElement._charWidth) {
      return editorElement._charWidth;
    }

    try {
      // Create a temporary character to measure
      const span = document.createElement('span');
      span.textContent = 'W';
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.font = window.getComputedStyle(editorElement).font;
      
      document.body.appendChild(span);
      const width = span.offsetWidth;
      document.body.removeChild(span);
      
      editorElement._charWidth = width;
      return width;
    } catch (error) {
      console.warn('Failed to calculate character width:', error);
      return 8; // Fallback width
    }
  }

  // ==================== CURSOR ANIMATION ====================

  /**
   * Animate cursor movement
   */
  animateCursor(userId, fromPosition, toPosition, duration = 200) {
    if (!this.visibleCursors.has(userId)) return;

    this.animatingCursors.add(userId);
    
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate position
      const interpolatedPosition = {
        line: Math.round(fromPosition.line + (toPosition.line - fromPosition.line) * eased),
        column: Math.round(fromPosition.column + (toPosition.column - fromPosition.column) * eased)
      };
      
      this.emit('cursor_animate', {
        userId,
        position: interpolatedPosition,
        progress: eased
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.animatingCursors.delete(userId);
        this.emit('cursor_animation_complete', { userId });
      }
    };
    
    requestAnimationFrame(animate);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Throttle function calls
   */
  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function(...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  /**
   * Get cursor statistics
   */
  getStats() {
    return {
      remoteCursors: this.remoteCursors.size,
      visibleCursors: this.visibleCursors.size,
      selections: this.selections.size,
      animatingCursors: this.animatingCursors.size,
      assignedColors: this.cursorColors.size,
      activeTimeouts: this.cursorTimeouts.size
    };
  }

  /**
   * Get all active users with cursors
   */
  getActiveUsers() {
    return Array.from(this.remoteCursors.keys());
  }

  /**
   * Check if user has visible cursor
   */
  isUserCursorVisible(userId) {
    return this.visibleCursors.has(userId);
  }

  /**
   * Set collaboration sync service
   */
  setCollaborationSync(collaborationSync) {
    this.collaborationSync = collaborationSync;
    
    if (collaborationSync) {
      // Listen to collaboration sync events
      this.collaborationSync.on('cursor_updated', (data) => {
        this.handleRemoteCursorUpdate(data);
      });

      this.collaborationSync.on('user_presence', (data) => {
        this.handleUserPresenceChange(data);
      });

      this.collaborationSync.on('disconnected', () => {
        this.clearAllCursors();
      });

      console.log('👆 Cursor tracking connected to collaboration sync');
    }
  }

  /**
   * Get user color
   */
  getUserColor(userId) {
    return this.cursorColors.get(userId);
  }

  /**
   * Configure cursor tracking
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Shutdown cursor tracking
   */
  shutdown() {
    this.clearAllCursors();
    this.cursorColors.clear();
    this.localCursor = null;
    
    this.emit('shutdown');
  }
}

export default CursorTrackingService;
