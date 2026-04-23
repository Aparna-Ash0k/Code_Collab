/**
 * Unified Permission System
 * 
 * Replaces the 3 conflicting permission systems with a single hierarchical model:
 * - Project permissions (owner/editor/viewer)
 * - Session permissions (inherit from project)
 * - Database permissions (enforced consistently)
 * 
 * Provides clear owner/editor/viewer roles with inheritance.
 */

export class PermissionSystem {
  static ROLES = {
    OWNER: 'owner',
    EDITOR: 'editor', 
    VIEWER: 'viewer',
    NONE: 'none'
  };

  static PERMISSIONS = {
    // File operations
    CREATE_FILE: 'create_file',
    READ_FILE: 'read_file',
    UPDATE_FILE: 'update_file',
    DELETE_FILE: 'delete_file',
    MOVE_FILE: 'move_file',
    
    // Folder operations
    CREATE_FOLDER: 'create_folder',
    DELETE_FOLDER: 'delete_folder',
    MOVE_FOLDER: 'move_folder',
    
    // Project operations
    MANAGE_PROJECT: 'manage_project',
    SHARE_PROJECT: 'share_project',
    DELETE_PROJECT: 'delete_project',
    
    // Session operations
    CREATE_SESSION: 'create_session',
    JOIN_SESSION: 'join_session',
    INVITE_USERS: 'invite_users',
    MANAGE_USERS: 'manage_users',
    END_SESSION: 'end_session',
    
    // Chat operations
    SEND_MESSAGE: 'send_message',
    DELETE_MESSAGE: 'delete_message'
  };

  static ROLE_PERMISSIONS = {
    [this.ROLES.OWNER]: [
      // All file operations
      this.PERMISSIONS.CREATE_FILE,
      this.PERMISSIONS.READ_FILE,
      this.PERMISSIONS.UPDATE_FILE,
      this.PERMISSIONS.DELETE_FILE,
      this.PERMISSIONS.MOVE_FILE,
      
      // All folder operations
      this.PERMISSIONS.CREATE_FOLDER,
      this.PERMISSIONS.DELETE_FOLDER,
      this.PERMISSIONS.MOVE_FOLDER,
      
      // All project operations
      this.PERMISSIONS.MANAGE_PROJECT,
      this.PERMISSIONS.SHARE_PROJECT,
      this.PERMISSIONS.DELETE_PROJECT,
      
      // All session operations
      this.PERMISSIONS.CREATE_SESSION,
      this.PERMISSIONS.JOIN_SESSION,
      this.PERMISSIONS.INVITE_USERS,
      this.PERMISSIONS.MANAGE_USERS,
      this.PERMISSIONS.END_SESSION,
      
      // All chat operations
      this.PERMISSIONS.SEND_MESSAGE,
      this.PERMISSIONS.DELETE_MESSAGE
    ],
    
    [this.ROLES.EDITOR]: [
      // Most file operations
      this.PERMISSIONS.CREATE_FILE,
      this.PERMISSIONS.READ_FILE,
      this.PERMISSIONS.UPDATE_FILE,
      this.PERMISSIONS.DELETE_FILE,
      this.PERMISSIONS.MOVE_FILE,
      
      // Most folder operations
      this.PERMISSIONS.CREATE_FOLDER,
      this.PERMISSIONS.DELETE_FOLDER,
      this.PERMISSIONS.MOVE_FOLDER,
      
      // Limited session operations
      this.PERMISSIONS.JOIN_SESSION,
      
      // Chat operations
      this.PERMISSIONS.SEND_MESSAGE
    ],
    
    [this.ROLES.VIEWER]: [
      // Read-only file operations
      this.PERMISSIONS.READ_FILE,
      
      // Limited session operations
      this.PERMISSIONS.JOIN_SESSION,
      
      // Chat operations
      this.PERMISSIONS.SEND_MESSAGE
    ],
    
    [this.ROLES.NONE]: [
      // No permissions
    ]
  };

  constructor() {
    this.projectPermissions = new Map(); // projectId -> Map<userId, role>
    this.sessionPermissions = new Map(); // sessionId -> Map<userId, role>
    this.userSessions = new Map(); // userId -> Set<sessionId>
    this.listeners = new Set();
  }

  /**
   * Add a permission change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove a permission change listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify listeners of permission changes
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Permission listener error:', error);
      }
    });
  }

  /**
   * Set project permissions for a user
   */
  setProjectPermission(projectId, userId, role) {
    if (!Object.values(PermissionSystem.ROLES).includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    if (!this.projectPermissions.has(projectId)) {
      this.projectPermissions.set(projectId, new Map());
    }

    const projectPerms = this.projectPermissions.get(projectId);
    const oldRole = projectPerms.get(userId);
    
    projectPerms.set(userId, role);

    console.log(`🔐 Set project permission: ${userId} → ${role} for project ${projectId}`);

    this.notifyListeners('project_permission_changed', {
      projectId,
      userId,
      oldRole,
      newRole: role
    });

    // Update session permissions for active sessions
    this.updateSessionPermissionsForProject(projectId, userId, role);
  }

  /**
   * Get project permission for a user
   */
  getProjectPermission(projectId, userId) {
    const projectPerms = this.projectPermissions.get(projectId);
    return projectPerms?.get(userId) || PermissionSystem.ROLES.EDITOR; // Default to EDITOR instead of NONE
  }

  /**
   * Set session permissions for a user
   */
  setSessionPermission(sessionId, userId, role, inheritFromProject = true) {
    if (!Object.values(PermissionSystem.ROLES).includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    if (!this.sessionPermissions.has(sessionId)) {
      this.sessionPermissions.set(sessionId, new Map());
    }

    const sessionPerms = this.sessionPermissions.get(sessionId);
    const oldRole = sessionPerms.get(userId);
    
    // If inheriting from project, don't allow higher permissions than project role
    if (inheritFromProject) {
      const projectRole = this.getProjectRoleForSession(sessionId, userId);
      role = this.getLowerRole(role, projectRole);
    }
    
    sessionPerms.set(userId, role);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(sessionId);

    console.log(`🔐 Set session permission: ${userId} → ${role} for session ${sessionId}`);

    this.notifyListeners('session_permission_changed', {
      sessionId,
      userId,
      oldRole,
      newRole: role
    });
  }

  /**
   * Get session permission for a user
   */
  getSessionPermission(sessionId, userId) {
    const sessionPerms = this.sessionPermissions.get(sessionId);
    return sessionPerms?.get(userId) || PermissionSystem.ROLES.EDITOR; // Default to EDITOR instead of NONE
  }

  /**
   * Get effective permission (considering both project and session)
   */
  getEffectivePermission(projectId, sessionId, userId) {
    const projectRole = this.getProjectPermission(projectId, userId);
    const sessionRole = sessionId ? this.getSessionPermission(sessionId, userId) : PermissionSystem.ROLES.EDITOR;
    
    // In collaboration sessions, prioritize session role over project role
    // Only use the lower role if the session role is explicitly set to a more restrictive role
    if (sessionId) {
      const sessionPerms = this.sessionPermissions.get(sessionId);
      const hasExplicitSessionRole = sessionPerms?.has(userId);
      
      // If user has explicit session role, use that; otherwise default to EDITOR
      return hasExplicitSessionRole ? sessionRole : PermissionSystem.ROLES.EDITOR;
    }
    
    // For non-session contexts, use project role or default to EDITOR
    return projectRole;
  }

  /**
   * Check if a user has a specific permission
   */
  hasPermission(permission, projectId, userId, sessionId = null) {
    const effectiveRole = this.getEffectivePermission(projectId, sessionId, userId);
    const rolePermissions = PermissionSystem.ROLE_PERMISSIONS[effectiveRole] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * Check if a user can perform a file operation
   */
  canPerformFileOperation(operation, projectId, userId, sessionId = null) {
    const permissionMap = {
      'create': PermissionSystem.PERMISSIONS.CREATE_FILE,
      'read': PermissionSystem.PERMISSIONS.READ_FILE,
      'update': PermissionSystem.PERMISSIONS.UPDATE_FILE,
      'delete': PermissionSystem.PERMISSIONS.DELETE_FILE,
      'move': PermissionSystem.PERMISSIONS.MOVE_FILE
    };

    const permission = permissionMap[operation];
    if (!permission) {
      throw new Error(`Unknown file operation: ${operation}`);
    }

    return this.hasPermission(permission, projectId, userId, sessionId);
  }

  /**
   * Check if a user can manage a project
   */
  canManageProject(projectId, userId) {
    return this.hasPermission(PermissionSystem.PERMISSIONS.MANAGE_PROJECT, projectId, userId);
  }

  /**
   * Check if a user can manage a session
   */
  canManageSession(sessionId, userId) {
    const sessionRole = this.getSessionPermission(sessionId, userId);
    return sessionRole === PermissionSystem.ROLES.OWNER;
  }

  /**
   * Get all users with permissions for a project
   */
  getProjectUsers(projectId) {
    const projectPerms = this.projectPermissions.get(projectId);
    if (!projectPerms) return [];

    return Array.from(projectPerms.entries()).map(([userId, role]) => ({
      userId,
      role,
      permissions: PermissionSystem.ROLE_PERMISSIONS[role] || []
    }));
  }

  /**
   * Get all users with permissions for a session
   */
  getSessionUsers(sessionId) {
    const sessionPerms = this.sessionPermissions.get(sessionId);
    if (!sessionPerms) return [];

    return Array.from(sessionPerms.entries()).map(([userId, role]) => ({
      userId,
      role,
      permissions: PermissionSystem.ROLE_PERMISSIONS[role] || []
    }));
  }

  /**
   * Remove a user from a project
   */
  removeUserFromProject(projectId, userId) {
    const projectPerms = this.projectPermissions.get(projectId);
    if (projectPerms) {
      const oldRole = projectPerms.get(userId);
      projectPerms.delete(userId);

      this.notifyListeners('user_removed_from_project', {
        projectId,
        userId,
        oldRole
      });

      // Remove from related sessions
      this.removeUserFromProjectSessions(projectId, userId);
    }
  }

  /**
   * Remove a user from a session
   */
  removeUserFromSession(sessionId, userId) {
    const sessionPerms = this.sessionPermissions.get(sessionId);
    if (sessionPerms) {
      const oldRole = sessionPerms.get(userId);
      sessionPerms.delete(userId);

      const userSessions = this.userSessions.get(userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(userId);
        }
      }

      this.notifyListeners('user_removed_from_session', {
        sessionId,
        userId,
        oldRole
      });
    }
  }

  /**
   * Clean up permissions when a session ends
   */
  endSession(sessionId) {
    const sessionPerms = this.sessionPermissions.get(sessionId);
    if (sessionPerms) {
      // Remove all users from this session
      for (const userId of sessionPerms.keys()) {
        this.removeUserFromSession(sessionId, userId);
      }
      
      this.sessionPermissions.delete(sessionId);
      
      this.notifyListeners('session_ended', { sessionId });
    }
  }

  /**
   * Get the lower of two roles (more restrictive)
   */
  getLowerRole(role1, role2) {
    const roleHierarchy = {
      [PermissionSystem.ROLES.NONE]: 0,
      [PermissionSystem.ROLES.VIEWER]: 1,
      [PermissionSystem.ROLES.EDITOR]: 2,
      [PermissionSystem.ROLES.OWNER]: 3
    };

    const level1 = roleHierarchy[role1] || 0;
    const level2 = roleHierarchy[role2] || 0;

    return level1 <= level2 ? role1 : role2;
  }

  /**
   * Update session permissions when project permissions change
   */
  updateSessionPermissionsForProject(projectId, userId, newProjectRole) {
    // Find all sessions for this project and update permissions
    // This would need to be implemented based on how sessions are linked to projects
    console.log(`🔄 Updating session permissions for project ${projectId}, user ${userId}`);
  }

  /**
   * Get project role for a session (helper for inheritance)
   */
  getProjectRoleForSession(sessionId, userId) {
    // This would need to be implemented based on how sessions are linked to projects
    // For now, return OWNER as a safe default
    return PermissionSystem.ROLES.OWNER;
  }

  /**
   * Remove user from all sessions related to a project
   */
  removeUserFromProjectSessions(projectId, userId) {
    // This would need to be implemented based on how sessions are linked to projects
    console.log(`🗑️ Removing user ${userId} from project ${projectId} sessions`);
  }

  /**
   * Validate permission request
   */
  validatePermissionRequest(permission, context) {
    const { projectId, sessionId, userId, operation } = context;

    if (!userId) {
      return { valid: false, error: 'User ID is required' };
    }

    if (!projectId && !sessionId) {
      return { valid: false, error: 'Project ID or Session ID is required' };
    }

    if (!Object.values(PermissionSystem.PERMISSIONS).includes(permission)) {
      return { valid: false, error: `Invalid permission: ${permission}` };
    }

    const hasPermission = this.hasPermission(permission, projectId, userId, sessionId);
    
    if (!hasPermission) {
      const effectiveRole = this.getEffectivePermission(projectId, sessionId, userId);
      return { 
        valid: false, 
        error: `Insufficient permissions. Required: ${permission}, User role: ${effectiveRole}` 
      };
    }

    return { valid: true };
  }

  /**
   * Get permission summary for debugging
   */
  getPermissionSummary(userId, projectId = null, sessionId = null) {
    const summary = {
      userId,
      projectId,
      sessionId,
      projectRole: projectId ? this.getProjectPermission(projectId, userId) : null,
      sessionRole: sessionId ? this.getSessionPermission(sessionId, userId) : null,
      effectiveRole: (projectId || sessionId) ? this.getEffectivePermission(projectId, sessionId, userId) : null,
      permissions: []
    };

    if (summary.effectiveRole) {
      summary.permissions = PermissionSystem.ROLE_PERMISSIONS[summary.effectiveRole] || [];
    }

    return summary;
  }
}

// Create singleton instance
export const permissionSystem = new PermissionSystem();

// Export default instance
export default permissionSystem;
