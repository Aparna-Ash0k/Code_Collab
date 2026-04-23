/**
 * Session Workspace Service
 * 
 * Handles automatic workspace state storage and retrieval for collaboration sessions.
 * When a new user joins a session, they automatically receive the complete workspace state.
 */

const admin = require('firebase-admin');

class SessionWorkspaceService {
  constructor() {
    this.db = admin?.firestore ? admin.firestore() : null;
    this.sessionWorkspacesCollection = 'session_workspaces';
    
    // In-memory fallback if Firebase is not available
    this.memoryStore = new Map();
    
    console.log(`🗃️ SessionWorkspaceService initialized (Firebase: ${this.db ? 'enabled' : 'disabled'})`);
  }

  /**
   * Store complete workspace state for a session
   */
  async storeSessionWorkspace(sessionId, workspaceData, userId) {
    try {
      const workspaceRecord = {
        sessionId,
        ownerId: userId,
        files: workspaceData.files || {},
        folders: workspaceData.folders || [],
        fileTree: workspaceData.fileTree || {},
        activeFiles: workspaceData.activeFiles || {},
        version: Date.now(),
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        lastModifiedBy: userId,
        metadata: {
          totalFiles: Object.keys(workspaceData.files || {}).length,
          totalSize: this.calculateWorkspaceSize(workspaceData.files),
          fileTypes: this.analyzeFileTypes(workspaceData.files)
        },
        status: 'active'
      };

      if (this.db) {
        // Store in Firebase
        const docRef = this.db.collection(this.sessionWorkspacesCollection).doc(sessionId);
        await docRef.set(workspaceRecord);
        console.log(`💾 Session workspace stored in Firebase for session: ${sessionId}`);
      } else {
        // Store in memory as fallback
        this.memoryStore.set(sessionId, workspaceRecord);
        console.log(`💾 Session workspace stored in memory for session: ${sessionId}`);
      }

      return true;
    } catch (error) {
      console.error(`❌ Failed to store session workspace for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Load complete workspace state for a session
   */
  async loadSessionWorkspace(sessionId) {
    try {
      let workspaceData = null;

      if (this.db) {
        // Load from Firebase
        const docRef = this.db.collection(this.sessionWorkspacesCollection).doc(sessionId);
        const doc = await docRef.get();
        
        if (doc.exists) {
          workspaceData = doc.data();
          console.log(`📖 Session workspace loaded from Firebase for session: ${sessionId}`);
        }
      } else {
        // Load from memory
        workspaceData = this.memoryStore.get(sessionId);
        if (workspaceData) {
          console.log(`📖 Session workspace loaded from memory for session: ${sessionId}`);
        }
      }

      if (!workspaceData) {
        console.log(`⚠️ No stored workspace found for session: ${sessionId}`);
        return null;
      }

      return {
        sessionId: workspaceData.sessionId,
        ownerId: workspaceData.ownerId,
        files: workspaceData.files || {},
        folders: workspaceData.folders || [],
        fileTree: workspaceData.fileTree || {},
        activeFiles: workspaceData.activeFiles || {},
        version: workspaceData.version,
        createdAt: workspaceData.createdAt,
        lastModified: workspaceData.lastModified,
        metadata: workspaceData.metadata
      };
    } catch (error) {
      console.error(`❌ Failed to load session workspace for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Update workspace state for a session
   */
  async updateSessionWorkspace(sessionId, updateData, userId) {
    try {
      let currentWorkspace = null;

      if (this.db) {
        // Get current workspace from Firebase
        const docRef = this.db.collection(this.sessionWorkspacesCollection).doc(sessionId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
          console.log(`⚠️ No existing workspace to update for session: ${sessionId}`);
          return false;
        }
        
        currentWorkspace = doc.data();
      } else {
        // Get from memory
        currentWorkspace = this.memoryStore.get(sessionId);
        if (!currentWorkspace) {
          console.log(`⚠️ No existing workspace to update for session: ${sessionId}`);
          return false;
        }
      }

      // Apply updates to workspace data
      const updatedWorkspace = this.applyWorkspaceUpdate(currentWorkspace, updateData, userId);

      if (this.db) {
        // Update in Firebase
        const docRef = this.db.collection(this.sessionWorkspacesCollection).doc(sessionId);
        await docRef.update({
          files: updatedWorkspace.files,
          folders: updatedWorkspace.folders,
          fileTree: updatedWorkspace.fileTree,
          activeFiles: updatedWorkspace.activeFiles,
          version: updatedWorkspace.version,
          lastModified: updatedWorkspace.lastModified,
          lastModifiedBy: userId,
          metadata: updatedWorkspace.metadata
        });
      } else {
        // Update in memory
        this.memoryStore.set(sessionId, updatedWorkspace);
      }

      console.log(`🔄 Session workspace updated for session: ${sessionId} by ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update session workspace for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Delete workspace when session ends
   */
  async deleteSessionWorkspace(sessionId) {
    try {
      if (this.db) {
        const docRef = this.db.collection(this.sessionWorkspacesCollection).doc(sessionId);
        await docRef.delete();
        console.log(`🗑️ Session workspace deleted from Firebase for session: ${sessionId}`);
      } else {
        this.memoryStore.delete(sessionId);
        console.log(`🗑️ Session workspace deleted from memory for session: ${sessionId}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete session workspace for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Apply workspace updates (file/folder operations)
   */
  applyWorkspaceUpdate(currentWorkspace, updateData, userId) {
    const updatedFiles = { ...currentWorkspace.files };
    const updatedFolders = [...(currentWorkspace.folders || [])];
    const updatedFileTree = { ...currentWorkspace.fileTree };
    const updatedActiveFiles = { ...currentWorkspace.activeFiles };

    switch (updateData.type) {
      case 'file_created':
      case 'file_updated':
        updatedFiles[updateData.path] = {
          content: updateData.content,
          type: updateData.fileType || this.getFileType(updateData.path),
          size: (updateData.content || '').length,
          lastModified: new Date().toISOString(),
          modifiedBy: userId
        };
        
        // Update file tree
        this.updateFileTree(updatedFileTree, updateData.path, 'file');
        break;

      case 'file_deleted':
        delete updatedFiles[updateData.path];
        this.removeFromFileTree(updatedFileTree, updateData.path);
        delete updatedActiveFiles[updateData.path];
        break;

      case 'folder_created':
        if (!updatedFolders.includes(updateData.path)) {
          updatedFolders.push(updateData.path);
        }
        this.updateFileTree(updatedFileTree, updateData.path, 'folder');
        break;

      case 'folder_deleted':
        const folderIndex = updatedFolders.indexOf(updateData.path);
        if (folderIndex > -1) {
          updatedFolders.splice(folderIndex, 1);
        }
        
        // Remove all files in the folder
        Object.keys(updatedFiles).forEach(filePath => {
          if (filePath.startsWith(updateData.path + '/')) {
            delete updatedFiles[filePath];
            delete updatedActiveFiles[filePath];
          }
        });
        
        this.removeFromFileTree(updatedFileTree, updateData.path);
        break;

      case 'file_renamed':
        if (updatedFiles[updateData.oldPath]) {
          updatedFiles[updateData.newPath] = updatedFiles[updateData.oldPath];
          delete updatedFiles[updateData.oldPath];
          
          if (updatedActiveFiles[updateData.oldPath]) {
            updatedActiveFiles[updateData.newPath] = updatedActiveFiles[updateData.oldPath];
            delete updatedActiveFiles[updateData.oldPath];
          }
          
          this.removeFromFileTree(updatedFileTree, updateData.oldPath);
          this.updateFileTree(updatedFileTree, updateData.newPath, 'file');
        }
        break;
    }

    return {
      ...currentWorkspace,
      files: updatedFiles,
      folders: updatedFolders,
      fileTree: updatedFileTree,
      activeFiles: updatedActiveFiles,
      version: Date.now(),
      lastModified: new Date().toISOString(),
      metadata: {
        totalFiles: Object.keys(updatedFiles).length,
        totalSize: this.calculateWorkspaceSize(updatedFiles),
        fileTypes: this.analyzeFileTypes(updatedFiles)
      }
    };
  }

  /**
   * Update file tree structure
   */
  updateFileTree(fileTree, path, type) {
    const parts = path.split('/').filter(p => p.length > 0);
    let current = fileTree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { type: 'folder', children: {} };
      }
      current = current[part].children;
    }

    const filename = parts[parts.length - 1];
    if (type === 'file') {
      current[filename] = { type: 'file' };
    } else {
      current[filename] = { type: 'folder', children: {} };
    }
  }

  /**
   * Remove from file tree
   */
  removeFromFileTree(fileTree, path) {
    const parts = path.split('/').filter(p => p.length > 0);
    let current = fileTree;
    const pathParts = [];

    // Navigate to parent
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      pathParts.push({ node: current, key: part });
      if (!current[part] || !current[part].children) return;
      current = current[part].children;
    }

    // Remove the item
    const filename = parts[parts.length - 1];
    delete current[filename];

    // Clean up empty parent folders
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const { node, key } = pathParts[i];
      if (node[key] && node[key].children && Object.keys(node[key].children).length === 0) {
        delete node[key];
      } else {
        break;
      }
    }
  }

  /**
   * Calculate total workspace size
   */
  calculateWorkspaceSize(files) {
    return Object.values(files || {}).reduce((total, file) => {
      return total + (file.size || (file.content || '').length);
    }, 0);
  }

  /**
   * Analyze file types in workspace
   */
  analyzeFileTypes(files) {
    const typeCount = {};
    Object.keys(files || {}).forEach(path => {
      const type = this.getFileType(path);
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    return typeCount;
  }

  /**
   * Get file type from path
   */
  getFileType(path) {
    const extension = path.split('.').pop()?.toLowerCase();
    const typeMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      html: 'html',
      css: 'css',
      scss: 'sass',
      less: 'less',
      json: 'json',
      md: 'markdown',
      txt: 'text'
    };
    return typeMap[extension] || 'text';
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.db !== null || this.memoryStore !== null;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      backend: this.db ? 'firebase' : 'memory',
      ready: this.isReady(),
      sessionCount: this.db ? 'unknown' : this.memoryStore.size
    };
  }
}

module.exports = SessionWorkspaceService;