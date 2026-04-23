/**
 * Firebase Configuration and Integration
 * Implements the Firestore schema from the architecture document
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator,
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
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  getStorage, 
  connectStorageEmulator,
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject,
  listAll
} from 'firebase/storage';
import { 
  getAuth, 
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "codecollab-dev.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "codecollab-dev",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "codecollab-dev.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.firestore = null;
    this.storage = null;
    this.isInitialized = false;
    this.currentUser = null;
    
    // Auth providers
    this.googleProvider = new GoogleAuthProvider();
    this.githubProvider = new GithubAuthProvider();
    
    // Event listeners
    this.authListeners = new Set();
  }

  /**
   * Initialize Firebase services
   */
  async initialize() {
    try {
      // Initialize Firebase app
      this.app = initializeApp(firebaseConfig);
      
      // Initialize services
      this.auth = getAuth(this.app);
      this.firestore = getFirestore(this.app);
      this.storage = getStorage(this.app);

      // Connect to emulators in development
      if (process.env.NODE_ENV === 'development' && !this.isInitialized) {
        try {
          // Use dynamic host for emulator connections
          const currentHost = window.location.hostname;
          const emulatorHost = currentHost === 'localhost' || currentHost === '127.0.0.1' ? 'localhost' : currentHost;
          
          connectAuthEmulator(this.auth, `http://${emulatorHost}:9099`);
          connectFirestoreEmulator(this.firestore, emulatorHost, 8080);
          connectStorageEmulator(this.storage, emulatorHost, 9199);
          console.log(`📧 Connected to Firebase emulators at ${emulatorHost}`);
        } catch (error) {
          console.log('⚠️ Firebase emulators not available, using production');
        }
      }

      // Set up auth state listener
      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        this.authListeners.forEach(listener => {
          try {
            listener(user);
          } catch (error) {
            console.error('Error in auth listener:', error);
          }
        });
      });

      this.isInitialized = true;
      console.log('🔥 Firebase initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }

  // ============= AUTHENTICATION =============

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  /**
   * Create account with email and password
   */
  async createAccount(email, password, displayName) {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Update user profile
      await updateDoc(doc(this.firestore, 'users', result.user.uid), {
        email: result.user.email,
        displayName: displayName,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });

      return result.user;
    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      await this.updateUserProfile(result.user);
      return result.user;
    } catch (error) {
      console.error('Google sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with GitHub
   */
  async signInWithGithub() {
    try {
      const result = await signInWithPopup(this.auth, this.githubProvider);
      await this.updateUserProfile(result.user);
      return result.user;
    } catch (error) {
      console.error('GitHub sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Update user profile in Firestore
   */
  async updateUserProfile(user) {
    try {
      await setDoc(doc(this.firestore, 'users', user.uid), {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  }

  /**
   * Add auth state listener
   */
  onAuthStateChanged(callback) {
    this.authListeners.add(callback);
    // Return unsubscribe function
    return () => this.authListeners.delete(callback);
  }

  // ============= PROJECT MANAGEMENT =============

  /**
   * Create new project
   * Schema: /projects/{projectId}
   */
  async createProject(projectData) {
    try {
      const projectId = 'project-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      const project = {
        id: projectId,
        name: projectData.name,
        description: projectData.description || '',
        ownerUid: this.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        visibility: projectData.visibility || 'private', // 'private' | 'team' | 'public'
        collaborators: { [this.currentUser.uid]: 'owner' },
        rootFolderId: null,
        latestSnapshotStoragePath: null,
        tags: projectData.tags || [],
        language: projectData.language || 'javascript'
      };

      await setDoc(doc(this.firestore, 'projects', projectId), project);
      
      // Create initial folder structure
      await this.createInitialFolders(projectId);
      
      return { projectId, ...project };
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId) {
    try {
      const projectDoc = await getDoc(doc(this.firestore, 'projects', projectId));
      if (!projectDoc.exists()) {
        throw new Error('Project not found');
      }
      return { id: projectDoc.id, ...projectDoc.data() };
    } catch (error) {
      console.error('Failed to get project:', error);
      throw error;
    }
  }

  /**
   * Get user's projects
   */
  async getUserProjects(userId = this.currentUser?.uid) {
    try {
      if (!userId) throw new Error('User not authenticated');

      const projectsQuery = query(
        collection(this.firestore, 'projects'),
        where(`collaborators.${userId}`, 'in', ['owner', 'admin', 'editor', 'viewer']),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(projectsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Failed to get user projects:', error);
      throw error;
    }
  }

  /**
   * Update project
   */
  async updateProject(projectId, updates) {
    try {
      await updateDoc(doc(this.firestore, 'projects', projectId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId) {
    try {
      const batch = writeBatch(this.firestore);
      
      // Delete all files
      const filesQuery = query(collection(this.firestore, 'projects', projectId, 'files'));
      const filesSnapshot = await getDocs(filesQuery);
      
      for (const fileDoc of filesSnapshot.docs) {
        batch.delete(fileDoc.ref);
        
        // Delete from storage if exists
        const fileData = fileDoc.data();
        if (fileData.storagePath) {
          try {
            await deleteObject(ref(this.storage, fileData.storagePath));
          } catch (error) {
            console.warn('Failed to delete file from storage:', error);
          }
        }
      }

      // Delete all snapshots
      const snapshotsQuery = query(collection(this.firestore, 'projects', projectId, 'snapshots'));
      const snapshotsSnapshot = await getDocs(snapshotsQuery);
      
      for (const snapshotDoc of snapshotsSnapshot.docs) {
        batch.delete(snapshotDoc.ref);
        
        // Delete from storage
        const snapshotData = snapshotDoc.data();
        if (snapshotData.storagePath) {
          try {
            await deleteObject(ref(this.storage, snapshotData.storagePath));
          } catch (error) {
            console.warn('Failed to delete snapshot from storage:', error);
          }
        }
      }

      // Delete project
      batch.delete(doc(this.firestore, 'projects', projectId));
      
      await batch.commit();
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  // ============= FILE MANAGEMENT =============

  /**
   * Create file
   * Schema: /projects/{projectId}/files/{fileId}
   */
  async createFile(projectId, fileData) {
    try {
      const fileId = fileData.id || ('file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
      
      const file = {
        id: fileId,
        path: fileData.path,
        name: fileData.name,
        type: fileData.type || 'file', // 'file' | 'folder'
        mime: fileData.mime || 'text/plain',
        size: fileData.size || 0,
        contentText: fileData.content && fileData.content.length < 10000 ? fileData.content : null,
        storagePath: null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedByUid: this.currentUser.uid,
        parentId: fileData.parentId || null,
        isDeleted: false
      };

      // If content is large, save to Storage
      if (fileData.content && fileData.content.length >= 10000) {
        const storagePath = `projects/${projectId}/files/${fileId}`;
        const storageRef = ref(this.storage, storagePath);
        
        await uploadBytes(storageRef, new Blob([fileData.content], { type: file.mime }));
        file.storagePath = storagePath;
        file.contentText = null;
      }

      await setDoc(doc(this.firestore, 'projects', projectId, 'files', fileId), file);
      
      return { fileId, ...file };
    } catch (error) {
      console.error('Failed to create file:', error);
      throw error;
    }
  }

  /**
   * Get file
   */
  async getFile(projectId, fileId) {
    try {
      const fileDoc = await getDoc(doc(this.firestore, 'projects', projectId, 'files', fileId));
      if (!fileDoc.exists()) {
        throw new Error('File not found');
      }

      const fileData = fileDoc.data();
      
      // Load content from Storage if needed
      if (fileData.storagePath && !fileData.contentText) {
        try {
          const storageRef = ref(this.storage, fileData.storagePath);
          const url = await getDownloadURL(storageRef);
          const response = await fetch(url);
          fileData.content = await response.text();
        } catch (error) {
          console.warn('Failed to load content from storage:', error);
          fileData.content = '';
        }
      } else {
        fileData.content = fileData.contentText || '';
      }

      return { id: fileDoc.id, ...fileData };
    } catch (error) {
      console.error('Failed to get file:', error);
      throw error;
    }
  }

  /**
   * Get all files for a project
   */
  async getProjectFiles(projectId) {
    try {
      const filesQuery = query(
        collection(this.firestore, 'projects', projectId, 'files'),
        where('isDeleted', '==', false),
        orderBy('path')
      );

      const snapshot = await getDocs(filesQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Failed to get project files:', error);
      throw error;
    }
  }

  /**
   * Update file
   */
  async updateFile(projectId, fileId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedByUid: this.currentUser.uid
      };

      // Handle content updates
      if (updates.content !== undefined) {
        if (updates.content.length < 10000) {
          updateData.contentText = updates.content;
          updateData.storagePath = null;
        } else {
          // Save to Storage
          const storagePath = `projects/${projectId}/files/${fileId}`;
          const storageRef = ref(this.storage, storagePath);
          
          await uploadBytes(storageRef, new Blob([updates.content], { type: updates.mime || 'text/plain' }));
          updateData.storagePath = storagePath;
          updateData.contentText = null;
        }
        
        updateData.size = updates.content.length;
        delete updateData.content; // Don't store in Firestore
      }

      await updateDoc(doc(this.firestore, 'projects', projectId, 'files', fileId), updateData);
    } catch (error) {
      console.error('Failed to update file:', error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(projectId, fileId) {
    try {
      // Soft delete by default
      await updateDoc(doc(this.firestore, 'projects', projectId, 'files', fileId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedByUid: this.currentUser.uid
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * Hard delete file (permanent)
   */
  async hardDeleteFile(projectId, fileId) {
    try {
      const fileDoc = await getDoc(doc(this.firestore, 'projects', projectId, 'files', fileId));
      if (fileDoc.exists()) {
        const fileData = fileDoc.data();
        
        // Delete from Storage if exists
        if (fileData.storagePath) {
          try {
            await deleteObject(ref(this.storage, fileData.storagePath));
          } catch (error) {
            console.warn('Failed to delete from storage:', error);
          }
        }
      }

      // Delete from Firestore
      await deleteDoc(doc(this.firestore, 'projects', projectId, 'files', fileId));
    } catch (error) {
      console.error('Failed to hard delete file:', error);
      throw error;
    }
  }

  // ============= SNAPSHOT MANAGEMENT =============

  /**
   * Create project snapshot
   * Schema: /projects/{projectId}/snapshots/{snapshotId}
   */
  async createSnapshot(projectId, snapshotData) {
    try {
      const snapshotId = 'snapshot-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // Upload snapshot data to Storage
      const storagePath = `projects/${projectId}/snapshots/${snapshotId}.json`;
      const storageRef = ref(this.storage, storagePath);
      
      const snapshotBlob = new Blob([JSON.stringify(snapshotData)], { type: 'application/json' });
      await uploadBytes(storageRef, snapshotBlob);

      // Save metadata to Firestore
      const snapshot = {
        id: snapshotId,
        createdAt: serverTimestamp(),
        createdByUid: this.currentUser.uid,
        storagePath,
        message: snapshotData.message || 'Project snapshot',
        fileCount: snapshotData.fileCount || 0,
        size: snapshotBlob.size
      };

      await setDoc(doc(this.firestore, 'projects', projectId, 'snapshots', snapshotId), snapshot);
      
      // Update project's latest snapshot
      await updateDoc(doc(this.firestore, 'projects', projectId), {
        latestSnapshotStoragePath: storagePath,
        updatedAt: serverTimestamp()
      });

      return { snapshotId, ...snapshot };
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      throw error;
    }
  }

  /**
   * Get snapshot
   */
  async getSnapshot(projectId, snapshotId) {
    try {
      const snapshotDoc = await getDoc(doc(this.firestore, 'projects', projectId, 'snapshots', snapshotId));
      if (!snapshotDoc.exists()) {
        throw new Error('Snapshot not found');
      }

      const snapshotMeta = snapshotDoc.data();
      
      // Download snapshot data from Storage
      const storageRef = ref(this.storage, snapshotMeta.storagePath);
      const url = await getDownloadURL(storageRef);
      const response = await fetch(url);
      const snapshotData = await response.json();

      return {
        id: snapshotDoc.id,
        ...snapshotMeta,
        data: snapshotData
      };
    } catch (error) {
      console.error('Failed to get snapshot:', error);
      throw error;
    }
  }

  /**
   * Get project snapshots
   */
  async getProjectSnapshots(projectId) {
    try {
      const snapshotsQuery = query(
        collection(this.firestore, 'projects', projectId, 'snapshots'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(snapshotsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Failed to get project snapshots:', error);
      throw error;
    }
  }

  // ============= COLLABORATION =============

  /**
   * Add collaborator to project
   */
  async addCollaborator(projectId, userId, role = 'editor') {
    try {
      await updateDoc(doc(this.firestore, 'projects', projectId), {
        [`collaborators.${userId}`]: role,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to add collaborator:', error);
      throw error;
    }
  }

  /**
   * Remove collaborator from project
   */
  async removeCollaborator(projectId, userId) {
    try {
      await updateDoc(doc(this.firestore, 'projects', projectId), {
        [`collaborators.${userId}`]: null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      throw error;
    }
  }

  /**
   * Listen for project changes
   */
  onProjectChange(projectId, callback) {
    return onSnapshot(doc(this.firestore, 'projects', projectId), callback);
  }

  /**
   * Listen for file changes
   */
  onProjectFilesChange(projectId, callback) {
    const filesQuery = query(
      collection(this.firestore, 'projects', projectId, 'files'),
      where('isDeleted', '==', false)
    );
    return onSnapshot(filesQuery, callback);
  }

  // ============= STORAGE UTILITIES =============

  /**
   * Upload file to Storage
   */
  async uploadFile(path, file, onProgress) {
    try {
      const storageRef = ref(this.storage, path);
      
      if (onProgress) {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        return new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(progress);
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ path, downloadURL });
            }
          );
        });
      } else {
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        return { path, downloadURL };
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Get download URL
   */
  async getDownloadURL(path) {
    try {
      const storageRef = ref(this.storage, path);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Failed to get download URL:', error);
      throw error;
    }
  }

  // ============= UTILITY METHODS =============

  /**
   * Create initial folder structure for new project
   */
  async createInitialFolders(projectId) {
    const folders = [
      { path: '/', name: 'root', type: 'folder' },
      { path: '/src', name: 'src', type: 'folder' },
      { path: '/public', name: 'public', type: 'folder' },
      { path: '/assets', name: 'assets', type: 'folder' }
    ];

    const batch = writeBatch(this.firestore);
    
    for (const folder of folders) {
      const folderId = 'folder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const folderRef = doc(this.firestore, 'projects', projectId, 'files', folderId);
      
      batch.set(folderRef, {
        id: folderId,
        path: folder.path,
        name: folder.name,
        type: folder.type,
        mime: 'application/x-directory',
        size: 0,
        contentText: null,
        storagePath: null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedByUid: this.currentUser.uid,
        parentId: null,
        isDeleted: false
      });
    }

    await batch.commit();
  }

  /**
   * Check if user has permission for project
   */
  async checkProjectPermission(projectId, requiredRole = 'viewer') {
    try {
      const project = await this.getProject(projectId);
      const userRole = project.collaborators[this.currentUser.uid];
      
      const roleHierarchy = ['viewer', 'editor', 'admin', 'owner'];
      const userRoleIndex = roleHierarchy.indexOf(userRole);
      const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
      
      return userRoleIndex >= requiredRoleIndex;
    } catch (error) {
      console.error('Failed to check project permission:', error);
      return false;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if initialized
   */
  isReady() {
    return this.isInitialized;
  }
}

// Export singleton instance
export default new FirebaseService();
