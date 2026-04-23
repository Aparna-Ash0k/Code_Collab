/**
 * YjsFileDocument - Wrapper for individual file documents with Monaco editor integration
 * Integrates Yjs CRDT with Monaco editor via y-monaco for collaborative editing
 */

import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { WebsocketProvider } from 'y-websocket';
import { getWebSocketUrl } from '../utils/serverConfig';

export class YjsFileDocument {
  constructor(fileId, initialContent = '', options = {}) {
    this.fileId = fileId;
    this.options = {
      roomPrefix: 'codecollab-',
      websocketUrl: options.websocketUrl || getWebSocketUrl(),
      ...options
    };

    // Create Yjs document
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('content');
    
    // Monaco binding
    this.monacoBinding = null;
    this.editor = null;
    
    // Awareness for cursors and selections
    this.awareness = null;
    this.provider = null;
    
    // Event listeners
    this.listeners = {
      contentChanged: new Set(),
      cursorsChanged: new Set(),
      connectionChanged: new Set(),
      conflictDetected: new Set()
    };

    // Initialize with content if provided
    if (initialContent) {
      this.ytext.insert(0, initialContent);
    }

    // Set up change listeners
    this.setupListeners();
  }

  /**
   * Bind to Monaco editor instance
   */
  bindToMonaco(editor, options = {}) {
    if (this.monacoBinding) {
      this.unbindFromMonaco();
    }

    this.editor = editor;
    
    try {
      // Create Monaco binding with Yjs
      this.monacoBinding = new MonacoBinding(
        this.ytext,
        editor.getModel(),
        new Set([editor]),
        this.awareness
      );

      console.log(`✅ Monaco binding created for file: ${this.fileId}`);
      
      // Set up Monaco-specific listeners
      this.setupMonacoListeners();
      
      return true;
    } catch (error) {
      console.error('Failed to bind Monaco editor:', error);
      return false;
    }
  }

  /**
   * Unbind from Monaco editor
   */
  unbindFromMonaco() {
    if (this.monacoBinding) {
      this.monacoBinding.destroy();
      this.monacoBinding = null;
      this.editor = null;
      console.log(`🔌 Monaco binding destroyed for file: ${this.fileId}`);
    }
  }

  /**
   * Connect to WebSocket provider for real-time sync
   */
  connect(websocketUrl = this.options.websocketUrl) {
    try {
      const roomName = this.options.roomPrefix + this.fileId;
      
      // Create WebSocket provider
      this.provider = new WebsocketProvider(websocketUrl, roomName, this.ydoc);
      this.awareness = this.provider.awareness;

      // Set up provider listeners
      this.provider.on('status', (event) => {
        console.log(`🔗 WebSocket status for ${this.fileId}:`, event.status);
        this.emit('connectionChanged', {
          fileId: this.fileId,
          status: event.status,
          connected: event.status === 'connected'
        });
      });

      this.provider.on('connection-close', (event) => {
        console.log(`❌ WebSocket connection closed for ${this.fileId}:`, event);
        this.emit('connectionChanged', {
          fileId: this.fileId,
          status: 'disconnected',
          connected: false
        });
      });

      // Set up awareness listeners for cursors
      this.awareness.on('change', () => {
        this.emit('cursorsChanged', {
          fileId: this.fileId,
          users: Array.from(this.awareness.getStates().entries())
        });
      });

      console.log(`🌐 Connected to WebSocket for file: ${this.fileId}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket provider
   */
  disconnect() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
      this.awareness = null;
      console.log(`🔌 Disconnected from WebSocket for file: ${this.fileId}`);
    }
  }

  /**
   * Set up Yjs document listeners
   */
  setupListeners() {
    // Listen for content changes
    this.ytext.observe((event, transaction) => {
      // Only emit if change was not from local Monaco editor
      if (!transaction.local) {
        this.emit('contentChanged', {
          fileId: this.fileId,
          content: this.ytext.toString(),
          delta: event.changes.delta,
          origin: transaction.origin
        });
      }
    });

    // Listen for document updates (for conflict detection)
    this.ydoc.on('update', (update, origin) => {
      if (origin !== this.ydoc.clientID) {
        // Update from remote user
        this.detectAndHandleConflicts(update, origin);
      }
    });
  }

  /**
   * Set up Monaco editor specific listeners
   */
  setupMonacoListeners() {
    if (!this.editor) return;

    // Listen for cursor position changes
    this.editor.onDidChangeCursorPosition((e) => {
      if (this.awareness) {
        this.awareness.setLocalStateField('cursor', {
          position: e.position,
          selection: this.editor.getSelection(),
          timestamp: Date.now()
        });
      }
    });

    // Listen for selection changes
    this.editor.onDidChangeCursorSelection((e) => {
      if (this.awareness) {
        this.awareness.setLocalStateField('selection', {
          selection: e.selection,
          secondarySelections: e.secondarySelections,
          timestamp: Date.now()
        });
      }
    });

    // Listen for focus/blur events
    this.editor.onDidFocusEditorWidget(() => {
      if (this.awareness) {
        this.awareness.setLocalStateField('focused', true);
      }
    });

    this.editor.onDidBlurEditorWidget(() => {
      if (this.awareness) {
        this.awareness.setLocalStateField('focused', false);
      }
    });
  }

  /**
   * Detect and handle editing conflicts
   */
  detectAndHandleConflicts(update, origin) {
    // Simple conflict detection - check if multiple users are editing same line
    const currentContent = this.ytext.toString();
    const lines = currentContent.split('\n');
    
    // Get cursor positions from awareness
    if (this.awareness) {
      const states = this.awareness.getStates();
      const activeCursors = Array.from(states.entries())
        .filter(([clientId, state]) => 
          clientId !== this.ydoc.clientID && 
          state.cursor && 
          Date.now() - state.cursor.timestamp < 5000 // Active within 5 seconds
        )
        .map(([clientId, state]) => ({
          clientId,
          line: state.cursor.position.lineNumber,
          column: state.cursor.position.column
        }));

      // Check if current user's cursor is near any other active cursor
      if (this.editor && activeCursors.length > 0) {
        const currentPosition = this.editor.getPosition();
        const conflicts = activeCursors.filter(cursor => 
          Math.abs(cursor.line - currentPosition.lineNumber) <= 1
        );

        if (conflicts.length > 0) {
          this.emit('conflictDetected', {
            fileId: this.fileId,
            line: currentPosition.lineNumber,
            conflicts,
            severity: 'warning'
          });
        }
      }
    }
  }

  /**
   * Get file content as string
   */
  getContent() {
    return this.ytext.toString();
  }

  /**
   * Set file content (replaces all content)
   */
  setContent(content) {
    this.ydoc.transact(() => {
      this.ytext.delete(0, this.ytext.length);
      this.ytext.insert(0, content);
    });
  }

  /**
   * Insert text at specific position
   */
  insertText(index, text) {
    this.ytext.insert(index, text);
  }

  /**
   * Delete text from specific range
   */
  deleteText(index, length) {
    this.ytext.delete(index, length);
  }

  /**
   * Get document statistics
   */
  getStatistics() {
    return {
      fileId: this.fileId,
      length: this.ytext.length,
      lines: this.ytext.toString().split('\n').length,
      connected: this.provider?.connected || false,
      collaborators: this.awareness ? this.awareness.getStates().size - 1 : 0,
      clientId: this.ydoc.clientID
    };
  }

  /**
   * Create snapshot of document state
   */
  createSnapshot() {
    return {
      fileId: this.fileId,
      content: this.ytext.toString(),
      state: Y.encodeStateAsUpdate(this.ydoc),
      timestamp: Date.now(),
      clientId: this.ydoc.clientID
    };
  }

  /**
   * Load document from snapshot
   */
  loadFromSnapshot(snapshot) {
    try {
      if (snapshot.state) {
        Y.applyUpdate(this.ydoc, snapshot.state);
      } else if (snapshot.content) {
        this.setContent(snapshot.content);
      }
      
      console.log(`📷 Snapshot loaded for file: ${this.fileId}`);
      return true;
    } catch (error) {
      console.error('Failed to load snapshot:', error);
      return false;
    }
  }

  /**
   * Set user awareness information
   */
  setAwarenessInfo(userInfo) {
    if (this.awareness) {
      this.awareness.setLocalStateField('user', {
        name: userInfo.name,
        color: userInfo.color,
        colorLight: userInfo.colorLight,
        avatar: userInfo.avatar,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get all connected users
   */
  getConnectedUsers() {
    if (!this.awareness) return [];

    return Array.from(this.awareness.getStates().entries())
      .map(([clientId, state]) => ({
        clientId,
        user: state.user,
        cursor: state.cursor,
        selection: state.selection,
        focused: state.focused,
        isLocal: clientId === this.ydoc.clientID
      }))
      .filter(user => user.user && user.user.name);
  }

  /**
   * Force sync with server
   */
  forceSync() {
    if (this.provider) {
      // Disconnect and reconnect to force sync
      const wasConnected = this.provider.connected;
      this.provider.disconnect();
      
      setTimeout(() => {
        this.provider.connect();
      }, 100);
      
      return wasConnected;
    }
    return false;
  }

  /**
   * Check if document has unsaved changes
   */
  hasUnsavedChanges() {
    // This would need to be implemented based on last save timestamp
    // For now, return false as auto-save handles persistence
    return false;
  }

  /**
   * Event system
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in YjsFileDocument event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup and destroy document
   */
  destroy() {
    // Unbind from Monaco
    this.unbindFromMonaco();
    
    // Disconnect from WebSocket
    this.disconnect();
    
    // Clear listeners
    Object.values(this.listeners).forEach(listenerSet => listenerSet.clear());
    
    // Destroy Yjs document
    this.ydoc.destroy();
    
    console.log(`🗑️ YjsFileDocument destroyed for file: ${this.fileId}`);
  }
}

/**
 * Factory function to create YjsFileDocument instances
 */
export function createYjsFileDocument(fileId, initialContent = '', options = {}) {
  return new YjsFileDocument(fileId, initialContent, options);
}

/**
 * Utility function to generate user colors for awareness
 */
export function generateUserColor(userId) {
  const colors = [
    { color: '#FF6B6B', colorLight: '#FFE3E3' },
    { color: '#4ECDC4', colorLight: '#E3F9F7' },
    { color: '#45B7D1', colorLight: '#E3F3FB' },
    { color: '#96CEB4', colorLight: '#F0F9F4' },
    { color: '#FECA57', colorLight: '#FFF8E3' },
    { color: '#FF9FF3', colorLight: '#FFEBFE' },
    { color: '#54A0FF', colorLight: '#E8F2FF' },
    { color: '#5F27CD', colorLight: '#F0E8FF' }
  ];

  // Generate consistent color based on user ID
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  return colors[Math.abs(hash) % colors.length];
}

export default YjsFileDocument;
