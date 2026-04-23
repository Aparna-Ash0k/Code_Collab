/**
 * SharedStateManager - Unified state management for overlapping context data
 * 
 * Consolidates state between FileSystemContext, CollaborationContext, and ProjectContext
 * to eliminate conflicts and provide single source of truth for:
 * - Project sharing and collaboration
 * - User roles and permissions
 * - Session management
 * - Real-time synchronization state
 */

import { createContext, useContext, useReducer, useCallback, useRef } from 'react';

// Unified action types
export const SHARED_STATE_ACTIONS = {
  // Project collaboration
  SET_SHARED_PROJECT: 'SET_SHARED_PROJECT',
  SET_COLLABORATION_MODE: 'SET_COLLABORATION_MODE',
  SET_PROJECT_OWNER: 'SET_PROJECT_OWNER',
  
  // User roles and permissions
  SET_USER_ROLE: 'SET_USER_ROLE',
  SET_PROJECT_PERMISSIONS: 'SET_PROJECT_PERMISSIONS',
  UPDATE_USER_PERMISSION: 'UPDATE_USER_PERMISSION',
  
  // Session management
  SET_ACTIVE_SESSION: 'SET_ACTIVE_SESSION',
  SET_SESSION_USERS: 'SET_SESSION_USERS',
  ADD_SESSION_USER: 'ADD_SESSION_USER',
  REMOVE_SESSION_USER: 'REMOVE_SESSION_USER',
  
  // Real-time state
  SET_USER_PRESENCE: 'SET_USER_PRESENCE',
  SET_FILE_ACTIVITIES: 'SET_FILE_ACTIVITIES',
  SET_EDIT_CONFLICTS: 'SET_EDIT_CONFLICTS',
  
  // Project metadata
  SET_PROJECT_METADATA: 'SET_PROJECT_METADATA',
  UPDATE_PROJECT_METADATA: 'UPDATE_PROJECT_METADATA',
  
  // Reset
  RESET_STATE: 'RESET_STATE'
};

// Initial unified state
const initialSharedState = {
  // Project collaboration state
  sharedProject: null, // Currently shared project data
  collaborationMode: false, // True when in collaboration session
  projectOwner: null, // User ID of project owner
  
  // User permissions and roles
  currentUserRole: 'owner', // Current user's role: 'owner' | 'editor' | 'viewer'
  projectPermissions: new Map(), // userId -> role mapping for all users
  accessLevels: new Map(), // userId -> detailed access level info
  
  // Session management
  activeSession: null, // Current session data
  sessionUsers: new Map(), // userId -> user info for active session
  sessionOwner: null, // User ID of session owner
  
  // Real-time collaboration state
  userPresence: new Map(), // userId -> { isOnline, currentFile, lastSeen }
  fileActivities: new Map(), // userId -> { filePath, activity, timestamp }
  editConflicts: new Map(), // filePath -> { users: [userId], lastUpdate }
  
  // Project metadata (unified from different sources)
  projectMetadata: {
    id: null,
    name: '',
    description: '',
    type: 'general',
    created: null,
    lastModified: null,
    fileCount: 0,
    collaboratorCount: 0
  }
};

// Unified state reducer
const sharedStateReducer = (state, action) => {
  switch (action.type) {
    case SHARED_STATE_ACTIONS.SET_SHARED_PROJECT:
      return {
        ...state,
        sharedProject: action.payload,
        projectMetadata: {
          ...state.projectMetadata,
          ...action.payload
        }
      };
      
    case SHARED_STATE_ACTIONS.SET_COLLABORATION_MODE:
      return { ...state, collaborationMode: action.payload };
      
    case SHARED_STATE_ACTIONS.SET_PROJECT_OWNER:
      return { ...state, projectOwner: action.payload };
      
    case SHARED_STATE_ACTIONS.SET_USER_ROLE:
      return { ...state, currentUserRole: action.payload };
      
    case SHARED_STATE_ACTIONS.SET_PROJECT_PERMISSIONS:
      return { 
        ...state, 
        projectPermissions: new Map(action.payload),
        projectMetadata: {
          ...state.projectMetadata,
          collaboratorCount: action.payload.size
        }
      };
      
    case SHARED_STATE_ACTIONS.UPDATE_USER_PERMISSION:
      const updatedPermissions = new Map(state.projectPermissions);
      updatedPermissions.set(action.payload.userId, action.payload.role);
      return { 
        ...state, 
        projectPermissions: updatedPermissions,
        projectMetadata: {
          ...state.projectMetadata,
          collaboratorCount: updatedPermissions.size
        }
      };
      
    case SHARED_STATE_ACTIONS.SET_ACTIVE_SESSION:
      return { 
        ...state, 
        activeSession: action.payload,
        sessionOwner: action.payload?.ownerId || null
      };
      
    case SHARED_STATE_ACTIONS.SET_SESSION_USERS:
      return { 
        ...state, 
        sessionUsers: new Map(action.payload)
      };
      
    case SHARED_STATE_ACTIONS.ADD_SESSION_USER:
      const sessionUsersWithNew = new Map(state.sessionUsers);
      sessionUsersWithNew.set(action.payload.userId, action.payload.userData);
      return { ...state, sessionUsers: sessionUsersWithNew };
      
    case SHARED_STATE_ACTIONS.REMOVE_SESSION_USER:
      const sessionUsersWithoutUser = new Map(state.sessionUsers);
      sessionUsersWithoutUser.delete(action.payload.userId);
      return { ...state, sessionUsers: sessionUsersWithoutUser };
      
    case SHARED_STATE_ACTIONS.SET_USER_PRESENCE:
      return { 
        ...state, 
        userPresence: new Map(action.payload)
      };
      
    case SHARED_STATE_ACTIONS.SET_FILE_ACTIVITIES:
      return { 
        ...state, 
        fileActivities: new Map(action.payload)
      };
      
    case SHARED_STATE_ACTIONS.SET_EDIT_CONFLICTS:
      return { 
        ...state, 
        editConflicts: new Map(action.payload)
      };
      
    case SHARED_STATE_ACTIONS.SET_PROJECT_METADATA:
      return { 
        ...state, 
        projectMetadata: { ...state.projectMetadata, ...action.payload }
      };
      
    case SHARED_STATE_ACTIONS.UPDATE_PROJECT_METADATA:
      return { 
        ...state, 
        projectMetadata: { ...state.projectMetadata, ...action.payload }
      };
      
    case SHARED_STATE_ACTIONS.RESET_STATE:
      return { ...initialSharedState };
      
    default:
      return state;
  }
};

// Create context
const SharedStateContext = createContext();

/**
 * SharedStateProvider - Provides unified state management
 */
export const SharedStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(sharedStateReducer, initialSharedState);
  const subscriptions = useRef(new Set());

  // Subscribe to state changes
  const subscribe = useCallback((callback) => {
    subscriptions.current.add(callback);
    return () => subscriptions.current.delete(callback);
  }, []);

  // Notify subscribers of state changes
  const notifySubscribers = useCallback((type, payload) => {
    subscriptions.current.forEach(callback => {
      try {
        callback(type, payload, state);
      } catch (error) {
        console.error('Error in SharedState subscriber:', error);
      }
    });
  }, [state]);

  // Enhanced dispatch that notifies subscribers
  const enhancedDispatch = useCallback((action) => {
    dispatch(action);
    notifySubscribers(action.type, action.payload);
  }, [notifySubscribers]);

  // Convenience methods for common operations
  const actions = {
    // Project collaboration
    setSharedProject: (project) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_SHARED_PROJECT, 
        payload: project 
      });
    },
    
    setCollaborationMode: (isActive) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_COLLABORATION_MODE, 
        payload: isActive 
      });
    },
    
    setProjectOwner: (userId) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_PROJECT_OWNER, 
        payload: userId 
      });
    },
    
    // User roles and permissions
    setUserRole: (role) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_USER_ROLE, 
        payload: role 
      });
    },
    
    setProjectPermissions: (permissions) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_PROJECT_PERMISSIONS, 
        payload: permissions 
      });
    },
    
    updateUserPermission: (userId, role) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.UPDATE_USER_PERMISSION, 
        payload: { userId, role } 
      });
    },
    
    // Session management
    setActiveSession: (session) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_ACTIVE_SESSION, 
        payload: session 
      });
    },
    
    setSessionUsers: (users) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_SESSION_USERS, 
        payload: users 
      });
    },
    
    addSessionUser: (userId, userData) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.ADD_SESSION_USER, 
        payload: { userId, userData } 
      });
    },
    
    removeSessionUser: (userId) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.REMOVE_SESSION_USER, 
        payload: { userId } 
      });
    },
    
    // Real-time state
    setUserPresence: (presence) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_USER_PRESENCE, 
        payload: presence 
      });
    },
    
    setFileActivities: (activities) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_FILE_ACTIVITIES, 
        payload: activities 
      });
    },
    
    setEditConflicts: (conflicts) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_EDIT_CONFLICTS, 
        payload: conflicts 
      });
    },
    
    // Project metadata
    setProjectMetadata: (metadata) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.SET_PROJECT_METADATA, 
        payload: metadata 
      });
    },
    
    updateProjectMetadata: (updates) => {
      enhancedDispatch({ 
        type: SHARED_STATE_ACTIONS.UPDATE_PROJECT_METADATA, 
        payload: updates 
      });
    },
    
    // Utility
    resetState: () => {
      enhancedDispatch({ type: SHARED_STATE_ACTIONS.RESET_STATE });
    }
  };

  // Computed state getters
  const getters = {
    // Get current user's permissions
    getCurrentUserPermissions: () => {
      const userId = state.activeSession?.userId;
      return userId ? state.projectPermissions.get(userId) : state.currentUserRole;
    },
    
    // Check if user has specific permission
    hasPermission: (permission, userId = null) => {
      const targetUserId = userId || state.activeSession?.userId;
      const userRole = targetUserId ? state.projectPermissions.get(targetUserId) : state.currentUserRole;
      
      switch (permission) {
        case 'read':
          return ['owner', 'editor', 'viewer'].includes(userRole);
        case 'write':
          return ['owner', 'editor'].includes(userRole);
        case 'manage':
          return userRole === 'owner';
        default:
          return false;
      }
    },
    
    // Get all collaborators
    getAllCollaborators: () => {
      const collaborators = [];
      for (const [userId, role] of state.projectPermissions) {
        const sessionUser = state.sessionUsers.get(userId);
        const presence = state.userPresence.get(userId);
        
        collaborators.push({
          userId,
          role,
          isOnline: presence?.isOnline || false,
          currentFile: presence?.currentFile,
          lastSeen: presence?.lastSeen,
          ...sessionUser
        });
      }
      return collaborators;
    },
    
    // Get project status
    getProjectStatus: () => ({
      isCollaborating: state.collaborationMode,
      hasSharedProject: !!state.sharedProject,
      isOwner: state.currentUserRole === 'owner',
      canEdit: ['owner', 'editor'].includes(state.currentUserRole),
      canManage: state.currentUserRole === 'owner',
      collaboratorCount: state.projectPermissions.size,
      activeUsers: Array.from(state.userPresence.values()).filter(p => p.isOnline).length
    })
  };

  const value = {
    state,
    actions,
    getters,
    subscribe,
    dispatch: enhancedDispatch
  };

  return (
    <SharedStateContext.Provider value={value}>
      {children}
    </SharedStateContext.Provider>
  );
};

/**
 * Hook to use SharedState
 */
export const useSharedState = () => {
  const context = useContext(SharedStateContext);
  if (!context) {
    throw new Error('useSharedState must be used within a SharedStateProvider');
  }
  return context;
};

// Utility hook for specific state slices
export const useSharedStateSlice = (selector) => {
  const { state, subscribe } = useSharedState();
  
  return {
    data: selector(state),
    subscribe: (callback) => subscribe((type, payload, fullState) => {
      callback(selector(fullState));
    })
  };
};

// Export for direct import
export default SharedStateContext;
