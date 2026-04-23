import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useSession } from './SessionContext';
import { useAuth } from './AuthContext';
import { projectSyncService } from '../services/RealTimeProjectSync';
import toast from 'react-hot-toast';

// Action types
const COLLAB_ACTIONS = {
  SET_CURSORS: 'SET_CURSORS',
  UPDATE_CURSOR: 'UPDATE_CURSOR',
  REMOVE_CURSOR: 'REMOVE_CURSOR',
  SET_FILE_ACTIVITIES: 'SET_FILE_ACTIVITIES',
  UPDATE_FILE_ACTIVITY: 'UPDATE_FILE_ACTIVITY',
  REMOVE_FILE_ACTIVITY: 'REMOVE_FILE_ACTIVITY',
  SET_COLLABORATORS: 'SET_COLLABORATORS',
  ADD_COLLABORATOR: 'ADD_COLLABORATOR',
  REMOVE_COLLABORATOR: 'REMOVE_COLLABORATOR',
  UPDATE_COLLABORATOR_STATUS: 'UPDATE_COLLABORATOR_STATUS',
  UPDATE_COLLABORATOR_ROLE: 'UPDATE_COLLABORATOR_ROLE',
  SET_EDIT_CONFLICTS: 'SET_EDIT_CONFLICTS',
  ADD_EDIT_CONFLICT: 'ADD_EDIT_CONFLICT',
  REMOVE_EDIT_CONFLICT: 'REMOVE_EDIT_CONFLICT',
  // Project sharing actions
  SET_PROJECT_MODE: 'SET_PROJECT_MODE',
  SET_PROJECT_TEMPLATE: 'SET_PROJECT_TEMPLATE',
  SET_PROJECT_METADATA: 'SET_PROJECT_METADATA',
  SET_ACCESS_RIGHTS: 'SET_ACCESS_RIGHTS',
  UPDATE_PROJECT_STRUCTURE: 'UPDATE_PROJECT_STRUCTURE',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  SET_LIVE_CURSORS: 'SET_LIVE_CURSORS',
  UPDATE_USER_PRESENCE: 'UPDATE_USER_PRESENCE',
  SET_USER_COLOR: 'SET_USER_COLOR',
  SET_SESSION_OWNER: 'SET_SESSION_OWNER',
  SET_USER_ROLES: 'SET_USER_ROLES',
  // Enhanced project collaboration actions
  SET_SHARED_PROJECT: 'SET_SHARED_PROJECT',
  UPDATE_SHARED_PROJECT: 'UPDATE_SHARED_PROJECT',
  SET_PROJECT_OWNER: 'SET_PROJECT_OWNER',
  UPDATE_PROJECT_ACCESS: 'UPDATE_PROJECT_ACCESS',
  SET_PROJECT_COLLABORATION_MODE: 'SET_PROJECT_COLLABORATION_MODE'
};

// Initial state
const initialState = {
  cursors: new Map(), // userId -> { position, selection, filePath, userName, userColor }
  fileActivities: new Map(), // userId -> { filePath, fileName, timestamp, userName, userColor }
  collaborators: new Map(), // userId -> { id, name, email, avatar, status, joinedAt, role }
  userColors: new Map(), // userId -> color
  userRoles: new Map(), // userId -> 'owner' | 'editor' | 'viewer' (only in collaboration sessions)
  sessionOwner: null, // userId of session owner
  editConflicts: new Map(), // filePath -> { users: [userId], lastUpdate: timestamp }
  // Project sharing state
  projectMode: null, // 'share_existing' | 'new_project'
  projectTemplate: null,
  projectMetadata: {
    name: '',
    description: '',
    type: 'general',
    dependencies: [],
    structure: new Map()
  },
  accessRights: new Map(), // userId -> 'owner' | 'editor' | 'viewer'
  projectOwner: null,
  notifications: [],
  liveCursors: new Map(), // filePath -> Map(userId -> { position, selection })
  userPresence: new Map(), // userId -> { isOnline, currentFile, lastSeen }
  // Enhanced project collaboration state
  sharedProject: null, // Currently shared project data
  projectOwner: null, // Owner of the shared project
  projectCollaborationMode: false, // True when actively collaborating on a shared project
  projectAccessLevels: new Map() // userId -> access level for current shared project
};

// Color palette for collaborators (more vibrant and distinct colors)
const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
  '#00D2D3', '#FF9F43', '#EE5A24', '#0ABDE3',
  '#FD79A8', '#6C5CE7', '#A29BFE', '#74B9FF',
  '#55A3FF', '#26C0C7', '#F8B500', '#FF7675',
  '#FD79A8', '#FDCB6E', '#6C5CE7', '#00B894'
];

// Collaboration reducer
const collaborationReducer = (state, action) => {
  switch (action.type) {
    case COLLAB_ACTIONS.SET_CURSORS:
      return { ...state, cursors: new Map(action.payload) };
      
    case COLLAB_ACTIONS.UPDATE_CURSOR:
      const newCursors = new Map(state.cursors);
      newCursors.set(action.payload.userId, action.payload.cursorData);
      return { ...state, cursors: newCursors };
      
    case COLLAB_ACTIONS.REMOVE_CURSOR:
      const cursorsWithoutUser = new Map(state.cursors);
      cursorsWithoutUser.delete(action.payload.userId);
      return { ...state, cursors: cursorsWithoutUser };
      
    case COLLAB_ACTIONS.SET_FILE_ACTIVITIES:
      return { ...state, fileActivities: new Map(action.payload) };
      
    case COLLAB_ACTIONS.UPDATE_FILE_ACTIVITY:
      const newActivities = new Map(state.fileActivities);
      newActivities.set(action.payload.userId, action.payload.activityData);
      return { ...state, fileActivities: newActivities };
      
    case COLLAB_ACTIONS.REMOVE_FILE_ACTIVITY:
      const activitiesWithoutUser = new Map(state.fileActivities);
      activitiesWithoutUser.delete(action.payload.userId);
      return { ...state, fileActivities: activitiesWithoutUser };
      
    case COLLAB_ACTIONS.SET_COLLABORATORS:
      return { ...state, collaborators: new Map(action.payload) };
      
    case COLLAB_ACTIONS.ADD_COLLABORATOR:
      const collaboratorsWithNew = new Map(state.collaborators);
      collaboratorsWithNew.set(action.payload.userId, action.payload.collaboratorData);
      return { ...state, collaborators: collaboratorsWithNew };
      
    case COLLAB_ACTIONS.REMOVE_COLLABORATOR:
      const collaboratorsWithoutUser = new Map(state.collaborators);
      collaboratorsWithoutUser.delete(action.payload.userId);
      return { ...state, collaborators: collaboratorsWithoutUser };
      
    case COLLAB_ACTIONS.UPDATE_COLLABORATOR_STATUS:
      const updatedCollaborators = new Map(state.collaborators);
      const existingCollaborator = updatedCollaborators.get(action.payload.userId);
      if (existingCollaborator) {
        updatedCollaborators.set(action.payload.userId, {
          ...existingCollaborator,
          ...action.payload.updates
        });
      }
      return { ...state, collaborators: updatedCollaborators };

    case COLLAB_ACTIONS.UPDATE_COLLABORATOR_ROLE:
      const collaboratorsWithUpdatedRole = new Map(state.collaborators);
      const collaboratorToUpdate = collaboratorsWithUpdatedRole.get(action.payload.userId);
      if (collaboratorToUpdate) {
        collaboratorsWithUpdatedRole.set(action.payload.userId, {
          ...collaboratorToUpdate,
          role: action.payload.role
        });
      }
      // Also update userRoles map
      const updatedUserRoles = new Map(state.userRoles);
      updatedUserRoles.set(action.payload.userId, action.payload.role);
      return { 
        ...state, 
        collaborators: collaboratorsWithUpdatedRole,
        userRoles: updatedUserRoles
      };

    case COLLAB_ACTIONS.SET_SESSION_OWNER:
      return { ...state, sessionOwner: action.payload };

    case COLLAB_ACTIONS.SET_USER_ROLES:
      return { ...state, userRoles: new Map(action.payload) };

    case COLLAB_ACTIONS.SET_EDIT_CONFLICTS:
      return { ...state, editConflicts: new Map(action.payload) };
      
    case COLLAB_ACTIONS.ADD_EDIT_CONFLICT:
      const newConflicts = new Map(state.editConflicts);
      newConflicts.set(action.payload.filePath, action.payload.conflictData);
      return { ...state, editConflicts: newConflicts };
      
    case COLLAB_ACTIONS.REMOVE_EDIT_CONFLICT:
      const conflictsWithoutFile = new Map(state.editConflicts);
      conflictsWithoutFile.delete(action.payload.filePath);
      return { ...state, editConflicts: conflictsWithoutFile };
      
    // Project sharing cases
    case COLLAB_ACTIONS.SET_PROJECT_MODE:
      return { ...state, projectMode: action.payload };
      
    case COLLAB_ACTIONS.SET_PROJECT_TEMPLATE:
      return { ...state, projectTemplate: action.payload };
      
    case COLLAB_ACTIONS.SET_PROJECT_METADATA:
      return { ...state, projectMetadata: { ...state.projectMetadata, ...action.payload } };
      
    case COLLAB_ACTIONS.SET_ACCESS_RIGHTS:
      return { ...state, accessRights: new Map(action.payload) };
      
    case COLLAB_ACTIONS.UPDATE_PROJECT_STRUCTURE:
      const newStructure = new Map(state.projectMetadata.structure);
      action.payload.forEach(([path, metadata]) => {
        newStructure.set(path, metadata);
      });
      return {
        ...state,
        projectMetadata: {
          ...state.projectMetadata,
          structure: newStructure
        }
      };
      
    case COLLAB_ACTIONS.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, { ...action.payload, id: Date.now() }]
      };
      
    case COLLAB_ACTIONS.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
      
    case COLLAB_ACTIONS.SET_LIVE_CURSORS:
      return { ...state, liveCursors: new Map(action.payload) };
      
    case COLLAB_ACTIONS.UPDATE_USER_PRESENCE:
      const newPresence = new Map(state.userPresence);
      const { userId, presence } = action.payload;
      newPresence.set(userId, { ...newPresence.get(userId), ...presence });
      return { ...state, userPresence: newPresence };
      
    case COLLAB_ACTIONS.SET_USER_COLOR:
      const newUserColors = new Map(state.userColors);
      newUserColors.set(action.payload.userId, action.payload.color);
      return { ...state, userColors: newUserColors };
      
    // Enhanced project collaboration cases
    case COLLAB_ACTIONS.SET_SHARED_PROJECT:
      console.log('📁 Setting shared project:', action.payload);
      return { 
        ...state, 
        sharedProject: action.payload,
        projectCollaborationMode: !!action.payload
      };
      
    case COLLAB_ACTIONS.UPDATE_SHARED_PROJECT:
      return {
        ...state,
        sharedProject: state.sharedProject ? { ...state.sharedProject, ...action.payload } : null
      };
      
    case COLLAB_ACTIONS.SET_PROJECT_OWNER:
      return { ...state, projectOwner: action.payload };
      
    case COLLAB_ACTIONS.UPDATE_PROJECT_ACCESS:
      const newProjectAccess = new Map(state.projectAccessLevels);
      newProjectAccess.set(action.payload.userId, action.payload.accessLevel);
      return { ...state, projectAccessLevels: newProjectAccess };
      
    case COLLAB_ACTIONS.SET_PROJECT_COLLABORATION_MODE:
      return { 
        ...state, 
        projectCollaborationMode: action.payload,
        // Clear project data when exiting collaboration mode
        sharedProject: action.payload ? state.sharedProject : null,
        projectAccessLevels: action.payload ? state.projectAccessLevels : new Map()
      };
      
    default:
      return state;
  }
};

// Create context
const CollaborationContext = createContext(null);

// Provider component
export const CollaborationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(collaborationReducer, initialState);
  const { socket, session } = useSession();
  const { user } = useAuth();
  
  const cursorUpdateTimeout = useRef(null);
  const lastCursorUpdate = useRef(0);
  const collaboratorsRef = useRef(new Map());

  // Assign color to user with persistence
  const getUserColor = useCallback((userId) => {
    if (!userId) return COLLABORATOR_COLORS[0];
    
    // Check if user already has a color assigned
    if (state.userColors.has(userId)) {
      return state.userColors.get(userId);
    }
    
    // Assign a new color based on a hash of the userId for consistency
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colorIndex = Math.abs(hash) % COLLABORATOR_COLORS.length;
    const assignedColor = COLLABORATOR_COLORS[colorIndex];
    
    // Store the color assignment
    dispatch({
      type: COLLAB_ACTIONS.SET_USER_COLOR,
      payload: {
        userId,
        color: assignedColor
      }
    });
    
    return assignedColor;
  }, [state.userColors, dispatch]);

  // Update cursor position with conflict detection
  const updateCursor = useCallback((position, selection = null, filePath = null) => {
    if (!socket || !session || !user) return;

    // Use the provided filePath directly (no dependency on FileSystem)
    const activeFilePath = filePath;
    if (!activeFilePath) return;

    const now = Date.now();
    // Throttle cursor updates to prevent spam
    if (now - lastCursorUpdate.current < 50) { // Reduced throttle for better responsiveness
      if (cursorUpdateTimeout.current) {
        clearTimeout(cursorUpdateTimeout.current);
      }
      cursorUpdateTimeout.current = setTimeout(() => {
        updateCursor(position, selection, activeFilePath);
      }, 50);
      return;
    }

    lastCursorUpdate.current = now;

    const cursorData = {
      userId: user.id || user.uid,
      userName: user.name || user.displayName || 'User',
      userColor: getUserColor(user.id || user.uid),
      position,
      selection,
      filePath: activeFilePath,
      fileName: activeFilePath.split('/').pop(),
      timestamp: now
    };

    // Check for edit conflicts
    checkForEditConflicts(activeFilePath, position, selection);

    // Update local state
    dispatch({
      type: COLLAB_ACTIONS.UPDATE_CURSOR,
      payload: { userId: user.id || user.uid, cursorData }
    });

    // Broadcast to other users
    socket.emit('cursor_update', {
      sessionId: session.id,
      ...cursorData
    });
  }, [socket, session, user, getUserColor]);

  // Check for potential edit conflicts
  const checkForEditConflicts = useCallback((filePath, position, selection) => {
    const cursorsInFile = [];
    for (const [userId, cursorData] of state.cursors) {
      if (cursorData.filePath === filePath && userId !== (user?.id || user?.uid)) {
        cursorsInFile.push({ userId, ...cursorData });
      }
    }

    const conflictUsers = [];
    const CONFLICT_RANGE = 3; // Lines within which to consider a conflict

    cursorsInFile.forEach(({ userId, position: otherPos, userName }) => {
      if (otherPos && position) {
        const lineDiff = Math.abs(otherPos.lineNumber - position.lineNumber);
        if (lineDiff <= CONFLICT_RANGE) {
          conflictUsers.push({ userId, userName, position: otherPos });
        }
      }
    });

    if (conflictUsers.length > 0) {
      dispatch({
        type: COLLAB_ACTIONS.ADD_EDIT_CONFLICT,
        payload: {
          filePath,
          conflictData: {
            users: conflictUsers,
            currentUser: {
              userId: user.id || user.uid,
              userName: user.name || user.displayName || 'User',
              position
            },
            lastUpdate: Date.now()
          }
        }
      });

      // Auto-remove conflict after 5 seconds
      setTimeout(() => {
        dispatch({
          type: COLLAB_ACTIONS.REMOVE_EDIT_CONFLICT,
          payload: { filePath }
        });
      }, 5000);
    }
  }, [state.cursors, user]);

  // Update file activity (when switching files)
  const updateFileActivity = useCallback((filePath, fileName) => {
    if (!socket || !session || !user) return;

    const activityData = {
      userId: user.id || user.uid,
      userName: user.name || user.displayName || 'User',
      userColor: getUserColor(user.id || user.uid),
      filePath,
      fileName,
      timestamp: Date.now()
    };

    // Update local state
    dispatch({
      type: COLLAB_ACTIONS.UPDATE_FILE_ACTIVITY,
      payload: { userId: user.id || user.uid, activityData }
    });

    // Broadcast to other users
    socket.emit('file_activity_update', {
      sessionId: session.id,
      ...activityData
    });
  }, [socket, session, user, getUserColor]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !session) return;
    
    console.log('🔐 CollaborationContext: Registering socket event handlers', {
      socketId: socket.id,
      sessionId: session.id,
      userId: user?.id || user?.uid,
      userDefined: !!user
    });

    // Handle cursor updates from other users
    const handleCursorUpdate = (data) => {
      if (data.sessionId !== session.id) return;
      if (data.userId === (user?.id || user?.uid)) return; // Ignore own updates

      dispatch({
        type: COLLAB_ACTIONS.UPDATE_CURSOR,
        payload: {
          userId: data.userId,
          cursorData: {
            userId: data.userId,
            userName: data.userName,
            userColor: data.userColor,
            position: data.position,
            selection: data.selection,
            filePath: data.filePath,
            fileName: data.fileName,
            timestamp: data.timestamp
          }
        }
      });
    };

    // Handle file activity updates from other users
    const handleFileActivityUpdate = (data) => {
      if (data.sessionId !== session.id) return;
      if (data.userId === (user?.id || user?.uid)) return; // Ignore own updates

      dispatch({
        type: COLLAB_ACTIONS.UPDATE_FILE_ACTIVITY,
        payload: {
          userId: data.userId,
          activityData: {
            userId: data.userId,
            userName: data.userName,
            userColor: data.userColor,
            filePath: data.filePath,
            fileName: data.fileName,
            timestamp: data.timestamp
          }
        }
      });
    };

    // Project sharing events
    const handleProjectShareInit = (data) => {
      console.log('📁 Received project share initialization:', data);
      
      const { mode, projectData, ownerId, sessionId } = data;
      
      if (sessionId !== session.id) return;
      
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_MODE, payload: mode });
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_METADATA, payload: projectData });
      
      // Set access rights
      const accessRights = new Map();
      accessRights.set(ownerId, 'owner');
      if (user && (user.id || user.uid) !== ownerId) {
        accessRights.set(user.id || user.uid, 'editor'); // Default to editor
      }
      dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: accessRights });
      
      // Show notification
      dispatch({
        type: COLLAB_ACTIONS.ADD_NOTIFICATION,
        payload: {
          type: 'info',
          title: 'Project Shared',
          message: `${projectData.name} has been shared with you`,
          duration: 5000
        }
      });
    };

    // New project creation events
    const handleProjectCreateInit = (data) => {
      console.log('🚀 Received new project creation:', data);
      
      const { mode, template, projectData, ownerId, sessionId } = data;
      
      if (sessionId !== session.id) return;
      
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_MODE, payload: mode });
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_TEMPLATE, payload: template });
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_METADATA, payload: projectData });
      
      // Set access rights
      const accessRights = new Map();
      accessRights.set(ownerId, 'owner');
      if (user && (user.id || user.uid) !== ownerId) {
        accessRights.set(user.id || user.uid, 'editor');
      }
      dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: accessRights });
      
      // Show notification
      dispatch({
        type: COLLAB_ACTIONS.ADD_NOTIFICATION,
        payload: {
          type: 'success',
          title: 'New Project Created',
          message: `${projectData.name} is ready for collaboration`,
          duration: 5000
        }
      });
    };

    // Access rights updates
    const handleAccessRightsUpdate = (data) => {
      console.log('🔐 Received access rights update:', data);
      
      const { userId, accessLevel, sessionId } = data;
      
      if (sessionId !== session.id) return;
      
      const newAccessRights = new Map(state.accessRights);
      newAccessRights.set(userId, accessLevel);
      dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: newAccessRights });
      
      // Show notification if it affects current user
      if (userId === (user?.id || user?.uid)) {
        dispatch({
          type: COLLAB_ACTIONS.ADD_NOTIFICATION,
          payload: {
            type: 'info',
            title: 'Access Updated',
            message: `Your access level has been changed to ${accessLevel}`,
            duration: 4000
          }
        });
      }
    };

    // Handle user joining session
    const handleUserJoined = (userData) => {
      if (userData.sessionId !== session.id) return;
      if (userData.userId === (user?.id || user?.uid)) return; // Ignore own join

      const collaboratorData = {
        id: userData.userId,
        name: userData.userName,
        email: userData.userEmail || '',
        avatar: userData.userAvatar || userData.userName?.charAt(0)?.toUpperCase() || 'U',
        status: 'online',
        joinedAt: userData.timestamp || Date.now(),
        isOwner: false,
        color: getUserColor(userData.userId)
      };

      dispatch({
        type: COLLAB_ACTIONS.ADD_COLLABORATOR,
        payload: { userId: userData.userId, collaboratorData }
      });

      // Show notification if user is the session owner
      if (session.creatorId === (user?.id || user?.uid)) {
        toast.success(`${userData.userName} joined the session`, {
          icon: '👋',
          duration: 4000,
          style: {
            background: '#2D2D2D',
            color: '#FFFFFF',
            border: '1px solid #007ACC'
          }
        });
        
        // Also add to notifications for project owner
        dispatch({
          type: COLLAB_ACTIONS.ADD_NOTIFICATION,
          payload: {
            type: 'info',
            title: 'Collaborator Joined',
            message: `${userData.userName} joined the project`,
            duration: 4000
          }
        });
      }
    };

    // Handle user leaving session
    const handleUserLeft = (userData) => {
      if (userData.sessionId !== session.id) return;
      if (userData.userId === (user?.id || user?.uid)) return; // Ignore own leave

      dispatch({
        type: COLLAB_ACTIONS.REMOVE_COLLABORATOR,
        payload: { userId: userData.userId }
      });

      // Remove cursor and file activity
      dispatch({
        type: COLLAB_ACTIONS.REMOVE_CURSOR,
        payload: { userId: userData.userId }
      });

      dispatch({
        type: COLLAB_ACTIONS.REMOVE_FILE_ACTIVITY,
        payload: { userId: userData.userId }
      });

      // Show notification if user is the session owner
      if (session.creatorId === (user?.id || user?.uid)) {
        toast(`${userData.userName} left the session`, {
          icon: '👋',
          duration: 3000,
          style: {
            background: '#2D2D2D',
            color: '#FFFFFF',
            border: '1px solid #FFA500'
          }
        });
        
        // Also add to notifications for project owner
        dispatch({
          type: COLLAB_ACTIONS.ADD_NOTIFICATION,
          payload: {
            type: 'warning',
            title: 'Collaborator Left',
            message: `${userData.userName} left the project`,
            duration: 4000
          }
        });
      }
    };

    // Handle session users list
    const handleSessionUsers = (data) => {
      if (data.sessionId !== session.id) return;

      const collaboratorsMap = new Map();
      const userRolesMap = new Map();
      
      data.users.forEach(userData => {
        if (userData.id !== (user?.id || user?.uid)) {
          // Determine role based on session ownership
          const role = userData.id === session.creatorId ? 'owner' : (userData.role || 'editor');
          
          collaboratorsMap.set(userData.id, {
            id: userData.id,
            name: userData.name,
            email: userData.email || '',
            avatar: userData.avatar || userData.name?.charAt(0)?.toUpperCase() || 'U',
            status: 'online',
            joinedAt: Date.now(),
            role: role,
            color: getUserColor(userData.id)
          });
          
          userRolesMap.set(userData.id, role);
        }
      });

      dispatch({
        type: COLLAB_ACTIONS.SET_COLLABORATORS,
        payload: collaboratorsMap
      });
      
      dispatch({
        type: COLLAB_ACTIONS.SET_USER_ROLES,
        payload: userRolesMap
      });
      
      // Set session owner
      if (session.creatorId) {
        dispatch({
          type: COLLAB_ACTIONS.SET_SESSION_OWNER,
          payload: session.creatorId
        });
      }
    };

    // Handle role updates
    const handleRoleUpdate = (data) => {
      if (data.sessionId !== session.id) return;
      
      dispatch({
        type: COLLAB_ACTIONS.UPDATE_COLLABORATOR_ROLE,
        payload: {
          userId: data.userId,
          role: data.role
        }
      });
      
      // Show notification
      if (data.userId === (user?.id || user?.uid)) {
        dispatch({
          type: COLLAB_ACTIONS.ADD_NOTIFICATION,
          payload: {
            type: 'info',
            title: 'Role Updated',
            message: `Your role has been changed to ${data.role} by ${data.updatedBy}`,
            duration: 5000
          }
        });
      }
    };

    // Handle window event for user permissions from SessionContext
    const handleUserPermissionsReady = (event) => {
      const { userId, permissions } = event.detail;
      console.log('🔐 CollaborationContext: Received userPermissionsReady event:', { userId, permissions });
      
      if (userId && permissions && permissions.projectAccessLevel) {
        console.log(`🔐 CollaborationContext: Setting access rights from custom event for user ${userId}: ${permissions.projectAccessLevel}`);
        
        // Initialize access rights map with current user's permissions
        const accessRights = new Map(state.accessRights);
        accessRights.set(userId, permissions.projectAccessLevel);
        
        dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: accessRights });
        
        console.log('✅ CollaborationContext: Access rights updated successfully from custom event:', accessRights);
      } else {
        console.warn('⚠️ CollaborationContext: Invalid userPermissionsReady data:', event.detail);
      }
    };

    // Register window event listener for user permissions
    window.addEventListener('userPermissionsReady', handleUserPermissionsReady);

    // Handle session info events for proper permission initialization  
    const handleSessionInfo = (sessionInfo) => {
      console.log('🔐 CollaborationContext: Received session_info event:', sessionInfo);
      
      if (sessionInfo && sessionInfo.userPermissions) {
        const userPermissions = sessionInfo.userPermissions;
        const userId = user?.id || user?.uid;
        
        console.log('🔐 CollaborationContext: User ID:', userId);
        console.log('🔐 CollaborationContext: User permissions from session_info:', userPermissions);
        console.log('🔐 CollaborationContext: Project access level:', userPermissions.projectAccessLevel);
        
        if (userId && userPermissions.projectAccessLevel) {
          console.log(`🔐 CollaborationContext: Setting access rights from session_info for user ${userId}: ${userPermissions.projectAccessLevel}`);
          
          // Initialize access rights map with current user's permissions
          const accessRights = new Map(state.accessRights);
          accessRights.set(userId, userPermissions.projectAccessLevel);
          
          dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: accessRights });
          
          console.log('✅ CollaborationContext: Access rights updated successfully from session_info:', accessRights);
        } else {
          console.warn('⚠️ CollaborationContext: Missing userId or projectAccessLevel in session_info:', { 
            userId, 
            projectAccessLevel: userPermissions.projectAccessLevel 
          });
        }
      } else {
        console.warn('⚠️ CollaborationContext: No userPermissions in session_info:', sessionInfo);
      }
    };

    // Handle session joined events for proper permission initialization (legacy)
    const handleSessionJoined = (data) => {
      console.log('🔐 CollaborationContext: Received session_joined event:', data);
      
      if (data && data.session && data.session.userPermissions) {
        const userPermissions = data.session.userPermissions;
        const userId = user?.id || user?.uid;
        
        console.log('🔐 CollaborationContext: User ID:', userId);
        console.log('🔐 CollaborationContext: User permissions received:', userPermissions);
        console.log('🔐 CollaborationContext: Project access level:', userPermissions.projectAccessLevel);
        
        if (userId && userPermissions.projectAccessLevel) {
          console.log(`🔐 CollaborationContext: Setting access rights for user ${userId}: ${userPermissions.projectAccessLevel}`);
          
          // Initialize access rights map with current user's permissions
          const accessRights = new Map(state.accessRights);
          accessRights.set(userId, userPermissions.projectAccessLevel);
          
          dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: accessRights });
          
          console.log('✅ CollaborationContext: Access rights updated successfully:', accessRights);
        } else {
          console.warn('⚠️ CollaborationContext: Missing userId or projectAccessLevel:', { 
            userId, 
            projectAccessLevel: userPermissions.projectAccessLevel 
          });
        }
      } else {
        console.warn('⚠️ CollaborationContext: Invalid session_joined data structure:', data);
      }
    };

    // Register event listeners
    socket.on('cursor_update', handleCursorUpdate);
    socket.on('file_activity_update', handleFileActivityUpdate);
    socket.on('project_share_init', handleProjectShareInit);
    socket.on('project_create_init', handleProjectCreateInit);
    socket.on('access_rights_update', handleAccessRightsUpdate);
    socket.on('user_joined_session', handleUserJoined);
    socket.on('user_left_session', handleUserLeft);
    socket.on('session_users', handleSessionUsers);
    socket.on('collaborator_role_updated', handleRoleUpdate);
    socket.on('session_joined', handleSessionJoined);
    socket.on('session_info', handleSessionInfo);
    
    // Enhanced project collaboration event handlers
    socket.on('project_shared', (data) => {
      if (data.sessionId !== session.id) return;
      
      console.log('📁 Received project share:', data.projectData.name);
      
      dispatch({ type: COLLAB_ACTIONS.SET_SHARED_PROJECT, payload: data.projectData });
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_OWNER, payload: data.ownerId });
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_COLLABORATION_MODE, payload: true });
      
      // Set access levels
      Object.entries(data.permissions).forEach(([userId, accessLevel]) => {
        dispatch({ 
          type: COLLAB_ACTIONS.UPDATE_PROJECT_ACCESS, 
          payload: { userId, accessLevel }
        });
      });
      
      // Show notification
      dispatch({
        type: COLLAB_ACTIONS.ADD_NOTIFICATION,
        payload: {
          type: 'success',
          title: 'Project Shared',
          message: `${data.ownerName} shared "${data.projectData.name}" with you`,
          duration: 5000
        }
      });
    });
    
    socket.on('project_access_updated', (data) => {
      if (data.sessionId !== session.id) return;
      
      dispatch({ 
        type: COLLAB_ACTIONS.UPDATE_PROJECT_ACCESS, 
        payload: { userId: data.userId, accessLevel: data.accessLevel }
      });
      
      // Show notification if it affects current user
      const currentUserId = user?.id || user?.uid;
      if (data.userId === currentUserId) {
        dispatch({
          type: COLLAB_ACTIONS.ADD_NOTIFICATION,
          payload: {
            type: 'info',
            title: 'Access Updated',
            message: `Your project access has been changed to ${data.accessLevel}`,
            duration: 4000
          }
        });
      }
    });
    
    socket.on('leave_project_collaboration', (data) => {
      if (data.sessionId !== session.id) return;
      
      // Remove user from project access
      const newProjectAccess = new Map(state.projectAccessLevels);
      newProjectAccess.delete(data.userId);
      dispatch({ 
        type: COLLAB_ACTIONS.UPDATE_PROJECT_ACCESS, 
        payload: { userId: data.userId, accessLevel: null }
      });
    });

    // Request current session users
    socket.emit('get_session_users');

    // Cleanup
    return () => {
      socket.off('cursor_update', handleCursorUpdate);
      socket.off('file_activity_update', handleFileActivityUpdate);
      socket.off('project_share_init', handleProjectShareInit);
      socket.off('project_create_init', handleProjectCreateInit);
      socket.off('access_rights_update', handleAccessRightsUpdate);
      socket.off('user_joined_session', handleUserJoined);
      socket.off('user_left_session', handleUserLeft);
      socket.off('session_users', handleSessionUsers);
      socket.off('collaborator_role_updated', handleRoleUpdate);
      socket.off('session_joined', handleSessionJoined);
      socket.off('session_info', handleSessionInfo);
      
      // Enhanced project collaboration cleanup
      socket.off('project_shared');
      socket.off('project_access_updated');
      socket.off('leave_project_collaboration');
      
      // Cleanup window event listener
      window.removeEventListener('userPermissionsReady', handleUserPermissionsReady);
    };
  }, [socket, session, user, getUserColor, state.accessRights]);

  // Project sharing functions
  const initializeProjectShare = useCallback(async (mode, projectData = {}) => {
    if (!socket || !session || !user) {
      throw new Error('Socket, session, or user not available');
    }

    dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_MODE, payload: mode });

    try {
      // Initialize project sync service
      const userId = user.id || user.uid;
      projectSyncService.initialize(socket, session.id, userId);

      if (mode === 'existing') {
        // Handle sharing existing project
        console.log('📁 Sharing existing project:', projectData.name);
        
        dispatch({
          type: COLLAB_ACTIONS.SET_PROJECT_METADATA,
          payload: {
            name: projectData.name,
            description: projectData.description,
            type: projectData.type || 'general',
            dependencies: projectData.dependencies || [],
            structure: new Map()
          }
        });

        // Start project collaboration with existing files
        await projectSyncService.startProjectCollaboration(mode, {
          name: projectData.name,
          description: projectData.description,
          type: projectData.type,
          files: projectData.files || [],
          folders: projectData.folders || []
        });

      } else if (mode === 'new') {
        // Handle new project creation
        console.log('🚀 Creating new collaborative project:', projectData.name);
        
        dispatch({
          type: COLLAB_ACTIONS.SET_PROJECT_METADATA,
          payload: {
            name: projectData.name,
            description: projectData.description,
            type: projectData.type || 'general',
            dependencies: [],
            structure: new Map()
          }
        });

        // Start project collaboration with empty project
        await projectSyncService.startProjectCollaboration(mode, {
          name: projectData.name,
          description: projectData.description,
          type: projectData.type,
          files: [],
          folders: []
        });
      }

      // Set owner access rights
      const accessRights = new Map();
      accessRights.set(userId, 'owner');
      dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: accessRights });

      // Setup project sync event listeners
      setupProjectSyncListeners();

      console.log('✅ Project collaboration initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize project collaboration:', error);
      throw error;
    }
  }, [socket, session, user]);

  // Setup project sync event listeners
  const setupProjectSyncListeners = useCallback(() => {
    if (!projectSyncService) return;

    // Project state events
    projectSyncService.on('project_started', (data) => {
      console.log('📁 Project collaboration started:', data);
      
      // Set the shared project state so file operations use project sync
      if (data.project) {
        dispatch({ type: COLLAB_ACTIONS.SET_SHARED_PROJECT, payload: data.project });
        dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_OWNER, payload: data.project.owner });
      }
      
      dispatch({
        type: COLLAB_ACTIONS.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'success',
          message: `Project "${data.project?.name}" collaboration started!`,
          duration: 5000
        }
      });
    });

    projectSyncService.on('project_synced', (data) => {
      console.log('🔄 Project state synchronized:', data);
      
      // Update the shared project state with the synchronized data
      if (data.project) {
        dispatch({ type: COLLAB_ACTIONS.SET_SHARED_PROJECT, payload: data.project });
      }
    });

    projectSyncService.on('collaborator_joined', (data) => {
      console.log('👤 Collaborator joined project:', data.userId);
      dispatch({
        type: COLLAB_ACTIONS.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'info',
          message: `${data.userName || 'Someone'} joined the project`,
          duration: 3000
        }
      });
    });

    projectSyncService.on('collaborator_left', (data) => {
      console.log('👤 Collaborator left project:', data.userId);
    });

    // File operation events
    projectSyncService.on('file_created', (data) => {
      console.log('📝 File created in project:', data.filePath);
      // Emit to file system to update UI
      window.dispatchEvent(new CustomEvent('projectFileCreated', { detail: data }));
    });

    projectSyncService.on('file_updated', (data) => {
      console.log('✏️ File updated in project:', data.filePath);
      // Emit to file system to update UI
      window.dispatchEvent(new CustomEvent('projectFileUpdated', { detail: data }));
    });

    projectSyncService.on('file_deleted', (data) => {
      console.log('🗑️ File deleted from project:', data.filePath);
      // Emit to file system to update UI
      window.dispatchEvent(new CustomEvent('projectFileDeleted', { detail: data }));
    });

    projectSyncService.on('file_renamed', (data) => {
      console.log('📝 File renamed in project:', data.oldPath, '->', data.newPath);
      // Emit to file system to update UI
      window.dispatchEvent(new CustomEvent('projectFileRenamed', { detail: data }));
    });

    // Folder operation events
    projectSyncService.on('folder_created', (data) => {
      console.log('📁 Folder created in project:', data.folderPath);
      // Emit to file system to update UI
      window.dispatchEvent(new CustomEvent('projectFolderCreated', { detail: data }));
    });

    projectSyncService.on('folder_deleted', (data) => {
      console.log('🗑️ Folder deleted from project:', data.folderPath);
      // Emit to file system to update UI
      window.dispatchEvent(new CustomEvent('projectFolderDeleted', { detail: data }));
    });

    // Error handling
    projectSyncService.on('operation_error', (data) => {
      console.error('❌ Project operation error:', data);
      dispatch({
        type: COLLAB_ACTIONS.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'error',
          message: `Project operation failed: ${data.error}`,
          duration: 5000
        }
      });
    });

  }, []);

  const updateUserAccessRights = useCallback((userId, accessLevel) => {
    if (!socket || !session) return;

    const newAccessRights = new Map(state.accessRights);
    newAccessRights.set(userId, accessLevel);
    
    dispatch({ type: COLLAB_ACTIONS.SET_ACCESS_RIGHTS, payload: newAccessRights });

    // Broadcast access rights update
    socket.emit('access_rights_update', {
      sessionId: session.id,
      userId,
      accessLevel,
      updatedBy: user.id || user.uid
    });
  }, [socket, session, user, state.accessRights]);

  const broadcastFileActivity = useCallback((filePath, activity) => {
    if (!socket || !session || !user) return;

    socket.emit('file_activity_broadcast', {
      sessionId: session.id,
      filePath,
      userId: user.id || user.uid,
      userName: user.name || user.displayName || 'User',
      activity,
      timestamp: Date.now()
    });
  }, [socket, session, user]);

  const broadcastCursorPosition = useCallback((filePath, position, selection) => {
    if (!socket || !session || !user) return;

    socket.emit('cursor_position_broadcast', {
      sessionId: session.id,
      filePath,
      userId: user.id || user.uid,
      position,
      selection,
      timestamp: Date.now()
    });
  }, [socket, session, user]);

  const updateUserPresence = useCallback((presence) => {
    if (!socket || !session || !user) return;

    socket.emit('user_presence_update', {
      sessionId: session.id,
      userId: user.id || user.uid,
      presence: {
        ...presence,
        lastSeen: Date.now()
      }
    });
  }, [socket, session, user]);

  const removeNotification = useCallback((notificationId) => {
    dispatch({ type: COLLAB_ACTIONS.REMOVE_NOTIFICATION, payload: notificationId });
  }, []);

  // Auto-remove notifications after their duration
  useEffect(() => {
    const timers = state.notifications.map(notification => {
      if (notification.duration) {
        return setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration);
      }
      return null;
    }).filter(Boolean);

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [state.notifications, removeNotification]);
  // Clean up old cursor positions and file activities
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const TIMEOUT = 30000; // 30 seconds

      // Clean up old cursors
      const activeCursors = new Map();
      for (const [userId, cursorData] of state.cursors) {
        if (now - cursorData.timestamp < TIMEOUT) {
          activeCursors.set(userId, cursorData);
        }
      }
      if (activeCursors.size !== state.cursors.size) {
        dispatch({ type: COLLAB_ACTIONS.SET_CURSORS, payload: activeCursors });
      }

      // Clean up old file activities
      const activeActivities = new Map();
      for (const [userId, activityData] of state.fileActivities) {
        if (now - activityData.timestamp < TIMEOUT) {
          activeActivities.set(userId, activityData);
        }
      }
      if (activeActivities.size !== state.fileActivities.size) {
        dispatch({ type: COLLAB_ACTIONS.SET_FILE_ACTIVITIES, payload: activeActivities });
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(cleanup);
  }, [state.cursors, state.fileActivities]);

  // Context value
  const value = {
    // State
    cursors: state.cursors,
    fileActivities: state.fileActivities,
    collaborators: state.collaborators,
    userColors: state.userColors,
    userRoles: state.userRoles,
    sessionOwner: state.sessionOwner,
    editConflicts: state.editConflicts,
    // Project sharing state
    projectMode: state.projectMode,
    projectTemplate: state.projectTemplate,
    projectMetadata: state.projectMetadata,
    accessRights: state.accessRights,
    notifications: state.notifications,
    liveCursors: state.liveCursors,
    userPresence: state.userPresence,
    // Enhanced project collaboration state
    sharedProject: state.sharedProject,
    projectOwner: state.projectOwner,
    projectCollaborationMode: state.projectCollaborationMode,
    projectAccessLevels: state.projectAccessLevels,
    
    // Actions
    updateCursor,
    updateFileActivity,
    getUserColor,
    // Project sharing actions
    initializeProjectShare,
    updateUserAccessRights,
    broadcastFileActivity,
    broadcastCursorPosition,
    updateUserPresence,
    removeNotification,
    
    // Enhanced project collaboration methods
    shareProjectInSession: (projectData, permissions = {}) => {
      if (!socket || !session || !user) {
        console.warn('Cannot share project: No active session');
        return false;
      }
      
      const userId = user.id || user.uid;
      const allPermissions = {
        [userId]: 'owner',
        ...permissions
      };
      
      // Set local state
      dispatch({ type: COLLAB_ACTIONS.SET_SHARED_PROJECT, payload: projectData });
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_OWNER, payload: userId });
      dispatch({ 
        type: COLLAB_ACTIONS.UPDATE_PROJECT_ACCESS, 
        payload: { userId, accessLevel: 'owner' }
      });
      
      // Broadcast to session
      socket.emit('project_shared', {
        sessionId: session.id,
        projectData,
        permissions: allPermissions,
        ownerId: userId,
        ownerName: user.name || user.displayName || 'User'
      });
      
      console.log('📡 Shared project in session:', projectData.name);
      return true;
    },
    
    updateProjectAccess: (userId, accessLevel) => {
      if (!socket || !session || !state.sharedProject) return false;
      
      const currentUserId = user?.id || user?.uid;
      if (state.projectOwner !== currentUserId) {
        console.warn('Only project owner can update access levels');
        return false;
      }
      
      dispatch({ 
        type: COLLAB_ACTIONS.UPDATE_PROJECT_ACCESS, 
        payload: { userId, accessLevel }
      });
      
      socket.emit('project_access_updated', {
        sessionId: session.id,
        userId,
        accessLevel,
        updatedBy: currentUserId
      });
      
      return true;
    },
    
    leaveProjectCollaboration: () => {
      dispatch({ type: COLLAB_ACTIONS.SET_PROJECT_COLLABORATION_MODE, payload: false });
      
      if (socket && session) {
        socket.emit('leave_project_collaboration', {
          sessionId: session.id,
          userId: user?.id || user?.uid
        });
      }
    },
    
    getProjectAccessLevel: (userId) => {
      if (!state.projectCollaborationMode || !state.sharedProject) return null;
      
      // Project owner always has owner access
      if (userId === state.projectOwner) return 'owner';
      
      // Check project-specific access levels
      return state.projectAccessLevels.get(userId) || 'viewer';
    },
    
    canEditProject: (userId = null) => {
      const targetUserId = userId || (user?.id || user?.uid);
      const accessLevel = value.getProjectAccessLevel(targetUserId);
      return ['owner', 'editor'].includes(accessLevel);
    },
    
    canManageProject: (userId = null) => {
      const targetUserId = userId || (user?.id || user?.uid);
      return value.getProjectAccessLevel(targetUserId) === 'owner';
    },
    
    // Role management functions
    setSessionOwner: (userId) => {
      dispatch({ type: COLLAB_ACTIONS.SET_SESSION_OWNER, payload: userId });
    },
    
    updateCollaboratorRole: (userId, role) => {
      if (!session || !user) return;
      
      // Only session owner can change roles
      if (session.creatorId !== (user.id || user.uid)) {
        console.warn('Only session owner can change collaborator roles');
        return;
      }
      
      dispatch({
        type: COLLAB_ACTIONS.UPDATE_COLLABORATOR_ROLE,
        payload: { userId, role }
      });
      
      // Broadcast role change to server
      if (socket) {
        socket.emit('update_collaborator_role', {
          sessionId: session.id,
          userId,
          role,
          updatedBy: user.id || user.uid
        });
      }
    },
    
    getUserRole: (userId) => {
      // If not in a session, no roles apply
      if (!session) return null;
      
      // Session creator is always owner
      if (session.creatorId === userId) return 'owner';
      
      // Return role from userRoles map
      return state.userRoles.get(userId) || 'editor';
    },
    
    isSessionOwner: (userId) => {
      return session?.creatorId === userId;
    },
    
    canManageRoles: (userId) => {
      // Only session owner can manage roles
      return session?.creatorId === userId;
    },
    
    // Getters
    getCursorsForFile: (filePath) => {
      const cursors = [];
      for (const [userId, cursorData] of state.cursors) {
        if (cursorData.filePath === filePath) {
          cursors.push(cursorData);
        }
      }
      return cursors;
    },
    
    getCollaboratorsArray: () => Array.from(state.collaborators.values()),
    
    getFileActivitiesArray: () => Array.from(state.fileActivities.values()),
    
    // Helper to check if anyone is editing a specific file
    isFileBeingEdited: (filePath) => {
      for (const [userId, cursorData] of state.cursors) {
        if (cursorData.filePath === filePath && userId !== (user?.id || user?.uid)) {
          return true;
        }
      }
      return false;
    },

    // Helper to get edit conflicts for a file
    getEditConflicts: (filePath) => {
      return state.editConflicts.get(filePath) || null;
    },

    // Helper to check if there are any conflicts in the current file
    hasEditConflicts: (filePath) => {
      return state.editConflicts.has(filePath);
    },
    
    // Access control helpers
    getUserAccessLevel: (userId) => state.accessRights.get(userId) || 'editor',
    canUserEdit: (userId) => ['owner', 'editor'].includes(state.accessRights.get(userId)),
    canUserManage: (userId) => state.accessRights.get(userId) === 'owner',
    isProjectOwner: (userId) => state.accessRights.get(userId) === 'owner',
    
    // File activity helpers
    getFileActivity: (filePath) => state.fileActivities.get(filePath),
    isFileActive: (filePath) => {
      const activity = state.fileActivities.get(filePath);
      return activity && (Date.now() - activity.timestamp) < 30000; // Active within 30 seconds
    },
    
    // Live cursor helpers
    getFileCursors: (filePath) => state.liveCursors.get(filePath) || new Map(),
    
    // Collaborator helpers
    getActiveCollaborators: () => Array.from(state.collaborators.entries()),
    isUserOnline: (userId) => {
      const presence = state.userPresence.get(userId);
      return presence && presence.isOnline;
    }
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

// Hook to use the collaboration context
export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};

// Export both named and default exports for compatibility
export { CollaborationContext };
export default CollaborationContext;

// Utility functions for project template operations

// Create project structure from template
const createProjectFromTemplate = async (template, projectData) => {
  const structure = new Map();
  
  switch (template) {
    case 'nodejs':
      structure.set('package.json', {
        type: 'file',
        content: JSON.stringify({
          name: projectData.name.toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          description: projectData.description,
          main: 'index.js',
          scripts: {
            start: 'node index.js',
            dev: 'node --watch index.js'
          },
          dependencies: {
            express: '^4.18.0'
          }
        }, null, 2)
      });
      structure.set('index.js', {
        type: 'file',
        content: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from ${projectData.name}!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
      });
      structure.set('README.md', {
        type: 'file',
        content: `# ${projectData.name}

${projectData.description}

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`
`
      });
      break;
      
    case 'react':
      structure.set('package.json', {
        type: 'file',
        content: JSON.stringify({
          name: projectData.name.toLowerCase().replace(/\s+/g, '-'),
          version: '0.1.0',
          description: projectData.description,
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            'react-scripts': '5.0.1'
          },
          scripts: {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test',
            eject: 'react-scripts eject'
          }
        }, null, 2)
      });
      structure.set('public/index.html', {
        type: 'file',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${projectData.name}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`
      });
      structure.set('src/App.js', {
        type: 'file',
        content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>${projectData.name}</h1>
        <p>${projectData.description}</p>
      </header>
    </div>
  );
}

export default App;`
      });
      structure.set('src/index.js', {
        type: 'file',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
      });
      structure.set('src/App.css', {
        type: 'file',
        content: `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}`
      });
      structure.set('src/index.css', {
        type: 'file',
        content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`
      });
      break;
      
    case 'python':
      structure.set('main.py', {
        type: 'file',
        content: `#!/usr/bin/env python3
"""
${projectData.name}
${projectData.description}
"""

def main():
    print("Hello from ${projectData.name}!")

if __name__ == "__main__":
    main()`
      });
      structure.set('requirements.txt', {
        type: 'file',
        content: `# Add your dependencies here
requests>=2.28.0`
      });
      structure.set('README.md', {
        type: 'file',
        content: `# ${projectData.name}

${projectData.description}

## Getting Started

\`\`\`bash
pip install -r requirements.txt
python main.py
\`\`\`
`
      });
      break;
      
    case 'flask':
      structure.set('app.py', {
        type: 'file',
        content: `from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def hello():
    return jsonify({"message": "Hello from ${projectData.name}!"})

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({"data": "Sample data", "status": "success"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)`
      });
      structure.set('requirements.txt', {
        type: 'file',
        content: `Flask>=2.3.0
Flask-CORS>=4.0.0
python-dotenv>=1.0.0`
      });
      structure.set('README.md', {
        type: 'file',
        content: `# ${projectData.name}

${projectData.description}

## Getting Started

\`\`\`bash
pip install -r requirements.txt
python app.py
\`\`\`

The server will run on http://localhost:5000
`
      });
      break;
      
    default:
      structure.set('README.md', {
        type: 'file',
        content: `# ${projectData.name}

${projectData.description}

Start building your project here!
`
      });
      break;
  }
  
  return structure;
};

const getTemplateDependencies = (template) => {
  const deps = {
    nodejs: ['express'],
    react: ['react', 'react-dom', 'react-scripts'],
    python: ['requests'],
    flask: ['flask', 'flask-cors', 'python-dotenv'],
    blank: []
  };
  
  return deps[template] || [];
};
