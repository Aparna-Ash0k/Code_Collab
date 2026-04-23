/**
 * Real-Time Code Synchronization Service
 * 
 * Handles real-time code synchronization using Socket.IO websockets.
 * Integrates with Monaco Editor and FileSystemContext for seamless collaboration.
 */

import { EventEmitter } from 'events';

class RealTimeCodeSync extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.isInitialized = false;
    this.openFiles = new Map(); // filePath -> { content, version, editor }
    this.pendingChanges = new Map(); // filePath -> changeQueue
    this.changeDebounceTimers = new Map();
    this.isReceivingUpdate = false;
  }

  /**
   * Initialize the service with Socket.IO connection and room info
   */
  initialize(socket, roomId, userId, userName) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.isInitialized = true;

    this.setupSocketListeners();
    console.log('🔗 RealTimeCodeSync initialized for room:', roomId);
  }

  /**
   * Setup Socket.IO event listeners for code synchronization
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Listen for code changes from other users
    this.socket.on('code_changed', (data) => {
      if (data.userId === this.userId) return; // Ignore own changes
      
      console.log('📝 Received code change:', data.filePath, 'from', data.userName);
      this.handleIncomingCodeChange(data);
    });

    // Listen for cursor updates from other users
    this.socket.on('cursor_update', (data) => {
      if (data.userId === this.userId) return; // Ignore own cursor
      
      console.log('🎯 Received cursor update:', data.filePath, 'from', data.userName);
      this.emit('remote_cursor_update', data);
    });

    // Listen for file operations
    this.socket.on('file_changed', (data) => {
      if (data.userId === this.userId) return; // Ignore own file operations
      
      console.log('📁 Received file operation:', data.action, data.fileMeta?.path);
      this.emit('remote_file_operation', data);
    });

    console.log('🎧 Socket.IO listeners set up for real-time code sync');
  }

  /**
   * Register a Monaco editor for real-time synchronization
   */
  registerEditor(filePath, editor, initialContent = '') {
    if (!this.isInitialized) {
      console.warn('⚠️ RealTimeCodeSync not initialized');
      return;
    }

    const fileData = {
      content: initialContent,
      version: 0,
      editor: editor,
      lastUpdate: Date.now()
    };

    this.openFiles.set(filePath, fileData);

    // Listen for content changes in the editor
    const contentChangeListener = editor.onDidChangeModelContent((e) => {
      if (this.isReceivingUpdate) return; // Don't broadcast when receiving updates
      
      this.handleLocalCodeChange(filePath, editor, e);
    });

    // Listen for cursor changes in the editor
    const cursorChangeListener = editor.onDidChangeCursorPosition((e) => {
      this.handleLocalCursorChange(filePath, editor, e);
    });

    // Store listeners for cleanup
    fileData.listeners = [contentChangeListener, cursorChangeListener];

    console.log('📝 Editor registered for real-time sync:', filePath);
    
    // Request initial file content from room if empty
    if (!initialContent.trim()) {
      this.requestFileContent(filePath);
    }
  }

  /**
   * Unregister an editor from real-time synchronization
   */
  unregisterEditor(filePath) {
    const fileData = this.openFiles.get(filePath);
    if (fileData) {
      // Dispose listeners
      if (fileData.listeners) {
        fileData.listeners.forEach(listener => listener.dispose());
      }
      
      this.openFiles.delete(filePath);
      
      // Clear pending changes and timers
      if (this.pendingChanges.has(filePath)) {
        this.pendingChanges.delete(filePath);
      }
      
      if (this.changeDebounceTimers.has(filePath)) {
        clearTimeout(this.changeDebounceTimers.get(filePath));
        this.changeDebounceTimers.delete(filePath);
      }
      
      console.log('📝 Editor unregistered from real-time sync:', filePath);
    }
  }

  /**
   * Handle local code changes and broadcast to other users
   */
  handleLocalCodeChange(filePath, editor, changeEvent) {
    const fileData = this.openFiles.get(filePath);
    if (!fileData) return;

    const newContent = editor.getValue();
    fileData.content = newContent;
    fileData.version++;
    fileData.lastUpdate = Date.now();

    // Debounce rapid changes to avoid spamming
    if (this.changeDebounceTimers.has(filePath)) {
      clearTimeout(this.changeDebounceTimers.get(filePath));
    }

    this.changeDebounceTimers.set(filePath, setTimeout(() => {
      this.broadcastCodeChange(filePath, newContent, changeEvent.changes);
    }, 300)); // 300ms debounce
  }

  /**
   * Handle local cursor changes and broadcast to other users
   */
  handleLocalCursorChange(filePath, editor, cursorEvent) {
    const position = cursorEvent.position;
    const selection = editor.getSelection();

    this.broadcastCursorUpdate(filePath, position, selection);
  }

  /**
   * Broadcast code changes to other users in the room
   */
  broadcastCodeChange(filePath, content, changes) {
    if (!this.socket || !this.roomId) return;

    const changeData = {
      roomId: this.roomId,
      filePath: filePath,
      content: content,
      changes: changes.map(change => ({
        range: change.range,
        text: change.text,
        rangeLength: change.rangeLength
      })),
      version: this.openFiles.get(filePath)?.version || 0,
      timestamp: Date.now(),
      userId: this.userId,
      userName: this.userName
    };

    this.socket.emit('code_change', changeData);
    console.log('📤 Broadcasted code change for:', filePath);
  }

  /**
   * Broadcast cursor updates to other users in the room
   */
  broadcastCursorUpdate(filePath, position, selection) {
    if (!this.socket || !this.roomId) return;

    const cursorData = {
      roomId: this.roomId,
      filePath: filePath,
      position: {
        lineNumber: position.lineNumber,
        column: position.column
      },
      selection: selection ? {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn
      } : null,
      timestamp: Date.now(),
      userId: this.userId,
      userName: this.userName
    };

    this.socket.emit('cursor_update', cursorData);
  }

  /**
   * Handle incoming code changes from other users
   */
  handleIncomingCodeChange(data) {
    const { filePath, content, changes, version, userId, userName } = data;
    const fileData = this.openFiles.get(filePath);
    
    if (!fileData || !fileData.editor) {
      console.log('📝 File not open locally, storing change:', filePath);
      // Store the change for when the file is opened
      this.emit('file_content_changed', { filePath, content, userId, userName });
      return;
    }

    // Prevent infinite loops by setting a flag
    this.isReceivingUpdate = true;

    try {
      const editor = fileData.editor;
      const model = editor.getModel();
      
      // Apply changes incrementally if possible, otherwise replace all content
      if (changes && changes.length > 0 && version > fileData.version) {
        // Apply incremental changes
        this.applyIncrementalChanges(editor, changes);
      } else {
        // Replace entire content
        const currentContent = editor.getValue();
        if (currentContent !== content) {
          editor.setValue(content);
        }
      }

      // Update file data
      fileData.content = content;
      fileData.version = Math.max(fileData.version, version);
      fileData.lastUpdate = Date.now();

      this.emit('remote_code_changed', { filePath, content, userId, userName });

    } catch (error) {
      console.error('❌ Failed to apply incoming code change:', error);
    } finally {
      // Reset the flag after a short delay to allow Monaco to process the change
      setTimeout(() => {
        this.isReceivingUpdate = false;
      }, 100);
    }
  }

  /**
   * Apply incremental changes to Monaco editor
   */
  applyIncrementalChanges(editor, changes) {
    const model = editor.getModel();
    
    // Apply changes in reverse order to maintain positions
    const sortedChanges = changes.sort((a, b) => {
      const aStart = model.getOffsetAt({ lineNumber: a.range.startLineNumber, column: a.range.startColumn });
      const bStart = model.getOffsetAt({ lineNumber: b.range.startLineNumber, column: b.range.startColumn });
      return bStart - aStart; // Reverse order
    });

    editor.executeEdits('remote-user', sortedChanges.map(change => ({
      range: change.range,
      text: change.text
    })));
  }

  /**
   * Request file content from the room (for initial load)
   */
  requestFileContent(filePath) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('request_file_content', {
      roomId: this.roomId,
      filePath: filePath,
      userId: this.userId
    });

    console.log('📥 Requested file content for:', filePath);
  }

  /**
   * Broadcast file creation to other users
   */
  broadcastFileCreate(filePath, content = '') {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('file_create', {
      fileMeta: {
        path: filePath,
        content: content,
        type: 'file',
        createdBy: this.userId,
        createdAt: Date.now()
      }
    });

    console.log('📤 Broadcasted file creation:', filePath);
  }

  /**
   * Broadcast file update to other users
   */
  broadcastFileUpdate(filePath, content) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('file_update', {
      fileMeta: {
        path: filePath,
        content: content,
        type: 'file',
        updatedBy: this.userId,
        updatedAt: Date.now()
      }
    });

    console.log('📤 Broadcasted file update:', filePath);
  }

  /**
   * Broadcast file deletion to other users
   */
  broadcastFileDelete(filePath) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('file_delete', {
      fileMeta: {
        path: filePath,
        type: 'file',
        deletedBy: this.userId,
        deletedAt: Date.now()
      }
    });

    console.log('📤 Broadcasted file deletion:', filePath);

    // Clean up local tracking
    this.unregisterEditor(filePath);
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      roomId: this.roomId,
      userId: this.userId,
      openFiles: this.openFiles.size,
      pendingChanges: this.pendingChanges.size
    };
  }

  /**
   * Cleanup the service
   */
  destroy() {
    // Unregister all editors
    for (const filePath of this.openFiles.keys()) {
      this.unregisterEditor(filePath);
    }

    // Clear all timers
    for (const timer of this.changeDebounceTimers.values()) {
      clearTimeout(timer);
    }

    // Remove socket listeners
    if (this.socket) {
      this.socket.off('code_changed');
      this.socket.off('cursor_update');
      this.socket.off('file_changed');
    }

    // Clear state
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.isInitialized = false;
    this.openFiles.clear();
    this.pendingChanges.clear();
    this.changeDebounceTimers.clear();

    console.log('🗑️ RealTimeCodeSync destroyed');
  }
}

// Export singleton instance
export const realTimeCodeSync = new RealTimeCodeSync();
export default RealTimeCodeSync;