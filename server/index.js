// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Y.js imports for real-time collaboration
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
// Y.js WebSocket support - Updated import
// const { setupWSConnection } = require('y-websocket/bin/utils');
// Temporarily commenting out y-websocket import due to package export issues
// Alternative: const { setupWSConnection } = require('y-websocket');
let setupWSConnection = null;
try {
  ({ setupWSConnection } = require('y-websocket'));
} catch (error) {
  console.warn('⚠️ y-websocket not available, Y.js WebSocket support disabled:', error.message);
}

// Firebase Admin SDK for token verification
let admin = null;
try {
  // Try to initialize Firebase Admin with service account file first
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    admin = require('firebase-admin');
    const serviceAccount = require('./firebase-service-account.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('✅ Firebase Admin SDK initialized for project:', serviceAccount.project_id);
  } else if (process.env.FIREBASE_ADMIN_KEY) {
    // Fallback to environment variable
    admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('✅ Firebase Admin SDK initialized for project:', serviceAccount.project_id);
  } else {
    console.log('⚠️ Firebase Admin SDK not initialized - no credentials provided');
    console.log('📦 Firebase disabled - using in-memory storage only');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK initialization failed:', error.message);
  console.log('📦 Firebase disabled - using in-memory storage only');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Import enhanced models
const { User, Project, Activity, Session } = require('./models/User');

// Import database service
const databaseService = require('./services/database');

// Import shared user storage
const { users, activities } = require('./storage/userStorage');

// Import workspace sync server
const WorkspaceSyncServer = require('./services/WorkspaceSyncServer');

// Import room-based collaboration services
const CollaborationRoomManager = require('./services/CollaborationRoomManager');
const WorkspaceDatabaseService = require('./services/WorkspaceDatabaseService');
const SessionWorkspaceService = require('./services/SessionWorkspaceService');

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'codecollab-enhanced-secret-key';

// Token verification helper function
const verifyToken = async (token) => {
  // Validate token format
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid token format');
  }

  // Clean token (remove any whitespace/newlines)
  const cleanToken = token.trim();

  // First, try to verify as Firebase token
  if (admin) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(cleanToken);
      return {
        type: 'firebase',
        decoded: decodedToken,
        userId: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
      };
    } catch (firebaseError) {
      // If Firebase verification fails, try JWT
      console.log(`🔍 Token is not a valid Firebase token (${firebaseError.code}), trying JWT...`);
    }
  }

  // Parse token to check algorithm before verification
  let tokenHeader, tokenPayload;
  try {
    const tokenParts = cleanToken.split('.');
    if (tokenParts.length === 3) {
      tokenHeader = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString('utf8'));
      tokenPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString('utf8'));
    }
  } catch (parseError) {
    console.log(`🔍 Token parsing failed: ${parseError.message}`);
  }

  // Handle different token types based on algorithm and issuer
  if (tokenHeader && tokenPayload) {
    // Check if this is a Google OAuth token (RS256)
    if (tokenHeader.alg === 'RS256' && tokenPayload.iss && 
        (tokenPayload.iss.includes('accounts.google.com') || tokenPayload.iss.includes('googleapis.com'))) {
      console.log(`🔍 Accepting Google OAuth token for: ${tokenPayload.email}`);
      return {
        type: 'google-oauth',
        decoded: tokenPayload,
        userId: tokenPayload.sub,
        email: tokenPayload.email,
        name: tokenPayload.name || tokenPayload.email?.split('@')[0] || 'User'
      };
    }
    
    // Try JWT verification for HS256 tokens
    if (tokenHeader.alg === 'HS256') {
      try {
        const decoded = jwt.verify(cleanToken, JWT_SECRET, { algorithms: ['HS256'] });
        return {
          type: 'jwt',
          decoded: decoded,
          userId: decoded.sub,
          email: decoded.email,
          name: decoded.name || decoded.email?.split('@')[0] || 'User'
        };
      } catch (jwtError) {
        console.log(`🔍 JWT verification failed: ${jwtError.message}`);
      }
    }
    
    // Accept any valid JWT structure for development/demo purposes
    if (tokenPayload.sub && tokenPayload.email) {
      console.log(`🔍 Accepting demo/development token for: ${tokenPayload.email}`);
      return {
        type: 'demo-jwt',
        decoded: tokenPayload,
        userId: tokenPayload.sub,
        email: tokenPayload.email,
        name: tokenPayload.name || tokenPayload.email?.split('@')[0] || 'User'
      };
    }
  }
  
  throw new Error(`Invalid token: Neither Firebase nor JWT verification succeeded (Firebase: ${admin ? 'available' : 'not configured'})`);
};

// In-memory stores (in production, use a proper database)
const projects = new Map();
const refreshTokens = new Set();
const virtualFileStore = new Map(); // Global virtual file system store

// Session/Room management for private collaboration
const collaborationSessions = new Map(); // sessionId -> session data
const sessionInviteKeys = new Map(); // inviteKey -> sessionId
const sessionUsers = new Map(); // sessionId -> Set of connected users

// Import routes
const authRoutes = require('./routes/auth');

// Use routes
app.use('/api/auth', authRoutes);

// Serve static files from the React app build directory
const buildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(buildPath));

const server = http.createServer(app);

// Enhanced Socket.IO with authentication and Y.js collaboration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Y.js Document store for collaboration rooms
const yjsDocuments = new Map(); // roomId -> Y.Doc
const yjsProviders = new Map(); // roomId -> WebsocketProvider

// Helper function to get or create Y.js document for a room
const getYjsDocument = (roomId) => {
  if (!yjsDocuments.has(roomId)) {
    const ydoc = new Y.Doc();
    yjsDocuments.set(roomId, ydoc);
    
    // Set up document sync
    ydoc.on('update', (update, origin, doc, tr) => {
      // Broadcast Y.js updates to all clients in the room
      if (origin !== 'socket') {
        io.to(roomId).emit('yjs_update', {
          roomId,
          update: Array.from(update),
          origin: origin || 'server'
        });
      }
    });
    
    console.log(`📝 Created Y.js document for room: ${roomId}`);
  }
  return yjsDocuments.get(roomId);
};

// Helper function to apply Y.js update to document
const applyYjsUpdate = (roomId, updateArray, origin = 'socket') => {
  const ydoc = getYjsDocument(roomId);
  const update = new Uint8Array(updateArray);
  Y.applyUpdate(ydoc, update, origin);
};

// Socket authentication middleware with enhanced user models and session support
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const sessionId = socket.handshake.auth.sessionId;
  const inviteKey = socket.handshake.auth.inviteKey;
  
  // For now, we'll allow connections but validate session access later
  if (!token || token === 'null' || token === 'undefined') {
    console.log(`⚠️ Socket connection as guest - No token provided`);
    // Allow guest access with limited permissions
    socket.userId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    socket.userEmail = 'guest@codecollab.com';
    socket.userName = 'Guest User';
    socket.userRole = 'guest';
    socket.userAvatar = null;
    socket.authenticated = false;
    socket.tokenType = 'guest';
    socket.sessionId = null; // Will be set when joining a session
    return next();
  }

  try {
    console.log(`🔍 Attempting to verify token for socket connection: ${token.substring(0, 20)}...`);
    const tokenInfo = await verifyToken(token);
    
    // Get or create user based on token type
    let user;
    if (tokenInfo.type === 'firebase') {
      // For Firebase users, get or create user record
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
      
      if (!user) {
        // Create new user for Firebase authentication
        const newUser = new User({
          id: tokenInfo.userId,
          name: tokenInfo.name,
          email: tokenInfo.email,
          role: 'user',
          provider: 'google'
        });
        users.set(tokenInfo.email, newUser);
        user = newUser;
        console.log(`✅ Created new user from Firebase auth: ${user.name}`);
      }
    } else {
      // For JWT tokens, find existing user or auto-create for demo tokens
      user = users.get(tokenInfo.email);
      if (!user && (tokenInfo.type === 'demo-jwt' || tokenInfo.type === 'jwt')) {
        // Auto-create user for demo/development tokens
        user = {
          id: tokenInfo.userId,
          email: tokenInfo.email,
          name: tokenInfo.name,
          role: 'user',
          createdAt: new Date().toISOString(),
          isActive: true,
          updateActivity: function() {
            this.lastActive = new Date().toISOString();
          }
        };
        users.set(tokenInfo.email, user);
        console.log(`✅ Auto-created user for demo/development socket: ${tokenInfo.email}`);
      }
      
      if (!user || !user.isActive) {
        console.log(`⚠️ Socket connection rejected - User not found or inactive:`, tokenInfo.email);
        return next(new Error('User not found or inactive'));
      }
    }

    // Update user activity
    user.updateActivity();

    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.userName = user.name;
    socket.userRole = user.role;
    socket.userAvatar = user.avatar;
    socket.authenticated = true;
    socket.tokenType = tokenInfo.type;
    socket.sessionId = null; // Will be set when joining a session

    console.log(`✅ Socket authenticated for user: ${user.name} (${user.email}) - Role: ${user.role} - Token: ${tokenInfo.type}`);
    next();
    
  } catch (error) {
    console.log(`⚠️ Socket connection rejected - Token verification failed:`, error.message);
    console.log(`⚠️ Token details: Type=${typeof token}, Length=${token?.length}, Value=${token?.substring(0, 50)}...`);
    
    // Allow connection as guest if token verification fails
    console.log(`🔓 Allowing connection as guest due to token verification failure`);
    socket.userId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    socket.userEmail = 'guest@codecollab.com';
    socket.userName = 'Guest User';
    socket.userRole = 'guest';
    socket.userAvatar = null;
    socket.authenticated = false;
    socket.tokenType = 'guest';
    socket.sessionId = null;
    return next();
  }
});

let currentCode = ''; // This will hold the shared code

// Performance monitoring variables
let connectedClients = new Set();
let performanceMetrics = {
  cpu: 0,
  memory: 0,
  network: 0,
  buildTime: 0,
  activeUsers: 0,
  serverLoad: 0,
  errorRate: 0,
  responseTime: 0
};
let monitoringInterval = null;

// Piston API configuration
const PISTON_API_URL = 'https://emkc.org/api/v2/piston';

// Rate limiting for Piston API
let lastPistonRequest = 0;
const PISTON_RATE_LIMIT_MS = 2000; // 2 seconds between requests (more conservative)
const pistonQueue = [];
let isProcessingPistonQueue = false;

// Process Piston API queue to avoid rate limiting
async function processPistonQueue() {
  if (isProcessingPistonQueue || pistonQueue.length === 0) {
    return;
  }
  
  isProcessingPistonQueue = true;
  
  while (pistonQueue.length > 0) {
    const { executionRequest, resolve, reject, timestamp } = pistonQueue.shift();
    
    // Check if request is too old (30 seconds timeout)
    if (Date.now() - timestamp > 30000) {
      reject(new Error('Request timeout - queue processing took too long'));
      continue;
    }
    
    const timeSinceLastRequest = Date.now() - lastPistonRequest;
    if (timeSinceLastRequest < PISTON_RATE_LIMIT_MS) {
      const waitTime = PISTON_RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    try {
      lastPistonRequest = Date.now();
      const response = await axios.post(`${PISTON_API_URL}/execute`, executionRequest, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      resolve(response.data);
    } catch (error) {
      reject(error);
    }
  }
  
  isProcessingPistonQueue = false;
}

// Queue Piston API requests to avoid rate limiting
function queuePistonRequest(executionRequest) {
  return new Promise((resolve, reject) => {
    pistonQueue.push({
      executionRequest,
      resolve,
      reject,
      timestamp: Date.now()
    });
    
    // Start processing if not already processing
    processPistonQueue();
  });
}

// Language mapping for Piston API
const languageMap = {
  'javascript': { language: 'javascript', version: '18.15.0' },
  'python': { language: 'python', version: '3.10.0' },
  'java': { language: 'java', version: '15.0.2' },
  'cpp': { language: 'cpp', version: '10.2.0' },
  'c': { language: 'c', version: '10.2.0' },
  'typescript': { language: 'typescript', version: '5.0.3' },
  'php': { language: 'php', version: '8.2.3' },
  'ruby': { language: 'ruby', version: '3.0.1' },
  'go': { language: 'go', version: '1.16.2' },
  'rust': { language: 'rust', version: '1.68.2' },
  'kotlin': { language: 'kotlin', version: '1.8.20' },
  'swift': { language: 'swift', version: '5.3.3' },
  'csharp': { language: 'csharp', version: '6.12.0' }
};

// Helper function to generate secure invite keys
const generateInviteKey = (length = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to get socket ID for a user in a specific session
const getUserSocketId = (userId, sessionId) => {
  const session = collaborationSessions.get(sessionId);
  if (!session) return null;
  return session.userSockets.get(userId);
};

// Helper function to create a new collaboration session
const createCollaborationSession = (creatorId, sessionName, settings = {}) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const inviteKey = generateInviteKey();
  
  const session = {
    id: sessionId,
    name: sessionName || `Session ${sessionId.substr(-6)}`,
    creatorId: creatorId,
    inviteKey: inviteKey,
    createdAt: Date.now(),
    settings: {
      maxUsers: settings.maxUsers || 10,
      allowGuests: settings.allowGuests || false,
      isPublic: false, // Always private now
      permissions: settings.permissions || {
        canViewFiles: true,
        canEditFiles: true,
        canCreateFiles: true,
        canCreateFolders: true,
        canDeleteFiles: false,
        canManagePermissions: false,
        canInviteOthers: false,
        canExecute: true,
        canChat: true
      }
    },
    files: new Map(), // Session-specific file system
    currentCode: '', // Session-specific code
    chatHistory: [],
    connectedUsers: new Set(),
    userSockets: new Map(), // userId -> socketId for backup broadcasting
    userPermissions: new Map(), // userId -> permissions
    
    // Workspace synchronization fields
    workspaceHost: creatorId, // User responsible for workspace state
    yjsUpdates: [], // Store Yjs updates for late joiners
    lastWorkspaceSync: Date.now(),
    workspaceVersion: 1,
    
    // Project collaboration fields
    projectCollaboration: null, // Will be set when project collaboration starts
    sharedFiles: new Map(), // Shared files across the session
    activeFiles: new Map() // Currently active/edited files
  };

  collaborationSessions.set(sessionId, session);
  sessionInviteKeys.set(inviteKey, sessionId);
  sessionUsers.set(sessionId, new Set());

  console.log(`🔐 Created private session: ${sessionId} with invite key: ${inviteKey}`);
  return session;
};

// Helper function to join a session with invite key
const joinSessionWithKey = async (inviteKey, userId, userInfo) => {
  const sessionId = sessionInviteKeys.get(inviteKey);
  if (!sessionId) {
    throw new Error('Invalid or expired invite key');
  }

  const session = collaborationSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Check if session is full
  if (session.connectedUsers.size >= session.settings.maxUsers) {
    throw new Error('Session is full');
  }

  // Check if user is already in session
  if (session.connectedUsers.has(userId)) {
    console.log(`📝 User ${userInfo.name} rejoined session ${sessionId}`);
    return session;
  }

  // Add user to session
  session.connectedUsers.add(userId);
  sessionUsers.get(sessionId).add(userId);

  // Set default permissions for new user
  if (!session.userPermissions.has(userId)) {
    // Assign all granular permissions from session.settings.permissions
    session.userPermissions.set(userId, {
      canViewFiles: session.settings.permissions.canViewFiles,
      canEditFiles: session.settings.permissions.canEditFiles,
      canCreateFiles: session.settings.permissions.canCreateFiles,
      canCreateFolders: session.settings.permissions.canCreateFolders,
      canDeleteFiles: session.settings.permissions.canDeleteFiles,
      canManagePermissions: session.settings.permissions.canManagePermissions,
      canInviteOthers: session.settings.permissions.canInviteOthers || userId === session.creatorId,
      canExecute: session.settings.permissions.canExecute,
      canChat: session.settings.permissions.canChat,
      // Add the missing projectAccessLevel property for UI role display
      projectAccessLevel: userId === session.creatorId ? 'owner' : 'editor'
    });
  }

  // Log activity
  const joinActivity = new Activity({
    type: 'session',
    action: 'user_joined',
    target: sessionId,
    user: userInfo,
    details: {
      sessionName: session.name,
      userCount: session.connectedUsers.size
    }
  });
  activities.push(joinActivity);

  // Trigger workspace sync for new user if there's an active workspace
  if (session.connectedUsers.size > 1 && session.workspaceHost) {
    // Emit to the workspace host to send workspace to new user
    const hostSocketId = getUserSocketId(session.workspaceHost, sessionId);
    if (hostSocketId) {
      io.to(hostSocketId).emit('workspace_transfer_requested', {
        targetUserId: userId,
        sessionId: sessionId
      });
      console.log(`🔄 Requested workspace transfer from host to ${userInfo.name} in session ${sessionId}`);
    }
  }

  console.log(`👥 User ${userInfo.name} joined session ${sessionId} (${session.connectedUsers.size}/${session.settings.maxUsers} users)`);
  return session;
};

// Helper function to leave a session
const leaveSession = (sessionId, userId, userInfo) => {
  const session = collaborationSessions.get(sessionId);
  if (!session) return false;

  session.connectedUsers.delete(userId);
  const sessionUserSet = sessionUsers.get(sessionId);
  if (sessionUserSet) {
    sessionUserSet.delete(userId);
  }

  // Log activity
  const leaveActivity = new Activity({
    type: 'session',
    action: 'user_left',
    target: sessionId,
    user: userInfo,
    details: {
      sessionName: session.name,
      userCount: session.connectedUsers.size
    }
  });
  activities.push(leaveActivity);

  console.log(`👋 User ${userInfo.name} left session ${sessionId} (${session.connectedUsers.size} users remaining)`);

  // If session is empty and creator left, optionally clean up after some time
  if (session.connectedUsers.size === 0) {
    console.log(`🧹 Session ${sessionId} is now empty, scheduling cleanup...`);
    // Clean up empty session after 1 hour
    setTimeout(() => {
      if (session.connectedUsers.size === 0) {
        collaborationSessions.delete(sessionId);
        sessionInviteKeys.delete(session.inviteKey);
        sessionUsers.delete(sessionId);
        console.log(`🗑️ Cleaned up empty session ${sessionId}`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  return true;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeUsers: connectedClients.size,
    totalActivities: activities.length
  });
});

// API endpoints for file operations
app.get('/api/files', async (req, res) => {
  // Check if user is authenticated
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    // Return empty directory for non-authenticated users
    res.json([]);
    return;
  }

  try {
    // Verify token
    const tokenInfo = await verifyToken(token);
    
    // Get user
    let user;
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
    } else {
      user = users.get(tokenInfo.email);
    }

    if (!user) {
      res.json([]);
      return;
    }

    // Get files from database for the user
    const dbFiles = await databaseService.getFilesByUser(user.id);
    
    // Also get virtual file system files for backwards compatibility
    const virtualFiles = Array.from(virtualFileStore.entries()).map(([path, data]) => ({
      path,
      name: path.split('/').pop(),
      type: data.type,
      source: 'virtual',
      ...data
    }));

    // Combine database files and virtual files
    const allFiles = [
      ...dbFiles.map(file => ({
        path: file.path,
        name: file.name,
        type: file.isDirectory ? 'folder' : 'file',
        source: 'database',
        id: file.id,
        content: file.content,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        authorName: file.authorName
      })),
      ...virtualFiles.filter(vf => !dbFiles.some(df => df.path === vf.path))
    ];
    
    res.json(allFiles);
    
  } catch (error) {
    console.error('Error processing file request:', error);
    res.json([]);
  }
});

app.post('/api/files/create', async (req, res) => {
  const { path: filePath, type, content = '', name, projectId = 'default' } = req.body;
  
  // Check if user is authenticated
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    // Verify token and get user info
    const tokenInfo = await verifyToken(token);
    
    // Get user from our user store
    let user;
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
      if (!user) {
        // Create new user for Firebase authentication
        const newUser = new User({
          id: tokenInfo.userId,
          name: tokenInfo.name,
          email: tokenInfo.email,
          role: 'user',
          provider: 'google'
        });
        users.set(tokenInfo.email, newUser);
        user = newUser;
      }
    } else {
      user = users.get(tokenInfo.email);
      if (!user || !user.isActive) {
        res.status(401).json({ success: false, message: 'User not found or inactive' });
        return;
      }
    }

    // Create file/folder data
    const fileData = {
      name: name || filePath.split('/').pop(),
      path: filePath,
      content: content,
      type: type,
      projectId: projectId,
      authorName: user.name
    };

    // Save to database
    const savedFile = await databaseService.createFile(fileData, user.id);

    // Also save to virtual file system for backwards compatibility
    const virtualPath = filePath;
    if (type === 'file') {
      virtualFileStore.set(virtualPath, {
        content,
        type: 'file',
        lastModified: Date.now(),
        createdBy: user.email,
        dbId: savedFile.id
      });
    } else if (type === 'folder') {
      virtualFileStore.set(virtualPath + '/', {
        content: '',
        type: 'folder',
        lastModified: Date.now(),
        createdBy: user.email,
        dbId: savedFile.id
      });
    }

    res.json({ 
      success: true, 
      message: `${type} created successfully`,
      file: savedFile
    });
    
    // Broadcast virtual file system update to all clients
    io.emit('virtual_fs_update', {
      action: 'create',
      path: virtualPath,
      data: {
        ...virtualFileStore.get(type === 'folder' ? virtualPath + '/' : virtualPath),
        dbFile: savedFile
      }
    });

    console.log(`📁 ${type} created and saved to database: ${fileData.name} by ${user.name} (${user.email})`);
    
  } catch (error) {
    console.error('Error creating file/folder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/files/read/:*', async (req, res) => {
  const filePath = req.params[0];
  
  // Check if user is authenticated
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    // Verify token
    const tokenInfo = await verifyToken(token);
    
    // First check database for the file
    const dbFile = await databaseService.getFileByPath(filePath);
    if (dbFile && !dbFile.isDirectory) {
      res.json({ 
        content: dbFile.content,
        file: dbFile
      });
      return;
    }
    
    // Fallback to virtual file system
    const virtualFile = virtualFileStore.get(filePath);
    if (virtualFile && virtualFile.type === 'file') {
      res.json({ content: virtualFile.content });
      return;
    }
    
    res.status(404).json({ success: false, message: 'File not found' });
    
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Virtual file system endpoints
app.post('/api/virtual-files', async (req, res) => {
  const { path: filePath, content, type = 'file' } = req.body;
  
  try {
    // Save to virtual file system
    virtualFileStore.set(filePath, {
      content,
      type,
      lastModified: Date.now()
    });

    // Check if user is authenticated and save to database
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const tokenInfo = await verifyToken(token);
        let user;
        
        if (tokenInfo.type === 'firebase') {
          user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
        } else {
          user = users.get(tokenInfo.email);
        }

        if (user) {
          const fileData = {
            name: filePath.split('/').pop(),
            path: filePath,
            content: content,
            type: type === 'folder' ? 'folder' : 'file',
            projectId: 'default',
            authorName: user.name
          };

          await databaseService.createFile(fileData, user.id);
          console.log(`📁 Virtual file saved to database: ${filePath} by ${user.name}`);
        }
      } catch (authError) {
        console.log('Authentication failed for virtual file creation, proceeding with virtual-only storage');
      }
    }
    
    res.json({ success: true, message: 'File saved to virtual file system' });
    
    // Broadcast virtual file system update
    io.emit('virtual_fs_update', {
      action: 'create',
      path: filePath,
      data: virtualFileStore.get(filePath)
    });
    
  } catch (error) {
    console.error('Error creating virtual file:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/virtual-files/:*', (req, res) => {
  const filePath = req.params[0];
  
  const file = virtualFileStore.get(filePath);
  if (file) {
    res.json({ content: file.content, ...file });
  } else {
    res.status(404).json({ success: false, message: 'File not found in virtual file system' });
  }
});

app.put('/api/virtual-files/:*', async (req, res) => {
  const filePath = req.params[0];
  const { content } = req.body;
  
  // Check if user is authenticated
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    if (token) {
      // Verify token for authenticated users
      const tokenInfo = await verifyToken(token);
      
      // Get user
      let user;
      if (tokenInfo.type === 'firebase') {
        user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
      } else {
        user = users.get(tokenInfo.email);
      }

      if (user) {
        // Try to update in database first
        const dbFile = await databaseService.getFileByPath(filePath);
        if (dbFile) {
          await databaseService.updateFile(dbFile.id, { content }, user.id);
          console.log(`📝 Database file updated: ${filePath} by ${user.name}`);
        }
      }
    }

    // Update virtual file system for backwards compatibility
    const existingFile = virtualFileStore.get(filePath);
    if (existingFile) {
      virtualFileStore.set(filePath, {
        ...existingFile,
        content,
        lastModified: Date.now()
      });
      
      res.json({ success: true, message: 'File updated in virtual file system' });
      
      // Broadcast update
      io.emit('virtual_fs_update', {
        action: 'update',
        path: filePath,
        data: virtualFileStore.get(filePath)
      });
    } else {
      res.status(404).json({ success: false, message: 'File not found in virtual file system' });
    }
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/virtual-files/:*', (req, res) => {
  const filePath = req.params[0];
  
  if (virtualFileStore.has(filePath)) {
    virtualFileStore.delete(filePath);
    res.json({ success: true, message: 'File deleted from virtual file system' });
    
    // Broadcast deletion
    io.emit('virtual_fs_update', {
      action: 'delete',
      path: filePath
    });
  } else {
    res.status(404).json({ success: false, message: 'File not found in virtual file system' });
  }
});

app.get('/api/virtual-files', async (req, res) => {
  // Check if user is authenticated
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    let allFiles = [];

    if (token) {
      // Get database files for authenticated users
      const tokenInfo = await verifyToken(token);
      let user;
      
      if (tokenInfo.type === 'firebase') {
        user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
      } else {
        user = users.get(tokenInfo.email);
      }

      if (user) {
        const dbFiles = await databaseService.getFilesByUser(user.id);
        allFiles = dbFiles.map(file => ({
          path: file.path,
          content: file.content,
          type: file.isDirectory ? 'folder' : 'file',
          size: file.size,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
          authorName: file.authorName,
          source: 'database',
          id: file.id
        }));
      }
    }

    // Add virtual file system files
    const virtualFiles = Array.from(virtualFileStore.entries()).map(([path, data]) => ({
      path,
      ...data,
      source: 'virtual'
    }));

    // Combine and deduplicate (database files take precedence)
    const combinedFiles = [...allFiles];
    virtualFiles.forEach(vf => {
      if (!allFiles.some(df => df.path === vf.path)) {
        combinedFiles.push(vf);
      }
    });

    res.json(combinedFiles);
  } catch (error) {
    console.error('Error getting virtual files:', error);
    // Fallback to virtual file system only
    const files = Array.from(virtualFileStore.entries()).map(([path, data]) => ({
      path,
      ...data,
      source: 'virtual'
    }));
    res.json(files);
  }
});

// Database-specific file management endpoints
app.get('/api/database/files', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const tokenInfo = await verifyToken(token);
    let user;
    
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
    } else {
      user = users.get(tokenInfo.email);
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    const files = await databaseService.getFilesByUser(user.id);
    res.json({ success: true, files });
    
  } catch (error) {
    console.error('Error getting database files:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/database/files/stats', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const stats = await databaseService.getFileStats();
    res.json({ success: true, stats });
    
  } catch (error) {
    console.error('Error getting file stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/database/activities', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const { projectId, limit = 50 } = req.query;
    const activities = await databaseService.getActivities(projectId, parseInt(limit));
    res.json({ success: true, activities });
    
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/database/files/search', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const { query, projectId } = req.body;
    const results = await databaseService.searchFiles(query, projectId);
    res.json({ success: true, results });
    
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Session management endpoints
const sessions = new Map(); // In-memory session storage

// Private collaboration session endpoints
app.post('/api/sessions/create', async (req, res) => {
  const { sessionName, settings } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required to create sessions' });
    return;
  }

  try {
    const tokenInfo = await verifyToken(token);
    let user;
    
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
    } else {
      user = users.get(tokenInfo.email);
    }

    // Auto-create user for demo/development tokens
    if (!user && (tokenInfo.type === 'demo-jwt' || tokenInfo.type === 'jwt')) {
      user = {
        id: tokenInfo.userId,
        email: tokenInfo.email,
        name: tokenInfo.name,
        role: 'user',
        createdAt: new Date().toISOString()
      };
      users.set(tokenInfo.email, user);
      console.log(`✅ Auto-created user for demo/development: ${tokenInfo.email}`);
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

  const session = createCollaborationSession(user.id, sessionName, settings);
    
    // Automatically add the creator to the session
    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role
    };
    
    try {
      await joinSessionWithKey(session.inviteKey, user.id, userInfo);
      console.log(`✅ Session creator auto-joined to session ${session.id}`);
    } catch (joinError) {
      console.warn(`⚠️ Failed to auto-join creator to session ${session.id}:`, joinError.message);
    }
    
    res.json({ 
      success: true, 
      session: {
        id: session.id,
        name: session.name,
        creatorId: session.creatorId,
        inviteKey: session.inviteKey,
        createdAt: session.createdAt,
        settings: session.settings,
        userCount: session.connectedUsers.size
      }
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/sessions/join', async (req, res) => {
  const { inviteKey } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!inviteKey) {
    res.status(400).json({ success: false, message: 'Invite key is required' });
    return;
  }

  try {
    let user = null;
    
    if (token) {
      // Authenticated user
      const tokenInfo = await verifyToken(token);
      
      if (tokenInfo.type === 'firebase') {
        user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
      } else {
        user = users.get(tokenInfo.email);
      }
    }

    // If no authenticated user, check if guests are allowed
    const sessionId = sessionInviteKeys.get(inviteKey);
    if (!sessionId) {
      res.status(404).json({ success: false, message: 'Invalid invite key' });
      return;
    }

    const session = collaborationSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    if (!user && !session.settings.allowGuests) {
      res.status(401).json({ success: false, message: 'Authentication required for this session' });
      return;
    }

    // Create guest user if needed
    if (!user) {
      user = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: `Guest User`,
        email: 'guest@codecollab.com',
        role: 'guest',
        avatar: 'G'
      };
    }

    const joinedSession = await joinSessionWithKey(inviteKey, user.id, user);
    
    res.json({ 
      success: true, 
      session: {
        id: joinedSession.id,
        name: joinedSession.name,
        creatorId: joinedSession.creatorId,
        createdAt: joinedSession.createdAt,
        settings: joinedSession.settings,
        userCount: joinedSession.connectedUsers.size,
        userPermissions: joinedSession.userPermissions.get(user.id)
      },
      user: user
    });
    
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    const session = collaborationSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Verify user has access to this session
    let hasAccess = false;
    
    if (token) {
      const tokenInfo = await verifyToken(token);
      let user;
      
      if (tokenInfo.type === 'firebase') {
        user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
      } else {
        user = users.get(tokenInfo.email);
      }

      if (user && session.connectedUsers.has(user.id)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this session' });
      return;
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        creatorId: session.creatorId,
        createdAt: session.createdAt,
        settings: session.settings,
        userCount: session.connectedUsers.size,
        files: Array.from(session.files.entries()).map(([path, data]) => ({
          path,
          ...data
        }))
      }
    });
    
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/sessions', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const tokenInfo = await verifyToken(token);
    let user;
    
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
    } else {
      user = users.get(tokenInfo.email);
    }

    // Auto-create user for demo/development tokens
    if (!user && (tokenInfo.type === 'demo-jwt' || tokenInfo.type === 'jwt')) {
      user = {
        id: tokenInfo.userId,
        email: tokenInfo.email,
        name: tokenInfo.name,
        role: 'user',
        createdAt: new Date().toISOString()
      };
      users.set(tokenInfo.email, user);
      console.log(`✅ Auto-created user for demo/development: ${tokenInfo.email}`);
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    // Get sessions where user is connected or is the creator
    const userSessions = Array.from(collaborationSessions.values())
      .filter(session => 
        session.creatorId === user.id || 
        session.connectedUsers.has(user.id)
      )
      .map(session => ({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        userCount: session.connectedUsers.size,
        isCreator: session.creatorId === user.id,
        inviteKey: session.creatorId === user.id ? session.inviteKey : undefined
      }));

    res.json({ success: true, sessions: userSessions });
    
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/sessions/:sessionId/regenerate-key', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const tokenInfo = await verifyToken(token);
    let user;
    
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
    } else {
      user = users.get(tokenInfo.email);
    }

    const session = collaborationSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Only creator can regenerate invite key
    if (session.creatorId !== user.id) {
      res.status(403).json({ success: false, message: 'Only session creator can regenerate invite key' });
      return;
    }

    // Remove old key and generate new one
    sessionInviteKeys.delete(session.inviteKey);
    const newInviteKey = generateInviteKey();
    session.inviteKey = newInviteKey;
    sessionInviteKeys.set(newInviteKey, sessionId);

    res.json({ 
      success: true, 
      inviteKey: newInviteKey,
      message: 'Invite key regenerated successfully'
    });
    
  } catch (error) {
    console.error('Error regenerating invite key:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const tokenInfo = await verifyToken(token);
    let user;
    
    if (tokenInfo.type === 'firebase') {
      user = Array.from(users.values()).find(u => u.id === tokenInfo.userId || u.email === tokenInfo.email);
    } else {
      user = users.get(tokenInfo.email);
    }

    const session = collaborationSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Only creator can delete session
    if (session.creatorId !== user.id) {
      res.status(403).json({ success: false, message: 'Only session creator can delete session' });
      return;
    }

    // Notify all connected users that session is being deleted
    io.to(sessionId).emit('session_deleted', {
      sessionId: sessionId,
      message: 'Session has been deleted by the creator'
    });

    // Clean up session data
    collaborationSessions.delete(sessionId);
    sessionInviteKeys.delete(session.inviteKey);
    sessionUsers.delete(sessionId);

    res.json({ 
      success: true, 
      message: 'Session deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/sessions', (req, res) => {
  const { sessionId, sessionData } = req.body;
  
  try {
    sessions.set(sessionId, {
      ...sessionData,
      lastUpdated: Date.now()
    });
    
    res.json({ success: true, message: 'Session saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = sessions.get(sessionId);
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, data]) => ({
    id,
    lastUpdated: data.lastUpdated,
    fileCount: data.virtualFileSystem ? Object.keys(data.virtualFileSystem.files || {}).length : 0,
    tabCount: data.tabs ? data.tabs.length : 0
  }));
  
  res.json(sessionList);
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    res.json({ success: true, message: 'Session deleted' });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

// Test endpoint for debugging Socket.IO issues
app.get('/api/test-socket', (req, res) => {
  res.json({ 
    message: 'Server is running',
    socketConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Piston API endpoints for code execution

// Get available languages
app.get('/api/execution/languages', async (req, res) => {
  try {
    const response = await axios.get(`${PISTON_API_URL}/runtimes`);
    const supportedLanguages = Object.keys(languageMap).map(lang => {
      const pistonLang = response.data.find(r => 
        r.language === languageMap[lang].language && 
        r.version === languageMap[lang].version
      );
      return {
        name: lang,
        displayName: lang.charAt(0).toUpperCase() + lang.slice(1),
        version: languageMap[lang].version,
        available: !!pistonLang
      };
    });
    
    res.json({ languages: supportedLanguages });
  } catch (error) {
    console.error('❌ Error fetching languages:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch available languages',
      fallback: Object.keys(languageMap).map(lang => ({
        name: lang,
        displayName: lang.charAt(0).toUpperCase() + lang.slice(1),
        version: languageMap[lang].version,
        available: true
      }))
    });
  }
});

// Execute code
app.post('/api/execution/execute', async (req, res) => {
  try {
    const { code, language, input = '' } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({
        error: 'Code and language are required'
      });
    }

    const pistonConfig = languageMap[language.toLowerCase()];
    if (!pistonConfig) {
      return res.status(400).json({
        error: `Unsupported language: ${language}`
      });
    }

    console.log(`🚀 Executing ${language} code...`);
    
    const executionRequest = {
      language: pistonConfig.language,
      version: pistonConfig.version,
      files: [
        {
          name: getFileName(language),
          content: code
        }
      ],
      stdin: input,
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_memory_limit: -1,
      run_memory_limit: -1
    };

    // Use the queue to avoid rate limiting
    const result = await queuePistonRequest(executionRequest);
    
    // Format the response
    const executionResult = {
      success: true,
      language: language,
      version: pistonConfig.version,
      compile: result.compile || { stdout: '', stderr: '', code: 0 },
      run: result.run || { stdout: '', stderr: '', code: 0 },
      output: result.run?.stdout || '',
      error: result.run?.stderr || result.compile?.stderr || '',
      exitCode: result.run?.code ?? result.compile?.code ?? 0,
      executionTime: Date.now()
    };

    console.log(`✅ Code execution completed for ${language}`);
    res.json(executionResult);

  } catch (error) {
    console.error('❌ Code execution error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        error: 'Code execution timed out',
        details: 'The code took too long to execute'
      });
    }
    
    // Handle rate limiting specifically
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        details: 'Too many requests. Please wait a moment and try again.',
        retryAfter: 5000
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Code execution failed',
      details: error.message
    });
  }
});

// Helper function to get appropriate filename for language
function getFileName(language) {
  const extensions = {
    'javascript': 'main.js',
    'typescript': 'main.ts',
    'python': 'main.py',
    'java': 'Main.java',
    'cpp': 'main.cpp',
    'c': 'main.c',
    'php': 'main.php',
    'ruby': 'main.rb',
    'go': 'main.go',
    'rust': 'main.rs',
    'kotlin': 'Main.kt',
    'swift': 'main.swift',
    'csharp': 'Main.cs'
  };
  
  return extensions[language.toLowerCase()] || 'main.txt';
}

// Track connections to prevent spam and improve stability
const connectionTracker = new Map();
const MAX_CONNECTIONS_PER_IP = 10; // Increased limit
const CONNECTION_WINDOW = 30000; // 30 seconds - longer window

// Helper function to update performance metrics
const updatePerformanceMetrics = () => {
  const loadAvg = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  performanceMetrics = {
    cpu: Math.round(loadAvg[0] * 10), // Approximate CPU usage
    memory: Math.round((usedMem / totalMem) * 100),
    network: Math.random() * 5, // Simulated network usage
    buildTime: Math.random() * 10,
    activeUsers: connectedClients.size,
    serverLoad: loadAvg[0],
    errorRate: Math.random() * 2,
    responseTime: Math.round(Math.random() * 200 + 50)
  };
};

// Initialize room-based collaboration services
let roomManager = null;
let workspaceDB = null;
let sessionWorkspaceService = null;

if (admin) {
  try {
    workspaceDB = new WorkspaceDatabaseService();
    sessionWorkspaceService = new SessionWorkspaceService();
    roomManager = new CollaborationRoomManager(workspaceDB);
    console.log('✅ Room-based collaboration services initialized');
    console.log('✅ Session workspace service initialized');
    
    // Start cleanup task for old workspaces (runs every hour)
    setInterval(async () => {
      try {
        const cleanedCount = await workspaceDB.cleanupOldWorkspaces();
        if (cleanedCount > 0) {
          console.log(`🧹 Automatically cleaned up ${cleanedCount} old workspaces`);
        }
      } catch (error) {
        console.error('❌ Failed to cleanup old workspaces:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
  } catch (error) {
    console.error('❌ Failed to initialize room collaboration services:', error);
  }
} else {
  console.log('⚠️ Room-based collaboration disabled - Firebase not available');
  // Initialize SessionWorkspaceService with memory fallback
  sessionWorkspaceService = new SessionWorkspaceService();
  console.log('✅ Session workspace service initialized (memory fallback)');
}

io.on('connection', (socket) => {
  const clientId = socket.id;
  const clientIP = socket.request.connection.remoteAddress || socket.handshake.address || 'unknown';
  const userName = socket.userName;
  const userEmail = socket.userEmail;
  
  // Enhanced rate limiting per IP
  const now = Date.now();
  const connections = connectionTracker.get(clientIP) || [];
  const recentConnections = connections.filter(time => now - time < CONNECTION_WINDOW);
  
  // Only apply rate limiting for excessive connections
  if (recentConnections.length >= MAX_CONNECTIONS_PER_IP) {
    console.log(`⚠️ Rate limiting client ${clientIP} (${recentConnections.length} connections)`);
    socket.emit('connection_error', 'Too many connections from this IP');
    socket.disconnect(true);
    return;
  }
  
  connectionTracker.set(clientIP, [...recentConnections, now]);
  connectedClients.add(clientId);
  performanceMetrics.activeUsers = connectedClients.size;
  
  console.log(`🔌 Client connected: ${userName} (${userEmail}) - ${clientId} from ${clientIP} (${connectedClients.size} total connections)`);

  // Initialize workspace sync for this socket
  if (!global.workspaceSync) {
    global.workspaceSync = new WorkspaceSyncServer(io, collaborationSessions);
  }
  global.workspaceSync.setupHandlers(socket);

  // Enhanced Y.js-based collaboration handlers with room isolation
  socket.on('yjs_update', ({ roomId, update, origin }) => {
    if (!roomId || !update) return;
    
    // Apply update to server-side document
    try {
      applyYjsUpdate(roomId, update, origin || 'socket');
      console.log(`📝 Applied and broadcasting Y.js update for room: ${roomId}`);
      
      // Broadcast to other clients in the room
      socket.to(roomId).emit('yjs_update', { roomId, update, origin: 'server' });
    } catch (error) {
      console.error(`❌ Error applying Y.js update for room ${roomId}:`, error);
      socket.emit('yjs_error', { error: 'Failed to apply update' });
    }
  });

  socket.on('yjs_sync_request', ({ roomId }) => {
    if (!roomId) return;
    
    try {
      const ydoc = getYjsDocument(roomId);
      const stateVector = Y.encodeStateVector(ydoc);
      
      socket.emit('yjs_sync_response', {
        roomId,
        stateVector: Array.from(stateVector)
      });
      
      console.log(`� Sent Y.js sync state for room: ${roomId}`);
    } catch (error) {
      console.error(`❌ Error sending Y.js sync for room ${roomId}:`, error);
      socket.emit('yjs_error', { error: 'Failed to sync' });
    }
  });

  socket.on('yjs_sync_update', ({ roomId, stateVector, update }) => {
    if (!roomId) return;
    
    try {
      if (stateVector) {
        const ydoc = getYjsDocument(roomId);
        const sv = new Uint8Array(stateVector);
        const diffUpdate = Y.encodeStateAsUpdate(ydoc, sv);
        
        if (diffUpdate.length > 0) {
          socket.emit('yjs_update', {
            roomId,
            update: Array.from(diffUpdate),
            origin: 'sync'
          });
        }
      }
      
      if (update) {
        applyYjsUpdate(roomId, update, 'sync');
        socket.to(roomId).emit('yjs_update', { roomId, update, origin: 'sync' });
      }
      
      console.log(`🔄 Processed Y.js sync update for room: ${roomId}`);
    } catch (error) {
      console.error(`❌ Error processing Y.js sync update for room ${roomId}:`, error);
    }
  });

  socket.on('awareness_update', ({ roomId, awareness }) => {
    if (!roomId || !awareness) return;
    
    console.log(`👥 Broadcasting awareness update for room: ${roomId}`);
    socket.to(roomId).emit('awareness_update', { roomId, awareness });
  });

  // Join Y.js collaboration room
  socket.on('join_yjs_room', ({ roomId }) => {
    if (!roomId) return;
    
    socket.join(roomId);
    
    // Get or create Y.js document for the room
    const ydoc = getYjsDocument(roomId);
    
    // Send initial state to the joining client
    const state = Y.encodeStateAsUpdate(ydoc);
    socket.emit('yjs_initial_state', {
      roomId,
      state: Array.from(state)
    });
    
    console.log(`📝 Client joined Y.js room: ${roomId}`);
  });

  socket.on('leave_yjs_room', ({ roomId }) => {
    if (!roomId) return;
    
    socket.leave(roomId);
    console.log(`📝 Client left Y.js room: ${roomId}`);
  });

  socket.on('register_workspace_host', (data) => {
    if (!data?.sessionId) return;
    
    const { sessionId } = data;
    socket.join(sessionId);
    console.log(`🏠 Registering workspace host for session: ${sessionId}`);
    
    // Register host with WorkspaceSyncServer
    if (global.workspaceSync) {
      global.workspaceSync.registerWorkspaceHost(socket, data);
    }
  });

  // **NEW: Store complete workspace state in database**
  socket.on('store_workspace_state', async (data) => {
    try {
      const { sessionId, workspaceData } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      if (!sessionWorkspaceService) {
        socket.emit('error', { type: 'service_unavailable', message: 'Workspace storage service not available' });
        return;
      }

      await sessionWorkspaceService.storeSessionWorkspace(sessionId, workspaceData, socket.userId);
      
      socket.emit('workspace_state_stored', {
        sessionId,
        success: true,
        message: 'Workspace state stored successfully',
        fileCount: Object.keys(workspaceData.files || {}).length,
        folderCount: (workspaceData.folders || []).length
      });
      
      console.log(`💾 Workspace state stored for session ${sessionId} by ${socket.userName}`);
      
    } catch (error) {
      console.error(`❌ Failed to store workspace state:`, error);
      socket.emit('error', { type: 'workspace_storage_failed', error: error.message });
    }
  });

  // **NEW: Handle workspace updates (file/folder operations)**
  socket.on('update_workspace_state', async (data) => {
    try {
      const { sessionId, updateData } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      if (!sessionWorkspaceService) {
        return; // Silently ignore if service not available
      }

      await sessionWorkspaceService.updateSessionWorkspace(sessionId, updateData, socket.userId);
      
      console.log(`🔄 Workspace state updated for session ${sessionId}: ${updateData.type} ${updateData.path}`);
      
    } catch (error) {
      console.error(`❌ Failed to update workspace state:`, error);
      // Don't emit error for updates, just log it
    }
  });

  // **NEW: Request workspace state from session host**
  socket.on('request_workspace_state', (data) => {
    try {
      const { sessionId } = data;
      
      if (!socket.sessionId || socket.sessionId !== sessionId) {
        socket.emit('error', { type: 'invalid_session', message: 'Not connected to this session' });
        return;
      }

      const session = collaborationSessions.get(sessionId);
      if (!session) {
        socket.emit('error', { type: 'session_not_found', message: 'Session not found' });
        return;
      }

      // Find the session creator or workspace host
      const creatorSocketId = session.userSockets.get(session.creatorId);
      if (creatorSocketId) {
        const creatorSocket = io.sockets.sockets.get(creatorSocketId);
        if (creatorSocket) {
          // Ask the creator to send workspace state to requesting user
          creatorSocket.emit('workspace_state_requested', {
            sessionId,
            requesterId: socket.userId,
            requesterName: socket.userName
          });
          
          console.log(`🔄 Workspace state requested by ${socket.userName} from session creator`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to request workspace state:`, error);
      socket.emit('error', { type: 'workspace_request_failed', error: error.message });
    }
  });

  // Add error handling for socket events
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${userName} (${clientId}):`, error);
  });

  console.log(`✅ Socket event handlers registered for ${userName} (${clientId})`);

  // Session management events
  socket.on('join_session', async (data) => {
    const { inviteKey, sessionId: requestedSessionId } = data;
    
    console.log(`📥 Join session request from ${socket.userName}: inviteKey=${inviteKey}, sessionId=${requestedSessionId}`);
    
    try {
      let session = null;
      
      if (inviteKey) {
        console.log(`🔑 Attempting to join session with invite key: ${inviteKey}`);
        
        // Join session using invite key
        const userInfo = {
          id: socket.userId,
          name: socket.userName,
          email: socket.userEmail,
          avatar: socket.userAvatar,
          role: socket.userRole
        };
        
        session = await joinSessionWithKey(inviteKey, socket.userId, userInfo);
        socket.sessionId = session.id;
        
        // Store socket ID for backup broadcasting
        session.userSockets.set(socket.userId, socket.id);
        
        // Join the socket room for this session
        socket.join(session.id);
        
        // Also join the Y.js collaboration room
        socket.join(`yjs_${session.id}`);
        const yjsDoc = getYjsDocument(`yjs_${session.id}`);
        
        // Send initial Y.js state to the joining client
        const yjsState = Y.encodeStateAsUpdate(yjsDoc);
        socket.emit('yjs_initial_state', {
          roomId: `yjs_${session.id}`,
          state: Array.from(yjsState)
        });
        
        // Send session data to the user
        socket.emit('session_joined', {
          session: {
            id: session.id,
            name: session.name,
            creatorId: session.creatorId,
            createdAt: session.createdAt,
            settings: session.settings,
            userCount: session.connectedUsers.size,
            userPermissions: session.userPermissions.get(socket.userId)
          },
          message: `Successfully joined session: ${session.name}`
        });

        console.log(`📤 Sent session_joined event to ${socket.userName} for session ${session.id}`);

        // Send current session state
        socket.emit('code_update', {
          code: session.currentCode,
          sessionId: session.id
        });

        // Send virtual file system state for this session
        const sessionFiles = Array.from(session.files.entries()).map(([path, data]) => ({
          path,
          ...data
        }));
        socket.emit('virtual_fs_state', sessionFiles);

        // Initialize workspace sync for this user
        if (global.workspaceSync) {
          await global.workspaceSync.sendInitialWorkspaceState(socket, session.id);
        }

        // **NEW FEATURE: Load and send stored workspace state to joining user**
        if (sessionWorkspaceService) {
          try {
            const storedWorkspace = await sessionWorkspaceService.loadSessionWorkspace(session.id);
            if (storedWorkspace) {
              console.log(`📋 Sending stored workspace state to ${socket.userName} for session ${session.id}`);
              
              // Send complete workspace state to the joining user
              socket.emit('workspace_state_loaded', {
                sessionId: session.id,
                workspaceData: {
                  files: storedWorkspace.files,
                  folders: storedWorkspace.folders,
                  fileTree: storedWorkspace.fileTree,
                  activeFiles: storedWorkspace.activeFiles
                },
                metadata: storedWorkspace.metadata,
                version: storedWorkspace.version,
                ownerId: storedWorkspace.ownerId,
                message: 'Complete workspace state loaded from database'
              });
              
              console.log(`✅ Workspace state sent to ${socket.userName}: ${Object.keys(storedWorkspace.files || {}).length} files, ${(storedWorkspace.folders || []).length} folders`);
            } else {
              console.log(`ℹ️ No stored workspace found for session ${session.id} - new session or first user`);
            }
          } catch (error) {
            console.error(`❌ Failed to load workspace state for ${socket.userName}:`, error);
            // Don't fail the join process, just log the error
          }
        }

        // Notify other users in the session
        socket.to(session.id).emit('user_joined_session', {
          userId: socket.userId,
          userName: socket.userName,
          userEmail: socket.userEmail,
          userRole: socket.userRole,
          userAvatar: socket.userAvatar,
          sessionId: session.id,
          userCount: session.connectedUsers.size,
          timestamp: Date.now()
        });

        // Send updated session info to all users in the session (including the one who just joined)
        io.to(session.id).emit('session_update', {
          sessionId: session.id,
          userCount: session.connectedUsers.size,
          timestamp: Date.now()
        });

        console.log(`👥 User ${socket.userName} joined session ${session.id} via invite key`);
        
      } else if (requestedSessionId) {
        // Join specific session (if user has access)
        session = collaborationSessions.get(requestedSessionId);
        if (!session) {
          socket.emit('session_error', { message: 'Session not found' });
          return;
        }

        if (!session.connectedUsers.has(socket.userId)) {
          socket.emit('session_error', { message: 'Access denied to this session' });
          return;
        }

        socket.sessionId = session.id;
        
        // Store socket ID for backup broadcasting
        session.userSockets.set(socket.userId, socket.id);
        
        socket.join(session.id);

        socket.emit('session_joined', {
          session: {
            id: session.id,
            name: session.name,
            creatorId: session.creatorId,
            createdAt: session.createdAt,
            settings: session.settings,
            userCount: session.connectedUsers.size,
            userPermissions: session.userPermissions.get(socket.userId)
          },
          message: `Reconnected to session: ${session.name}`
        });

        // Send current session state
        socket.emit('code_update', {
          code: session.currentCode,
          sessionId: session.id
        });

        console.log(`🔄 User ${socket.userName} reconnected to session ${session.id}`);
        
      } else {
        socket.emit('session_error', { message: 'No session specified or invite key provided' });
        return;
      }

    } catch (error) {
      console.error(`❌ Error joining session for ${socket.userName}:`, error.message);
      socket.emit('session_error', { message: error.message });
    }
  });

  socket.on('leave_session', () => {
    if (socket.sessionId) {
      const session = collaborationSessions.get(socket.sessionId);
      if (session) {
        // Leave the socket room
        socket.leave(socket.sessionId);
        
        // Remove user from session
        const userInfo = {
          id: socket.userId,
          name: socket.userName,
          email: socket.userEmail,
          avatar: socket.userAvatar,
          role: socket.userRole
        };
        
        leaveSession(socket.sessionId, socket.userId, userInfo);
        
        // Remove socket ID from session
        session.userSockets.delete(socket.userId);
        
        // Notify other users in the session
        socket.to(socket.sessionId).emit('user_left_session', {
          userId: socket.userId,
          userName: socket.userName,
          sessionId: socket.sessionId,
          userCount: session.connectedUsers.size,
          timestamp: Date.now()
        });

        // Send updated session info to all remaining users in the session
        io.to(socket.sessionId).emit('session_update', {
          sessionId: socket.sessionId,
          userCount: session.connectedUsers.size,
          timestamp: Date.now()
        });
        
        socket.emit('session_left', { 
          sessionId: socket.sessionId,
          message: 'Successfully left the session'
        });
        
        console.log(`👋 User ${socket.userName} left session ${socket.sessionId}`);
        socket.sessionId = null;
      }
    }
  });

  socket.on('get_session_users', () => {
    if (socket.sessionId) {
      const session = collaborationSessions.get(socket.sessionId);
      if (session) {
        const sessionUsers = Array.from(session.connectedUsers).map(userId => {
          // Find user details (simplified for now)
          return {
            id: userId,
            name: `User ${userId}`, // You could enhance this to get actual user names
            status: 'online'
          };
        });
        
        socket.emit('session_users', { 
          users: sessionUsers,
          userCount: session.connectedUsers.size,
          sessionId: socket.sessionId
        });
      }
    }
  });

  socket.on('get_session_info', () => {
    if (socket.sessionId) {
      const session = collaborationSessions.get(socket.sessionId);
      if (session) {
        // Get user permissions for the current user
        const userPermissions = session.userPermissions.get(socket.userId);
        
        socket.emit('session_info', {
          sessionId: session.id,
          name: session.name,
          creatorId: session.creatorId,  // Include creatorId
          userCount: session.connectedUsers.size,
          settings: session.settings,
          createdAt: session.createdAt,   // Include createdAt for consistency
          userPermissions: userPermissions,  // Include user permissions
          timestamp: Date.now()
        });
      }
    }
  });

  // FileSystemManager real-time broadcast support
  socket.on('fs-operation', (operation) => {
    console.log(`📁 FileSystem operation from ${socket.userName}: ${operation.type} ${operation.path}`);
    
    // Broadcast to all users in the session except sender
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('file-operation-broadcast', {
        ...operation,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      });
      
      console.log(`📡 Broadcasted ${operation.type} operation to session ${socket.sessionId}`);
    }
  });

  // Legacy file operations support
  socket.on('create_file', (data) => {
    const operation = {
      type: 'create',
      path: data.relativePath || data.name,
      content: data.content || '',
      metadata: {
        userId: socket.userId,
        userName: socket.userName,
        sessionId: socket.sessionId
      }
    };
    
    // Broadcast using new format
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('file-operation-broadcast', operation);
      console.log(`📡 Broadcasted create_file as file-operation-broadcast`);
    }
  });

  socket.on('realtime_code_change', (data) => {
    const operation = {
      type: 'update',
      path: data.filePath,
      content: data.content,
      metadata: {
        userId: socket.userId,
        userName: socket.userName,
        sessionId: socket.sessionId,
        timestamp: data.timestamp
      }
    };
    
    // Broadcast using new format
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('file-operation-broadcast', operation);
      console.log(`📡 Broadcasted realtime_code_change as file-operation-broadcast`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.userName} (${socket.userEmail}) - ${clientId} - Reason: ${reason}`);
    
    // Leave session if connected to one
    if (socket.sessionId) {
      const session = collaborationSessions.get(socket.sessionId);
      if (session) {
        const userInfo = {
          id: socket.userId,
          name: socket.userName,
          email: socket.userEmail,
          avatar: socket.userAvatar,
          role: socket.userRole
        };
        
        leaveSession(socket.sessionId, socket.userId, userInfo);
        
        // Remove socket ID from session
        session.userSockets.delete(socket.userId);
        
        // Notify other users in the session
        socket.to(socket.sessionId).emit('user_left_session', {
          userId: socket.userId,
          userName: socket.userName,
          sessionId: socket.sessionId,
          userCount: session.connectedUsers.size,
          reason: 'disconnect',
          timestamp: Date.now()
        });

        // Send updated session info to all remaining users in the session
        io.to(socket.sessionId).emit('session_update', {
          sessionId: socket.sessionId,
          userCount: session.connectedUsers.size,
          timestamp: Date.now()
        });
      }
    }
    
    // Update user status to offline
    const user = users.get(socket.userEmail);
    if (user) {
      if (typeof user.setOffline === 'function') {
        user.setOffline();
      }
      
      // Log activity
      const disconnectActivity = new Activity({
        type: 'user_session',
        action: 'disconnected',
        target: 'platform',
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        },
        details: {
          clientId: clientId,
          reason: reason,
          sessionDuration: Date.now() - user.lastActivity,
          sessionId: socket.sessionId
        }
      });
      activities.push(disconnectActivity);
    }
    
    // Clean up connection tracking
    const connections = connectionTracker.get(clientIP) || [];
    const updatedConnections = connections.filter(time => now - time < CONNECTION_WINDOW);
    if (updatedConnections.length > 0) {
      connectionTracker.set(clientIP, updatedConnections);
    } else {
      connectionTracker.delete(clientIP);
    }
    
    connectedClients.delete(clientId);
    performanceMetrics.activeUsers = connectedClients.size;
    
    // Clean up old connection tracking data
    setTimeout(() => {
      const cleanupTime = Date.now() - 30000; // 30 seconds
      for (const [ip, times] of connectionTracker.entries()) {
        const recent = times.filter(time => time > cleanupTime);
        if (recent.length === 0) {
          connectionTracker.delete(ip);
        } else {
          connectionTracker.set(ip, recent);
        }
      }
    }, 5000);
  });

  socket.on('connect_error', (error) => {
    console.error(`❌ Connection error for ${clientId}:`, error);
  });

  // Real-time cursor tracking
  socket.on('cursor_update', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      const { sessionId, userId, userName, userColor, position, selection, filePath, fileName, timestamp } = data;
      
      // Validate session
      if (sessionId !== socket.sessionId) {
        return;
      }

      console.log(`👆 Cursor update from ${socket.userName}: ${fileName} at ${position?.lineNumber}:${position?.column}`);
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('cursor_update', {
        sessionId: socket.sessionId,
        userId: socket.userId,
        userName: socket.userName,
        userColor,
        position,
        selection,
        filePath,
        fileName,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error handling cursor update from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to process cursor update');
    }
  });

  // File activity tracking (when users switch files)
  socket.on('file_activity_update', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      const { sessionId, userId, userName, userColor, filePath, fileName, timestamp } = data;
      
      // Validate session
      if (sessionId !== socket.sessionId) {
        return;
      }

      console.log(`📁 File activity from ${socket.userName}: editing ${fileName}`);
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('file_activity_update', {
        sessionId: socket.sessionId,
        userId: socket.userId,
        userName: socket.userName,
        userColor,
        filePath,
        fileName,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error handling file activity update from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to process file activity update');
    }
  });

  // Handle code changes with session isolation
  socket.on('code_change', (newCode) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check user permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canEdit) {
        socket.emit('error', 'You do not have permission to edit in this session');
        return;
      }

      if (typeof newCode === 'string' && newCode.length < 1000000) { // 1MB limit
        session.currentCode = newCode;
        
        // Broadcast to other users in the same session only
        socket.to(socket.sessionId).emit('code_update', {
          code: newCode,
          updatedBy: {
            userId: socket.userId,
            userName: userName,
            userEmail: userEmail
          },
          sessionId: socket.sessionId,
          timestamp: Date.now()
        });
        
        console.log(`✏️ Code updated by ${userName} in session ${socket.sessionId} (${newCode.length} chars)`);
      } else {
        console.warn(`Invalid code change from ${userName} (${clientId})`);
        socket.emit('error', 'Invalid code format or size');
      }
    } catch (error) {
      console.error(`Error handling code change from ${userName} (${clientId}):`, error);
      socket.emit('error', 'Failed to process code change');
    }
  });
  // Real-time code synchronization
  socket.on('realtime_code_change', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check user permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canEdit) {
        socket.emit('error', 'You do not have permission to edit in this session');
        return;
      }

      const { filePath, content, sessionId } = data;
      
      // Validate data
      if (!filePath || typeof content !== 'string') {
        socket.emit('error', 'Invalid code change data');
        return;
      }

      // Update session file store
      if (session.files.has(filePath)) {
        session.files.set(filePath, {
          ...session.files.get(filePath),
          content: content,
          lastModified: Date.now(),
          lastEditedBy: socket.userId
        });
      } else {
        // Create new file entry
        session.files.set(filePath, {
          content: content,
          type: 'file',
          lastModified: Date.now(),
          createdBy: socket.userId,
          lastEditedBy: socket.userId
        });
      }

      // Also update global virtual file store
      virtualFileStore.set(filePath, {
        content: content,
        type: 'file',
        lastModified: Date.now(),
        createdBy: socket.userEmail,
        sessionId: socket.sessionId
      });

      console.log(`📝 Real-time code update by ${socket.userName}: ${filePath} (${content.length} chars) in session ${socket.sessionId}`);
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('realtime_code_update', {
        filePath: filePath,
        content: content,
        userId: socket.userId,
        userName: socket.userName,
        sessionId: socket.sessionId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error handling real-time code change from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to process code change');
    }
  });

  // File operations (create, delete, rename, save)
  socket.on('file_operation', (operation) => {
    try {
      console.log('📥 Received file_operation:', JSON.stringify(operation, null, 2));
      
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check user permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canEditFiles) {
        socket.emit('error', 'You do not have permission to edit files in this session');
        return;
      }

      const { action, path: filePath, data } = operation;
      
      // Validate file path
      if (typeof filePath !== 'string' || filePath.includes('..') || filePath.length > 500) {
        socket.emit('error', 'Invalid file path');
        return;
      }

      console.log(`📁 File operation by ${socket.userName}: ${action} - ${filePath} in session ${socket.sessionId}`);
      
      // Update session's internal file system based on the operation
      try {
        switch (action) {
          case 'create':
          case 'file_create':
            if (data && data.type === 'file') {
              // Use simple file path without session prefix for consistency
              session.files.set(filePath, {
                content: data.content || '',
                type: 'file',
                lastModified: Date.now(),
                createdBy: socket.userId,
                lastEditedBy: socket.userId
              });
              
              // Also update global virtual file store
              virtualFileStore.set(filePath, {
                content: data.content || '',
                type: 'file',
                lastModified: Date.now(),
                createdBy: socket.userEmail,
                sessionId: socket.sessionId
              });
              
              console.log(`📄 File created in session: ${filePath}`);
            }
            break;
            
          case 'folder_create':
            const folderPath = filePath.endsWith('/') ? filePath : filePath + '/';
            session.files.set(folderPath, {
              type: 'directory',
              lastModified: Date.now(),
              createdBy: socket.userId
            });
            
            // Also update global virtual file store
            virtualFileStore.set(folderPath, {
              type: 'directory',
              lastModified: Date.now(),
              createdBy: socket.userEmail,
              sessionId: socket.sessionId
            });
            
            console.log(`📁 Folder created in session: ${folderPath}`);
            break;
            
          case 'delete':
          case 'file_delete':
          case 'folder_delete':
            session.files.delete(filePath);
            virtualFileStore.delete(filePath);
            
            // Also delete any files that start with this path (for folder deletion)
            for (const [path] of session.files) {
              if (path.startsWith(filePath)) {
                session.files.delete(path);
              }
            }
            for (const [path] of virtualFileStore) {
              if (path.startsWith(filePath)) {
                virtualFileStore.delete(path);
              }
            }
            
            console.log(`🗑️ File/folder deleted from session: ${filePath}`);
            break;
            
          case 'rename':
          case 'file_rename':
            const oldPath = data?.oldPath || filePath;
            const newPath = data?.newPath || data?.path || filePath;
            
            if (session.files.has(oldPath)) {
              const fileData = session.files.get(oldPath);
              session.files.delete(oldPath);
              session.files.set(newPath, {
                ...fileData,
                lastModified: Date.now(),
                lastEditedBy: socket.userId
              });
            }
            
            if (virtualFileStore.has(oldPath)) {
              const fileData = virtualFileStore.get(oldPath);
              virtualFileStore.delete(oldPath);
              virtualFileStore.set(newPath, {
                ...fileData,
                lastModified: Date.now()
              });
            }
            
            console.log(`📝 File/folder renamed in session: ${oldPath} -> ${newPath}`);
            break;

          case 'save':
          case 'file_save':
            if (data && typeof data.content === 'string') {
              if (session.files.has(filePath)) {
                const existingFile = session.files.get(filePath);
                session.files.set(filePath, {
                  ...existingFile,
                  content: data.content,
                  lastModified: Date.now(),
                  lastEditedBy: socket.userId
                });
              } else {
                // Create new file if it doesn't exist
                session.files.set(filePath, {
                  content: data.content,
                  type: 'file',
                  lastModified: Date.now(),
                  createdBy: socket.userId,
                  lastEditedBy: socket.userId
                });
              }
              
              // Update virtual file store
              if (virtualFileStore.has(filePath)) {
                const existingFile = virtualFileStore.get(filePath);
                virtualFileStore.set(filePath, {
                  ...existingFile,
                  content: data.content,
                  lastModified: Date.now()
                });
              } else {
                virtualFileStore.set(filePath, {
                  content: data.content,
                  type: 'file',
                  lastModified: Date.now(),
                  createdBy: socket.userEmail,
                  sessionId: socket.sessionId
                });
              }
              
              console.log(`💾 File saved in session: ${filePath} (${data.content.length} chars)`);
            }
            break;
        }
      } catch (updateError) {
        console.error(`Error updating session file system:`, updateError);
      }
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('file_operation', {
        ...operation,
        sessionId: socket.sessionId,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      });
      
      // Also emit virtual_fs_update for backward compatibility
      socket.to(socket.sessionId).emit('virtual_fs_update', {
        action: action,
        path: filePath,
        data: session.files.get(filePath) || data,
        sessionId: socket.sessionId,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      });
      
      // Emit specific events for file/folder creation that client handlers expect
      if (action === 'create' || action === 'file_create') {
        socket.to(socket.sessionId).emit('file_created', {
          path: filePath,
          content: data?.content || '',
          sessionId: socket.sessionId,
          userId: socket.userId,
          userName: socket.userName,
          timestamp: Date.now()
        });
        console.log(`📄 Broadcasted file_created event for: ${filePath}`);
      } else if (action === 'folder_create') {
        socket.to(socket.sessionId).emit('folder_created', {
          path: filePath,
          sessionId: socket.sessionId,
          userId: socket.userId,
          userName: socket.userName,
          timestamp: Date.now()
        });
        console.log(`📁 Broadcasted folder_created event for: ${filePath}`);
      }
      
      console.log(`📡 Broadcasted file operation to ${session.connectedUsers.size - 1} other users in session ${socket.sessionId}`);
      
    } catch (error) {
      console.error(`Error handling file operation from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to process file operation');
    }
  });

  // Enhanced virtual file system operation handler
  socket.on('virtual_fs_operation', async (operation) => {
    try {
      console.log('📥 Received virtual_fs_operation:', JSON.stringify(operation, null, 2));
      
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check user permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canEditFiles) {
        socket.emit('error', 'You do not have permission to edit files in this session');
        return;
      }

      const { action, filePath, content, data } = operation;
      
      // Validate file path
      if (typeof filePath !== 'string' || filePath.includes('..') || filePath.length > 500) {
        socket.emit('error', 'Invalid file path');
        return;
      }

      console.log(`�️ Virtual FS operation by ${socket.userName}: ${action} - ${filePath} in session ${socket.sessionId}`);
      
      // Update session's file system and virtual file store
      try {
        switch (action) {
          case 'create':
          case 'create_file':
            const fileData = {
              content: content || data?.content || '',
              type: 'file',
              lastModified: Date.now(),
              createdBy: socket.userId,
              lastEditedBy: socket.userId
            };
            
            session.files.set(filePath, fileData);
            virtualFileStore.set(filePath, {
              ...fileData,
              createdBy: socket.userEmail,
              sessionId: socket.sessionId
            });
            
            console.log(`� Virtual file created: ${filePath}`);
            break;
            
          case 'update':
          case 'save':
            if (typeof content === 'string') {
              const updatedData = {
                content: content,
                type: 'file',
                lastModified: Date.now(),
                lastEditedBy: socket.userId
              };
              
              if (session.files.has(filePath)) {
                const existingFile = session.files.get(filePath);
                session.files.set(filePath, { ...existingFile, ...updatedData });
              } else {
                session.files.set(filePath, { ...updatedData, createdBy: socket.userId });
              }
              
              if (virtualFileStore.has(filePath)) {
                const existingFile = virtualFileStore.get(filePath);
                virtualFileStore.set(filePath, { ...existingFile, ...updatedData });
              } else {
                virtualFileStore.set(filePath, {
                  ...updatedData,
                  createdBy: socket.userEmail,
                  sessionId: socket.sessionId
                });
              }
              
              console.log(`� Virtual file updated: ${filePath} (${content.length} chars)`);
            }
            break;
            
          case 'delete':
            session.files.delete(filePath);
            virtualFileStore.delete(filePath);
            
            console.log(`🗑️ Virtual file deleted: ${filePath}`);
            break;
            
          case 'create_folder':
            const folderPath = filePath.endsWith('/') ? filePath : filePath + '/';
            const folderData = {
              type: 'directory',
              lastModified: Date.now(),
              createdBy: socket.userId
            };
            
            session.files.set(folderPath, folderData);
            virtualFileStore.set(folderPath, {
              ...folderData,
              createdBy: socket.userEmail,
              sessionId: socket.sessionId
            });
            
            console.log(`� Virtual folder created: ${folderPath}`);
            break;
        }
      } catch (updateError) {
        console.error(`Error updating virtual file system:`, updateError);
      }
      
      // Broadcast to other users in the same session
      const broadcastData = {
        action: action,
        path: filePath,
        content: content,
        data: session.files.get(filePath) || data,
        sessionId: socket.sessionId,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      };
      
      socket.to(socket.sessionId).emit('virtual_fs_update', broadcastData);
      
      // Also emit as file_operation for compatibility
      socket.to(socket.sessionId).emit('file_operation', {
        action: action,
        path: filePath,
        data: { content: content, ...data },
        sessionId: socket.sessionId,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now()
      });
      
      // Emit specific events for file/folder creation that client handlers expect
      if (action === 'create' || action === 'create_file') {
        socket.to(socket.sessionId).emit('file_created', {
          path: filePath,
          content: content || '',
          sessionId: socket.sessionId,
          userId: socket.userId,
          userName: socket.userName,
          timestamp: Date.now()
        });
        console.log(`📄 Broadcasted file_created event for: ${filePath}`);
      } else if (action === 'create_folder') {
        socket.to(socket.sessionId).emit('folder_created', {
          path: filePath,
          sessionId: socket.sessionId,
          userId: socket.userId,
          userName: socket.userName,
          timestamp: Date.now()
        });
        console.log(`📁 Broadcasted folder_created event for: ${filePath}`);
      }
      
      console.log(`📡 Broadcasted virtual FS operation to ${session.connectedUsers.size - 1} other users in session ${socket.sessionId}`);
      
    } catch (error) {
      console.error(`Error handling virtual FS operation from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to process virtual file system operation');
    }
  });

  // Get session files state
  socket.on('get_session_files', () => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      console.log(`📁 Getting session files for ${socket.userName} in session ${socket.sessionId}`);
      console.log(`📁 Session has ${session.files.size} files stored`);

      // Convert session files to array format
      const sessionFiles = Array.from(session.files.entries()).map(([path, data]) => ({
        path: path,
        content: data.content || '',
        type: data.type || 'file',
        lastModified: data.lastModified || Date.now(),
        createdBy: data.createdBy,
        lastEditedBy: data.lastEditedBy
      }));
        
      console.log(`� Sending ${sessionFiles.length} session files to ${socket.userName}`);
      socket.emit('session_files_state', sessionFiles);
    } catch (error) {
      console.error(`Error getting session files for ${socket.userName}:`, error);
      socket.emit('error', 'Failed to get session files');
    }
  });

  // Get virtual file system state
  socket.on('get_virtual_fs_state', () => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Get all files for this session from both session files and virtual file store
      const allFiles = new Map();
      
      // Add session files
      for (const [path, data] of session.files) {
        allFiles.set(path, data);
      }
      
      // Add virtual files that belong to this session
      for (const [path, data] of virtualFileStore) {
        if (data.sessionId === socket.sessionId && !allFiles.has(path)) {
          allFiles.set(path, data);
        }
      }
      
      const virtualFSState = Array.from(allFiles.entries()).map(([path, data]) => ({
        path: path,
        content: data.content || '',
        type: data.type || 'file',
        lastModified: data.lastModified || Date.now(),
        createdBy: data.createdBy,
        lastEditedBy: data.lastEditedBy
      }));
        
      console.log(`📡 Sending virtual FS state to ${socket.userName}: ${virtualFSState.length} files`);
      socket.emit('virtual_fs_state', virtualFSState);
    } catch (error) {
      console.error(`Error getting virtual FS state for ${socket.userName}:`, error);
      socket.emit('error', 'Failed to get virtual file system state');
    }
  });

  // Handle chat messages with session isolation
  socket.on('chat_message', (messageData) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check user permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canChat) {
        socket.emit('error', 'You do not have permission to chat in this session');
        return;
      }

      const message = {
        id: Date.now().toString(),
        content: messageData.content,
        userId: socket.userId,
        userName: socket.userName,
        userAvatar: socket.userAvatar,
        sessionId: socket.sessionId,
        timestamp: Date.now(),
        type: messageData.type || 'text'
      };

      // Add to session chat history
      session.chatHistory.push(message);

      // Broadcast to all users in the session
      io.to(socket.sessionId).emit('chat_message', message);

      console.log(`💬 Chat message in session ${socket.sessionId} from ${socket.userName}: ${message.content.substring(0, 50)}...`);
    } catch (error) {
      console.error(`Error handling chat message from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to send chat message');
    }
  });

  // Code execution with session isolation
  socket.on('execute_code', async (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check user permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canExecute) {
        socket.emit('error', 'You do not have permission to execute code in this session');
        return;
      }

      const { code, language, input = '' } = data;
      console.log(`🚀 Code execution request from ${clientId} in session ${socket.sessionId}: ${language}`);
      
      // Broadcast execution start to session users only
      io.to(socket.sessionId).emit('execution_started', {
        clientId,
        language,
        sessionId: socket.sessionId,
        userName: socket.userName,
        timestamp: Date.now()
      });

      const pistonConfig = languageMap[language.toLowerCase()];
      if (!pistonConfig) {
        const errorResult = {
          error: `Unsupported language: ${language}`,
          sessionId: socket.sessionId
        };
        socket.emit('execution_error', errorResult);
        io.to(socket.sessionId).emit('execution_error', errorResult);
        return;
      }

      const executionRequest = {
        language: pistonConfig.language,
        version: pistonConfig.version,
        files: [
          {
            name: getFileName(language),
            content: code
          }
        ],
        stdin: input,
        compile_timeout: 10000,
        run_timeout: 3000,
        compile_memory_limit: -1,
        run_memory_limit: -1
      };

      // Use the queue to avoid rate limiting
      const result = await queuePistonRequest(executionRequest);
      
      const executionResult = {
        success: true,
        language: language,
        version: pistonConfig.version,
        compile: result.compile || { stdout: '', stderr: '', code: 0 },
        run: result.run || { stdout: '', stderr: '', code: 0 },
        output: result.run?.stdout || '',
        error: result.run?.stderr || result.compile?.stderr || '',
        exitCode: result.run?.code ?? result.compile?.code ?? 0,
        executionTime: Date.now(),
        sessionId: socket.sessionId,
        clientId,
        userName: socket.userName
      };

      // Broadcast result to session users only
      io.to(socket.sessionId).emit('execution_result', executionResult);
      console.log(`✅ Code execution completed for ${clientId} in session ${socket.sessionId}: ${language}`);

    } catch (error) {
      console.error(`❌ Code execution error for ${clientId}:`, error.message);
      
      let errorMessage = 'Execution failed';
      let details = error.message;
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Execution timed out';
        details = 'The code took too long to execute';
      } else if (error.response?.status === 429) {
        errorMessage = 'Rate limit exceeded';
        details = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message.includes('queue processing took too long')) {
        errorMessage = 'Queue timeout';
        details = 'The execution queue is busy. Please try again in a moment.';
      }
      
      const errorResult = {
        success: false,
        error: errorMessage,
        details: details,
        sessionId: socket.sessionId,
        clientId,
        userName: socket.userName
      };
      
      // Broadcast error to session users only
      io.to(socket.sessionId).emit('execution_error', errorResult);
    }
  });
  // Session-specific file operations
  socket.on('create_file', async (data) => {
    console.log(`🔥 [ENTRY] create_file handler called with data:`, data);
    console.log(`🔥 [ENTRY] socket.sessionId:`, socket.sessionId);
    console.log(`🔥 [ENTRY] socket.userName:`, socket.userName);
    
    if (!socket.sessionId) {
      console.log(`🔥 [EARLY_EXIT] No sessionId found`);
      socket.emit('error', 'Not connected to any session');
      return;
    }

    const { name, content = '', autoOpen = false } = data;
    console.log(`📄 Create file from ${socket.userName || socket.userEmail}: ${name} in session ${socket.sessionId}`);

    try {
      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

     // Check permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canCreateFiles) {
        socket.emit('error', 'You do not have permission to create files in this session');
        return;
      }

      // Use simple file path without session prefix for consistency
      const filePath = name;
      
      // Create in session file system
      const fileData = {
        content,
        type: 'file',
        size: content.length,
        createdBy: socket.userId,
        lastEditedBy: socket.userId,
        createdAt: new Date().toISOString(),
        lastModified: Date.now()
      };
      
      console.log(`🔧 [CREATE_FILE_DEBUG] About to store file in session: ${filePath}`);
      console.log(`🔧 [CREATE_FILE_DEBUG] Session files before: ${session.files.size} files`);
      console.log(`🔧 [CREATE_FILE_DEBUG] All existing files:`, Array.from(session.files.keys()));
      
      session.files.set(filePath, fileData);
      
      console.log(`🔧 [CREATE_FILE_DEBUG] Session files after: ${session.files.size} files`);
      console.log(`🔧 [CREATE_FILE_DEBUG] File stored successfully: ${session.files.has(filePath)}`);
      console.log(`🔧 [CREATE_FILE_DEBUG] All files now:`, Array.from(session.files.keys()));
      console.log(`🔧 [CREATE_FILE_DEBUG] Stored file data:`, session.files.get(filePath));

      // Also add to global virtual file store
      virtualFileStore.set(filePath, {
        content,
        type: 'file',
        size: content.length,
        createdBy: socket.userEmail,
        createdAt: new Date().toISOString(),
        sessionId: socket.sessionId,
        lastModified: Date.now()
      });

      // Save to database if authenticated
      if (socket.authenticated) {
        let user;
        if (socket.tokenType === 'firebase') {
          user = Array.from(users.values()).find(u => u.id === socket.userId || u.email === socket.userEmail);
        } else {
          user = users.get(socket.userEmail);
        }

        if (user) {
          const fileData = {
            name: name,
            path: filePath,
            content: content,
            type: 'file',
            projectId: socket.sessionId,
            authorName: user.name
          };

          await databaseService.createFile(fileData, user.id);
          console.log(`📄 File saved to database: ${name} by ${user.name} in session ${socket.sessionId}`);
        }
      }

      // Broadcast to session users
      console.log(`🔧 [DEBUG] About to broadcast file_created event for: ${name}`);
      console.log(`🔧 [DEBUG] Broadcasting to session: ${socket.sessionId} with ${session.connectedUsers.size} users`);
      console.log(`🔧 [DEBUG] Connected users in session:`, Array.from(session.connectedUsers.values()).map(u => u.name || u.email));
      
      const broadcastData = {
        name,
        path: filePath,
        relativePath: name, // Send the relative path that client expects
        sessionId: socket.sessionId,
        createdBy: socket.userName || socket.userEmail,
        content: content,
        autoOpen: autoOpen
      };
      
      console.log(`🔧 [DEBUG] Broadcast data:`, JSON.stringify(broadcastData, null, 2));
      
      // Ensure we broadcast to all session members except the creator
      const broadcastSuccess = io.to(socket.sessionId).emit('file_created', broadcastData);
      console.log(`🔧 [DEBUG] file_created event broadcasted successfully to room: ${socket.sessionId}`);
      
      // Also emit to individual sockets as backup
      session.connectedUsers.forEach((userId) => {
        if (userId !== socket.userId) {
          const userSocketId = session.userSockets.get(userId);
          if (userSocketId) {
            const userSocket = io.sockets.sockets.get(userSocketId);
            if (userSocket) {
              userSocket.emit('file_created', broadcastData);
              console.log(`🔧 [BACKUP] Sent file_created to user ${userId} (${userSocketId})`);
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error creating file for ${socket.userName}:`, error);
      socket.emit('error', 'Failed to create file');
    }
  });

  // Create folder handler for session-based file system
  socket.on('create_folder', async (data) => {
    if (!socket.sessionId) {
      socket.emit('error', 'Not connected to any session');
      return;
    }

    const { name } = data;
    console.log(`� Create folder from ${socket.userName || socket.userEmail}: ${name} in session ${socket.sessionId}`);

    try {
      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Check permissions
      const userPermissions = session.userPermissions.get(socket.userId);
      if (!userPermissions || !userPermissions.canCreateFolders) {
        socket.emit('error', 'You do not have permission to create folders in this session');
        return;
      }

      const folderPath = name.endsWith('/') ? name : name + '/';
      
      // Create in session file system
      const folderData = {
        type: 'directory',
        createdBy: socket.userId,
        createdAt: new Date().toISOString(),
        lastModified: Date.now()
      };
      
      session.files.set(folderPath, folderData);

      // Also add to global virtual file store
      virtualFileStore.set(folderPath, {
        type: 'directory',
        createdBy: socket.userEmail,
        createdAt: new Date().toISOString(),
        sessionId: socket.sessionId,
        lastModified: Date.now()
      });

      // Save to database if authenticated
      if (socket.authenticated) {
        let user;
        if (socket.tokenType === 'firebase') {
          user = Array.from(users.values()).find(u => u.id === socket.userId || u.email === socket.userEmail);
        } else {
          user = users.get(socket.userEmail);
        }

        if (user) {
          const folderData = {
            name: name,
            path: folderPath,
            type: 'folder',
            projectId: socket.sessionId,
            authorName: user.name
          };

          await databaseService.createFile(folderData, user.id);
          console.log(`📁 Folder saved to database: ${name} by ${user.name} in session ${socket.sessionId}`);
        }
      }

      // Broadcast to session users
      const broadcastData = {
        name,
        path: folderPath,
        relativePath: name + '/', // Send the relative path that client expects
        sessionId: socket.sessionId,
        createdBy: socket.userName || socket.userEmail
      };
      
      console.log(`📁 [DEBUG] Broadcasting folder_created to session: ${socket.sessionId} with ${session.connectedUsers.size} users`);
      console.log(`📁 [DEBUG] Broadcast data:`, JSON.stringify(broadcastData, null, 2));
      
      // Broadcast to all session members except the creator
      io.to(socket.sessionId).emit('folder_created', broadcastData);
      console.log(`📁 [DEBUG] folder_created event broadcasted successfully to room: ${socket.sessionId}`);
      
      // Also emit to individual sockets as backup
      session.connectedUsers.forEach((userId) => {
        if (userId !== socket.userId) {
          const userSocketId = session.userSockets.get(userId);
          if (userSocketId) {
            const userSocket = io.sockets.sockets.get(userSocketId);
            if (userSocket) {
              userSocket.emit('folder_created', broadcastData);
              console.log(`📁 [BACKUP] Sent folder_created to user ${userId} (${userSocketId})`);
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error creating folder for ${socket.userName}:`, error);
      socket.emit('error', 'Failed to create folder');
    }
  });

  // Performance monitoring (session-aware)
  socket.on('start_performance_monitoring', (data) => {
    if (!socket.sessionId) {
      socket.emit('error', 'Not connected to any session');
      return;
    }

    console.log(`� Starting performance monitoring for ${socket.id} in session ${socket.sessionId}`);

    if (!monitoringInterval) {
      monitoringInterval = setInterval(() => {
        updatePerformanceMetrics();
        // Send metrics only to users in sessions
        for (const [sessionId, session] of collaborationSessions.entries()) {
          io.to(sessionId).emit('performance_metrics', {
            ...performanceMetrics,
            sessionId: sessionId,
            sessionUsers: session.connectedUsers.size
          });
        }
      }, 2000); // Update every 2 seconds
    }

    socket.emit('monitoring_started', { sessionId: socket.sessionId });
  });

  socket.on('stop_performance_monitoring', (data) => {
    console.log(`📊 Stopping performance monitoring for ${socket.id}`);
    socket.emit('monitoring_stopped', { sessionId: socket.sessionId });
  });

  // Handle session management commands
  socket.on('get_session_users', () => {
    if (!socket.sessionId) {
      socket.emit('error', 'Not connected to any session');
      return;
    }

    const session = collaborationSessions.get(socket.sessionId);
    if (session) {
      const sessionUsers = Array.from(session.connectedUsers).map(userId => {
        // Find user info for each connected user
        const user = Array.from(users.values()).find(u => u.id === userId);
        return user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          permissions: session.userPermissions.get(userId)
        } : null;
      }).filter(Boolean);

      socket.emit('session_users', {
        sessionId: socket.sessionId,
        users: sessionUsers,
        totalUsers: session.connectedUsers.size
      });
    }
  });

  socket.on('get_session_info', () => {
    if (!socket.sessionId) {
      socket.emit('error', 'Not connected to any session');
      return;
    }

    const session = collaborationSessions.get(socket.sessionId);
    if (session) {
      socket.emit('session_info', {
        id: session.id,
        name: session.name,
        creatorId: session.creatorId,
        inviteKey: session.inviteKey,  // Include invite key for all session members
        createdAt: session.createdAt,
        settings: session.settings,
        userCount: session.connectedUsers.size,
        fileCount: session.files.size,
        chatCount: session.chatHistory.length,
        userPermissions: session.userPermissions.get(socket.userId)
      });
    }
  });

  socket.on('update_user_permissions', async (data) => {
    if (!socket.sessionId) {
      socket.emit('error', 'Not connected to any session');
      return;
    }

    const session = collaborationSessions.get(socket.sessionId);
    if (!session) {
      socket.emit('error', 'Session not found');
      return;
    }

    // Only session creator can update permissions
    if (session.creatorId !== socket.userId) {
      socket.emit('error', 'Only session creator can update user permissions');
      return;
    }

    const { userId, permissions } = data;
    if (session.connectedUsers.has(userId)) {
      session.userPermissions.set(userId, permissions);
      
      // Notify the user about permission changes
      io.to(socket.sessionId).emit('permissions_updated', {
        userId: userId,
        permissions: permissions,
        updatedBy: socket.userName
      });

      console.log(`� Permissions updated for user ${userId} in session ${socket.sessionId} by ${socket.userName}`);
    } else {
      socket.emit('error', 'User not found in session');
    }
  });

  // Project sharing events
  socket.on('project_share_init', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Only session creator can initiate project sharing
      if (session.creatorId !== socket.userId) {
        socket.emit('error', 'Only session creator can share projects');
        return;
      }

      const { mode, projectData, ownerId } = data;
      
      console.log(`📁 Project sharing initiated by ${socket.userName}: ${mode} - ${projectData.name}`);
      
      // Store project data in session
      session.projectMode = mode;
      session.projectData = projectData;
      session.projectOwner = ownerId;
      
      // Broadcast to all users in the session
      io.to(socket.sessionId).emit('project_share_init', {
        sessionId: socket.sessionId,
        mode,
        projectData,
        ownerId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling project share init from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to initialize project sharing');
    }
  });

  socket.on('project_create_init', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Only session creator can create new projects
      if (session.creatorId !== socket.userId) {
        socket.emit('error', 'Only session creator can create new projects');
        return;
      }

      const { mode, template, projectData, ownerId } = data;
      
      console.log(`🚀 New project creation by ${socket.userName}: ${template} - ${projectData.name}`);
      
      // Store project data in session
      session.projectMode = mode;
      session.projectTemplate = template;
      session.projectData = projectData;
      session.projectOwner = ownerId;
      
      // Load project structure into session files if provided
      if (projectData.structure && Array.isArray(projectData.structure)) {
        projectData.structure.forEach(([path, metadata]) => {
          if (metadata.type === 'file') {
            session.files.set(path, {
              content: metadata.content || '',
              type: 'file',
              lastModified: Date.now(),
              createdBy: ownerId,
              lastEditedBy: ownerId
            });
          }
        });
      }
      
      // Broadcast to all users in the session
      io.to(socket.sessionId).emit('project_create_init', {
        sessionId: socket.sessionId,
        mode,
        template,
        projectData,
        ownerId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling project create init from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to initialize project creation');
    }
  });

  socket.on('access_rights_update', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      // Only project owner can update access rights
      if (session.projectOwner !== socket.userId) {
        socket.emit('error', 'Only project owner can update access rights');
        return;
      }

      const { userId, accessLevel, updatedBy } = data;
      
      console.log(`🔐 Access rights update by ${socket.userName}: ${userId} -> ${accessLevel}`);
      
      // Update user permissions in session
      const userPermissions = session.userPermissions.get(userId);
      if (userPermissions) {
        userPermissions.projectAccessLevel = accessLevel;
        
        // Update editing permissions based on access level
        userPermissions.canEdit = ['owner', 'editor'].includes(accessLevel);
        userPermissions.canExecute = ['owner', 'editor'].includes(accessLevel);
        
        session.userPermissions.set(userId, userPermissions);
      }
      
      // Broadcast to all users in the session
      io.to(socket.sessionId).emit('access_rights_update', {
        sessionId: socket.sessionId,
        userId,
        accessLevel,
        updatedBy,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling access rights update from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to update access rights');
    }
  });

  socket.on('file_activity_broadcast', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      const { filePath, activity } = data;
      
      console.log(`📝 File activity broadcast by ${socket.userName}: ${activity} on ${filePath}`);
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('file_activity', {
        sessionId: socket.sessionId,
        filePath,
        userId: socket.userId,
        userName: socket.userName,
        activity,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling file activity broadcast from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to broadcast file activity');
    }
  });

  socket.on('cursor_position_broadcast', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      const { filePath, position, selection } = data;
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('cursor_position', {
        sessionId: socket.sessionId,
        filePath,
        userId: socket.userId,
        position,
        selection,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling cursor position broadcast from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to broadcast cursor position');
    }
  });

  socket.on('user_presence_update', (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      const { presence } = data;
      
      // Broadcast to other users in the same session
      socket.to(socket.sessionId).emit('user_presence', {
        sessionId: socket.sessionId,
        userId: socket.userId,
        presence,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling user presence update from ${socket.userName}:`, error);
      socket.emit('error', 'Failed to update user presence');
    }
  });

  // Enhanced Project Collaboration System
  socket.on('start_project_collaboration', async (data) => {
    try {
      console.log('📥 Received start_project_collaboration event:', JSON.stringify(data, null, 2));
      
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      const { project, mode } = data;
      
      console.log(`🚀 Starting project collaboration: ${project.name} (${mode}) by ${socket.userName}`);
      
      // Initialize project state in session
      session.projectCollaboration = {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        owner: project.owner,
        mode: mode,
        files: new Map(),
        folders: new Set(),
        collaborators: new Map(),
        metadata: project.metadata,
        createdAt: new Date().toISOString()
      };

      // Add owner as collaborator
      session.projectCollaboration.collaborators.set(project.owner, {
        id: project.owner,
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'manage'],
        joinedAt: new Date().toISOString()
      });

      // Load initial files and folders if sharing existing project
      if (mode === 'existing' && project.files) {
        project.files.forEach(file => {
          session.projectCollaboration.files.set(file.path, {
            id: file.id,
            name: file.name,
            type: 'file',
            content: file.content,
            metadata: file.metadata || {
              createdAt: new Date().toISOString(),
              createdBy: project.owner
            }
          });
        });
      }

      if (mode === 'existing' && project.folders) {
        project.folders.forEach(folder => {
          session.projectCollaboration.folders.add(folder.path);
        });
      }

      // Emit success response to initiator
      socket.emit('project_collaboration_started', {
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          owner: project.owner,
          mode: mode,
          files: Array.from(session.projectCollaboration.files.entries()).map(([path, data]) => ({
            path,
            ...data
          })),
          folders: Array.from(session.projectCollaboration.folders),
          collaborators: Object.fromEntries(session.projectCollaboration.collaborators),
          metadata: project.metadata
        }
      });

      // Broadcast to all other users in session
      socket.to(socket.sessionId).emit('project_state_sync', {
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          owner: project.owner,
          mode: mode,
          files: Array.from(session.projectCollaboration.files.entries()).map(([path, data]) => ({
            path,
            ...data
          })),
          folders: Array.from(session.projectCollaboration.folders),
          collaborators: Object.fromEntries(session.projectCollaboration.collaborators),
          metadata: project.metadata
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error(`Error starting project collaboration: ${error.message}`);
      socket.emit('project_collaboration_started', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('join_project_collaboration', async (data) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session || !session.projectCollaboration) {
        socket.emit('project_state_sync', {
          success: false,
          error: 'No active project collaboration found'
        });
        return;
      }

      const { userId, projectId } = data;
      
      console.log(`🔗 User ${socket.userName} joining project collaboration: ${projectId}`);

      // Add user as collaborator if not already added
      if (!session.projectCollaboration.collaborators.has(userId)) {
        session.projectCollaboration.collaborators.set(userId, {
          id: userId,
          role: 'editor',
          permissions: ['read', 'write'],
          joinedAt: new Date().toISOString()
        });

        // Notify other collaborators
        socket.to(socket.sessionId).emit('collaborator_joined_project', {
          userId: userId,
          userName: socket.userName,
          collaborator: {
            id: userId,
            role: 'editor',
            permissions: ['read', 'write'],
            joinedAt: new Date().toISOString()
          }
        });
      }

      // Send project state to joining user
      socket.emit('project_state_sync', {
        success: true,
        project: {
          id: session.projectCollaboration.id,
          name: session.projectCollaboration.name,
          description: session.projectCollaboration.description,
          type: session.projectCollaboration.type,
          owner: session.projectCollaboration.owner,
          mode: session.projectCollaboration.mode,
          files: Array.from(session.projectCollaboration.files.entries()).map(([path, data]) => ({
            path,
            ...data
          })),
          folders: Array.from(session.projectCollaboration.folders),
          collaborators: Object.fromEntries(session.projectCollaboration.collaborators),
          metadata: session.projectCollaboration.metadata
        }
      });

    } catch (error) {
      console.error(`Error joining project collaboration: ${error.message}`);
      socket.emit('project_state_sync', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('project_file_operation', async (operation) => {
    try {
      console.log('📥 Received project_file_operation:', JSON.stringify(operation, null, 2));
      
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session || !session.projectCollaboration) {
        console.log('❌ No active project collaboration found for session:', socket.sessionId);
        socket.emit('project_operation_error', {
          operationId: operation.id,
          error: 'No active project collaboration found'
        });
        return;
      }

      const project = session.projectCollaboration;
      const collaborator = project.collaborators.get(operation.userId);
      
      if (!collaborator) {
        console.log('❌ User not part of project collaboration:', operation.userId);
        socket.emit('project_operation_error', {
          operationId: operation.id,
          error: 'User not part of project collaboration'
        });
        return;
      }

      // Check permissions
      const canWrite = collaborator.permissions.includes('write') || collaborator.role === 'owner';
      const canDelete = collaborator.permissions.includes('delete') || collaborator.role === 'owner';

      switch (operation.type) {
        case 'file_create':
        case 'file_update':
          if (!canWrite) {
            socket.emit('project_operation_error', {
              operationId: operation.id,
              error: 'Insufficient permissions to modify files'
            });
            return;
          }

          project.files.set(operation.filePath, {
            id: operation.metadata?.id || `file_${Date.now()}`,
            name: operation.filePath.split('/').pop(),
            type: 'file',
            content: operation.content,
            metadata: {
              ...operation.metadata,
              lastModified: new Date().toISOString(),
              lastModifiedBy: operation.userId
            }
          });

          // Broadcast to all users
          console.log('📡 Broadcasting project_file_' + (operation.type === 'file_create' ? 'created' : 'updated') + ' to session:', socket.sessionId);
          io.to(socket.sessionId).emit('project_file_' + (operation.type === 'file_create' ? 'created' : 'updated'), {
            operationId: operation.id,
            filePath: operation.filePath,
            file: project.files.get(operation.filePath),
            userId: operation.userId,
            timestamp: operation.timestamp
          });
          break;

        case 'file_delete':
          if (!canDelete) {
            socket.emit('project_operation_error', {
              operationId: operation.id,
              error: 'Insufficient permissions to delete files'
            });
            return;
          }

          project.files.delete(operation.filePath);

          // Broadcast to all users
          console.log('📡 Broadcasting project_file_deleted to session:', socket.sessionId);
          io.to(socket.sessionId).emit('project_file_deleted', {
            operationId: operation.id,
            filePath: operation.filePath,
            userId: operation.userId,
            timestamp: operation.timestamp
          });
          break;

        case 'file_rename':
          if (!canWrite) {
            socket.emit('project_operation_error', {
              operationId: operation.id,
              error: 'Insufficient permissions to rename files'
            });
            return;
          }

          if (project.files.has(operation.oldPath)) {
            const fileData = project.files.get(operation.oldPath);
            project.files.delete(operation.oldPath);
            project.files.set(operation.newPath, {
              ...fileData,
              name: operation.newPath.split('/').pop(),
              metadata: {
                ...fileData.metadata,
                lastModified: new Date().toISOString(),
                lastModifiedBy: operation.userId
              }
            });

            // Broadcast to all users
            io.to(socket.sessionId).emit('project_file_renamed', {
              operationId: operation.id,
              oldPath: operation.oldPath,
              newPath: operation.newPath,
              userId: operation.userId,
              timestamp: operation.timestamp
            });
          }
          break;

        default:
          socket.emit('project_operation_error', {
            operationId: operation.id,
            error: 'Unknown file operation type'
          });
      }

    } catch (error) {
      console.error(`Error handling project file operation: ${error.message}`);
      socket.emit('project_operation_error', {
        operationId: operation.id,
        error: error.message
      });
    }
  });

  socket.on('project_folder_operation', async (operation) => {
    try {
      if (!socket.sessionId) {
        socket.emit('error', 'Not connected to any session');
        return;
      }

      const session = collaborationSessions.get(socket.sessionId);
      if (!session || !session.projectCollaboration) {
        socket.emit('project_operation_error', {
          operationId: operation.id,
          error: 'No active project collaboration found'
        });
        return;
      }

      const project = session.projectCollaboration;
      const collaborator = project.collaborators.get(operation.userId);
      
      if (!collaborator) {
        socket.emit('project_operation_error', {
          operationId: operation.id,
          error: 'User not part of project collaboration'
        });
        return;
      }

      // Check permissions
      const canWrite = collaborator.permissions.includes('write') || collaborator.role === 'owner';
      const canDelete = collaborator.permissions.includes('delete') || collaborator.role === 'owner';

      switch (operation.type) {
        case 'folder_create':
          if (!canWrite) {
            socket.emit('project_operation_error', {
              operationId: operation.id,
              error: 'Insufficient permissions to create folders'
            });
            return;
          }

          project.folders.add(operation.folderPath);

          // Broadcast to all users
          io.to(socket.sessionId).emit('project_folder_created', {
            operationId: operation.id,
            folderPath: operation.folderPath,
            userId: operation.userId,
            timestamp: operation.timestamp
          });
          break;

        case 'folder_delete':
          if (!canDelete) {
            socket.emit('project_operation_error', {
              operationId: operation.id,
              error: 'Insufficient permissions to delete folders'
            });
            return;
          }

          project.folders.delete(operation.folderPath);

          // Also delete all files in the folder
          for (const [filePath] of project.files) {
            if (filePath.startsWith(operation.folderPath + '/')) {
              project.files.delete(filePath);
            }
          }

          // Broadcast to all users
          io.to(socket.sessionId).emit('project_folder_deleted', {
            operationId: operation.id,
            folderPath: operation.folderPath,
            userId: operation.userId,
            timestamp: operation.timestamp
          });
          break;

        default:
          socket.emit('project_operation_error', {
            operationId: operation.id,
            error: 'Unknown folder operation type'
          });
      }

    } catch (error) {
      console.error(`Error handling project folder operation: ${error.message}`);
      socket.emit('project_operation_error', {
        operationId: operation.id,
        error: error.message
      });
    }
  });

  // Room-based collaboration event handlers
  if (roomManager && workspaceDB) {
    
    // Create a new collaboration room
    socket.on('create_collaboration_room', async (data) => {
      try {
        if (!socket.authenticated) {
          socket.emit('room_error', { error: 'Authentication required to create room' });
          return;
        }

        const { roomName, description, workspace } = data;
        
        console.log(`🏗️ Creating collaboration room: ${roomName} by ${socket.userName}`);
        
        // Create room using room manager
        const roomResult = await roomManager.createRoom(
          socket.userId,           // ownerId
          socket.userName,         // ownerName
          socket,                  // ownerSocket
          {                        // workspaceData
            roomName: roomName || 'Untitled Project',
            description: description || 'Collaboration workspace',
            workspace: workspace || { files: [], folders: [] }
          }
        );
        
        // Extract roomId from the result object
        const roomId = roomResult.roomId;
        
        // Store workspace in database
        const workspaceData = {
          roomId,
          ownerId: socket.userId,
          version: 1,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          files: workspace?.files || [],
          folders: workspace?.folders || [],
          metadata: {
            totalFiles: (workspace?.files || []).length,
            totalSize: (workspace?.files || []).reduce((sum, file) => sum + (file.content?.length || 0), 0),
            fileTypes: {}
          }
        };
        
        await workspaceDB.storeWorkspace(roomId, workspaceData);
        
        // Join the room socket channel
        socket.join(roomId);
        socket.collaborationRoomId = roomId;
        
        socket.emit('room_created', {
          roomId,
          roomName: roomName || 'Untitled Project',
          description: description || 'Collaboration workspace',
          ownerId: socket.userId,
          ownerName: socket.userName,
          createdAt: new Date().toISOString()
        });
        
        console.log(`✅ Room created successfully: ${roomId}`);
        
      } catch (error) {
        console.error(`❌ Failed to create room:`, error);
        socket.emit('room_error', { error: error.message });
      }
    });
    
    // Join an existing collaboration room
    socket.on('join_collaboration_room', async (data) => {
      try {
        if (!socket.authenticated) {
          socket.emit('room_error', { error: 'Authentication required to join room' });
          return;
        }

        const { roomId } = data;
        
        console.log(`🚪 User ${socket.userName} attempting to join room: ${roomId}`);
        
        // Join room using room manager
        const roomInfo = await roomManager.joinRoom(
          roomId,
          socket.userId,
          socket.userName,
          socket
        );
        
        // Load workspace from database
        const workspace = await workspaceDB.loadWorkspace(roomId);
        
        // Join the room socket channel
        socket.join(roomId);
        socket.collaborationRoomId = roomId;
        
        // Send workspace to the joining user
        socket.emit('room_joined', {
          roomId,
          roomInfo,
          workspace: {
            files: workspace.files,
            folders: workspace.folders,
            metadata: workspace.metadata,
            version: workspace.version,
            lastModified: workspace.lastModified
          }
        });
        
        // Notify other room participants
        socket.to(roomId).emit('user_joined_room', {
          roomId,
          user: {
            userId: socket.userId,
            userName: socket.userName,
            userEmail: socket.userEmail,
            joinedAt: new Date().toISOString()
          },
          participantCount: roomInfo.participants.length
        });
        
        console.log(`✅ User ${socket.userName} joined room: ${roomId}`);
        
      } catch (error) {
        console.error(`❌ Failed to join room:`, error);
        socket.emit('room_error', { error: error.message });
      }
    });
    
    // Leave collaboration room
    socket.on('leave_collaboration_room', async (data) => {
      try {
        const { roomId } = data;
        
        if (socket.collaborationRoomId && socket.collaborationRoomId === roomId) {
          await roomManager.leaveRoom(roomId, socket.userId);
          
          socket.leave(roomId);
          socket.collaborationRoomId = null;
          
          // Notify other participants
          socket.to(roomId).emit('user_left_room', {
            roomId,
            userId: socket.userId,
            userName: socket.userName,
            leftAt: new Date().toISOString()
          });
          
          socket.emit('room_left', { roomId });
          console.log(`👋 User ${socket.userName} left room: ${roomId}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to leave room:`, error);
        socket.emit('room_error', { error: error.message });
      }
    });
    
    // Room-based workspace updates
    socket.on('room_workspace_update', async (data) => {
      try {
        if (!socket.collaborationRoomId) {
          socket.emit('room_error', { error: 'Not connected to any collaboration room' });
          return;
        }

        const { updateType, filePath, fileName, content, folderPath } = data;
        
        // Update workspace in database
        const updateData = {
          updateType,
          filePath,
          fileName,
          content,
          folderPath,
          version: Date.now(), // Simple versioning
          lastModified: new Date().toISOString(),
          lastModifiedBy: socket.userId
        };
        
        await workspaceDB.updateWorkspace(socket.collaborationRoomId, updateData);
        
        // Broadcast update to all room participants
        socket.to(socket.collaborationRoomId).emit('room_workspace_updated', {
          roomId: socket.collaborationRoomId,
          update: updateData,
          updatedBy: {
            userId: socket.userId,
            userName: socket.userName
          }
        });
        
        console.log(`🔄 Room workspace updated: ${updateType} by ${socket.userName}`);
        
      } catch (error) {
        console.error(`❌ Failed to update room workspace:`, error);
        socket.emit('room_error', { error: error.message });
      }
    });
    
    // Get room info
    socket.on('get_room_info', async (data) => {
      try {
        const { roomId } = data;
        const roomInfo = await roomManager.getRoomInfo(roomId);
        const workspace = await workspaceDB.getWorkspaceMetadata(roomId);
        
        socket.emit('room_info', {
          roomId,
          ...roomInfo,
          workspace: workspace ? {
            version: workspace.version,
            lastModified: workspace.lastModified,
            metadata: workspace.metadata
          } : null
        });
        
      } catch (error) {
        console.error(`❌ Failed to get room info:`, error);
        socket.emit('room_error', { error: error.message });
      }
    });
    
    // Handle disconnect for room participants
    const originalDisconnectHandler = socket.listeners('disconnect')[0];
    socket.removeAllListeners('disconnect');
    
    socket.on('disconnect', async (reason) => {
      // Clean up room participation
      if (socket.collaborationRoomId) {
        try {
          await roomManager.leaveRoom(socket.collaborationRoomId, socket.userId);
          
          socket.to(socket.collaborationRoomId).emit('user_left_room', {
            roomId: socket.collaborationRoomId,
            userId: socket.userId,
            userName: socket.userName,
            leftAt: new Date().toISOString(),
            reason: 'disconnect'
          });
          
          console.log(`🔌 User ${socket.userName} disconnected from room: ${socket.collaborationRoomId}`);
        } catch (error) {
          console.error(`❌ Failed to clean up room on disconnect:`, error);
        }
      }
      
      // Call original disconnect handler
      if (originalDisconnectHandler) {
        originalDisconnectHandler.call(socket, reason);
      }
    });
    
  } else {
    console.log('⚠️ Room collaboration handlers not registered - services not available');
  }

  console.log(`✅ Socket event handlers registered for ${userName} (${clientId})`);
});

// Catch-all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

// Start the server on port 5000
const PORT = process.env.PORT || 5000;

function startServer(port) {
  const serverInstance = server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log(`🌐 Open your browser and navigate to http://localhost:${port}`);
    console.log(`📡 For network sharing, use your local IP address instead of localhost`);
    console.log(`ℹ️  Run network-info.bat to see your network details`);
    
    // Try to get and display local network IPs
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const networkIPs = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          networkIPs.push(iface.address);
        }
      }
    }
    
    if (networkIPs.length > 0) {
      console.log(`🌍 Network access URLs:`);
      networkIPs.forEach(ip => {
        console.log(`   http://${ip}:${port}`);
      });
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ Port ${port} is already in use. Trying port ${port + 1}...`);
      if (port < 6000) { // Try ports up to 6000 to find an available one  
        startServer(port + 1);
      } else {
        console.error('❌ Unable to find an available port. Please close other applications using ports 5000-6000.');
        process.exit(1);
      }
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
