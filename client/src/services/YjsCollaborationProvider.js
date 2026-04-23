/**
 * Y.js Collaboration Provider
 * 
 * Bridges the YjsFileSystem with the existing CodeCollab session architecture.
 * Provides real-time collaborative editing with conflict-free replicated data types (CRDTs).
 */

import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { yjsFileSystem } from './YjsFileSystem';
import { io } from 'socket.io-client';
import { getServerUrl } from '../utils/serverConfig';

export class YjsCollaborationProvider {
  constructor() {
    this.ydoc = new Y.Doc();
    this.socket = null;
    this.currentSession = null;
    this.currentRoom = null;
    this.user = null;
    this.token = null;
    
    // Y.js Maps for different data types
    this.files = this.ydoc.getMap('files'); // Y.Map<string, Y.Text>
    this.metadata = this.ydoc.getMap('metadata'); // File metadata
    this.cursors = this.ydoc.getMap('cursors'); // User cursors and selections
    
    // Monaco editor bindings
    this.editorBindings = new Map(); // filePath -> MonacoBinding
    
    // Event listeners
    this.listeners = new Set();
    
    // Setup Y.js document listeners
    this.setupYjsListeners();
    
    console.log('🔧 YjsCollaborationProvider initialized');
  }

  /**
   * Initialize with user and session context
   */
  async initialize(user, token, sessionId) {
    this.user = user;
    this.token = token;
    this.currentSession = sessionId;
    
    if (sessionId) {
      this.currentRoom = `yjs_${sessionId}`;
      await this.connectToSession(sessionId);
    }
    
    console.log('✅ YjsCollaborationProvider initialized for user:', user?.name || 'anonymous');
  }

  /**
   * Connect to collaboration session
   */
  async connectToSession(sessionId) {
    if (!this.socket) {
      await this.connectSocket();
    }
    
    this.currentSession = sessionId;
    this.currentRoom = `yjs_${sessionId}`;
    
    // Join the Y.js room
    this.socket.emit('join_yjs_room', { roomId: this.currentRoom });
    
    console.log('🔗 Connected to Y.js collaboration session:', sessionId);
  }

  /**
   * Setup socket connection with Y.js event handlers
   */
  async connectSocket() {
    if (this.socket) return;

    this.socket = io(getServerUrl(), {
      auth: {
        token: this.token
      }
    });

    this.socket.on('connect', () => {
      console.log('🔌 Y.js collaboration socket connected');
      this.notifyListeners('socket_connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Y.js collaboration socket disconnected:', reason);
      this.notifyListeners('socket_disconnected', { reason });
    });

    // Y.js synchronization events
    this.socket.on('yjs_update', ({ roomId, update, origin }) => {
      if (roomId === this.currentRoom && Array.isArray(update)) {
        const updateArray = new Uint8Array(update);
        Y.applyUpdate(this.ydoc, updateArray, 'socket');
        console.log(`📝 Applied Y.js update from ${origin || 'server'}`);
      }
    });

    this.socket.on('yjs_initial_state', ({ roomId, state }) => {
      if (roomId === this.currentRoom && Array.isArray(state)) {
        const stateArray = new Uint8Array(state);
        Y.applyUpdate(this.ydoc, stateArray, 'server');
        console.log(`📋 Applied initial Y.js state for room: ${roomId}`);
        this.notifyListeners('initial_sync_complete', { roomId });
      }
    });

    this.socket.on('yjs_error', ({ error }) => {
      console.error('❌ Y.js error from server:', error);
      this.notifyListeners('collaboration_error', { error });
    });

    // Setup Y.js update broadcasting
    this.ydoc.on('update', (update, origin, doc, tr) => {
      if (origin !== 'socket' && origin !== 'server' && this.currentRoom && this.socket?.connected) {
        this.socket.emit('yjs_update', {
          roomId: this.currentRoom,
          update: Array.from(update),
          origin: 'client'
        });
      }
    });
  }

  /**
   * Create or get a collaborative text document for a file
   */
  getOrCreateFile(filePath, initialContent = '') {
    let ytext = this.files.get(filePath);
    
    if (!ytext) {
      ytext = new Y.Text(initialContent);
      this.files.set(filePath, ytext);
      
      // Set metadata
      this.metadata.set(filePath, {
        name: this.getFileName(filePath),
        path: filePath,
        type: 'file',
        size: initialContent.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: this.user?.uid || this.user?.id || 'unknown'
      });
      
      console.log('📄 Created Y.js collaborative file:', filePath);
      this.notifyListeners('file_created', { path: filePath, content: initialContent });
    }
    
    return ytext;
  }

  /**
   * Bind Monaco editor to a Y.js text document
   */
  bindMonacoEditor(editor, filePath, initialContent = '') {
    // Clean up existing binding for this file
    if (this.editorBindings.has(filePath)) {
      this.editorBindings.get(filePath).destroy();
    }

    // Get or create Y.Text document
    const ytext = this.getOrCreateFile(filePath, initialContent);
    
    // Create Monaco binding for real-time collaboration
    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor])
      // Note: Awareness provider would go here for cursor collaboration
    );

    this.editorBindings.set(filePath, binding);
    
    // Listen for text changes to update metadata
    ytext.observe((event, transaction) => {
      const content = ytext.toString();
      const metadata = this.metadata.get(filePath);
      
      if (metadata) {
        this.metadata.set(filePath, {
          ...metadata,
          size: content.length,
          updatedAt: new Date().toISOString(),
          updatedBy: this.user?.uid || this.user?.id || 'unknown'
        });
      }
      
      // Notify listeners of content change
      this.notifyListeners('file_content_changed', { 
        path: filePath, 
        content, 
        length: content.length 
      });
    });

    console.log('🎯 Monaco editor bound to Y.js document:', filePath);
    return binding;
  }

  /**
   * Unbind Monaco editor from Y.js document
   */
  unbindMonacoEditor(filePath) {
    const binding = this.editorBindings.get(filePath);
    if (binding) {
      binding.destroy();
      this.editorBindings.delete(filePath);
      console.log('🔓 Monaco editor unbound from Y.js document:', filePath);
    }
  }

  /**
   * Get file content as string
   */
  getFileContent(filePath) {
    const ytext = this.files.get(filePath);
    return ytext ? ytext.toString() : '';
  }

  /**
   * Set file content (replaces all content)
   */
  setFileContent(filePath, content) {
    const ytext = this.getOrCreateFile(filePath, content);
    
    // Replace content atomically
    const currentLength = ytext.length;
    if (currentLength > 0) {
      ytext.delete(0, currentLength);
    }
    if (content.length > 0) {
      ytext.insert(0, content);
    }
    
    console.log('📝 File content updated via Y.js:', filePath);
  }

  /**
   * Get all files in the collaboration session
   */
  getAllFiles() {
    const files = [];
    
    this.files.forEach((ytext, path) => {
      const metadata = this.metadata.get(path) || {};
      files.push({
        path,
        name: this.getFileName(path),
        content: ytext.toString(),
        size: ytext.length,
        ...metadata
      });
    });
    
    return files;
  }

  /**
   * Delete a file from the collaboration session
   */
  deleteFile(filePath) {
    // Unbind Monaco editor if it exists
    this.unbindMonacoEditor(filePath);
    
    // Remove from Y.js maps
    this.files.delete(filePath);
    this.metadata.delete(filePath);
    
    console.log('🗑️ File deleted from Y.js collaboration:', filePath);
    this.notifyListeners('file_deleted', { path: filePath });
  }

  /**
   * Update user cursor position for collaborative editing
   */
  updateCursor(filePath, position, selection) {
    if (!this.user) return;
    
    const cursorData = {
      userId: this.user.uid || this.user.id,
      userName: this.user.name || this.user.email,
      filePath,
      position,
      selection,
      timestamp: Date.now(),
      color: this.getUserColor()
    };
    
    this.cursors.set(`${this.user.uid || this.user.id}_${filePath}`, cursorData);
    
    // Broadcast cursor update
    if (this.socket?.connected) {
      this.socket.emit('cursor_update', {
        sessionId: this.currentSession,
        ...cursorData
      });
    }
  }

  /**
   * Get user color for cursor display
   */
  getUserColor() {
    if (!this.user) return '#007ACC';
    
    const colors = [
      '#007ACC', // VS Code blue
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Light blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DDA0DD', // Plum
      '#98D8C8', // Mint
    ];
    
    const userString = this.user.email || this.user.name || this.user.id || 'user';
    const index = userString.charCodeAt(0) % colors.length;
    return colors[index];
  }

  /**
   * Setup Y.js document listeners
   */
  setupYjsListeners() {
    this.files.observe(() => {
      console.log('📁 Y.js files map changed');
      this.notifyListeners('files_changed', this.getAllFiles());
    });
    
    this.metadata.observe(() => {
      console.log('🏷️ Y.js metadata map changed');
      this.notifyListeners('metadata_changed', this.getAllFiles());
    });

    this.cursors.observe(() => {
      const cursors = [];
      this.cursors.forEach((cursor, key) => {
        cursors.push(cursor);
      });
      this.notifyListeners('cursors_changed', cursors);
    });
  }

  /**
   * Add event listener
   */
  addEventListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback({ event, data, timestamp: Date.now() });
      } catch (error) {
        console.error('YjsCollaborationProvider listener error:', error);
      }
    });
  }

  /**
   * Get file name from path
   */
  getFileName(path) {
    return path.split('/').pop() || path;
  }

  /**
   * Leave current collaboration session
   */
  leaveSession() {
    if (this.socket && this.currentRoom) {
      this.socket.emit('leave_yjs_room', { roomId: this.currentRoom });
    }
    
    // Clean up editor bindings
    for (const [filePath, binding] of this.editorBindings) {
      binding.destroy();
    }
    this.editorBindings.clear();
    
    this.currentSession = null;
    this.currentRoom = null;
    
    console.log('👋 Left Y.js collaboration session');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.leaveSession();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.ydoc.destroy();
    this.listeners.clear();
    
    console.log('🧹 YjsCollaborationProvider destroyed');
  }
}

// Export singleton instance
export const yjsCollaborationProvider = new YjsCollaborationProvider();
export default yjsCollaborationProvider;