/**
 * Database Service for Workspace Storage
 * 
 * Handles persistent storage of collaboration workspaces using Firebase
 */

const admin = require('firebase-admin');

class WorkspaceDatabaseService {
  constructor() {
    this.db = admin.firestore();
    this.workspacesCollection = 'collaboration_workspaces';
    this.archiveCollection = 'archived_workspaces';
  }

  /**
   * Store complete workspace for a room
   */
  async storeWorkspace(roomId, workspaceData) {
    try {
      const docRef = this.db.collection(this.workspacesCollection).doc(roomId);
      
      await docRef.set({
        ...workspaceData,
        storedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      });

      console.log(`💾 Workspace stored in database for room: ${roomId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to store workspace for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Load workspace from database
   */
  async loadWorkspace(roomId) {
    try {
      const docRef = this.db.collection(this.workspacesCollection).doc(roomId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error(`Workspace not found for room: ${roomId}`);
      }

      const data = doc.data();
      console.log(`📖 Workspace loaded from database for room: ${roomId}`);
      
      return {
        roomId: data.roomId,
        ownerId: data.ownerId,
        version: data.version,
        createdAt: data.createdAt,
        lastModified: data.lastModified,
        files: data.files || [],
        folders: data.folders || [],
        metadata: data.metadata || {}
      };

    } catch (error) {
      console.error(`❌ Failed to load workspace for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Update workspace in database
   */
  async updateWorkspace(roomId, updateData) {
    try {
      const docRef = this.db.collection(this.workspacesCollection).doc(roomId);
      
      // Get current workspace
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new Error(`Workspace not found for room: ${roomId}`);
      }

      const currentData = doc.data();
      
      // Apply update based on type
      let updatedFiles = currentData.files || [];
      let updatedFolders = currentData.folders || [];

      switch (updateData.updateType) {
        case 'file_created':
          updatedFiles.push({
            path: updateData.filePath,
            name: updateData.fileName,
            content: updateData.content || '',
            type: updateData.fileType || 'text',
            size: (updateData.content || '').length,
            createdAt: updateData.lastModified,
            createdBy: updateData.lastModifiedBy
          });
          break;

        case 'file_updated':
          updatedFiles = updatedFiles.map(file => 
            file.path === updateData.filePath
              ? {
                  ...file,
                  content: updateData.content,
                  size: updateData.content.length,
                  modifiedAt: updateData.lastModified,
                  modifiedBy: updateData.lastModifiedBy
                }
              : file
          );
          break;

        case 'file_deleted':
          updatedFiles = updatedFiles.filter(file => file.path !== updateData.filePath);
          break;

        case 'folder_created':
          if (!updatedFolders.includes(updateData.folderPath)) {
            updatedFolders.push(updateData.folderPath);
          }
          break;

        case 'folder_deleted':
          updatedFolders = updatedFolders.filter(folder => folder !== updateData.folderPath);
          // Remove files in deleted folder
          updatedFiles = updatedFiles.filter(file => 
            !file.path.startsWith(updateData.folderPath + '/')
          );
          break;
      }

      // Calculate new metadata
      const newMetadata = {
        totalFiles: updatedFiles.length,
        totalSize: updatedFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        fileTypes: this.analyzeFileTypes(updatedFiles)
      };

      // Update document
      await docRef.update({
        files: updatedFiles,
        folders: updatedFolders,
        metadata: newMetadata,
        version: updateData.version,
        lastModified: updateData.lastModified,
        lastModifiedBy: updateData.lastModifiedBy,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`🔄 Workspace updated in database for room: ${roomId} (${updateData.updateType})`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to update workspace for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Archive workspace when room is closed
   */
  async archiveWorkspace(roomId) {
    try {
      // Get current workspace
      const docRef = this.db.collection(this.workspacesCollection).doc(roomId);
      const doc = await docRef.get();

      if (doc.exists) {
        const data = doc.data();
        
        // Move to archive collection
        await this.db.collection(this.archiveCollection).doc(roomId).set({
          ...data,
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'archived'
        });

        // Delete from active collection
        await docRef.delete();

        console.log(`🗄️ Workspace archived for room: ${roomId}`);
      }

      return true;

    } catch (error) {
      console.error(`❌ Failed to archive workspace for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Get workspace metadata only (for quick lookups)
   */
  async getWorkspaceMetadata(roomId) {
    try {
      const docRef = this.db.collection(this.workspacesCollection).doc(roomId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return {
        roomId: data.roomId,
        ownerId: data.ownerId,
        version: data.version,
        createdAt: data.createdAt,
        lastModified: data.lastModified,
        metadata: data.metadata
      };

    } catch (error) {
      console.error(`❌ Failed to get workspace metadata for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * List all workspaces for a user
   */
  async getUserWorkspaces(userId) {
    try {
      const query = this.db.collection(this.workspacesCollection)
        .where('ownerId', '==', userId)
        .orderBy('lastModified', 'desc')
        .limit(50);

      const snapshot = await query.get();
      const workspaces = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        workspaces.push({
          roomId: doc.id,
          ownerId: data.ownerId,
          createdAt: data.createdAt,
          lastModified: data.lastModified,
          metadata: data.metadata,
          status: 'active'
        });
      });

      return workspaces;

    } catch (error) {
      console.error(`❌ Failed to get workspaces for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old workspaces (older than 30 days)
   */
  async cleanupOldWorkspaces() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const query = this.db.collection(this.workspacesCollection)
        .where('lastModified', '<', thirtyDaysAgo.toISOString())
        .limit(100);

      const snapshot = await query.get();
      const batch = this.db.batch();

      let cleanupCount = 0;
      snapshot.forEach(doc => {
        // Move to archive instead of deleting
        const archiveRef = this.db.collection(this.archiveCollection).doc(doc.id);
        const data = doc.data();
        
        batch.set(archiveRef, {
          ...data,
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'auto_archived'
        });
        
        batch.delete(doc.ref);
        cleanupCount++;
      });

      if (cleanupCount > 0) {
        await batch.commit();
        console.log(`🧹 Cleaned up ${cleanupCount} old workspaces`);
      }

      return cleanupCount;

    } catch (error) {
      console.error('❌ Failed to cleanup old workspaces:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      // Get active workspaces count
      const activeSnapshot = await this.db.collection(this.workspacesCollection).get();
      const activeCount = activeSnapshot.size;

      // Get archived workspaces count
      const archivedSnapshot = await this.db.collection(this.archiveCollection).get();
      const archivedCount = archivedSnapshot.size;

      // Calculate total storage used (approximate)
      let totalFiles = 0;
      let totalSize = 0;

      activeSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.metadata) {
          totalFiles += data.metadata.totalFiles || 0;
          totalSize += data.metadata.totalSize || 0;
        }
      });

      return {
        activeWorkspaces: activeCount,
        archivedWorkspaces: archivedCount,
        totalWorkspaces: activeCount + archivedCount,
        totalFiles,
        totalSize,
        averageFilesPerWorkspace: activeCount > 0 ? Math.round(totalFiles / activeCount) : 0,
        averageSizePerWorkspace: activeCount > 0 ? Math.round(totalSize / activeCount) : 0
      };

    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      throw error;
    }
  }

  /**
   * Utility method to analyze file types
   */
  analyzeFileTypes(files) {
    const types = {};
    files.forEach(file => {
      const ext = file.path.split('.').pop() || 'unknown';
      types[ext] = (types[ext] || 0) + 1;
    });
    return types;
  }
}

module.exports = WorkspaceDatabaseService;