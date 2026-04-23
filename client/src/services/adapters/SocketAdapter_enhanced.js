/**
 * Socket Adapter for FileSystemManager
 * 
 * Handles real-time Socket.IO operations in the adapter pattern.
 * Broadcasts file operations to other users in the session.
 */

import { EventEmitter } from 'events';

export class SocketAdapter extends EventEmitter {
  constructor(socket, session) {
    super();
    this.socket = socket;
    this.session = session;
    this.isInitialized = false;
    this.echoPreventionMap = new Map();
  }

  async initialize() {
    try {
      if (!this.socket || !this.session) {
        throw new Error('Socket or session not available');
      }

      // Set up socket listeners for incoming operations
      this.setupSocketListeners();
      
      this.isInitialized = true;
      console.log('📡 Socket adapter initialized');
    } catch (error) {
      console.error('Failed to initialize Socket adapter:', error);
      throw error;
    }
  }

  setupSocketListeners() {
    // Listen for file operations from other users
    this.socket.on('file-operation-broadcast', (operation) => {
      console.log('📡 Received file operation broadcast:', operation);
      
      // Prevent echo - don't process operations from ourselves
      if (operation.userId === this.socket.userId) {
        console.log('🔄 Ignoring echo from own operation');
        return;
      }
      
      // Emit operation to FileSystemManager for processing
      this.emit('remote-operation', operation);
    });

    // Legacy event handlers for backward compatibility
    this.socket.on('file_operation', (data) => {
      this.handleIncomingSocketOperation(data);
    });

    this.socket.on('virtual_fs_update', (data) => {
      this.handleIncomingVFSUpdate(data);
    });

    this.socket.on('file_created', (data) => {
      this.handleIncomingFileCreated(data);
    });

    this.socket.on('folder_created', (data) => {
      this.handleIncomingFolderCreated(data);
    });

    this.socket.on('realtime_code_change', (data) => {
      this.handleIncomingCodeChange(data);
    });

    this.socket.on('file_deleted', (data) => {
      this.handleIncomingFileDeleted(data);
    });

    this.socket.on('file_renamed', (data) => {
      this.handleIncomingFileRenamed(data);
    });
  }

  async handleIncomingSocketOperation(data) {
    try {
      // Convert socket data to standard operation format
      const operation = {
        type: data.action,
        path: data.path,
        content: data.data?.content,
        payload: data.data,
        metadata: {
          userId: data.userId,
          userName: data.userName,
          timestamp: data.timestamp,
          origin: 'socket'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming socket operation:', error);
    }
  }

  async handleIncomingVFSUpdate(data) {
    try {
      const operation = {
        type: 'vfs-update',
        path: data.filePath,
        content: data.content,
        metadata: {
          userId: data.userId,
          timestamp: data.timestamp,
          origin: 'socket-vfs'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming VFS update:', error);
    }
  }

  async handleIncomingFileCreated(data) {
    try {
      const operation = {
        type: 'create',
        path: data.relativePath || data.name,
        content: data.content || '',
        metadata: {
          userId: data.userId,
          timestamp: Date.now(),
          origin: 'socket-legacy'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming file created:', error);
    }
  }

  async handleIncomingFolderCreated(data) {
    try {
      const operation = {
        type: 'create_folder',
        path: data.relativePath || data.name,
        metadata: {
          userId: data.userId,
          timestamp: Date.now(),
          origin: 'socket-legacy'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming folder created:', error);
    }
  }

  async handleIncomingCodeChange(data) {
    try {
      const operation = {
        type: 'update',
        path: data.filePath,
        content: data.content,
        metadata: {
          userId: data.userId,
          timestamp: data.timestamp,
          origin: 'socket-realtime'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming code change:', error);
    }
  }

  async handleIncomingFileDeleted(data) {
    try {
      const operation = {
        type: 'delete',
        path: data.relativePath || data.path,
        metadata: {
          userId: data.userId,
          timestamp: Date.now(),
          origin: 'socket-legacy'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming file deleted:', error);
    }
  }

  async handleIncomingFileRenamed(data) {
    try {
      const operation = {
        type: 'rename',
        path: data.oldPath,
        newPath: data.newPath,
        metadata: {
          userId: data.userId,
          timestamp: Date.now(),
          origin: 'socket-legacy'
        }
      };

      this.emit('remote-operation', operation);
    } catch (error) {
      console.error('Error handling incoming file renamed:', error);
    }
  }

  async handleOperation(operation) {
    if (!this.isInitialized) {
      console.warn('Socket adapter not initialized, skipping operation');
      return;
    }

    try {
      const { type, path, payload, metadata } = operation;
      
      console.log(`📡 Socket broadcasting: ${type} ${path}`);

      // Create standardized operation format for FileSystemManager
      const fsOperation = {
        type,
        path,
        content: payload?.content || payload,
        metadata: {
          userId: this.socket.userId || 'anonymous',
          userName: this.socket.userName || 'Anonymous',
          sessionId: this.session?.id,
          timestamp: Date.now(),
          ...metadata
        }
      };

      // Broadcast using new FileSystemManager format
      this.socket.emit('fs-operation', fsOperation);
      
      console.log(`📡 FileSystemManager operation broadcasted: ${type} ${path}`);

      // Legacy support - emit specific events for backward compatibility
      switch (type) {
        case 'create':
          this.socket.emit('create_file', {
            name: payload?.name || path.split('/').pop(),
            content: payload?.content || payload || '',
            sessionId: this.session?.id,
            userId: this.socket.userId,
            relativePath: path
          });
          break;
          
        case 'create_folder':
          this.socket.emit('create_folder', {
            name: payload?.name || path.split('/').pop(),
            sessionId: this.session?.id,
            userId: this.socket.userId,
            relativePath: path
          });
          break;
          
        case 'update':
          this.socket.emit('realtime_code_change', {
            filePath: path,
            content: payload?.content || payload,
            sessionId: this.session?.id,
            userId: this.socket.userId,
            timestamp: operation.timestamp
          });
          break;
          
        case 'delete':
          this.socket.emit('delete_file', {
            path: path,
            sessionId: this.session?.id,
            userId: this.socket.userId,
            timestamp: operation.timestamp
          });
          break;
          
        case 'rename':
          this.socket.emit('rename_file', {
            oldPath: path,
            newPath: payload?.newPath,
            sessionId: this.session?.id,
            userId: this.socket.userId,
            timestamp: operation.timestamp
          });
          break;
          
        default:
          console.warn(`Unknown operation type: ${type}`);
      }
      
    } catch (error) {
      console.error('Socket adapter operation failed:', error);
      this.emit('error', error);
    }
  }

  convertOperationTypeToSocketAction(type) {
    const mapping = {
      'create': 'create',
      'create_folder': 'create_folder',
      'update': 'update',
      'delete': 'delete',
      'rename': 'rename'
    };
    
    return mapping[type] || type;
  }

  async cleanup() {
    if (this.socket) {
      this.socket.off('file-operation-broadcast');
      this.socket.off('file_operation');
      this.socket.off('virtual_fs_update');
      this.socket.off('file_created');
      this.socket.off('folder_created');
      this.socket.off('realtime_code_change');
      this.socket.off('file_deleted');
      this.socket.off('file_renamed');
    }
    
    this.isInitialized = false;
    console.log('📡 Socket adapter cleaned up');
  }
}
