import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';
import { getServerUrl } from '../utils/serverConfig';

// Session action types
const SESSION_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_SOCKET: 'SET_SOCKET',
  SET_SESSION: 'SET_SESSION',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_USERS: 'SET_USERS',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_CONNECTED: 'SET_CONNECTED',
  RESET_SESSION: 'RESET_SESSION'
};

// Initial session state
const initialState = {
  socket: null,
  session: null,
  isConnected: false,
  isLoading: false,
  error: null,
  users: [],
  messages: []
};

// Session reducer
function sessionReducer(state, action) {
  switch (action.type) {
    case SESSION_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload, error: null };
      
    case SESSION_ACTIONS.SET_SOCKET:
      return { ...state, socket: action.payload };
      
    case SESSION_ACTIONS.SET_SESSION:
      return { 
        ...state, 
        session: action.payload,
        isConnected: !!action.payload,
        isLoading: false,
        error: null
      };
      
    case SESSION_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
      
    case SESSION_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
      
    case SESSION_ACTIONS.SET_USERS:
      return { ...state, users: action.payload };
      
    case SESSION_ACTIONS.ADD_MESSAGE:
      return { 
        ...state, 
        messages: [...state.messages, action.payload]
      };
      
    case SESSION_ACTIONS.SET_CONNECTED:
      return { ...state, isConnected: action.payload };
      
    case SESSION_ACTIONS.RESET_SESSION:
      return {
        ...initialState,
        socket: state.socket // Keep socket connection
      };
      
    default:
      return state;
  }
}

// Session context
const SessionContext = createContext();

// Helper function to dynamically determine server URL
// Now using the shared utility function from serverConfig.js

// Session provider component
export const SessionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const { token, isAuthenticated, user } = useAuth();

  // Enhanced socket connection initialization with reconnection and state restoration
  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log('🌐 SessionContext: Connecting to server at:', serverUrl);
    
    const socket = io(serverUrl, {
      auth: {
        token: token || null
      },
      autoConnect: false,
      transports: ['polling', 'websocket'],
      upgrade: true,
      forceNew: true
    });

    // Socket event listeners
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      dispatch({ type: SESSION_ACTIONS.SET_CONNECTED, payload: true });
      
      // Auto-restore session if we were previously in one
      restoreSessionState();
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      dispatch({ type: SESSION_ACTIONS.SET_CONNECTED, payload: false });
    });

    // Enhanced session restoration function
    const restoreSessionState = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        // Check if we have a previous session to restore
        const lastSessionKey = localStorage.getItem(`codecollab_last_session_${user.id}`);
        if (lastSessionKey && socket.connected) {
          console.log('🔄 Attempting to restore previous session:', lastSessionKey);
          
          // Wait a moment for socket to be fully ready
          setTimeout(async () => {
            try {
              const joinResult = await joinSession(lastSessionKey);
              if (joinResult.success) {
                console.log('✅ Successfully restored previous session');
              } else {
                console.log('⚠️ Could not restore previous session:', joinResult.message);
                // Clear invalid session key
                localStorage.removeItem(`codecollab_last_session_${user.id}`);
              }
            } catch (error) {
              console.warn('⚠️ Session restoration failed:', error);
              localStorage.removeItem(`codecollab_last_session_${user.id}`);
            }
          }, 1000);
        }
      } catch (error) {
        console.warn('Session restoration error:', error);
      }
    };

    socket.on('session_joined', (data) => {
      console.log('🔐 SessionContext: Received session_joined event:', data);
      console.log('✅ Joined session:', data.session.name);
      dispatch({ type: SESSION_ACTIONS.SET_SESSION, payload: data.session });
      
      // Save session key for restoration on reconnection
      if (isAuthenticated && user && data.session.inviteKey) {
        localStorage.setItem(`codecollab_last_session_${user.id}`, data.session.inviteKey);
      }
      
      // Store user permissions globally for CollaborationContext
      if (data.session && data.session.userPermissions) {
        console.log('🔄 SessionContext: Storing user permissions globally for CollaborationContext');
        window.lastSessionPermissions = {
          userId: user?.id || user?.uid,
          permissions: data.session.userPermissions,
          timestamp: Date.now()
        };
        
        // Emit a custom event for CollaborationContext
        const event = new CustomEvent('userPermissionsReady', { 
          detail: {
            userId: user?.id || user?.uid,
            permissions: data.session.userPermissions
          }
        });
        window.dispatchEvent(event);
      }
      
      // Auto-request session info and users after joining to get complete session data including inviteKey
      setTimeout(() => {
        if (socket && socket.connected) {
          console.log('📊 Requesting session info and users...');
          socket.emit('get_session_info');
          socket.emit('get_session_users');
        }
      }, 1000);
    });

    socket.on('session_left', (data) => {
      console.log('👋 Left session');
      dispatch({ type: SESSION_ACTIONS.RESET_SESSION });
      
      // Clear saved session key
      if (isAuthenticated && user) {
        localStorage.removeItem(`codecollab_last_session_${user.id}`);
      }
    });

    socket.on('session_error', (error) => {
      console.error('❌ Session error:', error.message);
      dispatch({ type: SESSION_ACTIONS.SET_ERROR, payload: error.message });
      
      // Clear invalid session key on error
      if (isAuthenticated && user) {
        localStorage.removeItem(`codecollab_last_session_${user.id}`);
      }
    });

    socket.on('session_deleted', (data) => {
      console.log('🗑️ Session deleted:', data.message);
      dispatch({ type: SESSION_ACTIONS.RESET_SESSION });
      dispatch({ type: SESSION_ACTIONS.SET_ERROR, payload: data.message });
      
      // Clear deleted session key
      if (isAuthenticated && user) {
        localStorage.removeItem(`codecollab_last_session_${user.id}`);
      }
    });

    socket.on('user_joined_session', (userData) => {
      console.log('👤 User joined session:', userData.userName);
      // Update session data if it's for the current session
      if (state.session && userData.sessionId === state.session.id) {
        dispatch({ 
          type: SESSION_ACTIONS.SET_SESSION, 
          payload: {
            ...state.session,
            userCount: userData.userCount
          }
        });
        // Also refresh users list
        getSessionUsers();
      }
    });

    socket.on('user_left_session', (userData) => {
      console.log('👋 User left session:', userData.userName);
      // Update session data if it's for the current session
      if (state.session && userData.sessionId === state.session.id) {
        dispatch({ 
          type: SESSION_ACTIONS.SET_SESSION, 
          payload: {
            ...state.session,
            userCount: userData.userCount
          }
        });
        // Also refresh users list
        getSessionUsers();
      }
    });

    socket.on('session_update', (data) => {
      console.log('📊 Session update received:', data);
      // Update session data if it's for the current session
      if (state.session && data.sessionId === state.session.id) {
        dispatch({ 
          type: SESSION_ACTIONS.SET_SESSION, 
          payload: {
            ...state.session,
            userCount: data.userCount
          }
        });
      }
    });

    socket.on('session_info', (sessionInfo) => {
      console.log('ℹ️ Session info received:', sessionInfo);
      // Update session data
      if (state.session && sessionInfo.id === state.session.id) {
        dispatch({ 
          type: SESSION_ACTIONS.SET_SESSION, 
          payload: {
            ...state.session,
            userCount: sessionInfo.userCount,
            name: sessionInfo.name,
            inviteKey: sessionInfo.inviteKey,  // Include invite key from server
            settings: sessionInfo.settings,
            creatorId: sessionInfo.creatorId || state.session.creatorId  // Include creatorId from server or preserve existing
          }
        });
        
        // Also emit for CollaborationContext if sessionInfo has userPermissions
        if (sessionInfo.userPermissions) {
          console.log('🔄 SessionContext: Emitting session_permissions event for CollaborationContext');
          // We need to simulate the session_joined structure for CollaborationContext
          const sessionJoinedData = {
            session: {
              ...state.session,
              userPermissions: sessionInfo.userPermissions
            }
          };
          // Store in a global variable that CollaborationContext can access
          window.sessionPermissionsData = sessionJoinedData;
          // Also emit a custom event
          const event = new CustomEvent('sessionPermissionsReady', { detail: sessionJoinedData });
          window.dispatchEvent(event);
        }
      } else if (!state.session && sessionInfo.id) {
        // Create session object if we don't have one but server says we're in a session
        console.log('🔄 Creating session object from server info');
        dispatch({ 
          type: SESSION_ACTIONS.SET_SESSION, 
          payload: {
            id: sessionInfo.id,
            name: sessionInfo.name,
            inviteKey: sessionInfo.inviteKey,  // Include invite key from server
            userCount: sessionInfo.userCount,
            settings: sessionInfo.settings,
            createdAt: sessionInfo.createdAt || Date.now(),
            creatorId: sessionInfo.creatorId  // Include creatorId from server
          }
        });
      }
    });

    socket.on('session_users', (data) => {
      dispatch({ type: SESSION_ACTIONS.SET_USERS, payload: data.users });
      // Also update session user count
      if (state.session && data.sessionId === state.session.id) {
        dispatch({ 
          type: SESSION_ACTIONS.SET_SESSION, 
          payload: {
            ...state.session,
            userCount: data.userCount
          }
        });
      }
    });

    socket.on('chat_message', (message) => {
      console.log('💬 Received chat message:', message);
      dispatch({ type: SESSION_ACTIONS.ADD_MESSAGE, payload: message });
    });

    // VFS (Virtual File System) events for session-scoped file synchronization
    socket.on('virtual_fs_state', (files) => {
      console.log('📁 Received VFS state:', files);
      // Notify FileSystemContext about the session files
      window.dispatchEvent(new CustomEvent('vfs_state_update', { 
        detail: { files, sessionId: state.session?.id } 
      }));
    });

    socket.on('virtual_fs_update', (operation) => {
      console.log('📁 Received VFS update:', operation);
      // Notify FileSystemContext about file changes
      window.dispatchEvent(new CustomEvent('vfs_operation_sync', { 
        detail: { operation, sessionId: state.session?.id } 
      }));
    });

    socket.on('permissions_updated', (data) => {
      if (data.userId === user?.id) {
        console.log('🔐 Your permissions were updated by', data.updatedBy);
        // Update session permissions
        if (state.session) {
          dispatch({ 
            type: SESSION_ACTIONS.SET_SESSION, 
            payload: {
              ...state.session,
              userPermissions: data.permissions
            }
          });
        }
      }
    });

    socket.on('connection_error', (error) => {
      console.error('❌ Connection error:', error);
      dispatch({ type: SESSION_ACTIONS.SET_ERROR, payload: error });
    });

    dispatch({ type: SESSION_ACTIONS.SET_SOCKET, payload: socket });

    // Connect socket
    socket.connect();

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [token]); // Removed state.session and user?.id from dependency array to prevent reconnections

  // Create a new session
  const createSession = useCallback(async (sessionName, settings = {}) => {
    if (!isAuthenticated) {
      dispatch({ type: SESSION_ACTIONS.SET_ERROR, payload: 'Authentication required to create sessions' });
      return { success: false, message: 'Authentication required' };
    }

    dispatch({ type: SESSION_ACTIONS.SET_LOADING, payload: true });
    
    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionName,
          settings
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Session created:', data.session.name);
        
        // Auto-join the created session with better error handling and retry logic
        console.log('🔄 Auto-joining created session...');
        
        // Wait a moment for socket to be ready and retry if needed
        let joinResult = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!joinResult?.success && attempts < maxAttempts) {
          attempts++;
          
          if (attempts > 1) {
            console.log(`🔄 Retry attempt ${attempts}/${maxAttempts} for auto-join...`);
            // Wait a bit longer between retries
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
          
          // Check socket state before attempting join
          if (state.socket) {
            console.log(`🔌 Socket state: connected=${state.socket.connected}, id=${state.socket.id}`);
            
            // Ensure socket is connected
            if (!state.socket.connected) {
              console.log('🔄 Socket not connected, attempting to connect...');
              state.socket.connect();
              // Wait for connection
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          joinResult = await joinSession(data.session.inviteKey);
          
          if (!joinResult.success) {
            console.warn(`⚠️ Auto-join attempt ${attempts} failed:`, joinResult.message);
          }
        }
        
        if (!joinResult?.success) {
          console.warn('⚠️ Failed to auto-join created session after all attempts:', joinResult?.message);
        } else {
          console.log('✅ Successfully auto-joined created session');
        }
        
        dispatch({ type: SESSION_ACTIONS.SET_LOADING, payload: false });
        return { 
          success: true, 
          session: data.session,
          inviteKey: data.session.inviteKey,
          autoJoined: joinResult?.success || false
        };
      } else {
        throw new Error(data.message || 'Failed to create session');
      }
    } catch (error) {
      console.error('❌ Error creating session:', error);
      dispatch({ type: SESSION_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, message: error.message };
    }
  }, [isAuthenticated, token, state.socket]);

  // Join a session with invite key
  const joinSession = useCallback(async (inviteKey) => {
    dispatch({ type: SESSION_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: SESSION_ACTIONS.CLEAR_ERROR });

    try {
      // First, validate the invite key with the server
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/sessions/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ inviteKey })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Session join validated, connecting via socket...');
        
        // Now connect to the session via socket
        if (state.socket) {
          console.log(`🔌 Socket state check: connected=${state.socket.connected}, id=${state.socket.id || 'no-id'}`);
          
          // Ensure socket is connected before emitting
          if (!state.socket.connected) {
            console.log('🔄 Socket not connected, attempting to connect...');
            state.socket.connect();
            
            // Wait for connection with timeout
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Socket connection timeout'));
              }, 5000);
              
              const onConnect = () => {
                clearTimeout(timeout);
                state.socket.off('connect', onConnect);
                state.socket.off('connect_error', onError);
                console.log('✅ Socket connected successfully');
                resolve();
              };
              
              const onError = (error) => {
                clearTimeout(timeout);
                state.socket.off('connect', onConnect);
                state.socket.off('connect_error', onError);
                reject(error);
              };
              
              if (state.socket.connected) {
                clearTimeout(timeout);
                resolve();
              } else {
                state.socket.on('connect', onConnect);
                state.socket.on('connect_error', onError);
              }
            });
          }
          
          console.log('🔌 Emitting join_session event...');
          state.socket.emit('join_session', { inviteKey });
          
          // Wait for session_joined event or timeout
          const joinPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              cleanup();
              reject(new Error('Session join timeout - no response from server'));
            }, 15000); // Increased timeout to 15 seconds

            const cleanup = () => {
              clearTimeout(timeout);
              state.socket.off('session_joined', handleSessionJoined);
              state.socket.off('session_error', handleSessionError);
            };

            const handleSessionJoined = (sessionData) => {
              console.log('✅ Received session_joined event:', sessionData);
              cleanup();
              resolve(sessionData);
            };

            const handleSessionError = (error) => {
              console.log('❌ Received session_error event:', error);
              cleanup();
              reject(new Error(error.message || 'Failed to join session via socket'));
            };

            state.socket.on('session_joined', handleSessionJoined);
            state.socket.on('session_error', handleSessionError);
          });

          await joinPromise;
          console.log('✅ Successfully joined session via socket');
        } else {
          throw new Error('Socket not available');
        }
        
        return { success: true, session: data.session };
      } else {
        throw new Error(data.message || 'Failed to join session');
      }
    } catch (error) {
      console.error('❌ Error joining session:', error);
      dispatch({ type: SESSION_ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, message: error.message };
    }
  }, [token, state.socket]);

  // Leave current session
  const leaveSession = useCallback(() => {
    if (state.socket && state.session) {
      state.socket.emit('leave_session');
      
      // Clear stored session key
      if (isAuthenticated && user) {
        localStorage.removeItem(`codecollab_last_session_${user.id}`);
      }
    }
  }, [state.socket, state.session, isAuthenticated, user]);

  // Get user sessions
  const getUserSessions = useCallback(async () => {
    if (!isAuthenticated) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, sessions: data.sessions };
      } else {
        throw new Error(data.message || 'Failed to get sessions');
      }
    } catch (error) {
      console.error('❌ Error getting user sessions:', error);
      return { success: false, message: error.message };
    }
  }, [isAuthenticated, token]);

  // Regenerate invite key
  const regenerateInviteKey = useCallback(async (sessionId) => {
    if (!isAuthenticated) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/regenerate-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, inviteKey: data.inviteKey };
      } else {
        throw new Error(data.message || 'Failed to regenerate invite key');
      }
    } catch (error) {
      console.error('❌ Error regenerating invite key:', error);
      return { success: false, message: error.message };
    }
  }, [isAuthenticated, token]);

  // Delete session
  const deleteSession = useCallback(async (sessionId) => {
    if (!isAuthenticated) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        return { success: true };
      } else {
        throw new Error(data.message || 'Failed to delete session');
      }
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      return { success: false, message: error.message };
    }
  }, [isAuthenticated, token]);

  // Send chat message
  const sendMessage = useCallback((content, type = 'text') => {
    if (state.socket && state.session) {
      state.socket.emit('chat_message', { content, type });
    }
  }, [state.socket, state.session]);

  // Get session users
  const getSessionUsers = useCallback(() => {
    if (state.socket && state.session) {
      state.socket.emit('get_session_users');
    }
  }, [state.socket, state.session]);

  // Get session info
  const getSessionInfo = useCallback(() => {
    if (state.socket && state.session) {
      state.socket.emit('get_session_info');
    }
  }, [state.socket, state.session]);

  // Auto-refresh session info every 30 seconds when connected to a session
  useEffect(() => {
    if (state.session && state.socket && state.isConnected) {
      const interval = setInterval(() => {
        getSessionInfo();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [state.session, state.socket, state.isConnected, getSessionInfo]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: SESSION_ACTIONS.CLEAR_ERROR });
  }, []);

  // Manual session restoration function
  const restoreLastSession = useCallback(async () => {
    if (!isAuthenticated || !user || !state.socket) {
      return { success: false, message: 'Not authenticated or socket not available' };
    }

    try {
      const lastSessionKey = localStorage.getItem(`codecollab_last_session_${user.id}`);
      if (!lastSessionKey) {
        return { success: false, message: 'No previous session found' };
      }

      console.log('🔄 Manually restoring session:', lastSessionKey);
      const result = await joinSession(lastSessionKey);
      
      if (!result.success) {
        // Clear invalid session key
        localStorage.removeItem(`codecollab_last_session_${user.id}`);
      }
      
      return result;
    } catch (error) {
      console.error('Manual session restoration failed:', error);
      localStorage.removeItem(`codecollab_last_session_${user.id}`);
      return { success: false, message: error.message };
    }
  }, [isAuthenticated, user, state.socket, joinSession]);

  // Check if user has a previous session
  const hasLastSession = useCallback(() => {
    if (!isAuthenticated || !user) return false;
    return !!localStorage.getItem(`codecollab_last_session_${user.id}`);
  }, [isAuthenticated, user]);

  const value = {
    // State
    socket: state.socket,
    session: state.session,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    users: state.users,
    messages: state.messages,
    
    // Actions
    createSession,
    joinSession,
    leaveSession,
    getUserSessions,
    regenerateInviteKey,
    deleteSession,
    sendMessage,
    getSessionUsers,
    getSessionInfo,
    clearError,
    
    // Enhanced session restoration
    restoreLastSession,
    hasLastSession
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

// Hook to use session context
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

// Export both named and default exports for compatibility
export { SessionContext };
export default SessionContext;
