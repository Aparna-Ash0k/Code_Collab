import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { sessionManager } from '../utils/firebase';
// Removed virtualFileSystem import - now using UnifiedFileSystem
import { ProjectManager } from '../utils/ProjectManager';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { FirebaseFileService } from '../services/FirebaseFileService';
import { useCollaboration } from './CollaborationContext';
// Removed unused imports - now using UnifiedFileSystem
import { permissionSystem, PermissionSystem } from '../services/PermissionSystem';
import { projectSyncService } from '../services/RealTimeProjectSync';
import { realTimeFileSync } from '../services/RealTimeFileSync';
import PathUtils from '../utils/PathUtils';
// FileSystemContext provides unified file system operations through Yjs integration
import { UnifiedFileSystem } from '../services/UnifiedFileSystem';
import { useSharedState } from './SharedStateManager';
import { getUnifiedFileSystem } from '../services/UnifiedFileSystem';

// Action types for Project System
const ACTIONS = {
  // Tab management
  SET_TABS: 'SET_TABS',
  ADD_TAB: 'ADD_TAB',
  CLOSE_TAB: 'CLOSE_TAB',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  UPDATE_TAB: 'UPDATE_TAB',
  UPDATE_TAB_CONTENT: 'UPDATE_TAB_CONTENT',
  UPDATE_TAB_PATH: 'UPDATE_TAB_PATH',
  MARK_TAB_DIRTY: 'MARK_TAB_DIRTY',
  MARK_TAB_SAVED: 'MARK_TAB_SAVED',
  
  // Project management
  SET_PROJECTS: 'SET_PROJECTS',
  ADD_PROJECT: 'ADD_PROJECT',
  UPDATE_PROJECT: 'UPDATE_PROJECT',
  DELETE_PROJECT: 'DELETE_PROJECT',
  SET_ACTIVE_PROJECT: 'SET_ACTIVE_PROJECT',
  
  // File tree (from active project)
  SET_FILE_TREE: 'SET_FILE_TREE',
  LOAD_WORKSPACE: 'LOAD_WORKSPACE',
  ADD_FILE: 'ADD_FILE',
  UPDATE_FILE: 'UPDATE_FILE', 
  DELETE_FILE: 'DELETE_FILE',
  ADD_FOLDER: 'ADD_FOLDER',
  DELETE_FOLDER: 'DELETE_FOLDER',
  
  // General
  SET_LOADING: 'SET_LOADING',
  ADD_RECENT_FILE: 'ADD_RECENT_FILE',
  CLEAR_RECENT_FILES: 'CLEAR_RECENT_FILES',
  SET_PROJECT_TEMPLATES: 'SET_PROJECT_TEMPLATES'
};

// Initial state for Project System
const initialState = {
  // Tab management (same as before)
  tabs: [],
  activeTab: null,
  recentFiles: [],
  
  // Project management
  projects: new Map(), // projectId -> { id, name, description, type, fileTree, metadata, lastModified }
  activeProject: null, // Current project being worked on
  
  // File tree (from active project)
  fileTree: [],
  
  // Project templates
  projectTemplates: [
    { id: 'blank', name: 'Blank Project', description: 'Start with an empty project' },
    { id: 'javascript', name: 'JavaScript Project', description: 'Basic JavaScript project with HTML' },
    { id: 'nodejs', name: 'Node.js Project', description: 'Node.js project with Express' },
    { id: 'react', name: 'React App', description: 'React application with modern setup' },
    { id: 'python', name: 'Python Project', description: 'Python project with basic structure' },
    { id: 'flask', name: 'Flask API', description: 'Python Flask API project' }
  ],
  
  // General state
  loading: false
};

// Enhanced reducer for Project System
const projectSystemReducer = (state, action) => {
  switch (action.type) {
    // Tab management (same as before)
    case ACTIONS.SET_TABS:
      return { ...state, tabs: action.payload };
    case ACTIONS.ADD_TAB:
      return { 
        ...state, 
        tabs: [...state.tabs, action.payload],
        activeTab: action.payload.id 
      };
    case ACTIONS.CLOSE_TAB:
      const remainingTabs = state.tabs.filter(tab => tab.id !== action.payload);
      let newActiveTab = state.activeTab;
      
      if (state.activeTab === action.payload) {
        if (remainingTabs.length > 0) {
          const closedIndex = state.tabs.findIndex(tab => tab.id === action.payload);
          const nextIndex = Math.min(closedIndex, remainingTabs.length - 1);
          newActiveTab = remainingTabs[nextIndex].id;
        } else {
          newActiveTab = null;
        }
      }
      
      return { 
        ...state, 
        tabs: remainingTabs,
        activeTab: newActiveTab
      };
    case ACTIONS.SET_ACTIVE_TAB:
      return { ...state, activeTab: action.payload };
    case ACTIONS.UPDATE_TAB:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload.tabId 
            ? { ...tab, ...action.payload.updates }
            : tab
        )
      };
    case ACTIONS.UPDATE_TAB_CONTENT:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload.tabId 
            ? { ...tab, content: action.payload.content, isDirty: action.payload.isDirty }
            : tab
        )
      };
    case ACTIONS.UPDATE_TAB_PATH:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload.tabId 
            ? { ...tab, filePath: action.payload.filePath, fileName: action.payload.fileName }
            : tab
        )
      };
    case ACTIONS.MARK_TAB_DIRTY:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload 
            ? { ...tab, isDirty: true }
            : tab
        )
      };
    case ACTIONS.MARK_TAB_SAVED:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === action.payload 
            ? { ...tab, isDirty: false }
            : tab
        )
      };
    
    // Project management
    case ACTIONS.SET_PROJECTS:
      return { ...state, projects: new Map(action.payload) };
    case ACTIONS.ADD_PROJECT:
      const newProjects = new Map(state.projects);
      newProjects.set(action.payload.id, action.payload);
      return { ...state, projects: newProjects };
    case ACTIONS.UPDATE_PROJECT:
      const updatedProjects = new Map(state.projects);
      const existingProject = updatedProjects.get(action.payload.id);
      if (existingProject) {
        updatedProjects.set(action.payload.id, { ...existingProject, ...action.payload.updates });
      }
      return { ...state, projects: updatedProjects };
    case ACTIONS.DELETE_PROJECT:
      const projectsAfterDelete = new Map(state.projects);
      projectsAfterDelete.delete(action.payload);
      return { 
        ...state, 
        projects: projectsAfterDelete,
        activeProject: state.activeProject === action.payload ? null : state.activeProject
      };
    case ACTIONS.SET_ACTIVE_PROJECT:
      return { ...state, activeProject: action.payload };
    
    // File tree
    case ACTIONS.SET_FILE_TREE:
      return { ...state, fileTree: action.payload };
      
    case ACTIONS.LOAD_WORKSPACE:
      // Load a complete workspace (for room collaboration)
      return { 
        ...state, 
        fileTree: action.payload.files || [], 
        // Could also update projects, folders, etc. based on payload
      };
      
    case ACTIONS.ADD_FILE:
      // Add a single file to the tree (for real-time updates)
      const newFileTree = [...(state.fileTree || [])];
      // Simple add - in practice you'd need to handle proper tree insertion
      newFileTree.push(action.payload);
      return { ...state, fileTree: newFileTree };
      
    case ACTIONS.UPDATE_FILE:
      // Update file content in tree
      const updatedTree = (state.fileTree || []).map(item => 
        item.path === action.payload.path 
          ? { ...item, content: action.payload.content }
          : item
      );
      return { ...state, fileTree: updatedTree };
      
    case ACTIONS.DELETE_FILE:
      // Remove file from tree
      const filteredTree = (state.fileTree || []).filter(item => 
        item.path !== action.payload.path
      );
      return { ...state, fileTree: filteredTree };
      
    case ACTIONS.ADD_FOLDER:
      // Add folder to tree
      const treeWithFolder = [...(state.fileTree || [])];
      treeWithFolder.push(action.payload);
      return { ...state, fileTree: treeWithFolder };
      
    case ACTIONS.DELETE_FOLDER:
      // Remove folder and its contents
      const treeWithoutFolder = (state.fileTree || []).filter(item => 
        !item.path.startsWith(action.payload.path)
      );
      return { ...state, fileTree: treeWithoutFolder };
    
    // General
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.ADD_RECENT_FILE:
      const newFile = action.payload;
      const existingFiles = state.recentFiles.filter(f => f.filePath !== newFile.filePath);
      return {
        ...state,
        recentFiles: [newFile, ...existingFiles].slice(0, 10) // Keep only 10 recent files
      };
    case ACTIONS.CLEAR_RECENT_FILES:
      return { ...state, recentFiles: [] };
    case ACTIONS.SET_PROJECT_TEMPLATES:
      return { ...state, projectTemplates: action.payload };
    
    default:
      return state;
  }
};

// Create context (renamed for clarity)
const ProjectSystemContext = createContext(null);

// Generate unique ID for tabs and projects
let tabIdCounter = 0;
let projectIdCounter = 0;
const generateTabId = () => {
  tabIdCounter++;
  return `tab_${Date.now()}_${tabIdCounter}_${Math.random().toString(36).substr(2, 6)}`;
};
const generateProjectId = () => {
  projectIdCounter++;
  return `project_${Date.now()}_${projectIdCounter}_${Math.random().toString(36).substr(2, 6)}`;
};

// Provider component - renamed and enhanced for Project System
export const ProjectSystemProvider = ({ children }) => {
  const [state, dispatch] = useReducer(projectSystemReducer, initialState);
  const { user, token } = useAuth();
  const { socket, session } = useSession();
  const { state: sharedState, actions: sharedActions, getters: sharedGetters } = useSharedState();
  
  // Initialize ProjectManager with user context
  const projectManager = useRef(null);
  
  // Initialize UnifiedFileSystem for collaboration and file operations
  const unifiedFileSystem = useRef(null);
  const unifiedFileSystemRef = useRef(null); // Alias for consistency
  
  // Virtual File System reference for legacy compatibility
  const virtualFileSystem = { current: null }; // Initialize as object with current property
  
  // Safely get collaboration context (might not be available yet)
  let collaboration = null;
  try {
    collaboration = useCollaboration();
  } catch (error) {
    // CollaborationProvider not available yet - that's okay
    console.debug('Collaboration context not available yet:', error.message);
  }
  
  // Refs for stable references
  const stateRef = useRef(state);
  const socketRef = useRef(null);
  const updateTabContentRef = useRef(null);
  const openFileRef = useRef(null);
  const refreshFileTreeRef = useRef(null);

  // Update state ref whenever state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // **NEW: Helper function to update workspace state in database**
  const updateWorkspaceState = (updateType, path, additionalData = {}) => {
    // Only send updates if we're in a collaborative session
    if (socket && socket.connected && socket.sessionId && session?.id) {
      try {
        const updateData = {
          type: updateType,
          path: path,
          ...additionalData
        };
        
        console.log(`🔄 Updating workspace state: ${updateType} ${path}`);
        
        socket.emit('update_workspace_state', {
          sessionId: session.id,
          updateData: updateData
        });
      } catch (error) {
        console.error('Failed to update workspace state:', error);
        // Don't throw error, just log it so file operations continue
      }
    }
  };

  // Helper function to get current room ID (if in collaboration mode)
  const getRoomId = () => {
    // Check localStorage for active room
    const activeRoom = localStorage.getItem('activeCollaborationRoom');
    if (activeRoom) {
      try {
        const roomData = JSON.parse(activeRoom);
        return roomData.roomId;
      } catch (e) {
        console.warn('Failed to parse active room data');
      }
    }
    return null;
  };

  // Initialize ProjectManager when user is available
  useEffect(() => {
    if (user && !projectManager.current) {
      projectManager.current = new ProjectManager(user.id || user.uid);
      
      // Add listener to sync project changes to state
      projectManager.current.addListener((projects, activeProjectId) => {
        dispatch({ type: ACTIONS.SET_PROJECTS, payload: projects });
        dispatch({ type: ACTIONS.SET_ACTIVE_PROJECT, payload: activeProjectId });
        
        // Update file tree from active project
        if (activeProjectId) {
          const activeProject = projects.get(activeProjectId);
          if (activeProject) {
            const flatFiles = unifiedFileSystemRef.current?.getFilesArray() || [];
            const hierarchicalTree = value.buildHierarchicalTree ? value.buildHierarchicalTree(flatFiles) : flatFiles;
            dispatch({ type: ACTIONS.SET_FILE_TREE, payload: hierarchicalTree });
          }
        }
      });
      
      console.log('📂 ProjectManager initialized for user:', user.id || user.uid);
    }
  }, [user]);

  // Initialize UnifiedFileSystem when user is available (with loop prevention)
  const initializationRef = useRef(false);
  useEffect(() => {
    if (user && !unifiedFileSystem.current && !initializationRef.current) {
      initializationRef.current = true; // Prevent multiple initializations
      
      const initializeUnifiedFileSystem = async () => {
        try {
          unifiedFileSystem.current = getUnifiedFileSystem();
          unifiedFileSystemRef.current = unifiedFileSystem.current; // Set alias
          virtualFileSystem.current = unifiedFileSystem.current; // Set legacy alias
          
          await unifiedFileSystem.current.initialize({
            user,
            token,
            session,
            socket: socketRef.current,
            workspaceProvider: async () => {
              // Export current workspace from tabs and file system
              const currentFiles = new Map();
              const folders = new Set();
              
              // First, get files from file system (all existing files)
              try {
                const fileSystemFiles = unifiedFileSystem.current?.getFilesArray?.() || [];
                console.log(`📁 Found ${fileSystemFiles.length} files in file system:`, fileSystemFiles.map(f => f.path || f.name));
                
                fileSystemFiles.forEach(file => {
                  if (file.type === 'folder') {
                    folders.add(file.path || file.name);
                  } else if (file.path || file.name) {
                    const filePath = file.path || file.name;
                    currentFiles.set(filePath, {
                      name: file.name || filePath.split('/').pop(),
                      content: file.content || '',
                      type: file.type || 'file',
                      size: file.size || file.content?.length || 0,
                      lastModified: file.lastModified || Date.now(),
                      createdAt: file.createdAt || Date.now()
                    });
                  }
                });
              } catch (error) {
                console.warn('📁 Error getting files from file system:', error);
              }
              
              // Then, override with files from active tabs (most up-to-date content)
              const currentTabs = stateRef.current.tabs || [];
              currentTabs.forEach(tab => {
                if (tab.filePath && tab.content !== undefined) {
                  currentFiles.set(tab.filePath, {
                    name: tab.fileName,
                    content: tab.content,
                    type: tab.type || 'file',
                    size: tab.content?.length || 0,
                    lastModified: Date.now(),
                    createdAt: Date.now()
                  });
                }
              });
              
              console.log(`📁 Workspace provider: exporting ${currentFiles.size} files, ${folders.size} folders`);
              console.log('📁 Files being exported:', Array.from(currentFiles.keys()));
              return { 
                files: currentFiles, 
                folders: folders, 
                tree: stateRef.current.fileTree || []
              };
            }
          });

          // Set up event listeners with debounced dispatch to prevent loops
          let updateTimeoutId = null;
          const debouncedFileTreeUpdate = (newTree) => {
            if (updateTimeoutId) clearTimeout(updateTimeoutId);
            updateTimeoutId = setTimeout(() => {
              dispatch({ type: ACTIONS.SET_FILE_TREE, payload: newTree });
            }, 100);
          };

          unifiedFileSystem.current.on('connected', ({ sessionId, userId, isHost }) => {
            console.log(`🔗 UnifiedFileSystem connected to session ${sessionId} as ${isHost ? 'HOST' : 'MEMBER'}`);
          });

          unifiedFileSystem.current.on('workspace_synced', ({ fileCount, folderCount }) => {
            console.log(`✅ Workspace synced: ${fileCount} files, ${folderCount} folders`);
            // Use debounced update to prevent infinite loops
            const newTree = unifiedFileSystem.current?.getFilesArray?.() || [];
            debouncedFileTreeUpdate(newTree);
          });

          unifiedFileSystem.current.on('file_changed', ({ filePath, content, source }) => {
            console.log(`📝 File changed via ${source}: ${filePath}`);
            
            // Update or create tab for this file (without causing loops)
            const currentTabs = stateRef.current.tabs || [];
            let existingTab = currentTabs.find(tab => tab.filePath === filePath);
            if (existingTab) {
              dispatch({
                type: ACTIONS.UPDATE_TAB_CONTENT,
                payload: { tabId: existingTab.id, content, isDirty: false }
              });
            } else {
              // Only create new tab if not already exists
              const fileName = filePath.split('/').pop();
              const newTab = {
                id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                fileName: fileName,
                filePath: filePath,
                content: content,
                isDirty: false,
                isActive: false,
                type: fileName.split('.').pop() || 'text'
              };
              dispatch({ type: ACTIONS.ADD_TAB, payload: newTab });
            }
          });

          unifiedFileSystem.current.on('file_created', ({ filePath, content }) => {
            console.log(`📝 File created: ${filePath}`);
            const newTree = unifiedFileSystem.current?.getFilesArray?.() || [];
            debouncedFileTreeUpdate(newTree);
          });

          unifiedFileSystem.current.on('file_deleted', ({ filePath }) => {
            console.log(`🗑️ File deleted: ${filePath}`);
            
            // Close tab if open
            const currentTabs = stateRef.current.tabs || [];
            const tabToClose = currentTabs.find(tab => tab.filePath === filePath);
            if (tabToClose) {
              dispatch({ type: ACTIONS.CLOSE_TAB, payload: tabToClose.id });
            }
            
            const newTree = unifiedFileSystem.current?.getFilesArray?.() || [];
            debouncedFileTreeUpdate(newTree);
          });

          unifiedFileSystem.current.on('folder_created', ({ folderPath }) => {
            console.log(`📁 Folder created: ${folderPath}`);
            const newTree = unifiedFileSystem.current?.getFilesArray?.() || [];
            debouncedFileTreeUpdate(newTree);
          });

          unifiedFileSystem.current.on('collaborator_joined', (collaborator) => {
            console.log(`👥 Collaborator joined: ${collaborator.name}`);
          });

          unifiedFileSystem.current.on('tree_updated', (tree) => {
            debouncedFileTreeUpdate(tree);
          });

          unifiedFileSystem.current.on('error', ({ type, error }) => {
            console.error(`❌ UnifiedFileSystem error (${type}):`, error);
          });

          // Listen for remote file operations from other users via FileSystemManager
          const fileSystemManager = unifiedFileSystem.current.getFileSystemManager();
          if (fileSystemManager) {
            // Create a named handler function for proper cleanup
            const handleOperationCompleted = (data) => {
              const { operation } = data;
              console.log('� RECEIVED remote-operation event in FileSystemContext (via fileSystemManager):', operation);
              console.log('🔄 Triggering file tree refresh after remote operation');
              // Use ref to call refresh function if available
              if (refreshFileTreeRef.current) {
                refreshFileTreeRef.current();
              } else {
                console.warn('⚠️ refreshFileTree function not yet available');
              }
            };
            
            // Store the handler reference for cleanup
            fileSystemManager._operationCompletedHandler = handleOperationCompleted;
            fileSystemManager.on('operation_completed', handleOperationCompleted);
            console.log('🎧 Operation_completed event listener registered on fileSystemManager');
          } else {
            console.warn('⚠️ FileSystemManager not available for operation_completed events');
          }

          console.log('🎯 UnifiedFileSystem initialized for user:', user.id || user.uid);
          
          // Add global test function for debugging
          window.testCreateFile = async (fileName = 'test.js', content = '// Test file\nconsole.log("Hello from test file!");') => {
            try {
              console.log('🧪 TEST: Creating file', fileName);
              await unifiedFileSystem.current.createFile(fileName, content);
              console.log('✅ TEST: File created successfully');
              
              // Force refresh
              setTimeout(() => {
                const newTree = unifiedFileSystem.current?.getFilesArray?.() || [];
                console.log('📁 TEST: File tree after creation:', newTree);
                dispatch({ type: ACTIONS.SET_FILE_TREE, payload: newTree });
                if (refreshFileTreeRef.current) {
                  refreshFileTreeRef.current();
                }
              }, 100);
            } catch (error) {
              console.error('❌ TEST: Error creating file:', error);
            }
          };
          
          window.testFileTree = () => {
            console.log('🧪 TEST: Current file tree state:');
            const currentTree = unifiedFileSystem.current?.getFilesArray?.() || [];
            console.log('📁 UnifiedFileSystem files:', currentTree);
            console.log('📁 Context state files:', stateRef.current?.fileTree || []);
            return { unifiedFS: currentTree, contextState: stateRef.current?.fileTree || [] };
          };
          
          // Create a welcome file if the workspace is empty (first time user experience)
          setTimeout(async () => {
            try {
              console.log('🔍 Checking if workspace is empty for welcome file...');
              const currentFiles = unifiedFileSystem.current?.getFilesArray?.() || [];
              console.log('📁 Current files in workspace:', currentFiles.length, currentFiles);
              
              if (currentFiles.length === 0) {
                console.log('📄 Creating welcome file for new user...');
                const welcomeContent = `// Welcome to CodeCollab! 🚀

// This is your first file. You can:
// 1. Edit this code and see real-time collaboration
// 2. Create new files and folders using the + button
// 3. Invite others to collaborate by sharing the session link

console.log("Hello, CodeCollab!");

// Try typing here and watch it sync in real-time!
`;
                
                await unifiedFileSystem.current.createFile('welcome.js', welcomeContent);
                console.log('✅ Welcome file created successfully');
                
                // Force immediate file tree refresh with multiple approaches
                setTimeout(() => {
                  console.log('🔄 Forcing file tree refresh after welcome file creation');
                  const newTree = unifiedFileSystem.current?.getFilesArray?.() || [];
                  console.log('📁 File tree after welcome file:', newTree.length, 'files:', newTree);
                  
                  // Update via dispatch
                  dispatch({ type: ACTIONS.SET_FILE_TREE, payload: newTree });
                  
                  // Also trigger refreshFileTree if available
                  if (refreshFileTreeRef.current) {
                    console.log('🔄 Calling refreshFileTree function');
                    refreshFileTreeRef.current();
                  } else {
                    console.warn('⚠️ refreshFileTree function not available yet');
                  }
                  
                  // Also try to emit an event for any listeners
                  const event = new CustomEvent('fileTreeUpdated', {
                    detail: { fileTree: newTree }
                  });
                  window.dispatchEvent(event);
                }, 500);
              } else {
                console.log('ℹ️ Workspace already has files, skipping welcome file creation');
              }
            } catch (error) {
              console.log('ℹ️ Could not create welcome file (this is normal):', error.message);
            }
          }, 2000); // Wait 2 seconds for everything to be properly initialized
          
          // Note: Real-time file sync will be initialized later when functions are available
          console.log('📝 UnifiedFileSystem ready for real-time sync integration');
        } catch (error) {
          console.error('❌ Failed to initialize UnifiedFileSystem:', error);
          initializationRef.current = false; // Allow retry on error
        }
      };

      initializeUnifiedFileSystem();
    }
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (unifiedFileSystem.current && initializationRef.current) {
        try {
          // Remove all event listeners to prevent further dispatch calls
          unifiedFileSystem.current.off('workspace_synced');
          unifiedFileSystem.current.off('file_changed');
          unifiedFileSystem.current.off('file_created');
          unifiedFileSystem.current.off('file_deleted');
          unifiedFileSystem.current.off('folder_created');
          unifiedFileSystem.current.off('tree_updated');
          unifiedFileSystem.current.off('error');
          
          // Clean up FileSystemManager event listeners
          const fileSystemManager = unifiedFileSystem.current.getFileSystemManager();
          if (fileSystemManager && fileSystemManager._operationCompletedHandler) {
            fileSystemManager.off('operation_completed', fileSystemManager._operationCompletedHandler);
            delete fileSystemManager._operationCompletedHandler;
            console.log('🧹 Operation_completed event listener cleaned up (fileSystemManager)');
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup UnifiedFileSystem listeners:', cleanupError);
        }
      }
    };
  }, [user]);

  // Connect to session when socket and session are available (with loop prevention)
  const sessionConnectionRef = useRef(false);
  useEffect(() => {
    if (unifiedFileSystem.current && socketRef.current && session && user && !sessionConnectionRef.current) {
      sessionConnectionRef.current = true; // Prevent multiple connections
      const isHost = session.creatorId === (user.id || user.uid);
      unifiedFileSystem.current.connectToSession(socketRef.current, session.id, user.id || user.uid, isHost)
        .then(() => {
          console.log('✅ UnifiedFileSystem connected to session');
        })
        .catch(error => {
          console.error('Failed to connect UnifiedFileSystem to session:', error);
          sessionConnectionRef.current = false; // Allow retry on error
        });
    }
  }, [session, user]);

  // Load user projects on authentication (with loop prevention)
  const projectLoadRef = useRef(false);
  useEffect(() => {
    if (!user || !projectManager.current || projectLoadRef.current) return;
    
    projectLoadRef.current = true; // Prevent multiple loads
    
    const loadUserProjects = async () => {
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        console.log('🔄 Loading user projects for:', user.id);
        
        const firebaseFileService = new FirebaseFileService();
        const result = await firebaseFileService.loadUserProjects(user.id);
        
        if (result.success && result.data) {
          // Load projects into ProjectManager
          projectManager.current.loadFromData(result.data);
          
          // If there's an active project, load it into VFS
          if (result.data.activeProject) {
            const activeProject = projectManager.current.projects.get(result.data.activeProject);
            if (activeProject) {
              projectManager.current.loadProjectIntoVFS(activeProject);
              dispatch({ type: ACTIONS.SET_ACTIVE_PROJECT, payload: result.data.activeProject });
              
              // Restore previous session tabs for this project
              const restoredState = await restoreProjectSession(result.data.activeProject);
              if (restoredState.tabs.length > 0) {
                const restoredTabs = restoredState.tabs.map(tab => {
                  if (tab.filePath && unifiedFileSystemRef.current?.hasFile(tab.filePath)) {
                    const fileData = unifiedFileSystemRef.current?.readFile(tab.filePath);
                    return {
                      ...tab,
                      content: fileData.content,
                      isDirty: fileData.isDirty || false
                    };
                  }
                  return tab;
                });
                
                dispatch({ type: ACTIONS.SET_TABS, payload: restoredTabs });
                dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: restoredState.activeTab });
                console.log(`✅ Restored ${restoredTabs.length} tabs for project`);
              }
            }
          }
          
          console.log(`✅ Loaded ${projectManager.current.projects.size} projects`);
        } else {
          console.log('📁 No saved projects found, creating welcome project');
          createWelcomeProject();
        }
      } catch (error) {
        console.error('Failed to load user projects:', error);
        createWelcomeProject();
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    };

    // Function to restore project session state from localStorage
    const restoreProjectSession = async (projectId) => {
      try {
        const sessionData = localStorage.getItem(`codecollab_project_${user.id}_${projectId}`);
        if (sessionData) {
          const parsedSession = JSON.parse(sessionData);
          console.log('🔄 Restoring project session state:', parsedSession);
          return parsedSession;
        }
      } catch (error) {
        console.warn('Failed to restore project session state:', error);
      }
      return { tabs: [], activeTab: null };
    };

    // Create welcome project for new users
    const createWelcomeProject = () => {
      const welcomeProject = projectManager.current.createProject(
        'My First Project',
        'Welcome to CodeCollab! This is your first project.',
        'javascript'
      );
      
      projectManager.current.setActiveProject(welcomeProject.id);
      
      // Create welcome tab
      const welcomeTab = {
        id: generateTabId(),
        fileName: 'README.md',
        filePath: 'README.md',
        isDirty: false,
        content: `# Welcome to Your Project System! 🎉

## 🚀 You're now using the enhanced Project System!

### ✨ New Features:
- ✅ **Multiple Projects**: Create and manage multiple projects
- ✅ **Project Templates**: Start with pre-configured templates
- ✅ **Real-time Collaboration**: Share projects with team members
- ✅ **Role-based Access**: Owner, Editor, and Viewer permissions
- ✅ **Project Persistence**: All your projects are saved automatically

### 📂 Your First Project
This project was created with the JavaScript template and includes:
- HTML, CSS, and JavaScript files
- Interactive examples
- Modern project structure

### 🔥 What You Can Do:
1. **Create New Projects**: Use the Project Switcher
2. **Share Projects**: Invite collaborators with different roles
3. **Switch Between Projects**: Each project has its own file system
4. **Use Templates**: Start with React, Node.js, Python, Flask, or blank templates

### 🎯 Next Steps:
1. Explore the files in this project
2. Create a new project with a different template
3. Invite friends to collaborate
4. Build something amazing!

**Your projects are automatically saved and synced across devices.**

Happy coding! 🚀
`
      };
      
      dispatch({ type: ACTIONS.SET_TABS, payload: [welcomeTab] });
      dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: welcomeTab.id });
    };

    loadUserProjects();
  }, [user]);

  // Auto-save projects and session state
  useEffect(() => {
    if (!user || !projectManager.current) return;

    const autoSaveInterval = setInterval(async () => {
      if (!state.loading && projectManager.current.projects.size > 0) {
        try {
          // Save current VFS state to active project
          if (state.activeProject) {
            projectManager.current.saveActiveProjectFromVFS();
          }
          
          // Sync projects to Firebase
          const firebaseFileService = new FirebaseFileService();
          const projectsData = projectManager.current.serialize();
          await firebaseFileService.syncUserProjects(user.id, projectsData);
          
          // Save current project session state
          if (state.activeProject) {
            saveProjectSession(state.activeProject);
          }
          
          console.log('💾 Auto-saved projects and session state');
        } catch (error) {
          console.warn('Auto-save failed:', error);
        }
      }
    }, 30000); // Auto-save every 30 seconds

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [user, state.loading, state.activeProject, state.tabs, state.activeTab]);

  // Save project session state
  const saveProjectSession = useCallback((projectId) => {
    if (!user || !projectId) return;
    
    try {
      const sessionState = {
        tabs: state.tabs.map(tab => ({
          id: tab.id,
          fileName: tab.fileName,
          filePath: tab.filePath,
          isDirty: tab.isDirty
        })),
        activeTab: state.activeTab,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(`codecollab_project_${user.id}_${projectId}`, JSON.stringify(sessionState));
      console.log('💾 Project session state saved');
    } catch (error) {
      console.warn('Failed to save project session state:', error);
    }
  }, [user, state.tabs, state.activeTab]);

  // VFS event handler to sync UI with VFS changes
  useEffect(() => {
    const handleVFSStateUpdate = () => {
      const updatedFileTree = unifiedFileSystemRef.current?.getFileTreeArray() || [];
      dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
    };

    handleVFSStateUpdate();
    window.addEventListener('vfs_state_update', handleVFSStateUpdate);
    
    return () => {
      window.removeEventListener('vfs_state_update', handleVFSStateUpdate);
    };
  }, []);

  // Project sharing and collaboration features
  useEffect(() => {
    if (!socket || !session) return;
    
    socketRef.current = socket;
    console.log('📂 ProjectSystem: Setting up collaboration for session:', session.id);

    // UnifiedFileSystem is now handling all synchronization through Yjs
    const userId = user?.id || user?.uid;
    if (userId) {
      console.log('🔄 UnifiedFileSystem handling real-time collaboration through Yjs');
    }

    // Handle project sharing initialization
    const handleProjectShare = (data) => {
      console.log('📁 Received project share:', data);
      
      if (data.sessionId !== session.id) return;
      
      const { projectData, ownerId, permissions } = data;
      
      // Set collaboration mode using SharedState
      sharedActions.setCollaborationMode(true);
      sharedActions.setSharedProject(projectData);
      
      // Set user role based on permissions
      const userId = user?.id || user?.uid;
      const userRole = permissions[userId] || 'viewer';
      sharedActions.setUserRole(userRole);
      sharedActions.setProjectPermissions(new Map(Object.entries(permissions)));
      
      // Load shared project into VFS
      if (projectData.fileTree) {
        const filesData = {};
        if (projectData.fileTree instanceof Map) {
          projectData.fileTree.forEach((fileData, path) => {
            filesData[path] = fileData;
          });
        } else {
          Object.assign(filesData, projectData.fileTree);
        }

        unifiedFileSystemRef.current?.loadFromData({
          files: filesData,
          folders: Array.from(projectData.folders || [])
        });
        
        // Update file tree
        const updatedFileTree = unifiedFileSystemRef.current?.getFileTreeArray() || [];
        dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
      }
      
      console.log(`📂 Loaded shared project: ${projectData.name} as ${userRole}`);
    };

    // Handle project updates from owner
    const handleProjectUpdate = async (data) => {
      if (data.sessionId !== session.id) return;
      
      console.log('🔄 Received project update:', data.operation);
      
      const { operation, path, fileData } = data;
      
      switch (operation) {
        case 'file_create':
          await unifiedFileSystemRef.current?.createFile(path, fileData.content || '');
          break;
        case 'file_update':
          await unifiedFileSystemRef.current?.updateFile(path, fileData.content);
          break;
        case 'file_delete':
          await unifiedFileSystemRef.current?.deleteFile(path);
          
          // Close related tabs
          const tabsToClose = state.tabs.filter(tab => 
            tab.filePath?.startsWith(path)
          );
          tabsToClose.forEach(tab => {
            dispatch({ type: ACTIONS.CLOSE_TAB, payload: tab.id });
          });
          break;
        case 'folder_create':
          await unifiedFileSystemRef.current?.createFolder(path);
          break;
        case 'folder_delete':
          await unifiedFileSystemRef.current?.deleteFolder(path);
          break;
      }
      
      // Update file tree
      const updatedFileTree = unifiedFileSystemRef.current?.getFileTreeArray() || [];
      dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
    };

    // Session file operations sync
    const handleVFSOperationSync = (event) => {
      const { operation, path: filePath, data } = event.detail;
      
      if (socketRef.current && socketRef.current.connected && session) {
        console.log('📡 Broadcasting file operation:', operation, filePath);
        
        const operationData = {
          sessionId: session.id,
          action: operation,
          path: filePath,
          data: data || {},
          userId: user?.id || user?.uid,
          timestamp: Date.now(),
          projectId: sharedState.sharedProject?.id || state.activeProject
        };
        
        console.log('🔄 File operation decision:', {
          hasSharedProject: !!sharedState.sharedProject,
          sharedProjectId: sharedState.sharedProject?.id,
          activeProject: state.activeProject,
          willUseProjectOperation: !!(sharedState.sharedProject?.id || state.activeProject),
          operation: operation,
          filePath: filePath
        });
        
        socketRef.current.emit('project_file_operation', operationData);
      }
    };

    // Register event listeners
    socket.on('project_shared', handleProjectShare);
    socket.on('project_file_operation', handleProjectUpdate);
    window.addEventListener('vfs_operation_sync', handleVFSOperationSync);
    
    return () => {
      socket.off('project_shared', handleProjectShare);
      socket.off('project_file_operation', handleProjectUpdate);
      window.removeEventListener('vfs_operation_sync', handleVFSOperationSync);
    };
  }, [session?.id, user, state.tabs, sharedState.sharedProject, state.activeProject]);

  // Real-time code synchronization system
  useEffect(() => {
    if (socket && session) {
      socketRef.current = socket;
      
      console.log('✅ FileSystem real-time sync enabled for session:', session.id);

      // Real-time code synchronization - handles typing-level changes
      socket.on('realtime_code_update', async (data) => {
        console.log('📝 Received real-time code update:', data.filePath, `(${data.content?.length || 0} chars)`);
        
        const { filePath, content, userId: authorId, sessionId, timestamp } = data;
        
        // Only process updates for current session
        if (sessionId !== session.id) {
          return;
        }
        
        // Skip own updates to prevent echo
        if (authorId === (user?.id || user?.uid)) {
          console.log('🔄 Skipping own code update echo');
          return;
        }
        
        // Use UnifiedFileSystem for conflict resolution through Yjs
        try {
          // UnifiedFileSystem handles the update through Yjs
          await unifiedFileSystemRef.current?.updateFile(filePath, content);
          
          // Find the tab for this file and update it
          const targetTab = stateRef.current.tabs.find(tab => 
            tab.filePath === filePath || 
            (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
          );
          
          if (targetTab) {
            console.log('🔄 Applying real-time code update to tab:', targetTab.fileName);
            // Apply update without broadcasting to prevent loops
            updateTabContentRef.current(targetTab.id, content, false);
            dispatch({ type: ACTIONS.MARK_TAB_SAVED, payload: targetTab.id });
          } else {
            console.log('ℹ️ No open tab found for real-time update:', filePath);
          }
          
        } catch (error) {
          console.error('❌ Failed to process real-time update:', error);
        }
      });

      // File content change synchronization (for typing-level sync)
      socket.on('file_content_update', async (data) => {
        console.log('🔤 Received file content update:', data.filePath, `(${data.content?.length || 0} chars)`);
        
        const { filePath, content, userId: authorId, sessionId, timestamp, selection, cursor } = data;
        
        // Only process updates for current session
        if (sessionId !== session.id) {
          return;
        }
        
        // Skip own updates to prevent echo
        if (authorId === (user?.id || user?.uid)) {
          console.log('🔄 Skipping own file content update echo');
          return;
        }
        
        try {
          // Find the tab for this file
          const targetTab = stateRef.current.tabs.find(tab => 
            tab.filePath === filePath || 
            (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
          );
          
          if (targetTab) {
            console.log('🔄 Applying file content update to tab:', targetTab.fileName);
            // Apply update without broadcasting to prevent loops
            updateTabContentRef.current(targetTab.id, content, false);
            dispatch({ type: ACTIONS.MARK_TAB_SAVED, payload: targetTab.id });
          } else {
            console.log('ℹ️ No open tab found for file content update:', filePath);
            // Update VFS through UnifiedFileSystem
            await unifiedFileSystemRef.current?.updateFile(filePath, content);
          }
          
          // Update file tree to reflect any changes
          const flatFiles = unifiedFileSystemRef.current?.getFilesArray() || [];
          const hierarchicalTree = value.buildHierarchicalTree ? value.buildHierarchicalTree(flatFiles) : flatFiles;
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: hierarchicalTree });
          
        } catch (error) {
          console.error('❌ Failed to process file content update:', error);
        }
      });

      // Virtual file system operation handler
      socket.on('virtual_fs_operation', async (data) => {
        console.log('🗂️ Received virtual FS update:', data.action, data.path);
        
        const { action, path: filePath, data: fileData, sessionId, userId: authorId, timestamp } = data;
        
        // Only process updates for current session
        if (sessionId !== session.id) {
          return;
        }
        
        // Skip own updates to prevent echo
        if (authorId === (user?.id || user?.uid)) {
          console.log('🔄 Skipping own VFS update echo');
          return;
        }
        
        try {
          switch (action) {
            case 'create':
            case 'create_file':
              if (fileData?.type === 'file') {
                virtualFileSystem.createFile(filePath, fileData.content || '', { notify: false });
                console.log('📄 VFS file created:', filePath);
              }
              break;
              
            case 'create_folder':
              virtualFileSystem.createFolder(filePath, { notify: false });
              console.log('📁 VFS folder created:', filePath);
              break;
              
            case 'update':
            case 'save':
              if (fileData && typeof fileData.content === 'string') {
                if (virtualFileSystem.current && virtualFileSystem.current.updateFile) {
                  virtualFileSystem.current.updateFile(filePath, fileData.content, { notify: false });
                }
                
                // Update any open tabs
                const targetTab = stateRef.current.tabs.find(tab => 
                  tab.filePath === filePath || 
                  (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
                );
                
                if (targetTab && updateTabContentRef.current) {
                  updateTabContentRef.current(targetTab.id, fileData.content, false);
                  dispatch({ type: ACTIONS.MARK_TAB_SAVED, payload: targetTab.id });
                }
                
                console.log('💾 VFS file updated:', filePath);
              }
              break;
              
            case 'delete':
              virtualFileSystem.delete(filePath, { notify: false });
              
              // Close any open tabs for this file
              const targetTab = stateRef.current.tabs.find(tab => 
                tab.filePath === filePath || 
                (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
              );
              
              if (targetTab) {
                dispatch({ type: ACTIONS.CLOSE_TAB, payload: targetTab.id });
              }
              
              console.log('🗑️ VFS file deleted:', filePath);
              break;
          }
          
          // Update file tree
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: virtualFileSystem.getFileTreeArray() });
          
        } catch (error) {
          console.error('❌ Failed to process VFS update:', error);
        }
      });

      // Virtual file system update handler for backward compatibility
      socket.on('virtual_fs_update', async (data) => {
        console.log('🗂️ Received virtual FS update:', data.action, data.path);
        
        const { action, path: filePath, data: fileData, sessionId, userId: authorId, timestamp } = data;
        
        // Only process updates for current session
        if (sessionId !== session.id) {
          return;
        }
        
        // Skip own updates to prevent echo
        if (authorId === (user?.id || user?.uid)) {
          console.log('🔄 Skipping own VFS update echo');
          return;
        }
        
        try {
          switch (action) {
            case 'create':
            case 'create_file':
              if (fileData?.type === 'file') {
                virtualFileSystem.createFile(filePath, fileData.content || '', { notify: false });
                console.log('📄 VFS file created:', filePath);
              }
              break;
              
            case 'create_folder':
              virtualFileSystem.createFolder(filePath, { notify: false });
              console.log('📁 VFS folder created:', filePath);
              break;
              
            case 'update':
            case 'save':
              if (fileData && typeof fileData.content === 'string') {
                if (virtualFileSystem.current && virtualFileSystem.current.updateFile) {
                  virtualFileSystem.current.updateFile(filePath, fileData.content, { notify: false });
                }
                
                // Update any open tabs
                const targetTab = stateRef.current.tabs.find(tab => 
                  tab.filePath === filePath || 
                  (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
                );
                
                if (targetTab && updateTabContentRef.current) {
                  updateTabContentRef.current(targetTab.id, fileData.content, false);
                  dispatch({ type: ACTIONS.MARK_TAB_SAVED, payload: targetTab.id });
                }
                
                console.log('💾 VFS file updated:', filePath);
              }
              break;
              
            case 'delete':
              virtualFileSystem.delete(filePath, { notify: false });
              
              // Close any open tabs for this file
              const targetTab = stateRef.current.tabs.find(tab => 
                tab.filePath === filePath || 
                (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
              );
              
              if (targetTab) {
                dispatch({ type: ACTIONS.CLOSE_TAB, payload: targetTab.id });
              }
              
              console.log('🗑️ VFS file deleted:', filePath);
              break;
          }
          
          // Update file tree
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: virtualFileSystem.getFileTreeArray() });
          
        } catch (error) {
          console.error('❌ Failed to process VFS update:', error);
        }
      });

      // Handle file_created events from server
      socket.on('file_created', async (data) => {
        console.log('📄 Received file_created event:', data);
        
        const { name, path: filePath, content = '', sessionId, createdBy } = data;
        
        // Only process events for current session
        if (sessionId !== session.id) {
          return;
        }
        
        // Skip own events to prevent echo
        if (createdBy === (user?.name || user?.displayName || user?.email)) {
          console.log('🔄 Skipping own file_created event echo');
          return;
        }
        
        try {
          console.log('📄 Processing file_created event from remote user');
          
          // Trigger file tree refresh - the file should already exist in the UnifiedFileSystem
          // through Y.js synchronization, we just need to refresh the UI
          if (typeof refreshFileTreeRef.current === 'function') {
            console.log('� Refreshing file tree after remote file creation');
            refreshFileTreeRef.current();
          } else {
            console.warn('⚠️ refreshFileTree function not available');
          }
        } catch (error) {
          console.error('❌ Failed to process file_created event:', error);
        }
      });

      // Handle folder_created events from server
      socket.on('folder_created', async (data) => {
        console.log('📁 Received folder_created event:', data);
        
        const { name, path: folderPath, sessionId, createdBy } = data;
        
        // Only process events for current session
        if (sessionId !== session.id) {
          return;
        }
        
        // Skip own events to prevent echo
        if (createdBy === (user?.name || user?.displayName || user?.email)) {
          console.log('🔄 Skipping own folder_created event echo');
          return;
        }
        
        try {
          console.log('📁 Processing folder_created event from remote user');
          
          // Trigger file tree refresh - the folder should already exist in the UnifiedFileSystem
          // through Y.js synchronization, we just need to refresh the UI
          if (typeof refreshFileTreeRef.current === 'function') {
            console.log('� Refreshing file tree after remote folder creation');
            refreshFileTreeRef.current();
          } else {
            console.warn('⚠️ refreshFileTree function not available');
          }
        } catch (error) {
          console.error('❌ Failed to process folder_created event:', error);
        }
      });

      // Project collaboration event handlers
      const handleProjectFileCreated = (event) => {
        const { filePath, file } = event.detail;
        console.log('🤝 Project file created:', filePath);
        
        // Add file to VFS
        virtualFileSystem.createFile(filePath, file.content, { notify: true });
      };

      const handleProjectFileUpdated = (event) => {
        const { filePath, file } = event.detail;
        console.log('🤝 Project file updated:', filePath);
        
        // Update file in VFS
        virtualFileSystem.writeFile(filePath, file.content, { notify: true });
        
        // Update any open tabs
        const targetTab = stateRef.current.tabs.find(tab => 
          tab.filePath === filePath || 
          (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
        );
        
        if (targetTab && updateTabContentRef.current) {
          updateTabContentRef.current(targetTab.id, file.content, false);
          dispatch({ type: ACTIONS.MARK_TAB_SAVED, payload: targetTab.id });
        }
      };

      const handleProjectFileDeleted = (event) => {
        const { filePath } = event.detail;
        console.log('🤝 Project file deleted:', filePath);
        
        // Remove file from VFS
        virtualFileSystem.deleteFile(filePath, { notify: true });
        
        // Close any open tabs for this file
        const targetTab = stateRef.current.tabs.find(tab => 
          tab.filePath === filePath || 
          (filePath && tab.filePath && tab.filePath.endsWith(filePath.split('/').pop()))
        );
        
        if (targetTab) {
          dispatch({ type: ACTIONS.CLOSE_TAB, payload: targetTab.id });
        }
      };

      const handleProjectFileRenamed = (event) => {
        const { oldPath, newPath } = event.detail;
        console.log('🤝 Project file renamed:', oldPath, '->', newPath);
        
        // Handle in VFS
        if (virtualFileSystem.fileExists(oldPath)) {
          const fileData = virtualFileSystem.readFile(oldPath);
          virtualFileSystem.deleteFile(oldPath, { notify: false });
          virtualFileSystem.createFile(newPath, fileData.content, { notify: true });
        }
        
        // Update any open tabs
        const targetTab = stateRef.current.tabs.find(tab => 
          tab.filePath === oldPath || 
          (oldPath && tab.filePath && tab.filePath.endsWith(oldPath.split('/').pop()))
        );
        
        if (targetTab) {
          dispatch({ 
            type: ACTIONS.UPDATE_TAB_PATH, 
            payload: { 
              tabId: targetTab.id, 
              filePath: newPath,
              fileName: newPath.split('/').pop()
            } 
          });
        }
      };

      const handleProjectFolderCreated = (event) => {
        const { folderPath } = event.detail;
        console.log('🤝 Project folder created:', folderPath);
        
        // Add folder to VFS
        virtualFileSystem.createFolder(folderPath, { notify: true });
      };

      const handleProjectFolderDeleted = (event) => {
        const { folderPath } = event.detail;
        console.log('🤝 Project folder deleted:', folderPath);
        
        // Remove folder from VFS
        virtualFileSystem.deleteFolder(folderPath, { notify: true });
        
        // Close any open tabs in this folder
        const tabsToClose = stateRef.current.tabs.filter(tab => 
          tab.filePath && tab.filePath.startsWith(folderPath + '/')
        );
        
        tabsToClose.forEach(tab => {
          dispatch({ type: ACTIONS.CLOSE_TAB, payload: tab.id });
        });
      };

      // Register project collaboration event listeners
      window.addEventListener('projectFileCreated', handleProjectFileCreated);
      window.addEventListener('projectFileUpdated', handleProjectFileUpdated);
      window.addEventListener('projectFileDeleted', handleProjectFileDeleted);
      window.addEventListener('projectFileRenamed', handleProjectFileRenamed);
      window.addEventListener('projectFolderCreated', handleProjectFolderCreated);
      window.addEventListener('projectFolderDeleted', handleProjectFolderDeleted);

      // File system operations are now handled by UnifiedFileSystem through Yjs

      // File creation events are now handled by UnifiedFileSystem through Yjs

      // Folder creation events are now handled by UnifiedFileSystem through Yjs

      // Session file state synchronization
      socket.on('session_files_state', (filesData) => {
        console.log('📁 Received session files state:', filesData?.length || 0, 'files');
        
        if (filesData && filesData.length > 0) {
          const vfsFiles = {};
          const vfsFolders = [];
          
          filesData.forEach(file => {
            if (file.type === 'folder') {
              vfsFolders.push(file.path);
            } else {
              vfsFiles[file.path] = {
                content: file.content || '',
                type: file.type || 'file',
                lastModified: file.lastModified || Date.now(),
                isDirty: false
              };
            }
          });
          
          // Load into virtual file system
          virtualFileSystem.loadFromData({
            files: vfsFiles,
            folders: vfsFolders
          });
          
          // Update UI
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: virtualFileSystem.getFileTreeArray() });
        }
      });

      // **NEW: Handle workspace state loaded from database**
      socket.on('workspace_state_loaded', async (data) => {
        console.log('🗃️ Workspace state loaded from database:', data);
        
        try {
          const { sessionId, workspaceData, metadata, version, ownerId, message } = data;
          
          // Only process if for current session
          if (sessionId !== session.id) {
            console.log('🔄 Ignoring workspace_state_loaded for different session');
            return;
          }
          
          console.log(`📋 Loading workspace state: ${Object.keys(workspaceData.files || {}).length} files, ${(workspaceData.folders || []).length} folders`);
          console.log(`📊 Workspace owner: ${ownerId}, version: ${version}`);
          
          // Load the complete workspace state into UnifiedFileSystem
          if (unifiedFileSystem.current) {
            // Prepare data for UnifiedFileSystem
            const filesData = {};
            const foldersArray = workspaceData.folders || [];
            
            // Convert files data format
            Object.entries(workspaceData.files || {}).forEach(([filePath, fileData]) => {
              filesData[filePath] = {
                content: fileData.content || '',
                type: fileData.type || 'text',
                lastModified: fileData.lastModified || Date.now(),
                modifiedBy: fileData.modifiedBy || ownerId,
                size: fileData.size || (fileData.content || '').length,
                isDirty: false
              };
            });
            
            console.log(`📁 Loading ${Object.keys(filesData).length} files and ${foldersArray.length} folders into UnifiedFileSystem`);
            
            // Load data into UnifiedFileSystem
            await unifiedFileSystem.current.loadFromData({
              files: filesData,
              folders: foldersArray,
              fileTree: workspaceData.fileTree || {}
            });
            
            // Update the file tree display
            const updatedFileTree = unifiedFileSystem.current.getFilesArray();
            dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
            
            console.log(`✅ Workspace state loaded successfully: ${updatedFileTree.length} items in file tree`);
            
            // Show notification to user
            dispatch({
              type: ACTIONS.ADD_NOTIFICATION,
              payload: {
                id: `workspace-loaded-${Date.now()}`,
                type: 'success',
                message: `Workspace loaded: ${Object.keys(workspaceData.files || {}).length} files from session owner`,
                duration: 4000
              }
            });
          } else {
            console.warn('⚠️ UnifiedFileSystem not available, cannot load workspace state');
          }
          
        } catch (error) {
          console.error('❌ Failed to load workspace state:', error);
          
          // Show error notification
          dispatch({
            type: ACTIONS.ADD_NOTIFICATION,
            payload: {
              id: `workspace-load-error-${Date.now()}`,
              type: 'error',
              message: 'Failed to load workspace state from database',
              duration: 5000
            }
          });
        }
      });

      // **NEW: Handle workspace state requests from server**
      socket.on('workspace_state_requested', async (data) => {
        console.log('🔄 Workspace state requested by server:', data);
        
        try {
          const { sessionId, requesterId, requesterName } = data;
          
          // Only respond if we're in the correct session
          if (sessionId !== session.id) {
            console.log('🔄 Ignoring workspace state request for different session');
            return;
          }
          
          // Export current workspace state using workspaceProvider
          if (typeof workspaceProvider === 'function') {
            console.log(`📤 Exporting workspace state for ${requesterName} (${requesterId})`);
            
            const workspaceData = workspaceProvider();
            
            // Send workspace state to database for storage
            socket.emit('store_workspace_state', {
              sessionId: session.id,
              workspaceData: workspaceData
            });
            
            console.log(`✅ Workspace state sent to database for ${requesterName}`);
          } else {
            console.warn('⚠️ workspaceProvider function not available');
          }
          
        } catch (error) {
          console.error('❌ Failed to handle workspace state request:', error);
        }
      });

      // Request initial session state
      if (socket.connected) {
        console.log('📡 Requesting initial session files state...');
        socket.emit('get_session_files');
      } else {
        // Wait for connection then request state
        const handleConnect = () => {
          console.log('📡 Socket connected, requesting session files state...');
          socket.emit('get_session_files');
          socket.off('connect', handleConnect);
        };
        socket.on('connect', handleConnect);
      }

      // Add robust event handler for file system synchronization issues
      const handleRemoteFileSystemUpdate = async (eventType, data) => {
        console.log(`🔄 Handling remote file system update: ${eventType}`, data);
        
        try {
          // Wait for any ongoing operations to complete
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Force file tree refresh with multiple fallback strategies
          let refreshSuccessful = false;
          
          // Strategy 1: Use the refreshFileTreeRef function
          if (typeof refreshFileTreeRef.current === 'function') {
            try {
              console.log('🔄 Attempting file tree refresh via refreshFileTreeRef');
              const result = await refreshFileTreeRef.current();
              console.log('✅ File tree refresh successful via refreshFileTreeRef');
              refreshSuccessful = true;
            } catch (error) {
              console.warn('⚠️ refreshFileTreeRef failed, trying fallback:', error);
            }
          }
          
          // Strategy 2: Direct dispatch update
          if (!refreshSuccessful) {
            try {
              console.log('🔄 Attempting direct file tree update via dispatch');
              const updatedFileTree = unifiedFileSystem.current?.getFilesArray() || [];
              console.log(`📁 Retrieved ${updatedFileTree.length} files for direct update`);
              
              dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
              console.log('✅ File tree updated successfully via direct dispatch');
              refreshSuccessful = true;
            } catch (error) {
              console.warn('⚠️ Direct dispatch failed, trying final fallback:', error);
            }
          }
          
          // Strategy 3: Force re-trigger of UnifiedFileSystem events
          if (!refreshSuccessful) {
            try {
              console.log('🔄 Attempting to trigger UnifiedFileSystem refresh');
              // Emit a custom event that other parts of the system can listen to
              const refreshEvent = new CustomEvent('forceFileTreeRefresh', {
                detail: { eventType, data, timestamp: Date.now() }
              });
              window.dispatchEvent(refreshEvent);
              console.log('✅ Forced file tree refresh event dispatched');
            } catch (error) {
              console.error('❌ All file tree refresh strategies failed:', error);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error handling ${eventType} event:`, error);
        }
      };
      
      // Enhanced file_created handler with robust error handling
      const enhancedFileCreatedHandler = async (data) => {
        console.log('📄 Enhanced file_created handler:', data);
        
        const { name, path: filePath, content = '', sessionId, createdBy, userId } = data;
        
        // Only process events for current session
        if (sessionId !== session.id) {
          console.log('🔄 Ignoring file_created event from different session');
          return;
        }
        
        // Skip own events to prevent echo
        const currentUserId = user?.id || user?.uid;
        if (userId === currentUserId || createdBy === (user?.name || user?.displayName || user?.email)) {
          console.log('🔄 Skipping own file_created event echo');
          return;
        }
        
        // Handle the remote file system update
        await handleRemoteFileSystemUpdate('file_created', data);
      };
      
      // Enhanced folder_created handler with robust error handling
      const enhancedFolderCreatedHandler = async (data) => {
        console.log('📁 Enhanced folder_created handler:', data);
        
        const { name, path: folderPath, sessionId, createdBy, userId } = data;
        
        // Only process events for current session
        if (sessionId !== session.id) {
          console.log('🔄 Ignoring folder_created event from different session');
          return;
        }
        
        // Skip own events to prevent echo
        const currentUserId = user?.id || user?.uid;
        if (userId === currentUserId || createdBy === (user?.name || user?.displayName || user?.email)) {
          console.log('🔄 Skipping own folder_created event echo');
          return;
        }
        
        // Handle the remote file system update
        await handleRemoteFileSystemUpdate('folder_created', data);
      };
      
      // Register the enhanced event handlers
      socket.on('file_created', enhancedFileCreatedHandler);
      socket.on('folder_created', enhancedFolderCreatedHandler);
      
      // Also listen for custom refresh events from the window
      const handleForceRefresh = (event) => {
        console.log('🔄 Handling force file tree refresh event:', event.detail);
        handleRemoteFileSystemUpdate('force_refresh', event.detail);
      };
      window.addEventListener('forceFileTreeRefresh', handleForceRefresh);

      return () => {
        socket.off('realtime_code_update');
        socket.off('file_content_update');
        socket.off('virtual_fs_update');
        socket.off('file_created', enhancedFileCreatedHandler);
        socket.off('folder_created', enhancedFolderCreatedHandler);
        // Legacy socket handlers removed - now handled by UnifiedFileSystem through Yjs
        socket.off('session_files_state');
        
        // Remove window event listener
        window.removeEventListener('forceFileTreeRefresh', handleForceRefresh);
        
        // Cleanup project collaboration event listeners
        window.removeEventListener('projectFileCreated', handleProjectFileCreated);
        window.removeEventListener('projectFileUpdated', handleProjectFileUpdated);
        window.removeEventListener('projectFileDeleted', handleProjectFileDeleted);
        window.removeEventListener('projectFileRenamed', handleProjectFileRenamed);
        window.removeEventListener('projectFolderCreated', handleProjectFolderCreated);
        window.removeEventListener('projectFolderDeleted', handleProjectFolderDeleted);
        
        // Note: UnifiedFileSystem cleanup is handled by its own cleanup method
      };
    } else {
      socketRef.current = null;
      
      console.log('⚠️ FileSystem: No session available for real-time sync');
    }
  }, [socket, session, user]);

  // Real-time broadcast function for code changes
  const debouncedBroadcast = useRef(null);
  
  // Enhanced real-time broadcast function for code changes
  const broadcastCodeUpdate = useCallback((filePath, content) => {
    if (socketRef.current && socketRef.current.connected && session && user) {
      try {
        console.log('📡 Broadcasting real-time code update:', filePath, `(${content?.length || 0} chars)`);
        
        // Use both realtime_code_change and file_content_change for compatibility
        socketRef.current.emit('realtime_code_change', {
          sessionId: session.id,
          filePath: filePath,
          content: content,
          userId: user.id || user.uid,
          userName: user.name || user.displayName || 'User',
          timestamp: Date.now()
        });
        
        // Also emit file_content_change for typing-level sync
        socketRef.current.emit('file_content_change', {
          sessionId: session.id,
          filePath: filePath,
          content: content,
          userId: user.id || user.uid,
          userName: user.name || user.displayName || 'User',
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('⚠️ Failed to broadcast code update:', error);
      }
    }
  }, [session, user]);

  // Debounced version for high-frequency updates
  const debouncedBroadcastCodeUpdate = useCallback((filePath, content) => {
    if (debouncedBroadcast.current) {
      clearTimeout(debouncedBroadcast.current);
    }
    
    debouncedBroadcast.current = setTimeout(() => {
      broadcastCodeUpdate(filePath, content);
    }, 300); // 300ms debounce
  }, [broadcastCodeUpdate]);

  // Access control helper
  const checkFileAccess = useCallback((operation) => {
    // If no collaboration context, allow full access (standalone mode)
    if (!collaboration) {
      console.debug('FileSystemContext: No collaboration context, allowing full access');
      return true;
    }
    
    // If no session is active, allow full access (local file operations)
    if (!session) {
      console.debug('FileSystemContext: No active session, allowing full access');
      return true;
    }
    
    const userId = user?.id || user?.uid;
    if (!userId) {
      console.debug('FileSystemContext: No user ID but in standalone/guest mode, allowing access');
      // Allow access for guest users or standalone mode
      return true;
    }
    
    const userAccess = collaboration.getUserAccessLevel(userId);
    console.debug(`FileSystemContext: User ${userId} has access level: ${userAccess} for operation: ${operation}`);
    
    // If no access level is returned, default to editor for authenticated users (not viewer)
    const effectiveAccess = userAccess || 'editor';
    
    switch (operation) {
      case 'read':
        return ['owner', 'editor', 'viewer'].includes(effectiveAccess);
      case 'write':
      case 'create':
      case 'delete':
      case 'rename':
        return ['owner', 'editor'].includes(effectiveAccess);
      case 'manage':
        return effectiveAccess === 'owner';
      default:
        console.warn(`FileSystemContext: Unknown operation: ${operation}`);
        return false;
    }
  }, [collaboration, user, session]);

  // Enhanced broadcast function with activity tracking
  const broadcastFileOperationWithActivity = useCallback((action, filePath, data = {}) => {
    console.log('🎯 [BROADCAST START] Function called with:', action, filePath, data);
    console.log('🎯 [BROADCAST START] Prerequisites:', {
      hasSocket: !!socketRef.current,
      socketConnected: socketRef.current?.connected,
      hasSession: !!session,
      hasUser: !!user,
      sessionId: session?.id,
      userId: user?.id || user?.uid
    });
    
    if (socketRef.current && socketRef.current.connected && session && user) {
      try {
        console.log('📡 Broadcasting file operation:', action, filePath);
        console.log('🔍 Broadcast debug:', {
          socketConnected: socketRef.current.connected,
          sessionId: session.id,
          userId: user.id || user.uid,
          userName: user.name || user.displayName || user.email,
          action: action,
          filePath: filePath
        });
        
        // Use the correct WebSocket events based on the action
        switch (action) {
          case 'file_create':
            // Use dedicated create_file event that server properly handles
            const fileName = filePath.split('/').pop();
            console.log('📄 Broadcasting create_file for:', fileName);
            socketRef.current.emit('create_file', {
              name: fileName,
              content: data.content || '',
              sessionId: session.id,
              userId: user.id || user.uid,
              autoOpen: data.autoOpen
            });
            
            // Also emit the VFS operation for compatibility
            socketRef.current.emit('virtual_fs_operation', {
              action: 'create_file',
              filePath: filePath,
              content: data.content || '',
              sessionId: session.id,
              userId: user.id || user.uid,
              timestamp: Date.now()
            });
            
            console.log('📄 Emitted create_file and virtual_fs_operation for:', fileName);
            break;
            
          case 'folder_create':
            // Use dedicated create_folder event that server properly handles
            const folderName = filePath.split('/').pop();
            socketRef.current.emit('create_folder', {
              name: folderName,
              sessionId: session.id,
              userId: user.id || user.uid
            });
            console.log('� Emitted create_folder event:', folderName);
            break;
            
          default:
            // For other operations, fall back to the generic file_operation event
            const operationData = {
              sessionId: session.id,
              action: action,
              path: filePath,
              data: data,
              userId: user.id || user.uid,
              userName: user.name || user.displayName || 'User',
              timestamp: Date.now()
            };
            
            socketRef.current.emit('file_operation', operationData);
            console.log('🔄 Emitted generic file_operation event:', action);
            break;
        }
        
        // Track file activity if collaboration context is available
        if (collaboration && collaboration.broadcastFileActivity) {
          const activityType = {
            'file_create': 'created',
            'folder_create': 'created', 
            'delete': 'deleted',
            'rename': 'renamed'
          }[action] || 'modified';
          
          collaboration.broadcastFileActivity(filePath, activityType);
        }
      } catch (error) {
        console.warn('⚠️ Failed to broadcast file operation:', error);
      }
    } else {
      console.warn('⚠️ Cannot broadcast file operation - missing requirements:', {
        socketConnected: socketRef.current?.connected,
        hasSession: !!session,
        hasUser: !!user
      });
    }
  }, [session, user, collaboration]);

  // Enhanced tab management with session state persistence
  const updateTabContent = useCallback((tabId, content, shouldBroadcast = true) => {
    const tab = stateRef.current.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Check write permissions for file editing
    if (tab.filePath && !checkFileAccess('write')) {
      console.warn('Access denied: Cannot edit files');
      return;
    }

    // Update local state
    dispatch({
      type: ACTIONS.UPDATE_TAB_CONTENT,
      payload: { tabId, content, isDirty: true }
    });

    // Broadcast to other clients if needed
    if (shouldBroadcast && tab.filePath) {
      debouncedBroadcastCodeUpdate(tab.filePath, content);
      
      // Sync via UnifiedFileSystem for real-time collaboration
      if (unifiedFileSystem.current?.isInitialized) {
        unifiedFileSystem.current.updateFile(tab.filePath, content, {
          name: tab.fileName,
          type: tab.type,
          lastModified: Date.now()
        }).catch(error => {
          console.warn('Failed to sync file change via UnifiedFileSystem:', error);
        });
      }
    }

    // Update VFS if file has a path (for backward compatibility)
    if (tab.filePath) {
      if (virtualFileSystem.current && virtualFileSystem.current.updateFile) {
        virtualFileSystem.current.updateFile(tab.filePath, content, { notify: false });
      }
    }

    // Save session state immediately on content changes for important files
    if (user && tab.filePath && !tab.filePath.includes('welcome')) {
      saveSessionState();
    }
  }, [debouncedBroadcastCodeUpdate, user]);

  // Save current session state to localStorage
  const saveSessionState = useCallback(() => {
    if (!user) return;
    
    try {
      const sessionState = {
        tabs: stateRef.current.tabs.map(tab => ({
          id: tab.id,
          fileName: tab.fileName,
          filePath: tab.filePath,
          isDirty: tab.isDirty
        })),
        activeTab: stateRef.current.activeTab,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(`codecollab_session_${user.id}`, JSON.stringify(sessionState));
      console.log('💾 Session state saved');
    } catch (error) {
      console.warn('Failed to save session state:', error);
    }
  }, [user]);

  // Store ref for use in useEffect
  updateTabContentRef.current = updateTabContent;

  const openFile = useCallback((fileName, content, filePath) => {
    // If content is not provided, try to get it from VFS
    let actualContent = content;
    if (!actualContent && filePath) {
      const vfsFile = virtualFileSystem.readFile(filePath);
      if (vfsFile) {
        actualContent = vfsFile.content;
        console.log('📖 Retrieved content from VFS for:', filePath, 'length:', actualContent?.length || 0);
      }
    }
    
    const newTab = {
      id: generateTabId(),
      fileName,
      filePath,
      isDirty: false,
      content: actualContent || ''
    };
    
    console.log('📂 Opening file:', fileName, 'Content length:', actualContent?.length || 0);
    
    // Add to recent files
    if (filePath && fileName !== 'welcome.md') {
      dispatch({
        type: ACTIONS.ADD_RECENT_FILE,
        payload: {
          fileName,
          filePath,
          lastOpened: new Date().toISOString()
        }
      });
    }
    
    dispatch({ type: ACTIONS.ADD_TAB, payload: newTab });
  }, []);

  // Store ref for use in useEffect
  openFileRef.current = openFile;

  const closeTab = useCallback((tabId) => {
    dispatch({ type: ACTIONS.CLOSE_TAB, payload: tabId });
    // Save session state after closing tab
    setTimeout(saveSessionState, 100);
  }, [saveSessionState]);

  const setActiveTab = useCallback((tabId) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: tabId });
    // Save session state after switching tabs
    setTimeout(saveSessionState, 100);
  }, [saveSessionState]);

  const openNewTab = useCallback(() => {
    const newTab = {
      id: generateTabId(),
      fileName: 'untitled',
      filePath: null,
      isDirty: false,
      content: ''
    };
    
    dispatch({ type: ACTIONS.ADD_TAB, payload: newTab });
    // Save session state after opening new tab
    setTimeout(saveSessionState, 100);
  }, [saveSessionState]);

  // Enhanced project system context value
  const value = {
    // Core state
    tabs: state.tabs,
    activeTab: state.activeTab,
    fileTree: state.fileTree,
    loading: state.loading,
    recentFiles: state.recentFiles,
    
    // Project system state - convert Map to Array for components
    projects: Array.from(state.projects.values()),
    projectsMap: state.projects, // Keep Map for internal use
    activeProject: state.activeProject,
    projectTemplates: state.projectTemplates,
    
    // Shared collaboration state (from SharedStateManager)
    sharedProject: sharedState.sharedProject,
    collaborationMode: sharedState.collaborationMode,
    userRole: sharedState.currentUserRole,
    projectPermissions: sharedState.projectPermissions,
    projectOwner: sharedState.projectOwner,
    
    // Shared state helpers
    hasPermission: sharedGetters.hasPermission,
    getProjectStatus: sharedGetters.getProjectStatus,
    getAllCollaborators: sharedGetters.getAllCollaborators,
    
    // Project management functions
    createProject: (name, description, template = 'blank') => {
      if (!projectManager.current) return null;
      
      const project = projectManager.current.createProject(name, description, template);
      console.log('📂 Created project:', project.name, 'with template:', template);
      return project;
    },
    
    deleteProject: (projectId) => {
      if (!projectManager.current) return false;
      
      const success = projectManager.current.deleteProject(projectId);
      if (success) {
        console.log('🗑️ Deleted project:', projectId);
      }
      return success;
    },
    
    switchProject: (projectId) => {
      if (!projectManager.current) return false;
      
      // Save current project state first
      if (state.activeProject) {
        projectManager.current.saveActiveProjectFromVFS();
        saveProjectSession(state.activeProject);
      }
      
      // Switch to new project
      const success = projectManager.current.setActiveProject(projectId);
      if (success) {
        // Clear current tabs
        dispatch({ type: ACTIONS.SET_TABS, payload: [] });
        dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: null });
        
        // Load project session if available
        setTimeout(() => {
          restoreProjectSession(projectId);
        }, 100);
        
        console.log('🔄 Switched to project:', projectId);
      }
      return success;
    },
    
    shareProject: (projectId, permissions = {}) => {
      if (!socket || !session || !projectManager.current) {
        console.warn('Cannot share project: No active session');
        return false;
      }
      
      const project = projectManager.current.projects.get(projectId);
      if (!project) {
        console.warn('Cannot share project: Project not found');
        return false;
      }
      
      // Save current project state
      projectManager.current.saveActiveProjectFromVFS();
      
      // Prepare project data for sharing
      const projectData = {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        fileTree: Object.fromEntries(project.fileTree),
        folders: Array.from(project.folders || []),
        metadata: project.metadata
      };
      
      // Set default permissions (owner gets full access)
      const allPermissions = {
        [user.id || user.uid]: 'owner',
        ...permissions
      };
      
      // Broadcast project sharing
      socket.emit('share_project', {
        sessionId: session.id,
        projectData,
        permissions: allPermissions,
        ownerId: user.id || user.uid
      });
      
      console.log('📡 Shared project:', project.name, 'with permissions:', allPermissions);
      return true;
    },
    
    updateProjectPermissions: (userId, role) => {
      if (!socket || !session || !sharedGetters.hasPermission('manage')) {
        console.warn('Cannot update permissions: Not project owner');
        return false;
      }
      
      socket.emit('update_project_permissions', {
        sessionId: session.id,
        userId,
        role,
        updatedBy: user.id || user.uid
      });
      
      return true;
    },
    
    // File operations with simplified error handling to prevent loops
    createFile: async (fileName, content = '', parentPath = null) => {
      // Simple checks to prevent loops
      if (!user) {
        console.warn('❌ User not authenticated - using guest mode for file creation');
        // Allow guest users to create files locally
      }

      // Check if UnifiedFileSystem is available
      if (!unifiedFileSystem.current?.isInitialized && user) {
        console.log('⚠️ UnifiedFileSystem not initialized, but proceeding with basic file creation');
      }

      // Normalize file path - handle nested paths
      let normalizedPath;
      if (parentPath && parentPath !== '/' && parentPath !== '') {
        const cleanParentPath = parentPath.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
        normalizedPath = cleanParentPath ? `${cleanParentPath}/${fileName}` : fileName;
      } else {
        normalizedPath = fileName;
      }
      normalizedPath = PathUtils.normalize(normalizedPath);
      
      const userId = user?.id || user?.uid || 'guest';
      
      try {
        console.log('🎯 Creating file:', normalizedPath, 'in parent:', parentPath);
        
        // Create file in UnifiedFileSystem if available, otherwise continue
        let result = null;
        if (unifiedFileSystem.current?.isInitialized) {
          result = await unifiedFileSystem.current.createFile(normalizedPath, content, {
            createdBy: userId,
            createdAt: new Date().toISOString()
          });
        } else {
          console.log('📁 Creating file locally (UnifiedFileSystem not available)');
          result = { success: true, filePath: normalizedPath };
        }
        
        // Open the new file
        openFile(fileName, content, normalizedPath);
        
        // Update the file tree to reflect the new file
        let updatedFileTree;
        if (unifiedFileSystem.current?.isInitialized) {
          updatedFileTree = unifiedFileSystem.current.getFileTreeArray();
        } else {
          // Manually update file tree when UnifiedFileSystem is not available
          updatedFileTree = [...state.fileTree];
          
          // Check if file already exists in tree
          const existingFileIndex = updatedFileTree.findIndex(file => file.path === normalizedPath || file.name === normalizedPath);
          
          if (existingFileIndex === -1) {
            // Ensure parent folders exist in the tree
            if (parentPath && parentPath !== '/' && parentPath !== '') {
              const pathParts = normalizedPath.split('/');
              const filePart = pathParts.pop(); // Remove file name
              
              let currentPath = '';
              for (const part of pathParts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                
                // Check if this folder already exists
                const existingFolderIndex = updatedFileTree.findIndex(item => item.path === currentPath || item.name === currentPath);
                
                if (existingFolderIndex === -1) {
                  updatedFileTree.push({
                    id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: part,
                    path: currentPath,
                    type: 'folder',
                    isDirectory: true,
                    children: [],
                    lastModified: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                  });
                }
              }
            }
            
            // Add new file to tree
            updatedFileTree.push({
              id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: fileName,
              path: normalizedPath,
              type: 'file',
              content: content,
              isDirectory: false,
              size: content.length,
              lastModified: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });
          }
        }
        
        dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
        console.log('📁 File tree updated with new file:', normalizedPath, 'Total files:', updatedFileTree.length);
        
        // Broadcast file creation to other users in real-time collaboration
        if (realTimeFileSync.isInitialized) {
          realTimeFileSync.broadcastFileCreate(normalizedPath, content);
        } else if (socket && socket.connected) {
          // Fallback: Direct socket broadcast for guest users
          console.log('📡 Broadcasting file creation via fallback socket method for guest user');
          socket.emit('virtual_fs_update', {
            action: 'create_file',
            path: normalizedPath,
            content: content,
            data: {
              type: 'file',
              content: content,
              createdBy: userId,
              createdAt: Date.now()
            },
            sessionId: socket.sessionId || socket.id,
            userId: userId,
            userName: user?.name || user?.displayName || `Guest-${userId}`,
            timestamp: Date.now()
          });
        }
        
        console.log(`✅ File created successfully: ${normalizedPath}`);
        
        // **NEW: Update workspace state in database**
        updateWorkspaceState('file_created', normalizedPath, {
          content: content,
          fileType: PathUtils.extname(normalizedPath) || 'text'
        });
        
        return result;
      } catch (error) {
        console.error('Failed to create file:', error);
        
        // Still try to create the file locally for user experience
        try {
          openFile(fileName, content, normalizedPath);
          
          // Update the file tree even in fallback mode
          let fallbackFileTree = [...state.fileTree];
          
          // Check if file already exists in tree
          const existingFileIndex = fallbackFileTree.findIndex(file => file.path === normalizedPath || file.name === fileName);
          
          if (existingFileIndex === -1) {
            // Add new file to tree
            fallbackFileTree.push({
              id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: fileName,
              path: normalizedPath,
              type: 'file',
              content: content,
              isDirectory: false,
              size: content.length,
              lastModified: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });
          }
          
          
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: fallbackFileTree });
          console.log('📁 File tree updated in fallback mode with file:', fileName);
          
          console.log('✅ File created locally despite UnifiedFileSystem error');
          return { success: true, filePath: normalizedPath };
        } catch (fallbackError) {
          console.error('Failed to create file even locally:', fallbackError);
          throw new Error('Failed to create file. Please try again.');
        }
      }
    },

    createFolder: async (folderName) => {
      const userId = user?.id || user?.uid || 'guest';
      
      try {
        console.log('📁 Creating folder:', folderName);
        
        // Normalize folder path - handle nested paths
        const normalizedPath = folderName.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
        console.log('📁 Normalized folder path:', normalizedPath);
        
        // Create folder in UnifiedFileSystem if available
        let result = null;
        if (unifiedFileSystem.current?.isInitialized) {
          result = await unifiedFileSystem.current.createFolder(normalizedPath, {
            createdBy: userId,
            createdAt: new Date().toISOString()
          });
        } else {
          console.log('📁 Creating folder locally (UnifiedFileSystem not available)');
          result = { success: true, folderPath: normalizedPath };
        }
        
        // Update the file tree to reflect the new folder
        let updatedFileTree;
        if (unifiedFileSystem.current?.isInitialized) {
          updatedFileTree = unifiedFileSystem.current.getFileTreeArray();
        } else {
          // Manually update file tree when UnifiedFileSystem is not available
          updatedFileTree = [...state.fileTree];
          
          // Check if folder already exists in tree
          const existingFolderIndex = updatedFileTree.findIndex(item => item.path === normalizedPath || item.name === normalizedPath);
          
          if (existingFolderIndex === -1) {
            // Create nested folder structure if needed
            const pathParts = normalizedPath.split('/');
            let currentPath = '';
            
            for (const part of pathParts) {
              currentPath = currentPath ? `${currentPath}/${part}` : part;
              
              // Check if this level of folder already exists
              const existingIndex = updatedFileTree.findIndex(item => item.path === currentPath || item.name === currentPath);
              
              if (existingIndex === -1) {
                updatedFileTree.push({
                  id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: part,
                  path: currentPath,
                  type: 'folder',
                  isDirectory: true,
                  children: [],
                  lastModified: new Date().toISOString(),
                  createdAt: new Date().toISOString()
                });
              }
            }
          }
        }
        
        dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
        console.log('📁 File tree updated with new folder:', normalizedPath, 'Total items:', updatedFileTree.length);
        
        // Broadcast folder creation to other users in real-time collaboration
        if (realTimeFileSync.isInitialized) {
          // RealTimeFileSync doesn't have broadcastFolderCreate, so use generic approach
          if (realTimeFileSync.socket && realTimeFileSync.roomId) {
            realTimeFileSync.socket.emit('folder_create', {
              folderName: normalizedPath,
              folderPath: normalizedPath,
              projectId: realTimeFileSync.roomId
            });
          }
        } else if (socket && socket.connected) {
          // Fallback: Direct socket broadcast for guest users
          console.log('📡 Broadcasting folder creation via fallback socket method for guest user');
          socket.emit('virtual_fs_update', {
            action: 'create_folder',
            path: normalizedPath,
            data: {
              type: 'folder',
              createdBy: userId,
              createdAt: Date.now()
            },
            sessionId: socket.sessionId || socket.id,
            userId: userId,
            userName: user?.name || user?.displayName || `Guest-${userId}`,
            timestamp: Date.now()
          });
        }
        
        console.log(`✅ Folder created successfully: ${normalizedPath}`);
        
        // **NEW: Update workspace state in database**
        updateWorkspaceState('folder_created', normalizedPath);
        
        return result;
      } catch (error) {
        console.error('Failed to create folder:', error);
        throw new Error('Failed to create folder. Please try again.');
      }
    },
    
    deleteFile: async (filePath) => {
      const userId = user?.id || user?.uid;
      
      if (!checkFileAccess('delete')) {
        console.warn('Access denied: Cannot delete files');
        throw new Error('Insufficient permissions to delete files');
      }
      
      try {
        if (unifiedFileSystem.current?.isInitialized) {
          console.log('🗑️ Deleting file via UnifiedFileSystem:', filePath);
          
          // Use UnifiedFileSystem for file deletion
          const result = await unifiedFileSystem.current.deleteFile(filePath);
          
          // Save to active project
          if (state.activeProject && projectManager.current) {
            projectManager.current.saveActiveProjectFromVFS();
          }
        } else {
          console.log('🗑️ Deleting file locally (UnifiedFileSystem not available):', filePath);
          
          // Fallback to local file tree manipulation - handle hierarchical structure
          const deleteFromTree = (items) => {
            return items.filter(item => {
              if (item.path === filePath) {
                return false; // Remove this item
              }
              if (item.children && item.children.length > 0) {
                item.children = deleteFromTree(item.children);
              }
              return true;
            });
          };
          
          const updatedFileTree = deleteFromTree([...state.fileTree]);
          
          // Update file tree
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
          console.log('🗑️ File tree updated with deleted file:', filePath, 'Total root items:', updatedFileTree.length);
        }
        
        // Close any open tabs for the deleted file
        const tabToClose = state.tabs.find(tab => tab.filePath === filePath);
        if (tabToClose) {
          dispatch({ type: ACTIONS.CLOSE_TAB, payload: tabToClose.id });
        }
        
        // Broadcast file deletion to other users in real-time collaboration
        if (realTimeFileSync.isInitialized) {
          realTimeFileSync.broadcastFileDelete(filePath);
        } else if (socket) {
          // Fallback socket broadcast for guest users
          console.log('📡 Broadcasting file deletion via fallback socket method for guest user');
          socket.emit('file-deleted', { filePath, userId: userId || 'guest' });
        }
        
        console.log(`✅ File deleted successfully via UnifiedFileSystem: ${filePath}`);
        
        // **NEW: Update workspace state in database**
        updateWorkspaceState('file_deleted', filePath);
        
        return result;
      } catch (error) {
        console.error('Failed to delete file via UnifiedFileSystem:', error);
        throw error;
      }
    },
    
    renameFile: async (oldPath, newPath) => {
      if (!checkFileAccess('rename')) {
        console.warn('Access denied: Cannot rename files');
        throw new Error('Insufficient permissions to rename files');
      }
      
      try {
        if (unifiedFileSystem.current?.isInitialized) {
          console.log('🔄 Renaming file via UnifiedFileSystem:', oldPath, '->', newPath);
          
          // Use UnifiedFileSystem for file renaming
          const result = await unifiedFileSystem.current.renameFile(oldPath, newPath);
          
          // Save to active project
          if (state.activeProject && projectManager.current) {
            projectManager.current.saveActiveProjectFromVFS();
          }
        } else {
          console.log('🔄 Renaming file locally (UnifiedFileSystem not available):', oldPath, '->', newPath);
          
          // Fallback to local file tree manipulation - handle hierarchical structure
          const renameInTree = (items) => {
            return items.map(item => {
              if (item.path === oldPath) {
                return {
                  ...item,
                  path: newPath,
                  name: newPath.split('/').pop()
                };
              }
              if (item.children && item.children.length > 0) {
                item.children = renameInTree(item.children);
              }
              return item;
            });
          };
          
          const updatedFileTree = renameInTree([...state.fileTree]);
          
          // Update file tree
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
          console.log('🔄 File tree updated with renamed file:', oldPath, '->', newPath);
        }
        
        // Update related tabs
        const updatedTabs = state.tabs.map(tab => {
          if (tab.filePath?.startsWith(oldPath)) {
            const newFilePath = tab.filePath.replace(oldPath, newPath);
            const newFileName = newFilePath.split('/').pop();
            return { ...tab, filePath: newFilePath, fileName: newFileName };
          }
          return tab;
        });
        dispatch({ type: ACTIONS.SET_TABS, payload: updatedTabs });
        
        console.log(`✅ File renamed successfully: ${oldPath} -> ${newPath}`);
        return { success: true };
      } catch (error) {
        console.error('Failed to rename file:', error);
        throw error;
      }
    },
    
    deleteFolder: async (folderPath) => {
      const userId = user?.id || user?.uid;
      
      if (!checkFileAccess('delete')) {
        console.warn('Access denied: Cannot delete folders');
        throw new Error('Insufficient permissions to delete folders');
      }
      
      try {
        if (unifiedFileSystem.current?.isInitialized) {
          console.log('🗑️ Deleting folder via UnifiedFileSystem:', folderPath);
          
          // Use UnifiedFileSystem for folder deletion
          const result = await unifiedFileSystem.current.deleteFolder(folderPath);
          
          // Save to active project
          if (state.activeProject && projectManager.current) {
            projectManager.current.saveActiveProjectFromVFS();
          }
        } else {
          console.log('🗑️ Deleting folder locally (UnifiedFileSystem not available):', folderPath);
          
          // Fallback to local file tree manipulation - handle hierarchical structure
          const deleteFromTree = (items) => {
            return items.filter(item => {
              // Don't delete the folder itself or any of its children
              if (item.path === folderPath || item.path.startsWith(folderPath + '/')) {
                return false;
              }
              if (item.children && item.children.length > 0) {
                item.children = deleteFromTree(item.children);
              }
              return true;
            });
          };
          
          const updatedFileTree = deleteFromTree([...state.fileTree]);
          
          // Update file tree
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
          console.log('🗑️ File tree updated with deleted folder:', folderPath, 'Total root items:', updatedFileTree.length);
        }
        
        // Close any open tabs for files inside the deleted folder
        const tabsToClose = state.tabs.filter(tab => 
          tab.filePath && (tab.filePath === folderPath || tab.filePath.startsWith(folderPath + '/'))
        );
        
        for (const tab of tabsToClose) {
          dispatch({ type: ACTIONS.CLOSE_TAB, payload: tab.id });
        }
        
        // Broadcast folder deletion to other users in real-time collaboration
        if (realTimeFileSync.isInitialized) {
          realTimeFileSync.broadcastFolderDelete(folderPath);
        } else if (socket) {
          // Fallback socket broadcast for guest users
          console.log('📡 Broadcasting folder deletion via fallback socket method for guest user');
          socket.emit('folder-deleted', { folderPath, userId: userId || 'guest' });
        }
        console.log(`✅ Folder deleted successfully: ${folderPath}`);
        
        // Update workspace state in database
        updateWorkspaceState('folder_deleted', folderPath);
        
        return result;
      } catch (error) {
        console.error('Failed to delete folder via UnifiedFileSystem:', error);
        throw error;
      }
    },
    
    renameFolder: async (oldPath, newPath) => {
      if (!checkFileAccess('rename')) {
        console.warn('Access denied: Cannot rename folders');
        throw new Error('Insufficient permissions to rename folders');
      }
      
      try {
        if (unifiedFileSystem.current?.isInitialized) {
          console.log('🔄 Renaming folder via UnifiedFileSystem:', oldPath, '->', newPath);
          
          // Use UnifiedFileSystem for folder renaming
          const result = await unifiedFileSystem.current.renameFolder(oldPath, newPath);
          
          // Save to active project
          if (state.activeProject && projectManager.current) {
            projectManager.current.saveActiveProjectFromVFS();
          }
        } else {
          console.log('🔄 Renaming folder locally (UnifiedFileSystem not available):', oldPath, '->', newPath);
          
          // Fallback to local file tree manipulation - handle hierarchical structure
          const renameInTree = (items) => {
            return items.map(item => {
              if (item.path === oldPath) {
                // Rename the folder itself
                return { ...item, path: newPath, name: newPath.split('/').pop() };
              } else if (item.path.startsWith(oldPath + '/')) {
                // Update paths of all children
                const newItemPath = item.path.replace(oldPath, newPath);
                const updatedItem = { ...item, path: newItemPath };
                if (updatedItem.children && updatedItem.children.length > 0) {
                  updatedItem.children = renameInTree(updatedItem.children);
                }
                return updatedItem;
              }
              if (item.children && item.children.length > 0) {
                item.children = renameInTree(item.children);
              }
              return item;
            });
          };
          
          const updatedFileTree = renameInTree([...state.fileTree]);
          
          // Update file tree
          dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
          console.log('🔄 File tree updated with renamed folder:', oldPath, '->', newPath);
        }
        
        // Update related tabs - update paths for all files inside the renamed folder
        const updatedTabs = state.tabs.map(tab => {
          if (tab.filePath && tab.filePath.startsWith(oldPath + '/')) {
            const newFilePath = tab.filePath.replace(oldPath, newPath);
            const newFileName = newFilePath.split('/').pop();
            return { ...tab, filePath: newFilePath, fileName: newFileName };
          }
          return tab;
        });
        dispatch({ type: ACTIONS.SET_TABS, payload: updatedTabs });
        
        console.log(`✅ Folder renamed successfully via UnifiedFileSystem: ${oldPath} -> ${newPath}`);
        return result;
      } catch (error) {
        console.error('Failed to rename folder via UnifiedFileSystem:', error);
        throw error;
      }
    },
    
    // Tab operations
    updateTabContent,
    closeTab,
    setActiveTab,
    openNewTab,
    openFile,
    
    saveFile: (tabId) => {
      const tab = state.tabs.find(t => t.id === tabId);
      if (!tab) return;
      
      // Check write permissions before saving
      if (tab.filePath && !checkFileAccess('write')) {
        console.warn('Access denied: Cannot save files');
        return;
      }
      
      if (tab.filePath) {
        if (virtualFileSystem.current && virtualFileSystem.current.updateFile) {
          virtualFileSystem.current.updateFile(tab.filePath, tab.content);
        }
        dispatch({ type: ACTIONS.MARK_TAB_SAVED, payload: tabId });
        
        // Broadcast file update to other users in real-time collaboration
        if (realTimeFileSync.isInitialized) {
          realTimeFileSync.broadcastFileUpdate(tab.filePath, tab.content);
        }
        
        // Save to active project
        if (state.activeProject && projectManager.current) {
          projectManager.current.saveActiveProjectFromVFS();
        }
      }
    },
    
    // Utilities
    getCurrentTab: () => state.tabs.find(tab => tab.id === state.activeTab),
    getDirtyTabs: () => state.tabs.filter(tab => tab.isDirty),
    getVirtualFileSystem: () => virtualFileSystem.current,
    getProjectManager: () => projectManager.current,
    
    getCurrentProject: () => {
      if (sharedState.collaborationMode && sharedState.sharedProject) {
        return sharedState.sharedProject;
      }
      return state.activeProject ? state.projects.get(state.activeProject) : null;
    },
    
    getAllProjects: () => Array.from(state.projects.values()),
    
    getProjectPermissions: () => sharedState.projectPermissions,
    
    canUserEdit: () => sharedGetters.hasPermission('write'),
    canUserManage: () => sharedGetters.hasPermission('manage'),
    
    // Recent files
    clearRecentFiles: () => dispatch({ type: ACTIONS.CLEAR_RECENT_FILES }),
    openRecentFile: (recentFile) => {
      const fileData = unifiedFileSystem.current?.files?.get(recentFile.filePath);
      if (fileData) {
        openFile(recentFile.fileName, fileData.content, recentFile.filePath);
      }
    },

    // Project persistence functions
    syncProjects: async () => {
      if (!user || !projectManager.current) {
        console.warn('User not authenticated or ProjectManager not available');
        return { success: false, message: 'User not authenticated' };
      }

      try {
        // Save current project state
        if (state.activeProject) {
          projectManager.current.saveActiveProjectFromVFS();
        }
        
        const firebaseFileService = new FirebaseFileService();
        const projectsData = projectManager.current.serialize();
        
        const result = await firebaseFileService.syncUserProjects(user.id, projectsData);
        
        if (result.success) {
          console.log('✅ Successfully synced projects');
        }
        
        return result;
      } catch (error) {
        console.error('Failed to sync projects:', error);
        return { success: false, message: error.message };
      }
    },

    loadProjects: async () => {
      if (!user || !projectManager.current) {
        return { success: false, message: 'User not authenticated' };
      }

      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        
        const firebaseFileService = new FirebaseFileService();
        const result = await firebaseFileService.loadUserProjects(user.id);
        
        if (result.success && result.data) {
          projectManager.current.loadFromData(result.data);
          console.log(`✅ Loaded ${projectManager.current.projects.size} projects`);
        }
        
        return result;
      } catch (error) {
        console.error('Failed to load projects:', error);
        return { success: false, message: error.message };
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },

    // **NEW: Store complete workspace state in database**
    storeWorkspaceState: async () => {
      if (!socket || !socket.connected || !socket.sessionId || !session?.id) {
        console.warn('Cannot store workspace state: Not in collaborative session');
        return { success: false, message: 'Not in collaborative session' };
      }

      try {
        console.log('🗃️ Storing complete workspace state to database...');
        
        // Get current workspace data using workspaceProvider
        const workspaceData = workspaceProvider();
        
        // Send to server for storage
        socket.emit('store_workspace_state', {
          sessionId: session.id,
          workspaceData: workspaceData
        });
        
        console.log('✅ Workspace state sent for storage:', {
          files: Object.keys(workspaceData.files || {}).length,
          folders: (workspaceData.folders || []).length
        });
        
        return { success: true, message: 'Workspace state sent for storage' };
      } catch (error) {
        console.error('❌ Failed to store workspace state:', error);
        return { success: false, message: error.message };
      }
    },

    // **NEW: Request workspace state from server**
    requestWorkspaceState: async () => {
      if (!socket || !socket.connected || !socket.sessionId || !session?.id) {
        console.warn('Cannot request workspace state: Not in collaborative session');
        return { success: false, message: 'Not in collaborative session' };
      }

      try {
        console.log('🔄 Requesting workspace state from server...');
        
        socket.emit('request_workspace_state', {
          sessionId: session.id
        });
        
        return { success: true, message: 'Workspace state requested' };
      } catch (error) {
        console.error('❌ Failed to request workspace state:', error);
        return { success: false, message: error.message };
      }
    },

    // Session state management
    saveProjectSession: () => {
      if (state.activeProject) {
        saveProjectSession(state.activeProject);
      }
    },
    
    restoreProjectSession: async (projectId) => {
      if (!projectId) return;
      
      try {
        const sessionData = localStorage.getItem(`codecollab_project_${user.id}_${projectId}`);
        if (sessionData) {
          const parsedSession = JSON.parse(sessionData);
          
          const restoredTabs = parsedSession.tabs.map(tab => {
            if (tab.filePath && virtualFileSystem.files.has(tab.filePath)) {
              const fileData = virtualFileSystem.readFile(tab.filePath);
              return {
                ...tab,
                content: fileData.content,
                isDirty: fileData.isDirty || false
              };
            }
            return tab;
          });
          
          dispatch({ type: ACTIONS.SET_TABS, payload: restoredTabs });
          dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: parsedSession.activeTab });
          
          console.log(`✅ Restored session for project ${projectId}`);
        }
      } catch (error) {
        console.warn('Failed to restore project session:', error);
      }
    },
    
    // Convert flat files array to hierarchical tree structure
    buildHierarchicalTree: useCallback((flatFiles) => {
      const tree = [];
      const folderMap = new Map();

      // First pass: create all folders
      flatFiles.forEach(item => {
        const pathParts = item.path.split('/');
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderPath = pathParts.slice(0, i + 1).join('/');
          if (!folderMap.has(folderPath)) {
            const folderItem = {
              name: pathParts[i],
              path: folderPath,
              type: 'folder',
              isDirectory: true,
              children: []
            };
            folderMap.set(folderPath, folderItem);
          }
        }
      });

      // Second pass: organize into tree structure
      const allItems = [...Array.from(folderMap.values()), ...flatFiles];
      
      allItems.forEach(item => {
        const parentPath = item.path.includes('/') ? 
          item.path.substring(0, item.path.lastIndexOf('/')) : '';
        
        if (parentPath && folderMap.has(parentPath)) {
          const parent = folderMap.get(parentPath);
          parent.children.push(item);
        } else if (!parentPath) {
          tree.push(item);
        }
      });

      // Sort folders first, then files
      const sortItems = (items) => {
        items.sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
        
        items.forEach(item => {
          if (item.children && item.children.length > 0) {
            sortItems(item.children);
          }
        });
      };

      sortItems(tree);
      return tree;
    }, []),

    // File tree refresh function - called by Explorer component
    refreshFileTree: useCallback(() => {
      console.log('🔄 Refreshing file tree...');
      try {
        let flatFiles = [];
        
        if (unifiedFileSystem.current?.isInitialized) {
          // Use getFilesArray() to get flat array, then convert to hierarchical
          flatFiles = unifiedFileSystem.current.getFilesArray() || [];
          console.log('📁 Retrieved flat files from UnifiedFileSystem:', flatFiles.length, 'items');
        } else if (virtualFileSystem.current) {
          // Fallback to virtualFileSystem for backward compatibility
          flatFiles = virtualFileSystem.current.getFilesArray() || [];
          console.log('📁 Retrieved flat files from VirtualFileSystem:', flatFiles.length, 'items');
        } else {
          console.warn('⚠️ No file system available for refreshing file tree - skipping refresh to preserve current state');
          // Don't overwrite the current file tree when no file system is available
          // This prevents losing manually created files during refresh operations
          return state.fileTree || [];
        }
        
        // Convert flat array to hierarchical tree structure
        const hierarchicalTree = value.buildHierarchicalTree(flatFiles);
        
        // Only update the state if we actually have a file tree to update
        dispatch({ type: ACTIONS.SET_FILE_TREE, payload: hierarchicalTree });
        
        console.log('✅ File tree refreshed with', hierarchicalTree.length, 'root items, converted from', flatFiles.length, 'flat items');
        return hierarchicalTree;
      } catch (error) {
        console.error('❌ Failed to refresh file tree:', error);
        return [];
      }
    }, [state]),
    
    // Unified File System for collaboration
    unifiedFileSystem: unifiedFileSystem.current
  };

  // Helper function to restore project session
  const restoreProjectSession = useCallback(async (projectId) => {
    return value.restoreProjectSession(projectId);
  }, [value]);

  // Initialize real-time file sync when socket and user are available
  useEffect(() => {
    if (socket && user && value.createFile && value.deleteFile) {
      const roomId = getRoomId();
      if (roomId && !realTimeFileSync.isInitialized) {
        realTimeFileSync.initialize(
          socket, 
          roomId, 
          user.id || user.uid, 
          user.name || user.displayName || 'User',
          {
            createFile: value.createFile,
            updateFile: (filePath, content) => {
              // Update file through unified file system
              if (unifiedFileSystem.current) {
                return unifiedFileSystem.current.updateFile(filePath, content);
              }
            },
            deleteFile: value.deleteFile,
            readFile: (filePath) => {
              // Read file from current tabs or unified file system
              const tab = state.tabs.find(t => t.filePath === filePath);
              if (tab) {
                return tab.content;
              }
              if (unifiedFileSystem.current) {
                return unifiedFileSystem.current.readFile(filePath);
              }
              return '';
            },
            fileTree: state.fileTree
          }
        );
        
        console.log('🔗 RealTimeFileSync initialized for room:', roomId);
        
        // Set up event listeners for real-time file operations
        realTimeFileSync.on('remote_file_created', (data) => {
          console.log('📝 Remote file created:', data.path);
        });
        
        realTimeFileSync.on('remote_file_updated', (data) => {
          console.log('✏️ Remote file updated:', data.path);
        });
        
        realTimeFileSync.on('remote_file_deleted', (data) => {
          console.log('🗑️ Remote file deleted:', data.path);
        });

        realTimeFileSync.on('workspace_loaded', (data) => {
          console.log('📦 Workspace loaded:', data.fileCount, 'files from', data.sharedBy?.name);
          
          // Refresh file tree after workspace is loaded
          setTimeout(() => {
            const updatedFileTree = unifiedFileSystem.current?.getFileTreeArray() || [];
            dispatch({ type: ACTIONS.SET_FILE_TREE, payload: updatedFileTree });
          }, 1000);
        });

        realTimeFileSync.on('file_received', (data) => {
          console.log('📝 File received:', data.filePath, 'from', data.sharedBy?.name);
        });
      }
    }
  }, [socket, user, value.createFile, value.deleteFile, state.fileTree, state.tabs]);

  // Assign refreshFileTree function to ref for use in event handlers
  useEffect(() => {
    refreshFileTreeRef.current = value.refreshFileTree;
  }, [value.refreshFileTree]);

  return (
    <ProjectSystemContext.Provider value={value}>
      {children}
    </ProjectSystemContext.Provider>
  );
};

// Hook to use the project system context - renamed for clarity
export const useProjectSystem = () => {
  const context = useContext(ProjectSystemContext);
  if (!context) {
    throw new Error('useProjectSystem must be used within a ProjectSystemProvider');
  }
  return context;
};

// Keep backward compatibility
export const useFileSystem = useProjectSystem;
export const FileSystemProvider = ProjectSystemProvider;
export const FileSystemContext = ProjectSystemContext;

// Export ProjectSystemContext explicitly
export { ProjectSystemContext };
