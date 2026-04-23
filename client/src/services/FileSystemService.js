/**
 * FileSystemService - Core file system implementation with Yjs CRDT and Firebase persistence
 * Based on the architecture document requirements for collaborative file editing
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { getAuth } from 'firebase/auth';

class FileSystemService {
  constructor() {
    this.yjsProvider = null;
    this.documents = new Map(); // fileId -> Y.Doc
    this.fileMetadata = new Map(); // fileId -> metadata
    this.projectId = null;
    this.userId = null;
    this.socket = null;
    this.isInitialized = false;
    this.firestore = null;
    this.storage = null;
    this.auth = null;
    
    // Event listeners
    this.listeners = {
      fileChanged: new Set(),
      fileCreated: new Set(),
      fileDeleted: new Set(),
      fileRenamed: new Set(),
      projectLoaded: new Set(),
      syncStateChanged: new Set()
    };

    // Local storage for guest users
    this.localStorageKey = 'codecollab-guest-workspace';
    this.isGuestMode = false;
  }

  /**
   * Initialize the file system with Firebase config and project
   */
  async initialize({ firebaseConfig, projectId, userId, socket }) {
    try {
      // Initialize Firebase
      const app = initializeApp(firebaseConfig);
      this.firestore = getFirestore(app);
      this.storage = getStorage(app);
      this.auth = getAuth(app);
      
      this.projectId = projectId;
      this.userId = userId;
      this.socket = socket;
      this.isGuestMode = !userId;

      // Set up socket listeners for file operations
      this.setupSocketListeners();

      // Load project files
      if (projectId && userId) {
        await this.loadProject(projectId);
      } else {
        // Guest mode - load from local storage
        this.loadGuestWorkspace();
      }

      this.isInitialized = true;
      this.emit('syncStateChanged', { initialized: true, guestMode: this.isGuestMode });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize FileSystemService:', error);
      throw error;
    }
  }

  /**
   * Set up Socket.IO listeners for real-time file operations
   */
  setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('file_created', (data) => {
      this.handleRemoteFileCreated(data);
    });

    this.socket.on('file_updated', (data) => {
      this.handleRemoteFileUpdated(data);
    });

    this.socket.on('file_deleted', (data) => {
      this.handleRemoteFileDeleted(data);
    });

    this.socket.on('file_renamed', (data) => {
      this.handleRemoteFileRenamed(data);
    });

    this.socket.on('workspace_push', (data) => {
      this.handleWorkspacePush(data);
    });
  }

  /**
   * Load project from Firestore
   */
  async loadProject(projectId) {
    try {
      // Load project metadata
      const projectDoc = await getDoc(doc(this.firestore, 'projects', projectId));
      if (!projectDoc.exists()) {
        throw new Error('Project not found');
      }

      const projectData = projectDoc.data();
      
      // Load all files for this project
      const filesQuery = query(
        collection(this.firestore, 'projects', projectId, 'files'),
        orderBy('path')
      );
      
      const filesSnapshot = await getDocs(filesQuery);
      
      // Create Yjs documents for each file
      for (const fileDoc of filesSnapshot.docs) {
        const fileData = fileDoc.data();
        await this.createYjsDocument(fileDoc.id, fileData);
      }

      // Set up real-time listeners
      this.setupProjectListeners(projectId);
      
      this.emit('projectLoaded', { projectId, files: Array.from(this.fileMetadata.values()) });
      
    } catch (error) {
      console.error('Failed to load project:', error);
      throw error;
    }
  }

  /**
   * Create a Yjs document for a file
   */
  async createYjsDocument(fileId, fileMetadata) {
    // Create new Y.Doc for this file
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');
    
    // Load content from Firestore or Firebase Storage
    let content = '';
    if (fileMetadata.contentText) {
      content = fileMetadata.contentText;
    } else if (fileMetadata.storagePath) {
      try {
        const storageRef = ref(this.storage, fileMetadata.storagePath);
        const url = await getDownloadURL(storageRef);
        const response = await fetch(url);
        content = await response.text();
      } catch (error) {
        console.warn('Failed to load content from storage:', error);
      }
    }

    // Initialize Yjs document with content
    if (content) {
      ytext.insert(0, content);
    }

    // Set up change listener for auto-save
    ytext.observe(() => {
      this.debounceAutoSave(fileId);
    });

    // Store document and metadata
    this.documents.set(fileId, ydoc);
    this.fileMetadata.set(fileId, fileMetadata);

    return ydoc;
  }

  /**
   * Set up real-time Firestore listeners for project changes
   */
  setupProjectListeners(projectId) {
    // Listen for file metadata changes
    const filesRef = collection(this.firestore, 'projects', projectId, 'files');
    
    onSnapshot(filesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const fileId = change.doc.id;
        const fileData = change.doc.data();
        
        if (change.type === 'added' && !this.documents.has(fileId)) {
          this.createYjsDocument(fileId, fileData);
          this.emit('fileCreated', { fileId, metadata: fileData });
        } else if (change.type === 'modified') {
          this.fileMetadata.set(fileId, fileData);
          this.emit('fileChanged', { fileId, metadata: fileData });
        } else if (change.type === 'removed') {
          this.removeFile(fileId);
          this.emit('fileDeleted', { fileId });
        }
      });
    });
  }

  /**
   * Create a new file
   */
  async createFile(path, name, type = 'file', content = '', mime = 'text/plain') {
    const fileId = this.generateFileId();
    const now = Date.now();
    
    const fileMetadata = {
      id: fileId,
      path,
      name,
      type,
      mime,
      size: content.length,
      contentText: type === 'file' && content.length < 10000 ? content : null,
      storagePath: null,
      updatedAt: now,
      updatedByUid: this.userId || 'guest',
      createdAt: now
    };

    if (this.isGuestMode) {
      // Store in local storage for guest users
      this.saveToLocalStorage(fileId, fileMetadata, content);
    } else {
      // Save to Firestore
      await setDoc(
        doc(this.firestore, 'projects', this.projectId, 'files', fileId),
        {
          ...fileMetadata,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }
      );

      // If content is too large, save to Firebase Storage
      if (content.length >= 10000) {
        const storagePath = `projects/${this.projectId}/files/${fileId}`;
        const storageRef = ref(this.storage, storagePath);
        await uploadBytes(storageRef, new Blob([content], { type: mime }));
        
        // Update metadata with storage path
        await updateDoc(
          doc(this.firestore, 'projects', this.projectId, 'files', fileId),
          { storagePath, contentText: null }
        );
        fileMetadata.storagePath = storagePath;
        fileMetadata.contentText = null;
      }
    }

    // Create Yjs document
    await this.createYjsDocument(fileId, fileMetadata);

    // Broadcast to other clients via socket
    if (this.socket && !this.isGuestMode) {
      this.socket.emit('file_create', {
        projectId: this.projectId,
        fileId,
        metadata: fileMetadata
      });
    }

    this.emit('fileCreated', { fileId, metadata: fileMetadata });
    return fileId;
  }

  /**
   * Update file content
   */
  async updateFile(fileId, content) {
    const ydoc = this.documents.get(fileId);
    if (!ydoc) {
      throw new Error('File not found');
    }

    const ytext = ydoc.getText('content');
    
    // Update Yjs document (will trigger auto-save)
    ytext.delete(0, ytext.length);
    ytext.insert(0, content);
  }

  /**
   * Get file content
   */
  getFileContent(fileId) {
    const ydoc = this.documents.get(fileId);
    if (!ydoc) {
      return null;
    }

    return ydoc.getText('content').toString();
  }

  /**
   * Get file metadata
   */
  getFileMetadata(fileId) {
    return this.fileMetadata.get(fileId);
  }

  /**
   * Get all files
   */
  getAllFiles() {
    return Array.from(this.fileMetadata.values());
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    if (this.isGuestMode) {
      this.removeFromLocalStorage(fileId);
    } else {
      // Delete from Firestore
      await deleteDoc(doc(this.firestore, 'projects', this.projectId, 'files', fileId));
      
      // Delete from Firebase Storage if exists
      const metadata = this.fileMetadata.get(fileId);
      if (metadata?.storagePath) {
        try {
          const storageRef = ref(this.storage, metadata.storagePath);
          await deleteObject(storageRef);
        } catch (error) {
          console.warn('Failed to delete from storage:', error);
        }
      }
    }

    // Remove locally
    this.removeFile(fileId);

    // Broadcast to other clients
    if (this.socket && !this.isGuestMode) {
      this.socket.emit('file_delete', {
        projectId: this.projectId,
        fileId
      });
    }

    this.emit('fileDeleted', { fileId });
  }

  /**
   * Rename a file
   */
  async renameFile(fileId, newName, newPath) {
    const metadata = this.fileMetadata.get(fileId);
    if (!metadata) {
      throw new Error('File not found');
    }

    const updatedMetadata = {
      ...metadata,
      name: newName,
      path: newPath,
      updatedAt: Date.now(),
      updatedByUid: this.userId || 'guest'
    };

    if (this.isGuestMode) {
      this.updateLocalStorageMetadata(fileId, updatedMetadata);
    } else {
      await updateDoc(
        doc(this.firestore, 'projects', this.projectId, 'files', fileId),
        {
          name: newName,
          path: newPath,
          updatedAt: serverTimestamp(),
          updatedByUid: this.userId
        }
      );
    }

    this.fileMetadata.set(fileId, updatedMetadata);

    // Broadcast to other clients
    if (this.socket && !this.isGuestMode) {
      this.socket.emit('file_rename', {
        projectId: this.projectId,
        fileId,
        oldName: metadata.name,
        newName,
        newPath
      });
    }

    this.emit('fileRenamed', { fileId, oldName: metadata.name, newName, newPath });
  }

  /**
   * Auto-save with debouncing
   */
  debounceAutoSave(fileId) {
    if (this.autoSaveTimeouts?.has(fileId)) {
      clearTimeout(this.autoSaveTimeouts.get(fileId));
    }

    if (!this.autoSaveTimeouts) {
      this.autoSaveTimeouts = new Map();
    }

    const timeout = setTimeout(() => {
      this.autoSave(fileId);
      this.autoSaveTimeouts.delete(fileId);
    }, 2000); // Auto-save after 2 seconds of inactivity

    this.autoSaveTimeouts.set(fileId, timeout);
  }

  /**
   * Auto-save file content
   */
  async autoSave(fileId) {
    try {
      const content = this.getFileContent(fileId);
      const metadata = this.fileMetadata.get(fileId);
      
      if (!content || !metadata) return;

      if (this.isGuestMode) {
        this.saveToLocalStorage(fileId, metadata, content);
      } else {
        // Update in Firestore or Storage based on size
        if (content.length < 10000) {
          await updateDoc(
            doc(this.firestore, 'projects', this.projectId, 'files', fileId),
            {
              contentText: content,
              size: content.length,
              updatedAt: serverTimestamp(),
              updatedByUid: this.userId
            }
          );
        } else {
          // Save to Firebase Storage
          const storagePath = `projects/${this.projectId}/files/${fileId}`;
          const storageRef = ref(this.storage, storagePath);
          await uploadBytes(storageRef, new Blob([content], { type: metadata.mime }));
          
          await updateDoc(
            doc(this.firestore, 'projects', this.projectId, 'files', fileId),
            {
              contentText: null,
              storagePath,
              size: content.length,
              updatedAt: serverTimestamp(),
              updatedByUid: this.userId
            }
          );
        }
      }

      // Broadcast update to other clients
      if (this.socket && !this.isGuestMode) {
        this.socket.emit('file_update', {
          projectId: this.projectId,
          fileId,
          content: content.substring(0, 1000), // Send preview only
          size: content.length,
          updatedBy: this.userId
        });
      }

    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  /**
   * Guest mode: Save to local storage
   */
  saveToLocalStorage(fileId, metadata, content) {
    const workspace = this.getGuestWorkspace();
    workspace.files[fileId] = { metadata, content };
    workspace.updatedAt = Date.now();
    localStorage.setItem(this.localStorageKey, JSON.stringify(workspace));
  }

  /**
   * Guest mode: Load from local storage
   */
  loadGuestWorkspace() {
    const workspace = this.getGuestWorkspace();
    
    // Create Yjs documents for all files
    Object.entries(workspace.files).forEach(([fileId, fileData]) => {
      this.createYjsDocument(fileId, fileData.metadata);
      const ydoc = this.documents.get(fileId);
      if (ydoc && fileData.content) {
        const ytext = ydoc.getText('content');
        ytext.insert(0, fileData.content);
      }
    });

    this.emit('projectLoaded', { 
      projectId: 'guest-workspace', 
      files: Object.values(workspace.files).map(f => f.metadata) 
    });
  }

  /**
   * Get guest workspace from local storage
   */
  getGuestWorkspace() {
    const stored = localStorage.getItem(this.localStorageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to parse guest workspace:', error);
      }
    }

    return {
      id: 'guest-' + Date.now(),
      files: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Migrate guest workspace to Firebase
   */
  async migrateGuestWorkspace(newProjectId, userId) {
    if (!this.isGuestMode) return;

    const workspace = this.getGuestWorkspace();
    
    // Create project in Firestore
    await setDoc(doc(this.firestore, 'projects', newProjectId), {
      id: newProjectId,
      name: 'Migrated Workspace',
      ownerUid: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      visibility: 'private',
      collaborators: { [userId]: 'owner' }
    });

    // Migrate all files
    for (const [fileId, fileData] of Object.entries(workspace.files)) {
      await setDoc(
        doc(this.firestore, 'projects', newProjectId, 'files', fileId),
        {
          ...fileData.metadata,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedByUid: userId
        }
      );
    }

    // Clear guest workspace
    localStorage.removeItem(this.localStorageKey);
    
    // Switch to authenticated mode
    this.isGuestMode = false;
    this.projectId = newProjectId;
    this.userId = userId;

    this.emit('workspaceMigrated', { newProjectId });
  }

  /**
   * Push workspace snapshot to Firebase Storage
   */
  async pushWorkspaceSnapshot(message = 'Workspace snapshot') {
    if (this.isGuestMode) return null;

    try {
      // Create snapshot with all files
      const snapshot = {
        projectId: this.projectId,
        createdAt: Date.now(),
        createdBy: this.userId,
        message,
        files: {}
      };

      // Collect all file content
      for (const [fileId, metadata] of this.fileMetadata.entries()) {
        const content = this.getFileContent(fileId);
        snapshot.files[fileId] = {
          metadata,
          content
        };
      }

      // Compress and upload to Firebase Storage
      const snapshotJson = JSON.stringify(snapshot);
      const snapshotBlob = new Blob([snapshotJson], { type: 'application/json' });
      
      const snapshotId = 'snapshot-' + Date.now();
      const storagePath = `projects/${this.projectId}/snapshots/${snapshotId}.json`;
      const storageRef = ref(this.storage, storagePath);
      
      await uploadBytes(storageRef, snapshotBlob);

      // Save snapshot metadata to Firestore
      await setDoc(
        doc(this.firestore, 'projects', this.projectId, 'snapshots', snapshotId),
        {
          createdAt: serverTimestamp(),
          createdByUid: this.userId,
          storagePath,
          message,
          fileCount: Object.keys(snapshot.files).length
        }
      );

      return { snapshotId, storagePath };

    } catch (error) {
      console.error('Failed to push workspace snapshot:', error);
      throw error;
    }
  }

  /**
   * Pull workspace snapshot from Firebase Storage
   */
  async pullWorkspaceSnapshot(storagePath) {
    try {
      // Download snapshot from Firebase Storage
      const storageRef = ref(this.storage, storagePath);
      const url = await getDownloadURL(storageRef);
      const response = await fetch(url);
      const snapshot = await response.json();

      // Clear current workspace
      this.documents.clear();
      this.fileMetadata.clear();

      // Load snapshot files
      for (const [fileId, fileData] of Object.entries(snapshot.files)) {
        await this.createYjsDocument(fileId, fileData.metadata);
        if (fileData.content) {
          const ydoc = this.documents.get(fileId);
          const ytext = ydoc.getText('content');
          ytext.insert(0, fileData.content);
        }
      }

      this.emit('workspaceRestored', { snapshot });
      
    } catch (error) {
      console.error('Failed to pull workspace snapshot:', error);
      throw error;
    }
  }

  /**
   * Handle remote file operations
   */
  handleRemoteFileCreated(data) {
    if (data.projectId === this.projectId && !this.documents.has(data.fileId)) {
      this.createYjsDocument(data.fileId, data.metadata);
      this.emit('fileCreated', data);
    }
  }

  handleRemoteFileUpdated(data) {
    if (data.projectId === this.projectId) {
      this.emit('fileChanged', data);
    }
  }

  handleRemoteFileDeleted(data) {
    if (data.projectId === this.projectId) {
      this.removeFile(data.fileId);
      this.emit('fileDeleted', data);
    }
  }

  handleRemoteFileRenamed(data) {
    if (data.projectId === this.projectId) {
      const metadata = this.fileMetadata.get(data.fileId);
      if (metadata) {
        metadata.name = data.newName;
        metadata.path = data.newPath;
        this.fileMetadata.set(data.fileId, metadata);
      }
      this.emit('fileRenamed', data);
    }
  }

  handleWorkspacePush(data) {
    this.emit('workspacePushReceived', data);
  }

  /**
   * Remove file from local storage
   */
  removeFile(fileId) {
    this.documents.delete(fileId);
    this.fileMetadata.delete(fileId);
  }

  removeFromLocalStorage(fileId) {
    const workspace = this.getGuestWorkspace();
    delete workspace.files[fileId];
    workspace.updatedAt = Date.now();
    localStorage.setItem(this.localStorageKey, JSON.stringify(workspace));
  }

  updateLocalStorageMetadata(fileId, metadata) {
    const workspace = this.getGuestWorkspace();
    if (workspace.files[fileId]) {
      workspace.files[fileId].metadata = metadata;
      workspace.updatedAt = Date.now();
      localStorage.setItem(this.localStorageKey, JSON.stringify(workspace));
    }
  }

  /**
   * Generate unique file ID
   */
  generateFileId() {
    return 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Get Yjs document for Monaco editor integration
   */
  getYjsDocument(fileId) {
    return this.documents.get(fileId);
  }

  /**
   * Check if file system is ready
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      initialized: this.isInitialized,
      guestMode: this.isGuestMode,
      projectId: this.projectId,
      fileCount: this.documents.size,
      connected: this.socket?.connected || false
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    // Clear auto-save timers
    if (this.autoSaveTimeouts) {
      this.autoSaveTimeouts.forEach(timeout => clearTimeout(timeout));
      this.autoSaveTimeouts.clear();
    }

    // Destroy Yjs documents
    this.documents.forEach(doc => doc.destroy());
    this.documents.clear();
    this.fileMetadata.clear();

    // Clear listeners
    Object.values(this.listeners).forEach(listenerSet => listenerSet.clear());

    this.isInitialized = false;
  }
}

// Export singleton instance
export default new FileSystemService();
