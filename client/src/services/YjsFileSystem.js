/**
 * Yjs-Based Collaborative File System
 * 
 * Replaces the complex 7-layer system with a streamlined CRDT approach:
 * - Yjs for collaborative text editing and conflict resolution
 * - Firebase Firestore for metadata and small files
 * - Firebase Storage for large files and snapshots
 * - Real-time synchronization via Socket.IO
 */

import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { io } from 'socket.io-client';
import { getServerUrl } from '../utils/serverConfig';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '../utils/firebase';

export class YjsFileSystem {
  constructor() {
    this.ydoc = new Y.Doc();
    this.socket = null;
    this.currentProject = null;
    this.currentRoom = null;
    this.user = null;
    this.awareness = null;
    this.monacoBinding = null;
    
    // Yjs Maps for different data types
    this.files = this.ydoc.getMap('files'); // Y.Map<string, Y.Text>
    this.metadata = this.ydoc.getMap('metadata'); // File metadata
    this.fileTree = this.ydoc.getMap('fileTree'); // Folder structure
    
    // Event listeners
    this.listeners = new Set();
    this.setupYjsListeners();
  }

  /**
   * Initialize the file system with user authentication
   */
  async initialize(user, token) {
    this.user = user;
    this.token = token;
    await this.connectSocket();
    console.log('✅ YjsFileSystem initialized for user:', user?.email || 'anonymous');
  }

  /**
   * Connect to Socket.IO server for real-time collaboration
   */
  async connectSocket() {
    if (this.socket) return;

    this.socket = io(getServerUrl(), {
      auth: {
        token: this.token
      }
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to collaboration server');
      this.notifyListeners('socket_connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from collaboration server:', reason);
      this.notifyListeners('socket_disconnected', { reason });
    });

    // Enhanced Y.js event handlers
    this.socket.on('yjs_update', ({ roomId, update, origin }) => {
      if (roomId === this.currentRoom && Array.isArray(update)) {
        const updateArray = new Uint8Array(update);
        Y.applyUpdate(this.ydoc, updateArray, 'socket');
        console.log(`📝 Applied Y.js update from ${origin || 'server'} in room: ${roomId}`);
      }
    });

    this.socket.on('yjs_initial_state', ({ roomId, state }) => {
      if (roomId === this.currentRoom && Array.isArray(state)) {
        const stateArray = new Uint8Array(state);
        Y.applyUpdate(this.ydoc, stateArray, 'server');
        console.log(`📋 Applied initial Y.js state for room: ${roomId}`);
        this.notifyListeners('yjs_initial_sync', { roomId });
      }
    });

    this.socket.on('yjs_sync_response', ({ roomId, stateVector }) => {
      if (roomId === this.currentRoom && Array.isArray(stateVector)) {
        const sv = new Uint8Array(stateVector);
        const update = Y.encodeStateAsUpdate(this.ydoc, sv);
        
        if (update.length > 0) {
          this.socket.emit('yjs_sync_update', {
            roomId,
            update: Array.from(update)
          });
        }
        console.log(`🔄 Processed Y.js sync response for room: ${roomId}`);
      }
    });

    this.socket.on('yjs_error', ({ error }) => {
      console.error('❌ Y.js error from server:', error);
      this.notifyListeners('yjs_error', { error });
    });

    this.socket.on('awareness_update', ({ roomId, awareness }) => {
      if (roomId === this.currentRoom && this.awareness && Array.isArray(awareness)) {
        const awarenessUpdate = new Uint8Array(awareness);
        this.awareness.applyUpdate(awarenessUpdate, 'socket');
        console.log(`👥 Applied awareness update for room: ${roomId}`);
      }
    });

    // Legacy workspace event handlers
    this.socket.on('workspace_push', async ({ storagePath, projectMeta }) => {
      await this.loadWorkspaceFromStorage(storagePath);
    });

    this.socket.on('file_changed', ({ fileMeta }) => {
      this.notifyListeners('file_changed', fileMeta);
    });

    // Session-based room collaboration
    this.socket.on('session_joined', (data) => {
      console.log('🏠 Joined collaboration session:', data.session.id);
      this.currentRoom = `yjs_${data.session.id}`;
      
      // Request Y.js sync for the room
      this.requestYjsSync();
      
      this.notifyListeners('session_joined', data);
    });

    this.socket.on('room_joined', async (data) => {
      console.log('🏠 Joined collaboration room:', data.roomId);
      this.currentRoom = data.roomId;
      
      if (data.workspace) {
        await this.loadWorkspaceFromRoomData(data.workspace);
      }
      
      this.notifyListeners('room_joined', data);
    });
    
    this.socket.on('room_workspace_updated', (data) => {
      console.log('🔄 Room workspace updated:', data.update.updateType);
      this.handleRoomWorkspaceUpdate(data);
    });
    
    this.socket.on('user_joined_room', (data) => {
      console.log('👤 User joined room:', data.user.userName);
      this.notifyListeners('room_user_joined', data);
    });
    
    this.socket.on('user_left_room', (data) => {
      console.log('👋 User left room:', data.userName);
      this.notifyListeners('room_user_left', data);
    });

    // Setup Y.js update broadcasting
    this.ydoc.on('update', (update, origin, doc, tr) => {
      if (origin !== 'socket' && origin !== 'server' && this.currentRoom && this.socket.connected) {
        this.socket.emit('yjs_update', {
          roomId: this.currentRoom,
          update: Array.from(update),
          origin: 'client'
        });
        console.log(`📡 Broadcasted Y.js update to room: ${this.currentRoom}`);
      }
    });
  }

  /**
   * Create or load a project
   */
  async createProject(projectData) {
    const projectRef = doc(collection(db, 'projects'));
    const projectDoc = {
      id: projectRef.id,
      name: projectData.name,
      ownerUid: this.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      visibility: projectData.visibility || 'private',
      collaborators: { [this.user.uid]: 'owner' },
      rootFolderId: null,
      latestSnapshotStoragePath: null
    };

    await setDoc(projectRef, projectDoc);
    this.currentProject = { ...projectDoc, id: projectRef.id };
    
    console.log('📂 Project created:', projectDoc.name);
    return this.currentProject;
  }

  /**
   * Load project from Firestore
   */
  async loadProject(projectId) {
    const projectDoc = await getDoc(doc(db, 'projects', projectId));
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    this.currentProject = { id: projectId, ...projectDoc.data() };
    
    // Load files from Firestore
    await this.loadProjectFiles(projectId);
    
    console.log('📁 Project loaded:', this.currentProject.name);
    return this.currentProject;
  }

  /**
   * Load project files into Yjs documents
   */
  async loadProjectFiles(projectId) {
    const filesQuery = query(
      collection(db, 'projects', projectId, 'files'),
      orderBy('path')
    );

    const snapshot = await getDocs(filesQuery);
    
    snapshot.forEach((fileDoc) => {
      const fileData = fileDoc.data();
      
      if (fileData.type === 'folder') {
        this.fileTree.set(fileData.path, {
          type: 'folder',
          name: fileData.name,
          path: fileData.path,
          children: []
        });
      } else {
        // Create Y.Text document for file content
        const ytext = new Y.Text(fileData.contentText || '');
        this.files.set(fileData.path, ytext);
        
        // Store metadata
        this.metadata.set(fileData.path, {
          id: fileDoc.id,
          name: fileData.name,
          path: fileData.path,
          type: fileData.type,
          mime: fileData.mime,
          size: fileData.size,
          updatedAt: fileData.updatedAt,
          updatedByUid: fileData.updatedByUid,
          storagePath: fileData.storagePath
        });
      }
    });

    this.notifyListeners('project_loaded', { projectId, fileCount: snapshot.size });
  }

  /**
   * Join a collaboration room
   */
  async joinRoom(roomId) {
    if (!this.socket) {
      await this.connectSocket();
    }

    this.currentRoom = roomId;
    
    // Join the Y.js room on the server
    this.socket.emit('join_yjs_room', { roomId });
    
    // Request initial sync
    this.requestYjsSync();
    
    console.log('🚪 Joined Y.js room:', roomId);
  }

  /**
   * Request Y.js synchronization with the server
   */
  requestYjsSync() {
    if (!this.socket || !this.currentRoom) return;
    
    this.socket.emit('yjs_sync_request', {
      roomId: this.currentRoom
    });
    console.log('🔄 Requested Y.js sync for room:', this.currentRoom);
  }

  /**
   * Leave the current collaboration room
   */
  leaveRoom() {
    if (!this.socket || !this.currentRoom) return;
    
    this.socket.emit('leave_yjs_room', {
      roomId: this.currentRoom
    });
    
    console.log('🚪 Left Y.js room:', this.currentRoom);
    this.currentRoom = null;
  }

  /**
   * Create a new file with Y.js collaboration support
   */
  async createFile(path, content = '', options = {}) {
    const { type = 'file', mime = 'text/plain' } = options;
    
    // Create Y.Text document for collaborative editing
    const ytext = new Y.Text(content);
    this.files.set(path, ytext);
    
    // Store metadata
    const metadata = {
      id: this.generateFileId(),
      name: this.getFileName(path),
      path,
      type,
      mime,
      size: content.length,
      updatedAt: new Date(),
      updatedByUid: this.user?.uid || this.user?.id || 'unknown',
      contentText: content
    };
    
    this.metadata.set(path, metadata);
    
    // Save to Firestore if available
    await this.saveFileToFirestore(metadata);
    
    // Broadcast to room participants if in a room
    if (this.currentRoom) {
      this.broadcastRoomUpdate('file_created', {
        filePath: path,
        fileName: this.getFileName(path),
        content,
        fileType: type || 'text'
      });
    }
    
    this.notifyListeners('file_created', { path, metadata });
    console.log('📄 File created with Y.js support:', path);
    return ytext;
  }

  /**
   * Update file content through Y.js
   */
  async updateFile(path, content) {
    const ytext = this.getFile(path);
    if (!ytext) {
      // Create file if it doesn't exist
      return await this.createFile(path, content);
    }

    // Update Y.Text content atomically
    ytext.delete(0, ytext.length);
    ytext.insert(0, content);
    
    // Update metadata
    const metadata = this.metadata.get(path);
    if (metadata) {
      const updatedMetadata = {
        ...metadata,
        size: content.length,
        updatedAt: new Date(),
        updatedByUid: this.user?.uid || this.user?.id || 'unknown',
        contentText: content
      };
      
      this.metadata.set(path, updatedMetadata);
      await this.saveFileToFirestore(updatedMetadata);
    }
    
    // Broadcast to room participants
    if (this.currentRoom) {
      this.broadcastRoomUpdate('file_updated', {
        filePath: path,
        content
      });
    }
    
    this.notifyListeners('file_updated', { path, content, metadata });
    console.log('� File updated through Y.js:', path);
    return ytext;
  }

  /**
   * Create a folder
   */
  async createFolder(path) {
    const metadata = {
      id: this.generateFileId(),
      name: this.getFileName(path),
      path,
      type: 'folder',
      updatedAt: new Date(),
      updatedByUid: this.user.uid
    };
    
    this.fileTree.set(path, {
      type: 'folder',
      name: metadata.name,
      path,
      children: []
    });
    
    this.metadata.set(path, metadata);
    
    // Save to Firestore
    await this.saveFileToFirestore(metadata);
    
    // Notify room
    if (this.currentRoom) {
      this.socket.emit('file_create', { fileMeta: metadata });
    }
    
    this.notifyListeners('folder_created', { path, metadata });
    console.log('📁 Folder created:', path);
  }

  /**
   * Get file content as Y.Text
   */
  getFile(path) {
    return this.files.get(path);
  }

  /**
   * Get file metadata
   */
  getFileMetadata(path) {
    return this.metadata.get(path);
  }

  /**
   * Delete a file
   */
  async deleteFile(path) {
    const metadata = this.metadata.get(path);
    if (!metadata) {
      throw new Error('File not found');
    }

    // Remove from Yjs
    this.files.delete(path);
    this.metadata.delete(path);
    this.fileTree.delete(path);
    
    // Delete from Firestore
    if (this.currentProject) {
      await deleteDoc(doc(db, 'projects', this.currentProject.id, 'files', metadata.id));
    }
    
    // Delete from Storage if it's a large file
    if (metadata.storagePath) {
      try {
        await deleteObject(ref(storage, metadata.storagePath));
      } catch (error) {
        console.warn('Failed to delete from storage:', error);
      }
    }
    
    // Notify room
    if (this.currentRoom) {
      this.socket.emit('file_delete', { fileMeta: metadata });
    }
    
    this.notifyListeners('file_deleted', { path, metadata });
    console.log('🗑️ File deleted:', path);
  }

  /**
   * Bind Monaco editor to a file's Y.Text
   */
  bindMonacoEditor(editor, filePath) {
    const ytext = this.getFile(filePath);
    if (!ytext) {
      throw new Error('File not found for Monaco binding');
    }

    // Clean up previous binding
    if (this.monacoBinding) {
      this.monacoBinding.destroy();
    }

    // Create new binding
    this.monacoBinding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      this.awareness
    );

    // Auto-save on changes
    ytext.observe(() => {
      this.debouncedSave(filePath);
    });

    console.log('🎯 Monaco editor bound to:', filePath);
    return this.monacoBinding;
  }

  /**
   * Save file to Firestore (debounced)
   */
  debouncedSave = this.debounce(async (filePath) => {
    const ytext = this.getFile(filePath);
    const metadata = this.getFileMetadata(filePath);
    
    if (ytext && metadata) {
      const content = ytext.toString();
      const updatedMetadata = {
        ...metadata,
        contentText: content,
        size: content.length,
        updatedAt: new Date(),
        updatedByUid: this.user.uid
      };
      
      this.metadata.set(filePath, updatedMetadata);
      await this.saveFileToFirestore(updatedMetadata);
    }
  }, 2000);

  /**
   * Save file metadata to Firestore
   */
  async saveFileToFirestore(metadata) {
    if (!this.currentProject) return;
    
    const fileRef = doc(db, 'projects', this.currentProject.id, 'files', metadata.id);
    await setDoc(fileRef, {
      ...metadata,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  /**
   * Create a project snapshot and save to Storage
   */
  async createSnapshot(message = '') {
    if (!this.currentProject) {
      throw new Error('No active project');
    }

    // Create snapshot data
    const snapshotData = {
      files: {},
      folders: [],
      yjsState: Y.encodeStateAsUpdate(this.ydoc),
      metadata: {
        projectId: this.currentProject.id,
        createdAt: new Date().toISOString(),
        createdByUid: this.user.uid,
        message
      }
    };

    // Collect all files
    this.files.forEach((ytext, path) => {
      snapshotData.files[path] = ytext.toString();
    });

    // Collect folders
    this.fileTree.forEach((folder, path) => {
      if (folder.type === 'folder') {
        snapshotData.folders.push(path);
      }
    });

    // Compress and upload to Storage
    const compressedData = JSON.stringify(snapshotData);
    const blob = new Blob([compressedData], { type: 'application/json' });
    
    const snapshotId = this.generateSnapshotId();
    const storagePath = `snapshots/${this.currentProject.id}/${snapshotId}.json`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, blob);
    
    // Save snapshot metadata to Firestore
    const snapshotDoc = {
      id: snapshotId,
      createdAt: serverTimestamp(),
      createdByUid: this.user.uid,
      storagePath,
      message,
      fileCount: Object.keys(snapshotData.files).length,
      folderCount: snapshotData.folders.length
    };
    
    await setDoc(doc(db, 'projects', this.currentProject.id, 'snapshots', snapshotId), snapshotDoc);
    
    // Update project's latest snapshot
    await updateDoc(doc(db, 'projects', this.currentProject.id), {
      latestSnapshotStoragePath: storagePath,
      updatedAt: serverTimestamp()
    });
    
    console.log('📸 Snapshot created:', snapshotId);
    return { snapshotId, storagePath };
  }

  /**
   * Load workspace from a Storage snapshot
   */
  async loadWorkspaceFromStorage(storagePath) {
    try {
      const url = await getDownloadURL(ref(storage, storagePath));
      const response = await fetch(url);
      const snapshotData = await response.json();
      
      // Clear current state
      this.ydoc.destroy();
      this.ydoc = new Y.Doc();
      this.files = this.ydoc.getMap('files');
      this.metadata = this.ydoc.getMap('metadata');
      this.fileTree = this.ydoc.getMap('fileTree');
      
      // Apply Yjs state
      if (snapshotData.yjsState) {
        Y.applyUpdate(this.ydoc, new Uint8Array(snapshotData.yjsState));
      }
      
      // Restore files
      Object.entries(snapshotData.files || {}).forEach(([path, content]) => {
        const ytext = new Y.Text(content);
        this.files.set(path, ytext);
      });
      
      // Restore folders
      (snapshotData.folders || []).forEach(folderPath => {
        this.fileTree.set(folderPath, {
          type: 'folder',
          name: this.getFileName(folderPath),
          path: folderPath,
          children: []
        });
      });
      
      this.notifyListeners('workspace_loaded', { storagePath, fileCount: Object.keys(snapshotData.files).length });
      console.log('📦 Workspace loaded from snapshot');
      
    } catch (error) {
      console.error('❌ Failed to load workspace:', error);
      throw error;
    }
  }

  /**
   * Load workspace from room data (for collaboration room joining)
   */
  async loadWorkspaceFromRoomData(roomWorkspace) {
    try {
      console.log('📦 Loading workspace from room data...', roomWorkspace);
      
      // Clear current state
      this.clearWorkspace();
      
      // Load files into Yjs
      (roomWorkspace.files || []).forEach(file => {
        const ytext = new Y.Text(file.content || '');
        this.files.set(file.path, ytext);
        
        // Store metadata
        this.metadata.set(file.path, {
          name: file.name,
          type: file.type || 'text',
          size: file.size || (file.content || '').length,
          created: file.createdAt || new Date().toISOString(),
          modified: file.modifiedAt || file.createdAt || new Date().toISOString(),
          createdBy: file.createdBy,
          modifiedBy: file.modifiedBy
        });
      });
      
      // Load folders into file tree
      (roomWorkspace.folders || []).forEach(folderPath => {
        this.fileTree.set(folderPath, {
          type: 'folder',
          name: this.getFileName(folderPath),
          path: folderPath,
          children: []
        });
      });
      
      // Build hierarchical tree structure
      this.rebuildFileTree();
      
      this.notifyListeners('workspace_loaded_from_room', { 
        fileCount: (roomWorkspace.files || []).length,
        folderCount: (roomWorkspace.folders || []).length,
        metadata: roomWorkspace.metadata
      });
      
      console.log('✅ Workspace loaded from room data:', {
        files: (roomWorkspace.files || []).length,
        folders: (roomWorkspace.folders || []).length
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load workspace from room data:', error);
      throw error;
    }
  }
  
  /**
   * Clear current workspace
   */
  clearWorkspace() {
    this.files.clear();
    this.metadata.clear();
    this.fileTree.clear();
    console.log('🧹 Workspace cleared');
  }
  
  /**
   * Rebuild file tree hierarchy from flat structure
   */
  rebuildFileTree() {
    // This would implement proper tree building logic
    // For now, we'll keep it simple and rely on the file explorer to handle structure
    this.notifyListeners('file_tree_updated', {
      files: Array.from(this.files.keys()),
      folders: Array.from(this.fileTree.keys())
    });
  }

  /**
   * Push current workspace to room members
   */
  async pushWorkspaceToRoom() {
    if (!this.currentRoom) {
      throw new Error('No active room');
    }

    const { storagePath } = await this.createSnapshot('Workspace shared to room');
    
    this.socket.emit('workspace_push', {
      storagePath,
      projectMeta: this.currentProject
    });
    
    console.log('📤 Workspace pushed to room');
  }

  /**
   * Get file tree structure
   */
  getFileTree() {
    const tree = {};
    
    // Add folders
    this.fileTree.forEach((folder, path) => {
      tree[path] = { ...folder };
    });
    
    // Add files
    this.metadata.forEach((metadata, path) => {
      if (metadata.type === 'file') {
        tree[path] = {
          type: 'file',
          name: metadata.name,
          path: metadata.path,
          size: metadata.size,
          updatedAt: metadata.updatedAt
        };
      }
    });
    
    return tree;
  }

  /**
   * Setup Yjs event listeners
   */
  setupYjsListeners() {
    this.files.observe(() => {
      this.notifyListeners('files_changed', this.getFileTree());
    });
    
    this.fileTree.observe(() => {
      this.notifyListeners('tree_changed', this.getFileTree());
    });
  }

  /**
   * Add event listener
   */
  addEventListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback({ event, data });
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  /**
   * Utility methods
   */
  getFileName(path) {
    return path.split('/').pop() || path;
  }

  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSnapshotId() {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Handle workspace updates from room collaboration
   */
  handleRoomWorkspaceUpdate(data) {
    const { update } = data;
    
    try {
      switch (update.updateType) {
        case 'file_created':
          const ytext = new Y.Text(update.content || '');
          this.files.set(update.filePath, ytext);
          
          this.metadata.set(update.filePath, {
            name: update.fileName,
            type: update.fileType || 'text',
            size: (update.content || '').length,
            created: update.lastModified,
            modified: update.lastModified,
            createdBy: update.lastModifiedBy,
            modifiedBy: update.lastModifiedBy
          });
          
          this.notifyListeners('file_created', {
            path: update.filePath,
            name: update.fileName,
            content: update.content
          });
          break;
          
        case 'file_updated':
          const existingFile = this.files.get(update.filePath);
          if (existingFile) {
            // Update Yjs text
            existingFile.delete(0, existingFile.length);
            existingFile.insert(0, update.content || '');
          } else {
            // File doesn't exist, create it
            const newYtext = new Y.Text(update.content || '');
            this.files.set(update.filePath, newYtext);
          }
          
          // Update metadata
          const existingMeta = this.metadata.get(update.filePath) || {};
          this.metadata.set(update.filePath, {
            ...existingMeta,
            size: (update.content || '').length,
            modified: update.lastModified,
            modifiedBy: update.lastModifiedBy
          });
          
          this.notifyListeners('file_updated', {
            path: update.filePath,
            content: update.content
          });
          break;
          
        case 'file_deleted':
          this.files.delete(update.filePath);
          this.metadata.delete(update.filePath);
          
          this.notifyListeners('file_deleted', {
            path: update.filePath
          });
          break;
          
        case 'folder_created':
          this.fileTree.set(update.folderPath, {
            type: 'folder',
            name: this.getFileName(update.folderPath),
            path: update.folderPath,
            children: []
          });
          
          this.notifyListeners('folder_created', {
            path: update.folderPath,
            name: this.getFileName(update.folderPath)
          });
          break;
          
        case 'folder_deleted':
          this.fileTree.delete(update.folderPath);
          
          // Also remove files in the deleted folder
          for (const filePath of this.files.keys()) {
            if (filePath.startsWith(update.folderPath + '/')) {
              this.files.delete(filePath);
              this.metadata.delete(filePath);
            }
          }
          
          this.notifyListeners('folder_deleted', {
            path: update.folderPath
          });
          break;
          
        default:
          console.warn('Unknown room workspace update type:', update.updateType);
      }
      
      // Notify that the file tree structure may have changed
      this.notifyListeners('file_tree_updated', {
        files: Array.from(this.files.keys()),
        folders: Array.from(this.fileTree.keys())
      });
      
    } catch (error) {
      console.error('❌ Failed to handle room workspace update:', error);
    }
  }
  
  /**
   * Broadcast workspace changes to room participants
   */
  broadcastRoomUpdate(updateType, data) {
    if (!this.currentRoom || !this.socket) {
      return;
    }
    
    const updateData = {
      updateType,
      ...data,
      version: Date.now(),
      lastModified: new Date().toISOString(),
      lastModifiedBy: this.user?.uid || this.user?.id
    };
    
    this.socket.emit('room_workspace_update', updateData);
    console.log(`📡 Broadcasted room update: ${updateType}`);
  }
  
  /**
   * Override file operations to broadcast room updates
   */
  async createFileInRoom(path, content = '', options = {}) {
    await this.createFile(path, content, options);
    
    this.broadcastRoomUpdate('file_created', {
      filePath: path,
      fileName: this.getFileName(path),
      content,
      fileType: options.type || 'text'
    });
  }
  
  async updateFileInRoom(path, content) {
    await this.updateFile(path, content);
    
    this.broadcastRoomUpdate('file_updated', {
      filePath: path,
      content
    });
  }
  
  async deleteFileInRoom(path) {
    await this.deleteFile(path);
    
    this.broadcastRoomUpdate('file_deleted', {
      filePath: path
    });
  }
  
  async createFolderInRoom(path) {
    await this.createFolder(path);
    
    this.broadcastRoomUpdate('folder_created', {
      folderPath: path
    });
  }
  
  async deleteFolderInRoom(path) {
    await this.deleteFolder(path);
    
    this.broadcastRoomUpdate('folder_deleted', {
      folderPath: path
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.monacoBinding) {
      this.monacoBinding.destroy();
    }
    if (this.socket) {
      this.socket.disconnect();
    }
    this.ydoc.destroy();
    this.listeners.clear();
  }
}

// Export singleton instance
export const yjsFileSystem = new YjsFileSystem();
export default yjsFileSystem;
