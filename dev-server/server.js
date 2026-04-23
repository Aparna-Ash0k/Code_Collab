const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = 3002;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    let adminConfig = {};
    
    // Try to use the service account file directly first
    const serviceAccountPath = path.resolve(__dirname, 'codecollab-v2-firebase-adminsdk.json');
    console.log('🔑 Attempting to use service account file:', serviceAccountPath);
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log('✅ Service account file found, using it directly');
      adminConfig = {
        credential: admin.credential.cert(serviceAccountPath),
        projectId: 'codecollab-v2'
      };
    } else {
      console.log('❌ Service account file not found, falling back to environment variables');
      
      console.log('🔍 Debugging environment variables:');
      console.log('  GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('  FIREBASE_SERVICE_ACCOUNT_KEY length:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length : 'undefined');
      console.log('  All env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('FIREBASE')));
      
      // Option 1: Try to use service account key file from env var
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const envServiceAccountPath = path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS);
        console.log('🔑 Using service account key from env var:', envServiceAccountPath);
        
        if (!fs.existsSync(envServiceAccountPath)) {
          throw new Error(`Service account key file not found: ${envServiceAccountPath}`);
        }
        
        adminConfig = {
          credential: admin.credential.cert(envServiceAccountPath),
          projectId: 'codecollab-v2'
        };
      }
      // Option 2: Try to use service account key from environment variable
      else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.log('🔑 Using service account key from environment variable');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        adminConfig = {
          credential: admin.credential.cert(serviceAccount),
          projectId: 'codecollab-v2'
        };
      }
      // Option 3: Fallback to Application Default Credentials (requires gcloud auth)
      else {
        console.log('🔑 Using Application Default Credentials');
        adminConfig = {
          projectId: 'codecollab-v2'
        };
      }
    }
    
    admin.initializeApp(adminConfig);
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    console.log('📝 Please check your Firebase credentials configuration');
    process.exit(1);
  }
}

const db = admin.firestore();

// Simple in-memory storage for development when Firestore is not available
let mockDatabase = {
  projects: [],
  files: {},
  messages: {},
  presence: {},
  collaborators: {},
  invitations: {} // Store pending invitations by email
};

// Flag to check if Firestore is available
let firestoreAvailable = false;

// Function to initialize Firestore
const initializeFirestore = async () => {
  try {
    await db.collection('test').doc('startup-test').get();
    firestoreAvailable = true;
    console.log('✅ Firestore is available');
    return true;
  } catch (error) {
    firestoreAvailable = false;
    console.log('⚠️  Firestore not available, using in-memory storage for development');
    console.log('   Error:', error.message);
    return false;
  }
};

// Function to start the server
const startServer = async () => {
  // Initialize Firestore first
  await initializeFirestore();
  
  // Start the server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Development API server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoints available at http://localhost:${PORT}/api/`);
    
    // Display all available network interfaces
    console.log('\n🌐 Network Interfaces:');
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach(interfaceName => {
      const interfaceList = interfaces[interfaceName];
      interfaceList.forEach(interface => {
        if (interface.family === 'IPv4' && !interface.internal) {
          console.log(`   📡 ${interfaceName}: http://${interface.address}:${PORT}`);
          console.log(`   📝 API: http://${interface.address}:${PORT}/api/`);
        }
      });
    });
    console.log('');
  });
};

// Check if Firestore is available (synchronous check for endpoints)
const isFirestoreAvailable = () => firestoreAvailable;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware to extract user info from authorization header
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('\n🔐 === AUTH MIDDLEWARE DEBUG ===');
  console.log('📍 Timestamp:', new Date().toISOString());
  console.log('🌐 Request URL:', req.method, req.url);
  console.log('🔑 Auth Header:', authHeader ? `Bearer ${authHeader.substring(7, 30)}...` : 'None');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('📏 Token length:', token.length);
    console.log('🔍 Token preview:', token.substring(0, 50) + '...');
    console.log('🎯 Is fake token:', token === 'firebase-token');
    
    try {
      if (token === 'dev-token') {
        // Dev token fallback
        req.user = {
          id: 'dev-user-123',
          email: 'dev@example.com', 
          name: 'Dev User'
        };
        console.log('✅ Set user from dev token');
      } else if (token === 'no-token') {
        // No token fallback (for unauthenticated requests)
        req.user = {
          id: 'anonymous-user',
          email: 'anonymous@example.com', 
          name: 'Anonymous User'
        };
        console.log('✅ Set user from no-token (anonymous)');
      } else if (token.length > 50 && token.includes('.')) {
        // Try to decode if it's a Firebase JWT (basic decode without verification for dev)
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            // Use Buffer.from instead of atob for Node.js compatibility
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log('🔓 Decoded Firebase JWT payload keys:', Object.keys(payload));
            console.log('📝 Firebase token payload preview:', {
              sub: payload.sub,
              email: payload.email,
              name: payload.name,
              display_name: payload.display_name,
              aud: payload.aud,
              iss: payload.iss,
              exp: payload.exp
            });
            
            // Firebase JWTs typically don't have 'name' in payload unless custom claims are set
            // Use email prefix as fallback for name
            const displayName = payload.name || payload.display_name || payload.email?.split('@')[0] || 'User';
            
            req.user = {
              id: payload.sub || payload.user_id || payload.uid || 'firebase-user',
              email: payload.email || 'firebase-user@example.com',
              name: displayName
            };
            console.log('✅ Set user from Firebase JWT:', req.user);
            
            // Create or update user in Firestore
            await createOrUpdateUser(req.user);
          } catch (decodeError) {
            console.error('❌ Firebase JWT decode error:', decodeError.message);
            throw decodeError;
          }
        } else {
          console.log('❌ Invalid JWT format - not 3 parts');
          throw new Error('Invalid JWT format');
        }
      } else {
        console.log('❌ Token not recognized as valid Firebase token or dev-token');
        console.log('🚨 This looks like a FAKE TOKEN - check frontend auth!');
        throw new Error('Unrecognized token format');
      }
    } catch (error) {
      console.error('❌ Token processing error:', error.message);
      // If token parsing fails, use default
      req.user = {
        id: 'anonymous-user',
        email: 'anonymous@example.com',
        name: 'Anonymous User'
      };
      console.log('🔄 Fell back to anonymous user');
    }
  } else {
    console.log('❌ No authorization header found');
    // No auth header, use default
    req.user = {
      id: 'anonymous-user',
      email: 'anonymous@example.com', 
      name: 'Anonymous User'
    };
  }
  console.log('Final user for request:', req.user);
  next();
});

// Authentication middleware for protected routes
const authenticate = (req, res, next) => {
  if (!req.user || req.user.id === 'anonymous-user') {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Helper function to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Test endpoint for Firebase connectivity
app.get('/api/test', async (req, res) => {
  try {
    console.log('Testing Firebase connectivity...');
    
    // Test 1: Try to write a simple document (this will create the database if it doesn't exist)
    const testRef = db.collection('test').doc('connectivity');
    await testRef.set({
      message: 'Firebase connectivity test',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Firestore write successful - database exists or was created');
    
    // Test 2: Try to read the document back
    const testDoc = await testRef.get();
    if (testDoc.exists) {
      console.log('✅ Firestore read successful:', testDoc.data());
    }
    
    // Test 3: Try to list collections
    const collections = await db.listCollections();
    console.log('Available collections:', collections.map(c => c.id));
    
    res.json({ 
      success: true, 
      message: 'Firebase connectivity test passed',
      collections: collections.map(c => c.id),
      testData: testDoc.exists ? testDoc.data() : null
    });
  } catch (error) {
    console.error('❌ Firebase connectivity test failed:', error);
    res.status(500).json({ 
      error: 'Firebase connectivity test failed', 
      details: error.message,
      code: error.code 
    });
  }
});

// Network utility endpoints
app.get('/api/network/local-ip', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const localIPs = [];
    
    Object.keys(interfaces).forEach(interfaceName => {
      const interfaceList = interfaces[interfaceName];
      interfaceList.forEach(interface => {
        // Skip loopback and non-IPv4 addresses
        if (interface.family === 'IPv4' && !interface.internal) {
          localIPs.push({
            interface: interfaceName,
            address: interface.address,
            netmask: interface.netmask,
            mac: interface.mac
          });
        }
      });
    });
    
    // Return the first non-loopback IP as primary
    const primaryIP = localIPs.length > 0 ? localIPs[0].address : null;
    
    res.json({
      localIp: primaryIP,
      allInterfaces: localIPs,
      hostname: os.hostname()
    });
  } catch (error) {
    console.error('Error getting local IP:', error);
    res.status(500).json({ error: 'Failed to get local IP address' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    server: 'dev-server',
    version: '1.0.0'
  });
});

// User endpoints
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    console.log('GET /api/users/me - User:', req.user.id);
    
    if (!isFirestoreAvailable()) {
      // Return user info from request object
      return res.json({ 
        user: {
          uid: req.user.id,
          email: req.user.email,
          displayName: req.user.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }
    
    // Get user from Firestore
    const userRef = getUserRef(req.user.id);
    const userSnapshot = await userRef.get();
    
    // Admin SDK uses .exists (property), not .exists() (method)
    if (userSnapshot.exists) {
      res.json({ user: userSnapshot.data() });
    } else {
      // Create user if doesn't exist and return it
      const newUser = await createOrUpdateUser(req.user);
      const userDoc = await getUserRef(req.user.id).get();
      res.json({ user: userDoc.data() });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/me', authenticate, async (req, res) => {
  try {
    console.log('PUT /api/users/me', req.body, 'User:', req.user.id);
    const { displayName, avatarUrl } = req.body;
    
    if (!isFirestoreAvailable()) {
      // Mock update
      return res.json({ 
        user: {
          uid: req.user.id,
          email: req.user.email,
          displayName: displayName || req.user.name,
          avatarUrl,
          updatedAt: new Date().toISOString()
        }
      });
    }
    
    // Update user in Firestore
    const userRef = getUserRef(req.user.id);
    const updateData = {
      updatedAt: new Date().toISOString()
    };
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    
    await userRef.update(updateData);
    
    const updatedUser = await userRef.get();
    res.json({ user: updatedUser.data() });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Database helper functions
const getProjectRef = (projectId) => db.collection('projects').doc(projectId);
const getProjectFilesRef = (projectId) => db.collection('projects').doc(projectId).collection('files');
const getProjectMessagesRef = (projectId) => db.collection('projects').doc(projectId).collection('messages');
const getProjectPresenceRef = (projectId) => db.collection('projects').doc(projectId).collection('presence');
const getProjectCollaboratorsRef = (projectId) => db.collection('projects').doc(projectId).collection('collaborators');
const getUserRef = (userId) => db.collection('users').doc(userId);

// User management functions
const createOrUpdateUser = async (userData) => {
  try {
    if (!isFirestoreAvailable()) {
      console.log('📝 Skipping user creation - Firestore not available');
      return userData;
    }

    const userRef = getUserRef(userData.id);
    const userSnapshot = await userRef.get();
    
    const userDoc = {
      uid: userData.id,
      email: userData.email,
      displayName: userData.name,
      updatedAt: new Date().toISOString()
    };

    if (userSnapshot.exists) {
      // Update existing user
      await userRef.update(userDoc);
      console.log(`✅ Updated user ${userData.id} in Firestore`);
    } else {
      // Create new user
      await userRef.set({
        ...userDoc,
        createdAt: new Date().toISOString()
      });
      console.log(`✅ Created new user ${userData.id} in Firestore`);
    }

    return userData;
  } catch (error) {
    console.error('❌ Error creating/updating user:', error);
    return userData;
  }
};

// Mock database operations for development
const mockOperations = {
  async getProjects(userId) {
    return mockDatabase.projects.filter(p => 
      p.collaborators.includes(userId) || p.owner_id === userId
    );
  },
  
  async createProject(projectId, projectData) {
    const project = { 
      id: projectId, 
      ...projectData,
      owner_name: projectData.owner_name || 'Project Owner',
      owner_email: projectData.owner_email || 'owner@example.com',
      collaborators: {} // Initialize empty collaborators object
    };
    mockDatabase.projects.push(project);
    mockDatabase.files[projectId] = [{
      id: 'readme',
      path: 'README.md',
      content: `# ${projectData.name}\n\n${projectData.description || 'Project description'}`,
      type: 'file',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: projectData.owner_id,
      version: 1
    }];
    mockDatabase.messages[projectId] = [];
    mockDatabase.presence[projectId] = [];
    mockDatabase.collaborators[projectId] = [];
    return project;
  },
  
  async getProjectFiles(projectId) {
    return mockDatabase.files[projectId] || [];
  },
  
  async createProjectFile(projectId, fileData) {
    if (!mockDatabase.files[projectId]) {
      mockDatabase.files[projectId] = [];
    }
    const file = { id: Date.now().toString(), ...fileData };
    mockDatabase.files[projectId].push(file);
    return file;
  },
  
  async getProjectMessages(projectId) {
    return mockDatabase.messages[projectId] || [];
  },
  
  async createProjectMessage(projectId, messageData) {
    if (!mockDatabase.messages[projectId]) {
      mockDatabase.messages[projectId] = [];
    }
    const message = { id: Date.now().toString(), ...messageData };
    mockDatabase.messages[projectId].push(message);
    return message;
  },
  
  async getProjectPresence(projectId) {
    return mockDatabase.presence[projectId] || [];
  },
  
  async updateProjectPresence(projectId, presenceData) {
    if (!mockDatabase.presence[projectId]) {
      mockDatabase.presence[projectId] = [];
    }
    // Remove existing presence for this user
    mockDatabase.presence[projectId] = mockDatabase.presence[projectId].filter(
      p => p.user_id !== presenceData.user_id
    );
    // Add new presence
    const presence = { id: Date.now().toString(), ...presenceData };
    mockDatabase.presence[projectId].push(presence);
    return presence;
  },
  
  async getProjectCollaborators(projectId) {
    const project = mockDatabase.projects.find(p => p.id === projectId);
    if (!project) {
      return null;
    }
    
    const collaborators = [];
    
    // Add project owner
    collaborators.push({
      user_id: project.owner_id,
      user_name: project.owner_name || 'Project Owner',
      role: 'owner',
      email: project.owner_email || 'owner@example.com',
      joined_at: project.created_at,
      status: 'active'
    });
    
    // Add other collaborators from the project's collaborators object
    if (project.collaborators) {
      for (const [emailKey, collab] of Object.entries(project.collaborators)) {
        if (collab.status === 'active') {
          collaborators.push({
            user_id: collab.user_id || collab.email,
            user_name: collab.user_name || collab.email.split('@')[0],
            role: collab.role,
            email: collab.email,
            joined_at: collab.joined_at,
            status: collab.status
          });
        }
      }
    }
    
    return collaborators;
  },
  
  // Add method to handle invitations in mock database
  async addCollaboratorInvitation(projectId, email, role, invitedBy) {
    const project = mockDatabase.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const emailKey = email.replace('.', '_').replace('@', '_at_');
    
    // Add to project collaborators as invited
    if (!project.collaborators) {
      project.collaborators = {};
    }
    
    project.collaborators[emailKey] = {
      email,
      role,
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
      status: 'invited'
    };
    
    console.log(`Mock DB: Added invitation for ${email} as ${role} to project ${projectId}`);
    return project.collaborators[emailKey];
  },
  
  // Add method to activate collaborator in mock database
  async activateCollaborator(projectId, email, userId) {
    const project = mockDatabase.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const emailKey = email.replace('.', '_').replace('@', '_at_');
    
    if (project.collaborators && project.collaborators[emailKey]) {
      project.collaborators[emailKey].status = 'active';
      project.collaborators[emailKey].user_id = userId;
      project.collaborators[emailKey].joined_at = new Date().toISOString();
      project.collaborators[emailKey].user_name = email.split('@')[0];
      
      console.log(`Mock DB: Activated collaborator ${email} with role ${project.collaborators[emailKey].role}`);
      return project.collaborators[emailKey].role;
    }
    
    return null;
  },
  
  // Add method to remove collaborator in mock database
  async removeCollaborator(projectId, userId, requestingUserId) {
    const project = mockDatabase.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Check permissions - allow all authenticated users
    const isOwner = project.owner_id === requestingUserId;
    let requestingUserRole = null;
    
    if (project.collaborators) {
      for (const collab of Object.values(project.collaborators)) {
        if (collab.user_id === requestingUserId && collab.status === 'active') {
          requestingUserRole = collab.role;
          break;
        }
      }
    }
    
    // Allow all authenticated users to remove collaborators (no role restriction)
    
    // Don't allow removing the owner
    if (project.owner_id === userId) {
      throw new Error('Cannot remove project owner');
    }
    
    // Find and remove collaborator
    if (project.collaborators) {
      for (const [emailKey, collab] of Object.entries(project.collaborators)) {
        if (collab.user_id === userId) {
          delete project.collaborators[emailKey];
          console.log(`Mock DB: Removed collaborator ${collab.email}`);
          return collab;
        }
      }
    }
    
    throw new Error('Collaborator not found');
  }
};

// Helper function to ensure parent folders exist in database
const ensureParentFolders = async (projectId, filePath, userId) => {
  try {
    const pathParts = filePath.split('/');
    pathParts.pop(); // Remove the file name
    
    if (pathParts.length === 0) {
      // No parent folders needed for root level files
      return;
    }
    
    let currentPath = '';
    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      try {
        // Check if this folder exists in database
        const filesRef = getProjectFilesRef(projectId);
        const folderQuery = await filesRef.where('path', '==', currentPath).where('type', '==', 'folder').get();
        
        if (folderQuery.empty) {
          // Create the folder in database
          const folder = {
            path: currentPath,
            content: '',
            type: 'folder',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId,
            version: 1
          };
          await filesRef.add(folder);
          console.log(`  Auto-created parent folder in database: ${currentPath}`);
        }
      } catch (folderError) {
        console.error(`Error ensuring folder ${currentPath}:`, folderError);
        throw new Error(`Failed to create folder ${currentPath}: ${folderError.message}`);
      }
    }
  } catch (error) {
    console.error('Error in ensureParentFolders:', error);
    throw error;
  }
};

// Projects endpoints
app.get('/api/projects', async (req, res) => {
  try {
    console.log('GET /api/projects - User:', req.user.id);
    
    if (!isFirestoreAvailable()) {
      // Use mock database - need to find projects where user is owner or collaborator
      const userProjects = [];
      
      for (const project of mockDatabase.projects) {
        let userRole = null;
        
        // Check if user is owner
        if (project.owner_id === req.user.id) {
          userRole = 'owner';
        }
        // Check if user is in collaborators
        else if (project.collaborators) {
          for (const collab of Object.values(project.collaborators)) {
            if ((collab.user_id === req.user.id || collab.email === req.user.email) && collab.status === 'active') {
              userRole = collab.role;
              break;
            }
          }
        }
        
        if (userRole) {
          userProjects.push({
            ...project,
            userRole
          });
        }
      }
      
      console.log(`Found ${userProjects.length} projects for user ${req.user.id} (mock database)`);
      return res.json({ projects: userProjects });
    }
    
    // Get projects where user is owner or collaborator
    // We need to query all projects and filter on the client side due to Firestore limitations with complex queries
    console.log(`🔍 Fetching all projects to filter by user ${req.user.id}...`);
    const allProjectsSnapshot = await db.collection('projects').get();
    
    const projects = [];
    allProjectsSnapshot.forEach(doc => {
      const projectData = doc.data();
      let userRole = null;
      
      console.log(`📋 Checking project ${doc.id} for user ${req.user.id}...`);
      console.log(`   - Owner: ${projectData.owner_id || projectData.created_by}`);
      console.log(`   - Collaborators array: ${JSON.stringify(projectData.collaborators)}`);
      
      // Check if user is owner
      if (projectData.owner_id === req.user.id || projectData.created_by === req.user.id) {
        userRole = 'owner';
        console.log(`   ✅ User is owner`);
      }
      // Check if user is in collaborators array (for simple array format)
      else if (Array.isArray(projectData.collaborators) && projectData.collaborators.includes(req.user.id)) {
        userRole = 'editor'; // Default role for array-based collaborators
        console.log(`   ✅ User found in collaborators array`);
      }
      // Check collaborators object for user's role (for object format)
      else if (projectData.collaborators && typeof projectData.collaborators === 'object' && !Array.isArray(projectData.collaborators)) {
        for (const collab of Object.values(projectData.collaborators)) {
          if ((collab.user_id === req.user.id || collab.email === req.user.email) && collab.status === 'active') {
            userRole = collab.role;
            console.log(`   ✅ User found in collaborators object with role: ${userRole}`);
            break;
          }
        }
      }
      
      if (userRole) {
        projects.push({
          id: doc.id,
          ...projectData,
          userRole
        });
        console.log(`   ➕ Added project ${doc.id} with role ${userRole}`);
      } else {
        console.log(`   ❌ User not found in project ${doc.id}`);
      }
    });
    
    console.log(`Found ${projects.length} projects for user ${req.user.id}`);
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    console.log('POST /api/projects', req.body, 'User:', req.user);
    const { name, description, id } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectId = id || generateId(); // Use provided ID or generate new one
    const project = {
      name,
      description: description || '',
      owner_id: req.user.id,
      owner_name: req.user.name,
      owner_email: req.user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collaborators: [req.user.id],
      userRole: 'owner'
    };

    // Try Firestore first, fall back to mock database
    try {
      // Save project to Firestore
      await getProjectRef(projectId).set(project);
      
      // Create initial project structure in files subcollection
      const filesRef = getProjectFilesRef(projectId);
      
      // Create root README.md file
      const readmeFile = {
        path: 'README.md',
        content: `# ${name}\n\n${description || 'Project description'}`,
        type: 'file',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: req.user.id,
        version: 1
      };
      await filesRef.add(readmeFile);
      
      console.log(`✅ Created project ${projectId} in Firestore with initial files`);
      return res.json({ project: { id: projectId, ...project } });
    } catch (firestoreError) {
      console.log(`⚠️ Firestore unavailable, using mock database. Error: ${firestoreError.message}`);
      // Use mock database as fallback
      const createdProject = await mockOperations.createProject(projectId, project);
      console.log(`✅ Created project ${projectId} in mock database`);
      return res.json({ project: createdProject });
    }
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Delete project endpoint
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    console.log('DELETE /api/projects/:projectId', req.params);
    const { projectId } = req.params;
    
    if (isFirestoreAvailable()) {
      // Get project reference
      const projectRef = db.collection('projects').doc(projectId);
      const projectDoc = await projectRef.get();
      
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const project = projectDoc.data();
      
      // Check if user has permission to delete (owner or collaborator with delete permission)
      if (project.owner_id !== req.user.id && 
          !project.collaborators?.some(c => c.userId === req.user.id && c.role === 'admin')) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      
      // Delete all files in the project
      const filesRef = db.collection('projects').doc(projectId).collection('files');
      const filesSnapshot = await filesRef.get();
      
      const batch = db.batch();
      filesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete the project document
      batch.delete(projectRef);
      
      await batch.commit();
      console.log(`✅ Deleted project ${projectId} from Firestore`);
    } else {
      // Mock database fallback
      const projectIndex = mockDatabase.projects.findIndex(p => p.id === projectId);
      if (projectIndex === -1) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const project = mockDatabase.projects[projectIndex];
      
      // Check permissions
      if (project.owner_id !== req.user.id && 
          !project.collaborators?.some(c => c.userId === req.user.id && c.role === 'admin')) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      
      // Remove project from mock database
      mockDatabase.projects.splice(projectIndex, 1);
      
      // Remove all files for this project
      mockDatabase.files = mockDatabase.files.filter(f => f.projectId !== projectId);
      
      console.log(`✅ Deleted project ${projectId} from mock database`);
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Files endpoints
app.get('/api/projects/:projectId/files', async (req, res) => {
  try {
    console.log('GET /api/projects/:projectId/files', req.params);
    const { projectId } = req.params;
    
    if (isFirestoreAvailable()) {
      // Try Firestore first
      try {
        console.log('  Using Firestore for file listing...');
        
        // First, check if the project exists
        const projectRef = db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        
        if (!projectDoc.exists) {
          console.log('  ERROR: Project not found in Firestore');
          return res.status(404).json({ error: 'Project not found' });
        }
        
        // Get all files for the project from Firestore
        const filesSnapshot = await getProjectFilesRef(projectId).get();
        const files = [];
        
        filesSnapshot.forEach(doc => {
          files.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        console.log(`Found ${files.length} files for project ${projectId} (Firestore)`);
        return res.json({ files });
      } catch (firestoreError) {
        console.log('  Firestore failed, falling back to mock database:', firestoreError.message);
      }
    }
    
    // Use mock database fallback
    console.log('  Using mock database for file listing...');
    const files = await mockOperations.getProjectFiles(projectId);
    console.log(`Found ${files.length} files for project ${projectId} (mock database)`);
    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/api/projects/:projectId/files', async (req, res) => {
  try {
    console.log('POST /api/projects/:projectId/files', req.params, req.body, 'User:', req.user);
    const { projectId } = req.params;
    const { path, content, type } = req.body;

    if (!path) {
      console.log('ERROR: Path is required');
      return res.status(400).json({ error: 'Path is required' });
    }

    const file = {
      path,
      content: content || '',
      type: type || 'file',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: req.user.id,
      version: 1
    };

    if (isFirestoreAvailable()) {
      // Try Firestore first
      try {
        console.log('  Using Firestore for file creation...');
        
        // Check if project exists first
        const projectDoc = await getProjectRef(projectId).get();
        if (!projectDoc.exists) {
          console.log('  ERROR: Project not found in Firestore');
          return res.status(404).json({ error: 'Project not found' });
        }

        // Auto-create parent folders if creating a nested file
        if (type === 'file' && path.includes('/')) {
          try {
            await ensureParentFolders(projectId, path, req.user.id);
          } catch (folderError) {
            console.error('Error creating parent folders:', folderError);
            return res.status(500).json({ error: 'Failed to create parent folders: ' + folderError.message });
          }
        }
        
        // Save file to Firestore
        const docRef = await getProjectFilesRef(projectId).add(file);
        console.log(`✅ Created ${type}: ${path} by ${req.user.name} in Firestore`);
        return res.json({ file: { id: docRef.id, ...file } });
      } catch (firestoreError) {
        console.log('  Firestore creation failed, falling back to mock database:', firestoreError.message);
      }
    }
    
    // Use mock database fallback
    console.log('  Using mock database for file creation...');
    const createdFile = await mockOperations.createProjectFile(projectId, file);
    console.log(`✅ Created ${type}: ${path} by ${req.user.name} in mock database`);
    res.json({ file: createdFile });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file: ' + error.message });
  }
});

// PUT endpoint for updating files
app.put('/api/projects/:projectId/files/*', async (req, res) => {
  try {
    console.log('PUT /api/projects/:projectId/files/*');
    console.log('  projectId:', req.params.projectId);
    console.log('  filePath (raw):', req.params[0]);
    console.log('  filePath (decoded):', decodeURIComponent(req.params[0]));
    console.log('  body:', req.body);
    
    const { projectId } = req.params;
    const filePath = decodeURIComponent(req.params[0]);
    const { content } = req.body;

    if (!content && content !== '') {
      console.log('  ERROR: Missing content in request body');
      return res.status(400).json({ error: 'Content is required' });
    }

    if (isFirestoreAvailable()) {
      // Try Firestore first
      try {
        console.log('  Trying Firestore for file update...');
        
        // First, check if the project exists
        const projectRef = db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        
        if (!projectDoc.exists) {
          console.log('  ERROR: Project not found in Firestore');
          return res.status(404).json({ error: 'Project not found' });
        }
        
        const filesRef = getProjectFilesRef(projectId);
        const fileQuery = await filesRef.where('path', '==', filePath).get();
        
        if (fileQuery.empty) {
          console.log('  ERROR: File not found in Firestore');
          return res.status(404).json({ error: 'File not found' });
        }

        // Update the file in Firestore
        const fileDoc = fileQuery.docs[0];
        const currentFile = fileDoc.data();
        const updatedFile = {
          ...currentFile,
          content: content,
          updated_at: new Date().toISOString(),
          version: currentFile.version + 1
        };

        await fileDoc.ref.update(updatedFile);
        console.log('✅ File updated in Firestore');
        return res.json({ file: { id: fileDoc.id, ...updatedFile } });
      } catch (firestoreError) {
        console.log('  Firestore update failed, falling back to mock database:', firestoreError.message);
      }
    }

    // Use mock database fallback
    console.log('  Using mock database for file update...');
    const project = mockDatabase.projects[projectId];
    if (!project) {
      console.log('  ERROR: Project not found in mock database');
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingFile = project.files.find(f => f.path === filePath);
    if (!existingFile) {
      console.log('  ERROR: File not found in mock database');
      return res.status(404).json({ error: 'File not found' });
    }

    // Update the file in mock database
    existingFile.content = content;
    existingFile.updated_at = new Date().toISOString();
    existingFile.version = existingFile.version + 1;

    console.log('✅ File updated in mock database');
    res.json({ file: existingFile });
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// DELETE endpoint for deleting files
app.delete('/api/projects/:projectId/files/*', async (req, res) => {
  try {
    console.log('DELETE /api/projects/:projectId/files/*');
    console.log('  projectId:', req.params.projectId);
    console.log('  filePath (raw):', req.params[0]);
    console.log('  filePath (decoded):', decodeURIComponent(req.params[0]));
    
    const { projectId } = req.params;
    const filePath = decodeURIComponent(req.params[0]);

    if (isFirestoreAvailable()) {
      // Try Firestore first
      try {
        console.log('  Trying Firestore for file deletion...');
        
        // First, check if the project exists
        const projectRef = db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        
        if (!projectDoc.exists) {
          console.log('  ERROR: Project not found in Firestore');
          return res.status(404).json({ error: 'Project not found' });
        }
        
        const filesRef = getProjectFilesRef(projectId);
        const fileQuery = await filesRef.where('path', '==', filePath).get();
        
        if (fileQuery.empty) {
          console.log('  ERROR: File not found in Firestore');
          return res.status(404).json({ error: 'File not found' });
        }

        // Delete the file from Firestore
        await fileQuery.docs[0].ref.delete();
        console.log('✅ File deleted from Firestore');
        return res.json({ success: true });
      } catch (firestoreError) {
        console.log('  Firestore deletion failed, falling back to mock database:', firestoreError.message);
      }
    }

    // Use mock database fallback
    console.log('  Using mock database for file deletion...');
    const project = mockDatabase.projects[projectId];
    if (!project) {
      console.log('  ERROR: Project not found in mock database');
      return res.status(404).json({ error: 'Project not found' });
    }

    const fileIndex = project.files.findIndex(f => f.path === filePath);
    if (fileIndex === -1) {
      console.log('  ERROR: File not found in mock database');
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the file from mock database
    project.files.splice(fileIndex, 1);
    console.log('✅ File deleted from mock database');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Messages endpoints
app.get('/api/projects/:projectId/messages', async (req, res) => {
  try {
    console.log('GET /api/projects/:projectId/messages', req.params);
    const { projectId } = req.params;
    
    if (!firestoreAvailable) {
      // Use mock database
      const messages = await mockOperations.getProjectMessages(projectId);
      console.log(`Found ${messages.length} messages for project ${projectId} (mock database)`);
      return res.json({ messages });
    }
    
    // Get messages from Firestore
    const messagesSnapshot = await getProjectMessagesRef(projectId)
      .orderBy('created_at', 'asc')
      .get();
    
    const messages = [];
    messagesSnapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/projects/:projectId/messages', async (req, res) => {
  try {
    console.log('POST /api/projects/:projectId/messages', req.params, req.body, 'User:', req.user);
    const { projectId } = req.params;
    const { content, type } = req.body;

    const message = {
      content,
      type: type || 'text',
      user_id: req.user.id,
      user_name: req.user.name,
      created_at: new Date().toISOString(),
      project_id: projectId
    };

    // Save message to Firestore
    const docRef = await getProjectMessagesRef(projectId).add(message);
    
    console.log('✅ Message saved to database');
    res.json({ message: { id: docRef.id, ...message } });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Presence endpoints
app.get('/api/projects/:projectId/presence', async (req, res) => {
  try {
    console.log('GET /api/projects/:projectId/presence', req.params);
    const { projectId } = req.params;
    
    if (!firestoreAvailable) {
      // Use mock database
      const presence = await mockOperations.getProjectPresence(projectId);
      // Filter to last 5 minutes for mock data too
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const activePresence = presence.filter(p => p.last_seen > fiveMinutesAgo);
      console.log(`Found ${activePresence.length} active presence for project ${projectId} (mock database)`);
      return res.json({ presence: activePresence });
    }
    
    // Get active presence from Firestore (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const presenceSnapshot = await getProjectPresenceRef(projectId)
      .where('last_seen', '>', fiveMinutesAgo)
      .get();
    
    const presence = [];
    presenceSnapshot.forEach(doc => {
      presence.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ presence });
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({ error: 'Failed to fetch presence' });
  }
});

app.post('/api/projects/:projectId/presence', async (req, res) => {
  try {
    console.log('POST /api/projects/:projectId/presence', req.params, req.body, 'User:', req.user);
    const { projectId } = req.params;
    const { file, cursor } = req.body;

    if (!projectId) {
      console.log('ERROR: Project ID is required for presence update');
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const presenceData = {
      user_id: req.user.id,
      user_name: req.user.name,
      user_email: req.user.email, // Add email to presence data
      user_avatar: req.user.name.charAt(0).toUpperCase(),
      file: file || null,
      cursor: cursor || null,
      last_seen: new Date().toISOString()
    };

    if (!firestoreAvailable) {
      // Use mock database
      try {
        const updatedPresence = await mockOperations.updateProjectPresence(projectId, presenceData);
        console.log('✅ Updated user presence in mock database');
        return res.json({ success: true, presence: updatedPresence });
      } catch (mockError) {
        console.error('Mock database error:', mockError);
        return res.status(500).json({ error: 'Failed to update presence in mock database: ' + mockError.message });
      }
    }

    // Update or create presence in Firestore
    try {
      const presenceRef = getProjectPresenceRef(projectId);
      const existingPresence = await presenceRef.where('user_id', '==', req.user.id).get();
      
      if (!existingPresence.empty) {
        // Update existing presence
        await existingPresence.docs[0].ref.update(presenceData);
        console.log('✅ Updated user presence in database');
      } else {
        // Create new presence
        await presenceRef.add(presenceData);
        console.log('✅ Created user presence in database');
      }
      
      res.json({ success: true });
    } catch (dbError) {
      console.error('Firestore error updating presence:', dbError);
      return res.status(500).json({ error: 'Database error: ' + dbError.message });
    }
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({ error: 'Failed to update presence: ' + error.message });
  }
});

// Collaboration endpoints
app.get('/api/projects/:projectId/collaborators', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('\n🔍 === GET COLLABORATORS ENDPOINT ===');
    console.log('📍 Timestamp:', new Date().toISOString());
    console.log('🆔 Project ID:', projectId);
    console.log('👤 Request User:', req.user?.id, req.user?.email);
    console.log('🌐 Request IP:', req.ip);
    console.log('🌐 Request Host:', req.hostname);
    
    if (!firestoreAvailable) {
      // Use mock database
      const collaborators = await mockOperations.getProjectCollaborators(projectId);
      if (!collaborators) {
        console.log('❌ Project not found in mock database');
        return res.status(404).json({ error: 'Project not found' });
      }
      console.log(`✅ Found ${collaborators.length} collaborators for project ${projectId} (mock database)`);
      console.log('📋 Collaborators:', JSON.stringify(collaborators, null, 2));
      return res.json({ collaborators });
    }
    
    // Get project and its collaborators
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();
    const collaborators = [];

    // Helper function to get user info from users collection
    const getUserInfo = async (userId) => {
      try {
        const userDoc = await getUserRef(userId).get();
        // Admin SDK uses .exists (property), not .exists() (method)
        if (userDoc.exists) {
          const userData = userDoc.data();
          return {
            name: userData.displayName || userData.email?.split('@')[0] || 'Unknown User',
            email: userData.email || 'unknown@example.com'
          };
        }
      } catch (error) {
        console.error('Error fetching user info for', userId, error);
      }
      
      // Fallback - use current request user info if it's the same user
      if (userId === req.user.id) {
        return {
          name: req.user.name || req.user.email?.split('@')[0] || 'Unknown User',
          email: req.user.email || 'unknown@example.com'
        };
      }
      
      return {
        name: 'Unknown User',
        email: 'unknown@example.com'
      };
    };

    // Add project owner
    const ownerInfo = await getUserInfo(project.owner_id || project.created_by);
    collaborators.push({
      user_id: project.owner_id || project.created_by,
      user_name: ownerInfo.name,
      role: 'owner',
      email: ownerInfo.email,
      joined_at: project.created_at,
      status: 'active'
    });

    // Add other collaborators
    if (project.collaborators) {
      for (const collab of Object.values(project.collaborators)) {
        if (collab.status === 'active') {
          const collabInfo = await getUserInfo(collab.user_id);
          collaborators.push({
            user_id: collab.user_id,
            user_name: collabInfo.name,
            role: collab.role,
            email: collab.email,
            joined_at: collab.joined_at,
            status: collab.status
          });
        }
      }
    }
    
    res.json({ collaborators });
  } catch (error) {
    console.error('Error getting collaborators:', error);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

app.post('/api/projects/:projectId/invite', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email, role } = req.body;
    
    console.log(`📨 Inviting ${email} as ${role} to project ${projectId}`);
    
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "editor" or "viewer"' });
    }

    let project;
    let projectName = 'Project';

    if (!isFirestoreAvailable()) {
      // Use mock database
      try {
        // Allow all authenticated users to invite collaborators
        const collaboratorData = await mockOperations.addCollaboratorInvitation(projectId, email, role, req.user.id);
        
        // Get project details for email
        const foundProject = mockDatabase.projects.find(p => p.id === projectId);
        if (foundProject) {
          project = foundProject;
          projectName = foundProject.name || 'Project';
        }
        
        console.log(`✅ Mock invitation added to database for ${email} as ${role}`);
      } catch (mockError) {
        console.error('Mock database error:', mockError);
        return res.status(404).json({ error: mockError.message });
      }
    } else {
      // Check if project exists and user has permission
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      project = projectDoc.data();
      projectName = project.name || 'Project';
      
      // Check if user is the owner
      const isOwner = (project.owner_id === req.user.id) || (project.created_by === req.user.id);
      
      // Check if user is a collaborator with appropriate permissions
      let userRole = null;
      const userEmailKey = req.user.email.replace(/\./g, '_').replace(/@/g, '_');
      
      // Check for collaborator role using email-based key
      if (project.collaborators && typeof project.collaborators === 'object') {
        for (const [key, collaborator] of Object.entries(project.collaborators)) {
          if (collaborator.email === req.user.email || collaborator.user_id === req.user.id) {
            userRole = collaborator.role;
            break;
          }
        }
      }
      
      // Allow all authenticated users to invite collaborators
      console.log(`🔐 Permission check for user ${req.user.email}: allowing invitation`);

      const emailKey = email.replace('.', '_');
      
      // Check if user is already a collaborator
      if (project.collaborators?.[emailKey]) {
        return res.status(400).json({ error: 'User is already a collaborator' });
      }

      // Add collaborator to project
      const collaboratorData = {
        email,
        role,
        invited_by: req.user.id,
        invited_at: new Date().toISOString(),
        status: 'invited'
      };

      await db.collection('projects').doc(projectId).update({
        [`collaborators.${emailKey}`]: collaboratorData
      });
      
      console.log(`✅ Firestore invitation added to database for ${email} as ${role}`);
    }

    // Send email via EmailJS REST API
    try {
      const emailJSConfig = {
        PUBLIC_KEY: 'a1G5c01uj9gXf8gCh',
        SERVICE_ID: 'service_a5zyw4z',
        TEMPLATE_ID: 'template_eex2l6b'
      };

      const emailData = {
        service_id: emailJSConfig.SERVICE_ID,
        template_id: emailJSConfig.TEMPLATE_ID,
        user_id: emailJSConfig.PUBLIC_KEY,
        template_params: {
          to_email: email,
          from_name: req.user.name || req.user.email.split('@')[0],
          project_name: projectName,
          project_id: projectId,
          role: role,
          custom_message: `${req.user.name || req.user.email} has invited you to collaborate on "${projectName}" as a ${role}.`,
          subject: `You've been invited to collaborate on "${projectName}"`
        }
      };

      console.log(`📧 Sending email via EmailJS to ${email}...`);
      
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        console.log(`✅ Email sent successfully to ${email} via EmailJS`);
        res.json({ 
          success: true, 
          message: `Invitation sent to ${email} as ${role}`,
          emailSent: true
        });
      } else {
        const errorText = await response.text();
        console.error(`⚠️ EmailJS API error:`, response.status, errorText);
        // Return success since invitation was added to database, but note email failed
        res.json({ 
          success: true, 
          message: `Invitation added to project, but email delivery failed. Please share the project ID directly: ${projectId}`,
          emailSent: false,
          emailError: `EmailJS error: ${response.status}`
        });
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send email via EmailJS:', emailError.message);
      // Return success since invitation was added to database, but note email failed
      res.json({ 
        success: true, 
        message: `Invitation added to project, but email could not be sent. Please share the project ID directly: ${projectId}`,
        emailSent: false,
        emailError: emailError.message
      });
    }
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

app.post('/api/projects/join', authenticate, async (req, res) => {
  try {
    const { projectCode } = req.body;
    
    if (!projectCode) {
      return res.status(400).json({ error: 'Project code is required' });
    }
    
    console.log(`🚪 User ${req.user.email} attempting to join project ${projectCode}`);
    
    if (!isFirestoreAvailable()) {
      // Use mock database
      const project = mockDatabase.projects.find(p => p.id === projectCode);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const userEmail = req.user.email;
      let userRole = 'viewer'; // default role
      
      console.log(`📝 Mock DB: Checking role for ${userEmail}`);
      
      if (project.owner_id === req.user.id) {
        userRole = 'owner';
        console.log(`👑 User is project owner`);
      } else {
        // Try to activate existing invitation
        const activatedRole = await mockOperations.activateCollaborator(projectCode, userEmail, req.user.id);
        if (activatedRole) {
          userRole = activatedRole;
          console.log(`✅ Mock DB: Activated invited collaborator with role: ${userRole}`);
        } else {
          // Check if there's an invitation for this user by email
          const emailKey = userEmail.replace('.', '_').replace('@', '_at_');
          if (project.collaborators && project.collaborators[emailKey] && project.collaborators[emailKey].status === 'invited') {
            // User has an invitation - use the invited role and activate them
            userRole = project.collaborators[emailKey].role;
            project.collaborators[emailKey].status = 'active';
            project.collaborators[emailKey].user_id = req.user.id;
            project.collaborators[emailKey].joined_at = new Date().toISOString();
            project.collaborators[emailKey].user_name = userEmail.split('@')[0];
            console.log(`✅ Mock DB: Activated invited user ${userEmail} with role: ${userRole}`);
          } else {
            // Add as viewer if not explicitly invited (sharing link scenario)
            console.log(`➕ Mock DB: Adding new collaborator as viewer (no invitation found)`);
            if (!project.collaborators) {
              project.collaborators = {};
            }
            const userName = userEmail.split('@')[0];
            project.collaborators[emailKey] = {
              email: userEmail,
              role: 'viewer',
              invited_by: req.user.id,
              invited_at: new Date().toISOString(),
              joined_at: new Date().toISOString(),
              user_id: req.user.id,
              user_name: userName,
              status: 'active'
            };
            console.log(`✅ Mock DB: Added collaborator ${userName} (${userEmail}) with user_id: ${req.user.id}`);
          }
        }
      }
      
      // Get project files from mock database
      const workspaceFiles = mockDatabase.files[projectCode] || [];
      
      console.log(`📤 Mock DB: Sending workspace state with ${workspaceFiles.length} files to new collaborator with role: ${userRole}`);
      
      return res.json({ 
        success: true, 
        project: {
          id: projectCode,
          ...project,
          userRole
        },
        workspaceState: {
          files: workspaceFiles,
          syncedAt: new Date().toISOString()
        }
      });
    }
    
    // Find project by ID
    const projectDoc = await db.collection('projects').doc(projectCode).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();
    const userEmail = req.user.email;
    const emailKey = userEmail.replace('.', '_');
    
    // Check if user is invited or already a collaborator
    let userRole = 'viewer'; // default role
    
    console.log(`📝 Firestore: Checking role for ${userEmail}`);
    
    if (project.created_by === req.user.id || project.owner_id === req.user.id) {
      userRole = 'owner';
      console.log(`👑 User is project owner`);
    } else if (project.collaborators?.[emailKey]) {
      userRole = project.collaborators[emailKey].role;
      console.log(`👤 Found existing collaborator with role: ${userRole}`);
      
      // If user was invited, mark as active and add user_name
      if (project.collaborators[emailKey].status === 'invited') {
        // Get user info from users collection or use email
        let userName = userEmail.split('@')[0]; // Fallback
        try {
          const userDoc = await getUserRef(req.user.id).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData.displayName || userData.email?.split('@')[0] || userName;
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
        
        await db.collection('projects').doc(projectCode).update({
          [`collaborators.${emailKey}.status`]: 'active',
          [`collaborators.${emailKey}.joined_at`]: new Date().toISOString(),
          [`collaborators.${emailKey}.user_id`]: req.user.id,
          [`collaborators.${emailKey}.user_name`]: userName
        });
        console.log(`✅ Firestore: Activated invited collaborator ${userName} with role: ${userRole}`);
      }
    } else {
      // Check if there's an invitation for this user by email (may have different key format)
      let foundInvitation = false;
      let invitedRole = 'viewer';
      
      if (project.collaborators) {
        // Check different possible email key formats
        const possibleKeys = [
          emailKey,
          userEmail.replace(/\./g, '_'),
          userEmail.replace(/\./g, '_').replace(/@/g, '_at_')
        ];
        
        for (const key of possibleKeys) {
          if (project.collaborators[key] && project.collaborators[key].status === 'invited') {
            foundInvitation = true;
            invitedRole = project.collaborators[key].role;
            userRole = invitedRole;
            
            // Get user info from users collection or use email
            let userName = userEmail.split('@')[0]; // Fallback
            try {
              const userDoc = await getUserRef(req.user.id).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                userName = userData.displayName || userData.email?.split('@')[0] || userName;
              }
            } catch (error) {
              console.error('Error fetching user info:', error);
            }
            
            // Activate the invitation
            await db.collection('projects').doc(projectCode).update({
              [`collaborators.${key}.status`]: 'active',
              [`collaborators.${key}.joined_at`]: new Date().toISOString(),
              [`collaborators.${key}.user_id`]: req.user.id,
              [`collaborators.${key}.user_name`]: userName
            });
            console.log(`✅ Firestore: Activated invited user ${userName} (${userEmail}) with role: ${invitedRole} (key: ${key})`);
            break;
          }
        }
      }
      
      if (!foundInvitation) {
        // Add as viewer if not explicitly invited (sharing link scenario)
        console.log(`➕ Firestore: Adding new collaborator as viewer (no invitation found)`);
        
        // Get user info from users collection or use email
        let userName = userEmail.split('@')[0]; // Fallback
        try {
          const userDoc = await getUserRef(req.user.id).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData.displayName || userData.email?.split('@')[0] || userName;
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
        
        const collaboratorData = {
          email: userEmail,
          role: 'viewer',
          invited_by: req.user.id,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          user_id: req.user.id,
          user_name: userName,
          status: 'active'
        };

        await db.collection('projects').doc(projectCode).update({
          [`collaborators.${emailKey}`]: collaboratorData
        });
        
        console.log(`✅ Firestore: Added collaborator ${userName} (${userEmail}) with user_id: ${req.user.id}`);
      }
    }
    
    // Get all project files
    const filesSnapshot = await db.collection('projects').doc(projectCode).collection('files').get();
    const workspaceFiles = [];
    
    filesSnapshot.forEach(doc => {
      workspaceFiles.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📤 Firestore: Sending workspace state with ${workspaceFiles.length} files to new collaborator with role: ${userRole}`);
    
    res.json({ 
      success: true, 
      project: {
        id: projectDoc.id,
        ...project,
        userRole
      },
      workspaceState: {
        files: workspaceFiles,
        syncedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error joining project:', error);
    res.status(500).json({ error: 'Failed to join project' });
  }
});

// Update collaborator role - MUST come before DELETE route to avoid route matching issues
app.put('/api/projects/:projectId/collaborators/:userId/role', authenticate, async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;
    
    console.log(`🔄 Updating collaborator ${userId} role to ${role} in project ${projectId} by ${req.user.id}`);
    
    // Validate role
    if (!role || !['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "editor" or "viewer"' });
    }
    
    if (!isFirestoreAvailable()) {
      // Use mock database
      const project = mockDatabase.projects.find(p => p.id === projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check permission - only owner can update roles
      console.log(`📋 Mock DB: Project owner: ${project.owner_id}, Current user: ${req.user.id}`);
      
      const isOwner = project.owner_id === req.user.id;
      
      if (!isOwner) {
        return res.status(403).json({ error: 'Only project owner can update collaborator roles' });
      }

      // Don't allow updating the owner's role
      if (project.owner_id === userId) {
        return res.status(400).json({ error: 'Cannot update project owner role' });
      }

      // Find and update collaborator role
      let updatedCollaborator = null;
      if (project.collaborators) {
        for (const [emailKey, collab] of Object.entries(project.collaborators)) {
          // Match by user_id or by email (for invited collaborators who haven't joined yet)
          if (collab.user_id === userId || collab.email === userId || (collab.user_id || collab.email) === userId) {
            collab.role = role;
            updatedCollaborator = collab;
            console.log(`✅ Mock DB: Updated collaborator ${collab.email} role to ${role}`);
            break;
          }
        }
      }

      if (!updatedCollaborator) {
        console.log(`❌ Mock DB: Collaborator ${userId} not found in project ${projectId}`);
        console.log(`📋 Mock DB: Available collaborators:`, Object.entries(project.collaborators || {}).map(([key, c]) => ({
          key,
          user_id: c.user_id,
          email: c.email
        })));
        return res.status(404).json({ error: 'Collaborator not found' });
      }
      
      return res.json({ 
        success: true, 
        message: `${updatedCollaborator.email} role updated to ${role}`,
        collaborator: updatedCollaborator
      });
    }
    
    // Get project from Firestore
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();

    // Check permission - only owner can update roles
    console.log(`📋 Firestore: Project owner: ${project.created_by || project.owner_id}, Current user: ${req.user.id}`);
    
    const isOwner = (project.created_by === req.user.id) || (project.owner_id === req.user.id);
    
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can update collaborator roles' });
    }

    // Don't allow updating the owner's role
    if ((project.created_by === userId) || (project.owner_id === userId)) {
      return res.status(400).json({ error: 'Cannot update project owner role' });
    }

    // Find and update collaborator role
    let updatedCollaborator = null;
    if (project.collaborators) {
      for (const [emailKey, collab] of Object.entries(project.collaborators)) {
        // Match by user_id or by email (for invited collaborators who haven't joined yet)
        if (collab.user_id === userId || collab.email === userId || (collab.user_id || collab.email) === userId) {
          // Update the role in Firestore
          await db.collection('projects').doc(projectId).update({
            [`collaborators.${emailKey}.role`]: role
          });
          
          updatedCollaborator = { ...collab, role };
          console.log(`✅ Firestore: Updated collaborator ${collab.email} role to ${role}`);
          break;
        }
      }
    }

    if (!updatedCollaborator) {
      console.log(`❌ Firestore: Collaborator ${userId} not found in project ${projectId}`);
      console.log(`📋 Firestore: Available collaborators:`, Object.entries(project.collaborators || {}).map(([key, c]) => ({
        key,
        user_id: c.user_id,
        email: c.email
      })));
      return res.status(404).json({ error: 'Collaborator not found' });
    }
    
    res.json({ 
      success: true, 
      message: `${updatedCollaborator.email} role updated to ${role}`,
      collaborator: updatedCollaborator
    });
  } catch (error) {
    console.error('Error updating collaborator role:', error);
    res.status(500).json({ error: 'Failed to update collaborator role' });
  }
});

app.delete('/api/projects/:projectId/collaborators/:userId', authenticate, async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    
    console.log(`🗑️ Removing collaborator ${userId} from project ${projectId} by ${req.user.id}`);
    
    if (!isFirestoreAvailable()) {
      // Use mock database
      const project = mockDatabase.projects.find(p => p.id === projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check permission - owner or editor can remove collaborators
      console.log(`📋 Mock DB: Project owner: ${project.owner_id}, Current user: ${req.user.id}`);
      console.log(`📋 Mock DB: Project collaborators:`, project.collaborators);
      
      const isOwner = project.owner_id === req.user.id;
      let userRole = null;
      
      // Check if user is a collaborator with appropriate permissions
      if (project.collaborators && typeof project.collaborators === 'object') {
        for (const [key, collaborator] of Object.entries(project.collaborators)) {
          if (collaborator.email === req.user.email || collaborator.user_id === req.user.id) {
            userRole = collaborator.role;
            break;
          }
        }
      }
      
      console.log(`👤 Mock DB: User role: ${userRole}, Is Owner: ${isOwner}`);
      
      // Allow all authenticated users to remove collaborators
      console.log(`✅ Mock DB: Permission granted for user ${req.user.id}`);

      // Don't allow removing the owner
      if (project.owner_id === userId) {
        return res.status(400).json({ error: 'Cannot remove project owner' });
      }

      // Find and remove collaborator
      let removedCollaborator = null;
      if (project.collaborators) {
        for (const [emailKey, collab] of Object.entries(project.collaborators)) {
          // Match by user_id or by email (for invited collaborators who haven't joined yet)
          if (collab.user_id === userId || collab.email === userId || (collab.user_id || collab.email) === userId) {
            removedCollaborator = collab;
            delete project.collaborators[emailKey];
            console.log(`✅ Mock DB: Removed collaborator ${collab.email} from project`);
            break;
          }
        }
      }

      if (!removedCollaborator) {
        console.log(`❌ Mock DB: Collaborator ${userId} not found in project ${projectId}`);
        console.log(`📋 Mock DB: Available collaborators:`, Object.entries(project.collaborators || {}).map(([key, c]) => ({
          key,
          user_id: c.user_id,
          email: c.email
        })));
        return res.status(404).json({ error: 'Collaborator not found' });
      }
      
      // Clean up presence for removed collaborator
      if (mockDatabase.presence[projectId]) {
        mockDatabase.presence[projectId] = mockDatabase.presence[projectId].filter(
          p => p.user_id !== userId && p.user_id !== removedCollaborator.email
        );
        console.log(`🧹 Mock DB: Cleaned up presence for removed user ${userId}`);
      }
      
      return res.json({ 
        success: true, 
        message: `${removedCollaborator.email} removed from project` 
      });
    }
    
    // Get project from Firestore
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();

    // Check permission - owner or editor can remove collaborators
    console.log(`📋 Firestore: Project owner: ${project.created_by || project.owner_id}, Current user: ${req.user.id}`);
    
    const isOwner = (project.created_by === req.user.id) || (project.owner_id === req.user.id);
    let userRole = null;
    
    // Check if user is a collaborator with appropriate permissions
    if (project.collaborators && typeof project.collaborators === 'object') {
      for (const [key, collaborator] of Object.entries(project.collaborators)) {
        if (collaborator.email === req.user.email || collaborator.user_id === req.user.id) {
          userRole = collaborator.role;
          break;
        }
      }
    }
    
    console.log(`👤 Firestore: User role: ${userRole}, Is Owner: ${isOwner}`);
    
    // Allow all authenticated users to remove collaborators
    console.log(`✅ Firestore: Permission granted for user ${req.user.id}`);

    // Don't allow removing the owner
    if ((project.created_by === userId) || (project.owner_id === userId)) {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    // Find and remove collaborator
    let removedCollaborator = null;
    if (project.collaborators) {
      for (const [emailKey, collab] of Object.entries(project.collaborators)) {
        // Match by user_id or by email (for invited collaborators who haven't joined yet)
        if (collab.user_id === userId || collab.email === userId || (collab.user_id || collab.email) === userId) {
          removedCollaborator = collab;
          await db.collection('projects').doc(projectId).update({
            [`collaborators.${emailKey}`]: admin.firestore.FieldValue.delete()
          });
          console.log(`✅ Firestore: Removed collaborator ${collab.email} from project`);
          break;
        }
      }
    }

    if (!removedCollaborator) {
      console.log(`❌ Firestore: Collaborator ${userId} not found in project ${projectId}`);
      console.log(`📋 Firestore: Available collaborators:`, Object.entries(project.collaborators || {}).map(([key, c]) => ({
        key,
        user_id: c.user_id,
        email: c.email
      })));
      return res.status(404).json({ error: 'Collaborator not found' });
    }
    
    // Clean up presence for removed collaborator in Firestore
    try {
      const presenceQuery = await db.collection('projects')
        .doc(projectId)
        .collection('presence')
        .where('user_id', '==', userId)
        .get();
      
      const batch = db.batch();
      presenceQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`🧹 Firestore: Cleaned up presence for removed user ${userId}`);
    } catch (presenceError) {
      console.error('Error cleaning up presence:', presenceError);
      // Don't fail the whole operation if presence cleanup fails
    }
    
    res.json({ 
      success: true, 
      message: `${removedCollaborator.email} removed from project` 
    });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// Start the server with proper Firestore initialization
startServer().catch(console.error);