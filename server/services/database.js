const { User, Project, Activity, Session } = require('../models/User');

// Firebase Admin SDK initialization
let admin;
let db;
let auth;

// Check if Firebase should be enabled
const firebaseEnabled = process.env.ENABLE_FIREBASE === 'true';
const hasValidFirebaseConfig = (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_KEY) && process.env.FIREBASE_PROJECT_ID;

if (firebaseEnabled && hasValidFirebaseConfig) {
  try {
    admin = require('firebase-admin');

    // Check if Firebase Admin SDK is already initialized (by main server)
    if (admin.apps.length > 0) {
      // Use the existing Firebase app
      const app = admin.apps[0];
      db = app.firestore();
      auth = app.auth();
      console.log('✅ Using existing Firebase Admin SDK instance from main server');
    } else {
      // Initialize Firebase Admin SDK if not already done
      let credential;

      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          // Use service account from environment variable
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          credential = admin.credential.cert(serviceAccount);
        } catch (parseError) {
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON: ' + parseError.message);
        }
      } else if (process.env.FIREBASE_ADMIN_KEY) {
        try {
          // Use admin key from environment variable
          const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
          credential = admin.credential.cert(serviceAccount);
        } catch (parseError) {
          throw new Error('Invalid FIREBASE_ADMIN_KEY JSON: ' + parseError.message);
        }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account from file path
        credential = admin.credential.applicationDefault();
      } else {
        throw new Error('No valid Firebase credentials found');
      }

      const app = admin.initializeApp({
        credential: credential,
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      db = app.firestore();
      auth = app.auth();
      console.log('✅ Firebase Admin SDK initialized successfully in database service');
    }
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed:', error.message);
    console.warn('📦 Falling back to in-memory storage');
    admin = null;
    db = null;
    auth = null;
  }
} else {
  console.log('📦 Firebase disabled - using in-memory storage only');
  admin = null;
  db = null;
  auth = null;
}

// Database service for file operations
class DatabaseService {
  constructor() {
    // Firebase Firestore or in-memory storage fallback
    this.isFirebaseAvailable = !!db;
    this.projects = new Map();
    this.users = new Map();
    this.activities = [];
    
    console.log(`📦 Database Service initialized with ${this.isFirebaseAvailable ? 'Firebase' : 'in-memory'} storage`);
  }

  // Project operations
  async createProject(projectData, userId) {
    const projectId = this.generateId('project');
    const project = new Project({
      id: projectId,
      name: projectData.name,
      description: projectData.description,
      owner: userId,
      ownerName: projectData.ownerName,
      visibility: projectData.visibility || 'private',
      language: projectData.language || 'javascript',
      collaborators: [userId]
    });

    this.projects.set(projectId, project);

    // Create activity record
    const activity = new Activity({
      type: 'project_operation',
      action: 'project_created',
      target: project.name,
      user: {
        id: userId,
        name: projectData.ownerName
      },
      projectId: projectId,
      details: {
        visibility: project.visibility,
        language: project.language
      }
    });

    this.activities.push(activity);

    console.log(`📂 Project created in database: ${project.name} by ${projectData.ownerName}`);
    return project;
  }

  async getProject(projectId) {
    return this.projects.get(projectId);
  }

  async getProjectsByUser(userId) {
    const userProjects = [];
    for (const [id, project] of this.projects.entries()) {
      if (project.owner === userId || project.collaborators.includes(userId)) {
        userProjects.push(project);
      }
    }
    return userProjects;
  }

  // Activity operations
  async getActivities(projectId = null, limit = 50) {
    let filteredActivities = this.activities;
    
    if (projectId) {
      filteredActivities = this.activities.filter(activity => activity.projectId === projectId);
    }

    return filteredActivities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // Utility methods
  generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Firebase-specific methods
  async authenticateGoogleUser(idToken) {
    if (!this.isFirebaseAvailable || !auth) {
      // Fallback for development when Firebase is disabled
      console.log('🔄 Firebase disabled - using mock authentication');
      
      // Create a mock user for development
      const mockUser = {
        id: 'dev_user_' + Date.now(),
        email: 'dev@codecollab.com',
        name: 'Development User',
        avatar: '/api/placeholder/32/32',
        role: 'user',
        provider: 'mock',
        emailVerified: true
      };

      return {
        success: true,
        user: mockUser,
        token: 'mock_token_' + Date.now()
      };
    }

    try {
      // Verify the Google ID token
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;
      const name = decodedToken.name || email.split('@')[0];
      const picture = decodedToken.picture;

      // Get or create user in Firebase
      let userRecord;
      try {
        userRecord = await auth.getUser(uid);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            uid,
            email,
            displayName: name,
            photoURL: picture,
            emailVerified: decodedToken.email_verified || false
          });
        } else {
          throw error;
        }
      }

      // Store user data in Firestore
      const userData = {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || name,
        avatar: userRecord.photoURL || picture,
        provider: 'google',
        emailVerified: userRecord.emailVerified,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        projectCount: 0,
        isActive: true
      };

      await db.collection('users').doc(uid).set(userData, { merge: true });

      // Generate custom token for the client
      const customToken = await auth.createCustomToken(uid);

      console.log(`✅ Google user authenticated: ${email}`);
      return {
        success: true,
        user: {
          id: uid,
          email: userRecord.email,
          name: userRecord.displayName || name,
          avatar: userRecord.photoURL || picture,
          role: 'user',
          provider: 'google',
          emailVerified: userRecord.emailVerified
        },
        token: customToken
      };
    } catch (error) {
      console.error('❌ Google authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async logActivity(activity) {
    // Store in memory
    this.activities.push(activity);

    // Store in Firebase if available
    if (this.isFirebaseAvailable) {
      try {
        const activityDoc = {
          ...activity,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('activities').add(activityDoc);
      } catch (error) {
        console.warn('Failed to log activity to Firebase:', error);
      }
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;
