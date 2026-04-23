import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  enableNetwork,
  disableNetwork,
  Timestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithCredential,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Firebase configuration for Yjs-based CodeCollab
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase only if all required config is present
let app, db, auth, storage, googleProvider;
const FIREBASE_ENABLED = process.env.REACT_APP_FIREBASE_ENABLED === 'true' && 
                         firebaseConfig.apiKey && 
                         firebaseConfig.projectId;

if (FIREBASE_ENABLED) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    
    // Configure Google provider
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Enable offline persistence
    enableNetwork(db).catch((error) => {
      console.warn('Firebase offline persistence failed:', error);
    });
    
    console.log('✅ Firebase initialized successfully for project:', firebaseConfig.projectId);
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed, using localStorage fallback:', error);
  }
} else {
  console.log('📱 Using localStorage for data management (Firebase disabled or misconfigured)');
  console.log('Firebase config check:', {
    enabled: process.env.REACT_APP_FIREBASE_ENABLED === 'true',
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId
  });
}

// Database service class for user management
export class DatabaseService {
  constructor() {
    this.isFirebaseAvailable = FIREBASE_ENABLED && !!db;
    this.cache = new Map();
  }

  // User Management
  async createUser(userData) {
    const userDoc = {
      ...userData,
      createdAt: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString(),
      updatedAt: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString(),
      isOnline: false,
      lastActivity: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString()
    };

    if (this.isFirebaseAvailable) {
      try {
        const docRef = await addDoc(collection(db, 'users'), userDoc);
        console.log('✅ User created in Firebase:', docRef.id);
        return { id: docRef.id, ...userDoc };
      } catch (error) {
        console.warn('⚠️ Firebase user creation failed:', error);
      }
    }

    // Fallback to localStorage
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const user = { id: userId, ...userDoc };
    localStorage.setItem(`codecollab_user_${userId}`, JSON.stringify(user));
    return user;
  }

  async getUser(userId) {
    if (this.cache.has(userId)) {
      return this.cache.get(userId);
    }

    if (this.isFirebaseAvailable) {
      try {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          const userData = { id: userId, ...docSnap.data() };
          this.cache.set(userId, userData);
          return userData;
        }
      } catch (error) {
        console.warn('Failed to get user from Firebase:', error);
      }
    }

    // Fallback to localStorage
    const userData = localStorage.getItem(`codecollab_user_${userId}`);
    return userData ? JSON.parse(userData) : null;
  }

  async updateUser(userId, updates) {
    const updateData = {
      ...updates,
      updatedAt: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString()
    };

    if (this.isFirebaseAvailable) {
      try {
        await updateDoc(doc(db, 'users', userId), updateData);
        console.log('✅ User updated in Firebase');
        
        // Update cache
        if (this.cache.has(userId)) {
          this.cache.set(userId, { ...this.cache.get(userId), ...updateData });
        }
        return true;
      } catch (error) {
        console.warn('⚠️ Firebase user update failed:', error);
      }
    }

    // Fallback to localStorage
    const existingUser = localStorage.getItem(`codecollab_user_${userId}`);
    if (existingUser) {
      const user = { ...JSON.parse(existingUser), ...updateData };
      localStorage.setItem(`codecollab_user_${userId}`, JSON.stringify(user));
      return true;
    }
    return false;
  }

  // Project Management
  async createProject(projectData) {
    const projectDoc = {
      ...projectData,
      createdAt: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString(),
      updatedAt: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString(),
      fileCount: 0,
      collaborators: projectData.collaborators || []
    };

    if (this.isFirebaseAvailable) {
      try {
        const docRef = await addDoc(collection(db, 'projects'), projectDoc);
        console.log('✅ Project created in Firebase:', docRef.id);
        return { id: docRef.id, ...projectDoc };
      } catch (error) {
        console.warn('⚠️ Firebase project creation failed:', error);
      }
    }

    // Fallback to localStorage
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const project = { id: projectId, ...projectDoc };
    localStorage.setItem(`codecollab_project_${projectId}`, JSON.stringify(project));
    return project;
  }

  async getUserProjects(userId) {
    if (this.isFirebaseAvailable) {
      try {
        const q = query(
          collection(db, 'projects'),
          where('collaborators', 'array-contains', userId),
          orderBy('updatedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.warn('Failed to get projects from Firebase:', error);
      }
    }

    // Fallback to localStorage
    const projects = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('codecollab_project_')) {
        try {
          const project = JSON.parse(localStorage.getItem(key));
          if (project.collaborators?.some(c => c.id === userId)) {
            projects.push(project);
          }
        } catch (error) {
          console.warn('Failed to parse project:', key);
        }
      }
    }
    return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async updateProject(projectId, updates) {
    const updateData = {
      ...updates,
      updatedAt: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString()
    };

    if (this.isFirebaseAvailable) {
      try {
        await updateDoc(doc(db, 'projects', projectId), updateData);
        console.log('✅ Project updated in Firebase');
        return true;
      } catch (error) {
        console.warn('⚠️ Firebase project update failed:', error);
      }
    }

    // Fallback to localStorage
    const existingProject = localStorage.getItem(`codecollab_project_${projectId}`);
    if (existingProject) {
      const project = { ...JSON.parse(existingProject), ...updateData };
      localStorage.setItem(`codecollab_project_${projectId}`, JSON.stringify(project));
      return true;
    }
    return false;
  }

  async deleteProject(projectId) {
    if (this.isFirebaseAvailable) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        console.log('✅ Project deleted from Firebase');
        return true;
      } catch (error) {
        console.warn('⚠️ Firebase project deletion failed:', error);
      }
    }

    // Fallback to localStorage
    localStorage.removeItem(`codecollab_project_${projectId}`);
    return true;
  }

  // Activity Log Management
  async logActivity(activityData) {
    const activityDoc = {
      ...activityData,
      timestamp: this.isFirebaseAvailable ? serverTimestamp() : new Date().toISOString(),
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    if (this.isFirebaseAvailable) {
      try {
        await addDoc(collection(db, 'activities'), activityDoc);
        console.log('✅ Activity logged in Firebase');
        return activityDoc;
      } catch (error) {
        console.warn('⚠️ Firebase activity logging failed:', error);
      }
    }

    // Fallback to localStorage
    const activities = this.getLocalActivities();
    activities.unshift(activityDoc);
    // Keep only last 1000 activities in localStorage
    if (activities.length > 1000) {
      activities.splice(1000);
    }
    localStorage.setItem('codecollab_activities', JSON.stringify(activities));
    return activityDoc;
  }

  async getProjectActivities(projectId, limit = 50) {
    if (this.isFirebaseAvailable) {
      try {
        const q = query(
          collection(db, 'activities'),
          where('projectId', '==', projectId),
          orderBy('timestamp', 'desc'),
          limit(limit)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.warn('Failed to get activities from Firebase:', error);
      }
    }

    // Fallback to localStorage
    const activities = this.getLocalActivities();
    return activities
      .filter(activity => activity.projectId === projectId)
      .slice(0, limit);
  }

  getLocalActivities() {
    try {
      const activities = localStorage.getItem('codecollab_activities');
      return activities ? JSON.parse(activities) : [];
    } catch (error) {
      return [];
    }
  }

  // File Storage (for avatars, project files, etc.)
  async uploadFile(file, path) {
    if (this.isFirebaseAvailable && storage) {
      try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('✅ File uploaded to Firebase Storage');
        return downloadURL;
      } catch (error) {
        console.warn('⚠️ Firebase file upload failed:', error);
      }
    }

    // Fallback: convert to base64 for localStorage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Real-time subscriptions
  subscribeToProject(projectId, callback) {
    if (this.isFirebaseAvailable) {
      try {
        return onSnapshot(doc(db, 'projects', projectId), (doc) => {
          if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
          }
        });
      } catch (error) {
        console.warn('Failed to subscribe to project:', error);
      }
    }

    // Fallback: polling for localStorage
    const pollInterval = setInterval(() => {
      const project = localStorage.getItem(`codecollab_project_${projectId}`);
      if (project) {
        callback(JSON.parse(project));
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }

  subscribeToActivities(projectId, callback) {
    if (this.isFirebaseAvailable) {
      try {
        const q = query(
          collection(db, 'activities'),
          where('projectId', '==', projectId),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        return onSnapshot(q, (querySnapshot) => {
          const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(activities);
        });
      } catch (error) {
        console.warn('Failed to subscribe to activities:', error);
      }
    }

    // Fallback: polling for localStorage
    const pollInterval = setInterval(() => {
      const activities = this.getProjectActivities(projectId, 20);
      callback(activities);
    }, 5000);

    return () => clearInterval(pollInterval);
  }

  // Collaboration settings
  async saveCollaborationSettings(userId, settings) {
    return this.updateUser(userId, { collaborationSettings: settings });
  }

  async getCollaborationSettings(userId) {
    const user = await this.getUser(userId);
    return user?.collaborationSettings || {};
  }
}

// Create a singleton instance
export const databaseService = new DatabaseService();

// Session management class - Enhanced with Firebase integration
export class SessionManager {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.isFirebaseAvailable = FIREBASE_ENABLED && !!db;
    this.listeners = new Map();
    this.dbService = databaseService;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save session data with improved error handling and Firebase integration
  async saveSession(sessionData) {
    const data = {
      ...sessionData,
      lastUpdated: Date.now(),
      sessionId: this.sessionId,
      version: '2.0'
    };

    // Enhanced Firebase session storage
    if (this.isFirebaseAvailable) {
      try {
        await setDoc(doc(db, 'sessions', this.sessionId), data);
        console.log('✅ Session saved to Firebase');
        
        // Also log session activity
        await this.dbService.logActivity({
          type: 'session_save',
          action: 'saved session',
          target: this.sessionId,
          user: sessionData.user || { id: 'anonymous', name: 'Anonymous User' },
          projectId: sessionData.projectId,
          details: {
            fileCount: Object.keys(sessionData.virtualFileSystem || {}).length,
            tabCount: (sessionData.tabs || []).length
          }
        });
        
        return true;
      } catch (error) {
        console.warn('⚠️ Firebase save failed, using localStorage fallback:', error.message);
        this.isFirebaseAvailable = false; // Disable Firebase for this session
      }
    }

    // Enhanced localStorage fallback
    try {
      const storageKey = `codecollab_session_${this.sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(data));
      
      // Save session metadata for quick listing
      const metadata = {
        id: this.sessionId,
        lastUpdated: data.lastUpdated,
        fileCount: Object.keys(data.virtualFileSystem || {}).length,
        tabCount: (data.tabs || []).length,
        projectName: data.projectName || 'Untitled Project',
        user: data.user
      };
      
      const allSessions = this.getLocalSessionsMetadata();
      allSessions[this.sessionId] = metadata;
      localStorage.setItem('codecollab_sessions_metadata', JSON.stringify(allSessions));
      
      console.log('💾 Session saved to localStorage');
      return true;
    } catch (error) {
      console.error('❌ Failed to save session to localStorage:', error);
      return false;
    }
  }

  // Enhanced session loading with better error handling
  async loadSession(sessionId = null) {
    const targetSessionId = sessionId || this.sessionId;

    // Try Firebase first
    if (this.isFirebaseAvailable) {
      try {
        const docRef = doc(db, 'sessions', targetSessionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('✅ Session loaded from Firebase');
          
          // Log session load activity
          await this.dbService.logActivity({
            type: 'session_load',
            action: 'loaded session',
            target: targetSessionId,
            user: data.user || { id: 'anonymous', name: 'Anonymous User' },
            projectId: data.projectId,
            details: {
              fileCount: Object.keys(data.virtualFileSystem || {}).length,
              version: data.version || '1.0'
            }
          });
          
          return data;
        }
      } catch (error) {
        console.warn('Failed to load from Firebase, trying localStorage:', error);
      }
    }

    // Enhanced localStorage fallback
    try {
      const data = localStorage.getItem(`codecollab_session_${targetSessionId}`);
      if (data) {
        const sessionData = JSON.parse(data);
        console.log('💾 Session loaded from localStorage');
        return sessionData;
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }

    return null;
  }

  // Enhanced real-time session updates
  subscribeToSession(sessionId, callback) {
    if (this.isFirebaseAvailable) {
      try {
        const docRef = doc(db, 'sessions', sessionId);
        const unsubscribe = onSnapshot(docRef, (doc) => {
          if (doc.exists()) {
            callback(doc.data());
          }
        }, (error) => {
          console.warn('Firebase subscription error:', error);
          // Fallback to polling
          this.startPolling(sessionId, callback);
        });
        
        this.listeners.set(sessionId, unsubscribe);
        return unsubscribe;
      } catch (error) {
        console.warn('Failed to subscribe to Firebase, using polling fallback:', error);
      }
    }

    // Enhanced polling fallback
    return this.startPolling(sessionId, callback);
  }

  startPolling(sessionId, callback) {
    const pollInterval = setInterval(async () => {
      try {
        const data = await this.loadSession(sessionId);
        if (data) callback(data);
      } catch (error) {
        console.warn('Polling error:', error);
      }
    }, 2000);

    const cleanup = () => clearInterval(pollInterval);
    this.listeners.set(sessionId, cleanup);
    return cleanup;
  }

  // Unsubscribe from session updates
  unsubscribeFromSession(sessionId) {
    const unsubscribe = this.listeners.get(sessionId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(sessionId);
    }
  }

  // Enhanced session listing with better metadata
  async listSessions() {
    const sessions = [];
    
    // Try Firebase first for authenticated users
    if (this.isFirebaseAvailable) {
      try {
        const q = query(
          collection(db, 'sessions'),
          orderBy('lastUpdated', 'desc'),
          limit(20)
        );
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          sessions.push({
            id: doc.id,
            lastUpdated: data.lastUpdated,
            fileCount: Object.keys(data.virtualFileSystem || {}).length,
            tabCount: (data.tabs || []).length,
            projectName: data.projectName || 'Untitled Project',
            user: data.user,
            source: 'firebase'
          });
        });
        
        if (sessions.length > 0) {
          return sessions;
        }
      } catch (error) {
        console.warn('Failed to list sessions from Firebase:', error);
      }
    }

    // Enhanced localStorage fallback
    const metadata = this.getLocalSessionsMetadata();
    const localSessions = Object.values(metadata)
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
      .map(session => ({ ...session, source: 'localStorage' }));
    
    return [...sessions, ...localSessions];
  }

  getLocalSessionsMetadata() {
    try {
      const metadata = localStorage.getItem('codecollab_sessions_metadata');
      return metadata ? JSON.parse(metadata) : {};
    } catch (error) {
      // Fallback: scan localStorage for session files
      const sessions = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('codecollab_session_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const sessionId = data.sessionId || key.replace('codecollab_session_', '');
            sessions[sessionId] = {
              id: sessionId,
              lastUpdated: data.lastUpdated,
              fileCount: Object.keys(data.virtualFileSystem || {}).length,
              tabCount: (data.tabs || []).length,
              projectName: data.projectName || 'Untitled Project',
              user: data.user
            };
          } catch (parseError) {
            console.warn('Failed to parse session:', key);
          }
        }
      }
      return sessions;
    }
  }

  // Enhanced session deletion
  async deleteSession(sessionId) {
    let deleted = false;
    
    if (this.isFirebaseAvailable) {
      try {
        await deleteDoc(doc(db, 'sessions', sessionId));
        console.log('✅ Session deleted from Firebase');
        deleted = true;
      } catch (error) {
        console.warn('Failed to delete from Firebase:', error);
      }
    }

    // Always try to delete from localStorage
    try {
      localStorage.removeItem(`codecollab_session_${sessionId}`);
      
      // Update metadata
      const metadata = this.getLocalSessionsMetadata();
      delete metadata[sessionId];
      localStorage.setItem('codecollab_sessions_metadata', JSON.stringify(metadata));
      
      console.log('💾 Session deleted from localStorage');
      deleted = true;
    } catch (error) {
      console.warn('Failed to delete from localStorage:', error);
    }

    return deleted;
  }

  // Cleanup old sessions
  async cleanupOldSessions(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
    const cutoffTime = Date.now() - maxAge;
    const sessions = await this.listSessions();
    
    for (const session of sessions) {
      if (session.lastUpdated < cutoffTime) {
        await this.deleteSession(session.id);
        console.log(`🧹 Cleaned up old session: ${session.id}`);
      }
    }
  }

  // Export session data
  async exportSession(sessionId) {
    const data = await this.loadSession(sessionId);
    if (!data) return null;

    const exportData = {
      metadata: {
        sessionId: data.sessionId,
        lastUpdated: new Date(data.lastUpdated).toISOString(),
        exportedAt: new Date().toISOString(),
        version: data.version || '1.0'
      },
      project: {
        name: data.projectName || 'Untitled Project',
        description: data.projectDescription || ''
      },
      files: data.virtualFileSystem || {},
      tabs: data.tabs || [],
      user: data.user
    };

    return exportData;
  }
}

export const sessionManager = new SessionManager();

// Google Authentication Service
export class GoogleAuthService {
  constructor() {
    this.isAvailable = FIREBASE_ENABLED && !!auth && !!googleProvider;
  }

  // Sign in with Google
  async signInWithGoogle() {
    if (!this.isAvailable) {
      throw new Error('Google authentication is not available. Please enable Firebase.');
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Get the Google Access Token
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      // Extract user information
      const userData = {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'Google User',
        avatar: user.photoURL || null,
        role: 'user',
        provider: 'google',
        isEmailVerified: user.emailVerified,
        createdAt: user.metadata.creationTime,
        lastLoginAt: user.metadata.lastSignInTime
      };

      // Save user data to database
      await databaseService.createUser(userData);

      // Log activity
      await databaseService.logActivity({
        type: 'user_login',
        action: 'signed in with Google',
        target: 'account',
        user: {
          id: userData.id,
          name: userData.name,
          avatar: userData.avatar
        },
        details: {
          provider: 'google',
          email: userData.email
        }
      });

      console.log('✅ Google sign-in successful');
      return {
        success: true,
        user: userData,
        token: await user.getIdToken() // Get Firebase ID token
      };
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Another sign-in attempt is already in progress.';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with the same email but different sign-in credentials.';
      }

      throw new Error(errorMessage);
    }
  }

  // Link Google account to existing account
  async linkGoogleAccount(currentUser) {
    if (!this.isAvailable) {
      throw new Error('Google authentication is not available.');
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      // Link the credential to the current user
      await linkWithCredential(currentUser, credential);
      
      console.log('✅ Google account linked successfully');
      return { success: true };
    } catch (error) {
      console.error('Google account linking error:', error);
      throw new Error('Failed to link Google account. Please try again.');
    }
  }

  // Get current Firebase user
  getCurrentUser() {
    return auth?.currentUser || null;
  }

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    if (!this.isAvailable) {
      return () => {}; // Return empty unsubscribe function
    }
    
    return onAuthStateChanged(auth, callback);
  }

  // Sign out from Google
  async signOut() {
    if (!this.isAvailable) {
      return;
    }

    try {
      await signOut(auth);
      console.log('✅ Google sign-out successful');
    } catch (error) {
      console.error('Google sign-out error:', error);
      throw new Error('Failed to sign out from Google.');
    }
  }

  // Check if user is signed in with Google
  isSignedInWithGoogle() {
    const user = this.getCurrentUser();
    return user?.providerData?.some(provider => provider.providerId === 'google.com') || false;
  }
}

// Create singleton instance
export const googleAuthService = new GoogleAuthService();

// Export Firebase instances and utilities for Yjs file system
export { 
  db, 
  auth, 
  storage, 
  googleProvider,
  Timestamp,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  uploadBytes,
  getDownloadURL,
  ref,
  onSnapshot
};
