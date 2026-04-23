import React, { createContext, useContext, useState, useEffect } from 'react';

// Permission types
export const PERMISSIONS = {
  // File operations
  CREATE_FILE: 'create_file',
  EDIT_FILE: 'edit_file',
  DELETE_FILE: 'delete_file',
  RENAME_FILE: 'rename_file',
  
  // Folder operations
  CREATE_FOLDER: 'create_folder',
  DELETE_FOLDER: 'delete_folder',
  RENAME_FOLDER: 'rename_folder',
  
  // Project operations
  CREATE_PROJECT: 'create_project',
  DELETE_PROJECT: 'delete_project',
  INVITE_USERS: 'invite_users',
  REMOVE_USERS: 'remove_users',
  
  // Collaboration
  SHARE_CURSOR: 'share_cursor',
  CHAT_ACCESS: 'chat_access',
  VOICE_ACCESS: 'voice_access',
  
  // Code execution
  RUN_CODE: 'run_code',
  DEBUG_CODE: 'debug_code',
  
  // Settings
  CHANGE_SETTINGS: 'change_settings',
  MANAGE_ROLES: 'manage_roles'
};

// Predefined roles with their permissions
export const ROLES = {
  ADMIN: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all features and project management',
    color: '#dc2626', // red-600
    permissions: Object.values(PERMISSIONS)
  },
  DEVELOPER: {
    id: 'developer', 
    name: 'Developer',
    description: 'Can edit code, create files, and run code',
    color: '#2563eb', // blue-600
    permissions: [
      PERMISSIONS.CREATE_FILE,
      PERMISSIONS.EDIT_FILE,
      PERMISSIONS.DELETE_FILE,
      PERMISSIONS.RENAME_FILE,
      PERMISSIONS.CREATE_FOLDER,
      PERMISSIONS.DELETE_FOLDER,
      PERMISSIONS.RENAME_FOLDER,
      PERMISSIONS.SHARE_CURSOR,
      PERMISSIONS.CHAT_ACCESS,
      PERMISSIONS.VOICE_ACCESS,
      PERMISSIONS.RUN_CODE,
      PERMISSIONS.DEBUG_CODE
    ]
  },
  REVIEWER: {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Can view and comment on code, limited editing',
    color: '#7c3aed', // violet-600
    permissions: [
      PERMISSIONS.EDIT_FILE, // Limited editing for reviews
      PERMISSIONS.SHARE_CURSOR,
      PERMISSIONS.CHAT_ACCESS,
      PERMISSIONS.RUN_CODE
    ]
  },
  VIEWER: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to view code and participate in chat',
    color: '#059669', // emerald-600
    permissions: [
      PERMISSIONS.SHARE_CURSOR,
      PERMISSIONS.CHAT_ACCESS
    ]
  }
};

const PermissionsContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export const PermissionsProvider = ({ children }) => {
  const [currentUserRole, setCurrentUserRole] = useState(ROLES.ADMIN.id); // Default to admin for demo
  const [projectMembers, setProjectMembers] = useState([
    {
      id: 'user-1',
      name: 'You',
      email: 'you@codecollab.dev',
      role: ROLES.ADMIN.id,
      isCurrentUser: true,
      avatar: null,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    }
  ]);
  const [customRoles, setCustomRoles] = useState({});

  // Get all available roles (predefined + custom)
  const getAllRoles = () => {
    return { ...ROLES, ...customRoles };
  };

  // Check if current user has a specific permission
  const hasPermission = (permission) => {
    const allRoles = getAllRoles();
    const userRole = allRoles[currentUserRole];
    return userRole?.permissions.includes(permission) || false;
  };

  // Check if current user has multiple permissions
  const hasPermissions = (permissions) => {
    return permissions.every(permission => hasPermission(permission));
  };

  // Check if current user has any of the given permissions
  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  // Get current user's role object
  const getCurrentUserRole = () => {
    const allRoles = getAllRoles();
    return allRoles[currentUserRole];
  };

  // Get user by ID
  const getUserById = (userId) => {
    return projectMembers.find(member => member.id === userId);
  };

  // Get user role object by user ID
  const getUserRole = (userId) => {
    const user = getUserById(userId);
    if (!user) return null;
    const allRoles = getAllRoles();
    return allRoles[user.role];
  };

  // Check if a specific user has a permission
  const userHasPermission = (userId, permission) => {
    const userRole = getUserRole(userId);
    return userRole?.permissions.includes(permission) || false;
  };

  // Add a new project member
  const addProjectMember = (memberData) => {
    if (!hasPermission(PERMISSIONS.INVITE_USERS)) {
      throw new Error('Insufficient permissions to invite users');
    }

    const newMember = {
      id: `user-${Date.now()}`,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isCurrentUser: false,
      ...memberData
    };

    setProjectMembers(prev => [...prev, newMember]);
    return newMember;
  };

  // Remove a project member
  const removeProjectMember = (userId) => {
    if (!hasPermission(PERMISSIONS.REMOVE_USERS)) {
      throw new Error('Insufficient permissions to remove users');
    }

    const user = getUserById(userId);
    if (user?.isCurrentUser) {
      throw new Error('Cannot remove yourself from the project');
    }

    setProjectMembers(prev => prev.filter(member => member.id !== userId));
  };

  // Update user role
  const updateUserRole = (userId, newRoleId) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
      throw new Error('Insufficient permissions to manage roles');
    }

    const user = getUserById(userId);
    if (user?.isCurrentUser && newRoleId !== ROLES.ADMIN.id) {
      throw new Error('Cannot remove admin role from yourself');
    }

    setProjectMembers(prev => 
      prev.map(member => 
        member.id === userId 
          ? { ...member, role: newRoleId }
          : member
      )
    );
  };

  // Create custom role
  const createCustomRole = (roleData) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
      throw new Error('Insufficient permissions to create custom roles');
    }

    const roleId = `custom-${Date.now()}`;
    const newRole = {
      id: roleId,
      name: roleData.name,
      description: roleData.description,
      color: roleData.color || '#6b7280',
      permissions: roleData.permissions || [],
      isCustom: true
    };

    setCustomRoles(prev => ({
      ...prev,
      [roleId]: newRole
    }));

    return newRole;
  };

  // Update custom role
  const updateCustomRole = (roleId, updates) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
      throw new Error('Insufficient permissions to update custom roles');
    }

    if (!customRoles[roleId]) {
      throw new Error('Custom role not found');
    }

    setCustomRoles(prev => ({
      ...prev,
      [roleId]: { ...prev[roleId], ...updates }
    }));
  };

  // Delete custom role
  const deleteCustomRole = (roleId) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
      throw new Error('Insufficient permissions to delete custom roles');
    }

    if (!customRoles[roleId]) {
      throw new Error('Custom role not found');
    }

    // Check if any users have this role
    const usersWithRole = projectMembers.filter(member => member.role === roleId);
    if (usersWithRole.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    setCustomRoles(prev => {
      const { [roleId]: deleted, ...rest } = prev;
      return rest;
    });
  };

  // Update user's last active timestamp
  const updateUserActivity = (userId) => {
    setProjectMembers(prev => 
      prev.map(member => 
        member.id === userId 
          ? { ...member, lastActive: new Date().toISOString() }
          : member
      )
    );
  };

  // Get permission-based UI state
  const getUIPermissions = () => {
    return {
      canCreateFiles: hasPermission(PERMISSIONS.CREATE_FILE),
      canEditFiles: hasPermission(PERMISSIONS.EDIT_FILE),
      canDeleteFiles: hasPermission(PERMISSIONS.DELETE_FILE),
      canCreateFolders: hasPermission(PERMISSIONS.CREATE_FOLDER),
      canRunCode: hasPermission(PERMISSIONS.RUN_CODE),
      canManageUsers: hasPermission(PERMISSIONS.INVITE_USERS) || hasPermission(PERMISSIONS.REMOVE_USERS),
      canManageRoles: hasPermission(PERMISSIONS.MANAGE_ROLES),
      canChangeSettings: hasPermission(PERMISSIONS.CHANGE_SETTINGS),
      isAdmin: currentUserRole === ROLES.ADMIN.id
    };
  };

  const value = {
    // Current user state
    currentUserRole,
    setCurrentUserRole,
    
    // Project members
    projectMembers,
    setProjectMembers,
    
    // Roles
    getAllRoles,
    getCurrentUserRole,
    customRoles,
    
    // Permission checking
    hasPermission,
    hasPermissions,
    hasAnyPermission,
    userHasPermission,
    
    // User management
    getUserById,
    getUserRole,
    addProjectMember,
    removeProjectMember,
    updateUserRole,
    updateUserActivity,
    
    // Role management
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    
    // UI helpers
    getUIPermissions,
    
    // Constants
    PERMISSIONS,
    ROLES
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export default PermissionsContext;
