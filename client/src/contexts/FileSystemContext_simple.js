import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { useSharedState } from './SharedStateManager';

// Create context
const ProjectSystemContext = createContext(null);

// Initial state
const initialState = {
  // Tab management
  tabs: [],
  activeTab: null,
  splitScreenMode: false,
  
  // File management
  files: [],
  currentProject: null,
  projectHistory: [],
  
  // State management
  isLoading: false,
  error: null,
  lastAction: null,
  
  // Settings
  autoSave: true,
  autoSaveInterval: 5000,
  
  // Editor state
  editorSettings: {
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'Monaco, monospace',
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    lineNumbers: true,
    minimap: true,
    folding: true,
    bracketMatching: 'always'
  }
};

// Simple reducer
const projectSystemReducer = (state, action) => {
  switch (action.type) {
    default:
      return state;
  }
};

// Minimal ProjectSystemProvider without circular dependencies
export const ProjectSystemProvider = ({ children }) => {
  const [state, dispatch] = useReducer(projectSystemReducer, initialState);
  const { user } = useAuth();
  const { socket, session } = useSession();
  const { state: sharedState, actions: sharedActions, getters: sharedGetters } = useSharedState();
  
  const value = {
    // State
    state,
    dispatch,
    
    // Basic functions
    getTabs: () => state.tabs,
    getActiveTab: () => state.activeTab,
    getFiles: () => state.files,
    getCurrentProject: () => state.currentProject,
    
    // Minimal functionality
    openFile: useCallback(() => {}, []),
    closeFile: useCallback(() => {}, []),
    saveFile: useCallback(() => {}, []),
    createFile: useCallback(() => {}, []),
    deleteFile: useCallback(() => {}, []),
    renameFile: useCallback(() => {}, []),
  };

  return (
    <ProjectSystemContext.Provider value={value}>
      {children}
    </ProjectSystemContext.Provider>
  );
};

// Hook to use the context
export const useProjectSystem = () => {
  const context = useContext(ProjectSystemContext);
  if (context === undefined) {
    throw new Error('useProjectSystem must be used within a ProjectSystemProvider');
  }
  return context;
};

// Export context and aliases
export { ProjectSystemContext };
export const FileSystemProvider = ProjectSystemProvider;
export const FileSystemContext = ProjectSystemContext;
export const useFileSystem = useProjectSystem;
