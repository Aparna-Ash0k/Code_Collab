/**
 * Enhanced Socket.IO Server for Yjs-based Collaboration
 * 
 * Replaces the complex server-side file system with room-based collaboration
 * Features:
 * - Firebase Auth integration
 * - Yjs update forwarding
 * - Room management
 * - Workspace sharing via Firebase Storage
 * - Real-time awareness
 */

const express = require('express');
const http = requi  // Handle cursor updates
  socket.on('cursor_update', ({ filePath, cursorData }) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('cursor_update', {
        filePath,
        cursorData,
        userId: socket.user.uid,
        userName: socket.user.name
      });
    }
  });

  // Handle real-time code changes
  socket.on('code_change', (data) => {
    if (socket.currentRoom && data.roomId === socket.currentRoom) {
      console.log(`📝 Code change from ${socket.user.name} in file: ${data.filePath}`);
      
      // Broadcast to other participants in the room
      socket.to(socket.currentRoom).emit('code_changed', {
        filePath: data.filePath,
        content: data.content,
        changes: data.changes,
        version: data.version,
        timestamp: data.timestamp,
        userId: socket.user.uid,
        userName: socket.user.name
      });
    }
  });

  // Handle file content requests
  socket.on('request_file_content', async (data) => {
    if (socket.currentRoom && data.roomId === socket.currentRoom) {
      console.log(`📥 File content requested for: ${data.filePath} by ${socket.user.name}`);
      
      try {
        // For now, we'll broadcast the request to other room members
        // In a full implementation, this would query the database
        socket.to(socket.currentRoom).emit('file_content_requested', {
          filePath: data.filePath,
          requestedBy: socket.user.uid,
          requesterId: socket.id
        });
        
        // Send empty content as fallback
        socket.emit('file_content_response', {
          filePath: data.filePath,
          content: '',
          version: 0
        });
      } catch (error) {
        console.error('❌ Failed to handle file content request:', error);
        socket.emit('error', { message: 'Failed to get file content' });
      }
    }
  });
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  if (!admin.apps.length) {
    let credential;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Development mode
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'codecollab-demo',
        clientEmail: 'firebase-adminsdk@codecollab-demo.iam.gserviceaccount.com',
        privateKey: process.env.FIREBASE_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\n-----END PRIVATE KEY-----\n'
      });
    }

    admin.initializeApp({
      credential: credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'codecollab-demo',
      storageBucket: `${process.env.FIREBASE_PROJECT_ID || 'codecollab-demo'}.appspot.com`
    });
  }

  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK initialization failed:', error.message);
}

const db = admin.firestore();
const storage = admin.storage();

// Express app setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// In-memory room management
const rooms = new Map();
const userSockets = new Map();

class CollaborationRoom {
  constructor(roomId, projectId = null, creatorId = null) {
    this.id = roomId;
    this.projectId = projectId;
    this.creatorId = creatorId;
    this.participants = new Map();
    this.yjsUpdates = [];
    this.awareness = new Map();
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  addParticipant(userId, socketId, userData) {
    this.participants.set(userId, {
      userId,
      socketId,
      name: userData.name,
      email: userData.email,
      avatar: userData.picture,
      joinedAt: Date.now(),
      isActive: true
    });
    this.lastActivity = Date.now();
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
    this.awareness.delete(userId);
    this.lastActivity = Date.now();
  }

  updateAwareness(userId, awarenessData) {
    this.awareness.set(userId, {
      ...awarenessData,
      userId,
      timestamp: Date.now()
    });
    this.lastActivity = Date.now();
  }

  addYjsUpdate(update, userId) {
    this.yjsUpdates.push({
      update,
      userId,
      timestamp: Date.now()
    });
    
    // Keep only last 100 updates to prevent memory issues
    if (this.yjsUpdates.length > 100) {
      this.yjsUpdates = this.yjsUpdates.slice(-50);
    }
    
    this.lastActivity = Date.now();
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  isEmpty() {
    return this.participants.size === 0;
  }
}

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0],
      picture: decodedToken.picture,
      emailVerified: decodedToken.email_verified
    };

    console.log(`🔐 User authenticated: ${socket.user.email}`);
    next();
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    next(new Error('Authentication failed'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.user.email} (${socket.id})`);
  userSockets.set(socket.user.uid, socket.id);

  // Create or join room
  socket.on('create_room', async ({ projectId, initialWorkspace }) => {
    try {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const room = new CollaborationRoom(roomId, projectId, socket.user.uid);
      rooms.set(roomId, room);

      room.addParticipant(socket.user.uid, socket.id, socket.user);
      socket.join(roomId);
      socket.currentRoom = roomId;

      console.log(`🏠 Room created: ${roomId} by ${socket.user.email}`);
      
      socket.emit('room_created', {
        roomId,
        projectId,
        creator: socket.user,
        participants: room.getParticipants()
      });

      // Log activity
      if (db) {
        await logActivity({
          type: 'collaboration',
          action: 'room_created',
          userId: socket.user.uid,
          userName: socket.user.name,
          projectId,
          details: { roomId }
        });
      }

    } catch (error) {
      console.error('❌ Failed to create room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  socket.on('join_room', async ({ roomId }) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Check if user has permission to join
      if (room.projectId) {
        const hasPermission = await checkProjectPermission(socket.user.uid, room.projectId);
        if (!hasPermission) {
          throw new Error('Permission denied');
        }
      }

      room.addParticipant(socket.user.uid, socket.id, socket.user);
      socket.join(roomId);
      socket.currentRoom = roomId;

      console.log(`🚪 User joined room: ${socket.user.email} → ${roomId}`);

      // Send room state to the joining user
      socket.emit('room_state', {
        roomId,
        projectId: room.projectId,
        participants: room.getParticipants(),
        yjsUpdates: room.yjsUpdates.slice(-10), // Last 10 updates
        awareness: Array.from(room.awareness.values())
      });

      // Request workspace files from existing participants
      setTimeout(() => {
        socket.to(roomId).emit('new_user_needs_workspace', {
          newUser: socket.user,
          roomId: roomId
        });
      }, 1000); // Small delay to ensure the user is fully connected

      // Notify other participants
      socket.to(roomId).emit('user_joined', {
        user: socket.user,
        participants: room.getParticipants()
      });

      // Log activity
      if (db) {
        await logActivity({
          type: 'collaboration',
          action: 'user_joined',
          userId: socket.user.uid,
          userName: socket.user.name,
          projectId: room.projectId,
          details: { roomId }
        });
      }

    } catch (error) {
      console.error('❌ Failed to join room:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('leave_room', async () => {
    if (socket.currentRoom) {
      await handleRoomLeave(socket);
    }
  });

  // Yjs update handling
  socket.on('yjs_update', ({ roomId, update }) => {
    try {
      const room = rooms.get(roomId);
      if (!room || !room.participants.has(socket.user.uid)) {
        return;
      }

      room.addYjsUpdate(update, socket.user.uid);
      
      // Broadcast to other participants
      socket.to(roomId).emit('yjs_update', {
        update,
        userId: socket.user.uid
      });

    } catch (error) {
      console.error('❌ Failed to handle Yjs update:', error);
    }
  });

  // Awareness (cursors, selections) handling
  socket.on('awareness_update', ({ roomId, awareness }) => {
    try {
      const room = rooms.get(roomId);
      if (!room || !room.participants.has(socket.user.uid)) {
        return;
      }

      room.updateAwareness(socket.user.uid, awareness);
      
      // Broadcast to other participants
      socket.to(roomId).emit('awareness_update', {
        userId: socket.user.uid,
        awareness
      });

    } catch (error) {
      console.error('❌ Failed to handle awareness update:', error);
    }
  });

  // Workspace sharing
  socket.on('workspace_push', async ({ storagePath, projectMeta }) => {
    try {
      if (!socket.currentRoom) {
        throw new Error('No active room');
      }

      const room = rooms.get(socket.currentRoom);
      if (!room || room.creatorId !== socket.user.uid) {
        throw new Error('Only room creator can push workspace');
      }

      console.log(`📤 Workspace pushed by ${socket.user.email} to room ${socket.currentRoom}`);
      
      // Broadcast to all participants
      io.to(socket.currentRoom).emit('workspace_push', {
        storagePath,
        projectMeta,
        pushedBy: socket.user
      });

      // Log activity
      if (db) {
        await logActivity({
          type: 'collaboration',
          action: 'workspace_pushed',
          userId: socket.user.uid,
          userName: socket.user.name,
          projectId: room.projectId,
          details: { 
            roomId: socket.currentRoom,
            storagePath,
            participantCount: room.participants.size
          }
        });
      }

    } catch (error) {
      console.error('❌ Failed to push workspace:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // File operations
  socket.on('file_create', ({ fileMeta }) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('file_changed', {
        action: 'created',
        fileMeta,
        userId: socket.user.uid
      });
    }
  });

  socket.on('file_update', ({ fileMeta }) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('file_changed', {
        action: 'updated',
        fileMeta,
        userId: socket.user.uid
      });
    }
  });

  socket.on('file_delete', ({ fileMeta }) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('file_changed', {
        action: 'deleted',
        fileMeta,
        userId: socket.user.uid
      });
    }
  });

  // Cursor updates
  socket.on('cursor_update', ({ filePath, cursorData }) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('cursor_update', {
        filePath,
        cursorData,
        userId: socket.user.uid,
        userName: socket.user.name
      });
    }
  });

  // Request workspace from creator
  socket.on('request_workspace', () => {
    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room && room.creatorId) {
        const creatorSocketId = userSockets.get(room.creatorId);
        if (creatorSocketId) {
          io.to(creatorSocketId).emit('workspace_requested', {
            requestedBy: socket.user,
            roomId: socket.currentRoom
          });
        }
      }
    }
  });

  // Handle workspace sharing from room members
  socket.on('share_workspace_files', (data) => {
    if (socket.currentRoom && data.roomId === socket.currentRoom) {
      console.log(`📤 User ${socket.user.name} sharing ${data.files?.length || 0} files with room`);
      
      // Broadcast workspace files to all other participants
      socket.to(socket.currentRoom).emit('workspace_files_shared', {
        files: data.files || [],
        folders: data.folders || [],
        sharedBy: socket.user,
        timestamp: Date.now()
      });
    }
  });

  // Handle individual file sharing for new joiners
  socket.on('share_file_with_user', (data) => {
    if (socket.currentRoom && data.targetUserId) {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('file_shared_by_user', {
          filePath: data.filePath,
          content: data.content,
          sharedBy: socket.user,
          timestamp: Date.now()
        });
        
        console.log(`📤 File ${data.filePath} shared by ${socket.user.name} with user ${data.targetUserId}`);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`🔌 User disconnected: ${socket.user.email}`);
    userSockets.delete(socket.user.uid);
    
    if (socket.currentRoom) {
      await handleRoomLeave(socket);
    }
  });
});

// Helper functions
async function handleRoomLeave(socket) {
  const roomId = socket.currentRoom;
  const room = rooms.get(roomId);
  
  if (room) {
    room.removeParticipant(socket.user.uid);
    socket.leave(roomId);
    
    // Notify other participants
    socket.to(roomId).emit('user_left', {
      user: socket.user,
      participants: room.getParticipants()
    });

    console.log(`🚪 User left room: ${socket.user.email} ← ${roomId}`);
    
    // Clean up empty rooms
    if (room.isEmpty()) {
      rooms.delete(roomId);
      console.log(`🧹 Empty room cleaned up: ${roomId}`);
    }

    // Log activity
    if (db) {
      await logActivity({
        type: 'collaboration',
        action: 'user_left',
        userId: socket.user.uid,
        userName: socket.user.name,
        projectId: room.projectId,
        details: { roomId }
      });
    }
  }
  
  socket.currentRoom = null;
}

async function checkProjectPermission(userId, projectId) {
  if (!db || !projectId) return true; // Allow if no Firebase or no project

  try {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return false;

    const projectData = projectDoc.data();
    return projectData.ownerUid === userId || 
           projectData.collaborators?.[userId] ||
           projectData.visibility === 'public';
  } catch (error) {
    console.error('Failed to check project permission:', error);
    return false;
  }
}

async function logActivity(activityData) {
  try {
    await db.collection('activities').add({
      ...activityData,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// REST API endpoints for compatibility
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    rooms: rooms.size,
    connections: userSockets.size,
    uptime: process.uptime()
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    projectId: room.projectId,
    participantCount: room.participants.size,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity
  }));
  
  res.json({ rooms: roomList });
});

// Cleanup inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > inactiveThreshold && room.isEmpty()) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up inactive room: ${roomId}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Collaboration server running on port ${PORT}`);
  console.log(`📡 Socket.IO enabled with CORS for ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});

module.exports = { app, server, io };
