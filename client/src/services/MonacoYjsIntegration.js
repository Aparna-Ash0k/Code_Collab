/**
 * Monaco Editor Yjs Integration
 * 
 * Provides real-time collaborative editing using Yjs CRDT with Monaco Editor.
 * Handles operational transforms, cursor awareness, and conflict resolution.
 */

import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

class MonacoYjsIntegration {
  constructor() {
    this.bindings = new Map(); // filePath -> MonacoBinding
    this.editors = new Map();  // filePath -> monaco editor instance
    this.workspaceSync = null;
    this.awareness = null;
    
    // Track user info for cursors
    this.userInfo = null;
  }

  /**
   * Initialize with workspace sync and user info
   */
  initialize(workspaceSync, userInfo) {
    this.workspaceSync = workspaceSync;
    this.userInfo = userInfo;
    
    // Get awareness from Yjs document
    this.awareness = workspaceSync.getYjsDocument().getAwarenessMap();
    
    console.log('🔗 Monaco Yjs integration initialized');
  }

  /**
   * Connect Monaco editor to Yjs for a specific file
   */
  connectEditor(filePath, monacoEditor) {
    if (!this.workspaceSync) {
      console.warn('⚠️ WorkspaceSync not initialized');
      return null;
    }

    try {
      // Get or create Yjs text for this file
      let yText = this.workspaceSync.getYjsText(filePath);
      if (!yText) {
        const currentContent = monacoEditor.getValue();
        yText = this.workspaceSync.createYjsText(filePath, currentContent);
      }

      // Create Monaco binding
      const binding = new MonacoBinding(
        yText,
        monacoEditor.getModel(),
        new Set([monacoEditor]),
        this.awareness
      );

      // Store references
      this.bindings.set(filePath, binding);
      this.editors.set(filePath, monacoEditor);

      // Setup awareness info for cursors
      if (this.awareness && this.userInfo) {
        this.awareness.setLocalStateField('user', {
          name: this.userInfo.name || 'User',
          color: this.generateUserColor(this.userInfo.id || this.userInfo.uid),
          colorLight: this.generateUserColor(this.userInfo.id || this.userInfo.uid, true)
        });
      }

      console.log(`🔗 Monaco editor connected to Yjs for file: ${filePath}`);

      // Return disconnect function
      return () => {
        this.disconnectEditor(filePath);
      };

    } catch (error) {
      console.error('❌ Failed to connect Monaco editor to Yjs:', error);
      return null;
    }
  }

  /**
   * Disconnect Monaco editor from Yjs
   */
  disconnectEditor(filePath) {
    try {
      const binding = this.bindings.get(filePath);
      if (binding) {
        binding.destroy();
        this.bindings.delete(filePath);
      }

      this.editors.delete(filePath);
      console.log(`🔌 Monaco editor disconnected from Yjs for file: ${filePath}`);

    } catch (error) {
      console.error('❌ Failed to disconnect Monaco editor from Yjs:', error);
    }
  }

  /**
   * Update file content via Yjs (programmatic changes)
   */
  updateFileContent(filePath, content) {
    try {
      const yText = this.workspaceSync?.getYjsText(filePath);
      if (yText) {
        // Replace all content
        yText.delete(0, yText.length);
        yText.insert(0, content);
        console.log(`📝 Updated file content via Yjs: ${filePath}`);
      }
    } catch (error) {
      console.error('❌ Failed to update file content via Yjs:', error);
    }
  }

  /**
   * Get current file content from Yjs
   */
  getFileContent(filePath) {
    try {
      const yText = this.workspaceSync?.getYjsText(filePath);
      return yText ? yText.toString() : null;
    } catch (error) {
      console.error('❌ Failed to get file content from Yjs:', error);
      return null;
    }
  }

  /**
   * Check if file is connected to Yjs
   */
  isFileConnected(filePath) {
    return this.bindings.has(filePath);
  }

  /**
   * Get all connected files
   */
  getConnectedFiles() {
    return Array.from(this.bindings.keys());
  }

  /**
   * Generate consistent color for user
   */
  generateUserColor(userId, light = false) {
    const colors = [
      light ? '#FF6B6B33' : '#FF6B6B', // Red
      light ? '#4ECDC433' : '#4ECDC4', // Teal
      light ? '#45B7D133' : '#45B7D1', // Blue
      light ? '#FFA07A33' : '#FFA07A', // Light Salmon
      light ? '#98D8C833' : '#98D8C8', // Mint
      light ? '#F7DC6F33' : '#F7DC6F', // Yellow
      light ? '#BB8FCE33' : '#BB8FCE', // Purple
      light ? '#85C1E933' : '#85C1E9', // Light Blue
      light ? '#F8C47133' : '#F8C471', // Orange
      light ? '#82E0AA33' : '#82E0AA'  // Green
    ];

    // Generate hash from userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Set user awareness info
   */
  setUserInfo(userInfo) {
    this.userInfo = userInfo;
    
    if (this.awareness && userInfo) {
      this.awareness.setLocalStateField('user', {
        name: userInfo.name || 'User',
        color: this.generateUserColor(userInfo.id || userInfo.uid),
        colorLight: this.generateUserColor(userInfo.id || userInfo.uid, true)
      });
    }
  }

  /**
   * Get active collaborators for a file
   */
  getFileCollaborators(filePath) {
    if (!this.awareness) return [];

    const collaborators = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (state.user && clientId !== this.awareness.clientID) {
        collaborators.push({
          clientId,
          name: state.user.name,
          color: state.user.color,
          cursor: state.cursor || null,
          selection: state.selection || null
        });
      }
    });

    return collaborators;
  }

  /**
   * Handle Monaco editor cursor changes
   */
  handleCursorChange(filePath, editor) {
    if (!this.awareness) return;

    const selection = editor.getSelection();
    const position = editor.getPosition();

    if (selection && position) {
      this.awareness.setLocalStateField('cursor', {
        filePath,
        line: position.lineNumber,
        column: position.column,
        timestamp: Date.now()
      });

      if (selection.startLineNumber !== selection.endLineNumber || 
          selection.startColumn !== selection.endColumn) {
        this.awareness.setLocalStateField('selection', {
          filePath,
          startLine: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLine: selection.endLineNumber,
          endColumn: selection.endColumn,
          timestamp: Date.now()
        });
      } else {
        this.awareness.setLocalStateField('selection', null);
      }
    }
  }

  /**
   * Get Yjs document statistics
   */
  getStats() {
    return {
      connectedFiles: this.bindings.size,
      activeEditors: this.editors.size,
      collaboratorCount: this.awareness ? this.awareness.getStates().size - 1 : 0,
      yjsDocSize: this.workspaceSync ? this.workspaceSync.getYjsDocument().store.clients.size : 0
    };
  }

  /**
   * Cleanup all connections
   */
  destroy() {
    // Disconnect all editors
    for (const filePath of this.bindings.keys()) {
      this.disconnectEditor(filePath);
    }

    // Clear awareness
    if (this.awareness) {
      this.awareness.destroy();
    }

    this.bindings.clear();
    this.editors.clear();
    this.workspaceSync = null;
    this.awareness = null;
    this.userInfo = null;

    console.log('🗑️ Monaco Yjs integration destroyed');
  }
}

// Export singleton instance
export const monacoYjsIntegration = new MonacoYjsIntegration();
export default MonacoYjsIntegration;