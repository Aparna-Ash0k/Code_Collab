/**
 * Advanced User Management System
 * Comprehensive user management with role-based access control (RBAC),
 * team hierarchies, permission systems, and user lifecycle management
 */

import { EventEmitter } from 'events';

class AdvancedUserManagementSystem extends EventEmitter {
  constructor() {
    super();
    
    // User management configuration
    this.config = {
      // RBAC settings
      rbac: {
        enabled: true,
        inheritanceEnabled: true,
        dynamicRoles: true,
        roleHierarchy: true,
        permissionCaching: true,
        cacheTimeout: 300000 // 5 minutes
      },
      
      // Team management
      teams: {
        enabled: true,
        maxTeamSize: 100,
        maxNestingLevel: 5,
        allowCrossTeamMembership: true,
        inheritPermissions: true
      },
      
      // User lifecycle
      lifecycle: {
        accountActivation: true,
        passwordExpiry: 90, // days
        inactivityThreshold: 30, // days
        autoDeactivation: true,
        dataRetention: 365 // days
      },
      
      // Security settings
      security: {
        enforceStrongPasswords: true,
        requireMFA: false,
        sessionTimeout: 3600000, // 1 hour
        maxConcurrentSessions: 3,
        auditUserActions: true
      }
    };
    
    // Core data structures
    this.users = new Map(); // userId -> user data
    this.roles = new Map(); // roleId -> role definition
    this.permissions = new Map(); // permissionId -> permission definition
    this.teams = new Map(); // teamId -> team data
    this.userSessions = new Map(); // sessionId -> session data
    this.permissionCache = new Map(); // userId -> cached permissions
    
    // Relationships
    this.userRoles = new Map(); // userId -> Set of roleIds
    this.rolePermissions = new Map(); // roleId -> Set of permissionIds
    this.teamMembers = new Map(); // teamId -> Set of userIds
    this.userTeams = new Map(); // userId -> Set of teamIds
    this.teamHierarchy = new Map(); // teamId -> parentTeamId
    
    // System roles and permissions
    this.systemRoles = new Set(['super_admin', 'admin', 'moderator', 'user', 'guest']);
    this.systemPermissions = new Set([
      'read', 'write', 'delete', 'admin', 'moderate',
      'create_team', 'manage_team', 'invite_users',
      'view_analytics', 'manage_permissions', 'system_config'
    ]);
    
    // User management metrics
    this.metrics = {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      pendingUsers: 0,
      totalTeams: 0,
      totalRoles: 0,
      totalPermissions: 0,
      permissionCacheHits: 0,
      permissionCacheMisses: 0
    };
    
    this.initializeUserManagement();
  }

  /**
   * Initialize user management system
   */
  initializeUserManagement() {
    console.log('👥 Initializing advanced user management system...');
    
    // Setup default roles and permissions
    this.setupDefaultRolesAndPermissions();
    
    // Setup permission caching
    this.setupPermissionCaching();
    
    // Setup user lifecycle monitoring
    this.setupUserLifecycleMonitoring();
    
    console.log('✅ Advanced user management system initialized');
  }

  // ==================== USER MANAGEMENT ====================

  /**
   * Create new user
   */
  async createUser(userData) {
    const userId = this.generateUserId();
    
    const user = {
      id: userId,
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      status: 'pending', // pending, active, inactive, suspended, deleted
      createdAt: Date.now(),
      lastLoginAt: null,
      lastActivityAt: null,
      preferences: userData.preferences || {},
      metadata: userData.metadata || {},
      
      // Security
      passwordHash: await this.hashPassword(userData.password),
      passwordLastChanged: Date.now(),
      mfaEnabled: false,
      mfaSecret: null,
      
      // Profile
      avatar: userData.avatar || null,
      timezone: userData.timezone || 'UTC',
      language: userData.language || 'en',
      
      // Permissions context
      directPermissions: new Set(),
      customRoles: new Set()
    };
    
    this.users.set(userId, user);
    this.userRoles.set(userId, new Set());
    this.userTeams.set(userId, new Set());
    
    // Assign default role
    await this.assignRole(userId, 'user');
    
    // Update metrics
    this.metrics.totalUsers++;
    this.metrics.pendingUsers++;
    
    this.emit('user_created', user);
    
    console.log(`👤 User created: ${user.username} (${userId})`);
    return user;
  }

  /**
   * Activate user account
   */
  async activateUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.status !== 'pending') {
      throw new Error('User is not in pending state');
    }
    
    user.status = 'active';
    user.activatedAt = Date.now();
    
    // Update metrics
    this.metrics.pendingUsers--;
    this.metrics.activeUsers++;
    
    this.emit('user_activated', user);
    
    console.log(`✅ User activated: ${user.username}`);
    return user;
  }

  /**
   * Update user profile
   */
  async updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Validate updates
    const allowedFields = ['firstName', 'lastName', 'avatar', 'timezone', 'language', 'preferences'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }
    
    // Apply updates
    Object.assign(user, validUpdates);
    user.updatedAt = Date.now();
    
    // Clear permission cache
    this.clearUserPermissionCache(userId);
    
    this.emit('user_updated', { userId, updates: validUpdates });
    
    return user;
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId, reason = 'manual') {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const previousStatus = user.status;
    user.status = 'inactive';
    user.deactivatedAt = Date.now();
    user.deactivationReason = reason;
    
    // End all user sessions
    await this.endAllUserSessions(userId);
    
    // Update metrics
    if (previousStatus === 'active') {
      this.metrics.activeUsers--;
    } else if (previousStatus === 'pending') {
      this.metrics.pendingUsers--;
    }
    this.metrics.inactiveUsers++;
    
    this.emit('user_deactivated', { userId, reason });
    
    console.log(`🚫 User deactivated: ${user.username} (${reason})`);
    return user;
  }

  // ==================== ROLE-BASED ACCESS CONTROL ====================

  /**
   * Create new role
   */
  createRole(roleData) {
    const roleId = this.generateRoleId();
    
    const role = {
      id: roleId,
      name: roleData.name,
      description: roleData.description || '',
      type: roleData.type || 'custom', // system, custom
      level: roleData.level || 0, // for hierarchy
      inheritsFrom: roleData.inheritsFrom || null,
      createdAt: Date.now(),
      permissions: new Set(roleData.permissions || []),
      metadata: roleData.metadata || {}
    };
    
    this.roles.set(roleId, role);
    this.rolePermissions.set(roleId, new Set(roleData.permissions || []));
    
    this.metrics.totalRoles++;
    
    this.emit('role_created', role);
    
    console.log(`🎭 Role created: ${role.name} (${roleId})`);
    return role;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId, roleId) {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);
    
    if (!user) throw new Error('User not found');
    if (!role) throw new Error('Role not found');
    
    const userRoles = this.userRoles.get(userId);
    userRoles.add(roleId);
    
    // Clear permission cache
    this.clearUserPermissionCache(userId);
    
    this.emit('role_assigned', { userId, roleId });
    
    console.log(`🎭 Role assigned: ${role.name} to ${user.username}`);
  }

  /**
   * Remove role from user
   */
  async removeRole(userId, roleId) {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);
    
    if (!user) throw new Error('User not found');
    if (!role) throw new Error('Role not found');
    
    const userRoles = this.userRoles.get(userId);
    userRoles.delete(roleId);
    
    // Clear permission cache
    this.clearUserPermissionCache(userId);
    
    this.emit('role_removed', { userId, roleId });
    
    console.log(`🎭 Role removed: ${role.name} from ${user.username}`);
  }

  /**
   * Check if user has permission
   */
  async checkPermission(userId, permission, context = {}) {
    // Check cache first
    const cacheKey = `${userId}:${permission}:${JSON.stringify(context)}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.rbac.cacheTimeout) {
      this.metrics.permissionCacheHits++;
      return cached.hasPermission;
    }
    
    this.metrics.permissionCacheMisses++;
    
    // Calculate permissions
    const hasPermission = await this.calculateUserPermission(userId, permission, context);
    
    // Cache result
    this.permissionCache.set(cacheKey, {
      hasPermission,
      timestamp: Date.now()
    });
    
    return hasPermission;
  }

  /**
   * Calculate user permission
   */
  async calculateUserPermission(userId, permission, context = {}) {
    const user = this.users.get(userId);
    if (!user || user.status !== 'active') {
      return false;
    }
    
    // Check direct permissions
    if (user.directPermissions.has(permission)) {
      return true;
    }
    
    // Check role-based permissions
    const userRoles = this.userRoles.get(userId) || new Set();
    
    for (const roleId of userRoles) {
      const rolePermissions = this.rolePermissions.get(roleId) || new Set();
      
      if (rolePermissions.has(permission)) {
        return true;
      }
      
      // Check inherited permissions
      if (this.config.rbac.inheritanceEnabled) {
        const hasInheritedPermission = await this.checkInheritedPermission(roleId, permission);
        if (hasInheritedPermission) {
          return true;
        }
      }
    }
    
    // Check team-based permissions
    if (this.config.teams.inheritPermissions) {
      const hasTeamPermission = await this.checkTeamPermission(userId, permission, context);
      if (hasTeamPermission) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check inherited permissions from role hierarchy
   */
  async checkInheritedPermission(roleId, permission) {
    const role = this.roles.get(roleId);
    if (!role || !role.inheritsFrom) {
      return false;
    }
    
    const parentRolePermissions = this.rolePermissions.get(role.inheritsFrom) || new Set();
    if (parentRolePermissions.has(permission)) {
      return true;
    }
    
    // Recursive check
    return this.checkInheritedPermission(role.inheritsFrom, permission);
  }

  // ==================== TEAM MANAGEMENT ====================

  /**
   * Create new team
   */
  createTeam(teamData) {
    const teamId = this.generateTeamId();
    
    const team = {
      id: teamId,
      name: teamData.name,
      description: teamData.description || '',
      type: teamData.type || 'project', // project, department, organization
      parentTeam: teamData.parentTeam || null,
      level: this.calculateTeamLevel(teamData.parentTeam),
      createdAt: Date.now(),
      createdBy: teamData.createdBy,
      settings: teamData.settings || {},
      metadata: teamData.metadata || {},
      
      // Team permissions
      permissions: new Set(teamData.permissions || []),
      roles: new Set(teamData.roles || [])
    };
    
    // Validate nesting level
    if (team.level > this.config.teams.maxNestingLevel) {
      throw new Error('Maximum team nesting level exceeded');
    }
    
    this.teams.set(teamId, team);
    this.teamMembers.set(teamId, new Set());
    
    // Update hierarchy
    if (team.parentTeam) {
      this.teamHierarchy.set(teamId, team.parentTeam);
    }
    
    this.metrics.totalTeams++;
    
    this.emit('team_created', team);
    
    console.log(`👥 Team created: ${team.name} (${teamId})`);
    return team;
  }

  /**
   * Add user to team
   */
  async addUserToTeam(userId, teamId, role = 'member') {
    const user = this.users.get(userId);
    const team = this.teams.get(teamId);
    
    if (!user) throw new Error('User not found');
    if (!team) throw new Error('Team not found');
    
    // Check team size limit
    const currentMembers = this.teamMembers.get(teamId);
    if (currentMembers.size >= this.config.teams.maxTeamSize) {
      throw new Error('Team size limit exceeded');
    }
    
    // Add to team
    currentMembers.add(userId);
    
    // Update user teams
    const userTeams = this.userTeams.get(userId);
    userTeams.add(teamId);
    
    // Clear permission cache
    this.clearUserPermissionCache(userId);
    
    this.emit('user_added_to_team', { userId, teamId, role });
    
    console.log(`👥 User ${user.username} added to team ${team.name}`);
  }

  /**
   * Remove user from team
   */
  async removeUserFromTeam(userId, teamId) {
    const user = this.users.get(userId);
    const team = this.teams.get(teamId);
    
    if (!user) throw new Error('User not found');
    if (!team) throw new Error('Team not found');
    
    // Remove from team
    const teamMembers = this.teamMembers.get(teamId);
    teamMembers.delete(userId);
    
    // Update user teams
    const userTeams = this.userTeams.get(userId);
    userTeams.delete(teamId);
    
    // Clear permission cache
    this.clearUserPermissionCache(userId);
    
    this.emit('user_removed_from_team', { userId, teamId });
    
    console.log(`👥 User ${user.username} removed from team ${team.name}`);
  }

  /**
   * Check team-based permissions
   */
  async checkTeamPermission(userId, permission, context = {}) {
    const userTeams = this.userTeams.get(userId) || new Set();
    
    for (const teamId of userTeams) {
      const team = this.teams.get(teamId);
      if (!team) continue;
      
      // Check team permissions
      if (team.permissions.has(permission)) {
        return true;
      }
      
      // Check inherited team permissions
      if (await this.checkInheritedTeamPermission(teamId, permission)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check inherited team permissions
   */
  async checkInheritedTeamPermission(teamId, permission) {
    const parentTeamId = this.teamHierarchy.get(teamId);
    if (!parentTeamId) {
      return false;
    }
    
    const parentTeam = this.teams.get(parentTeamId);
    if (!parentTeam) {
      return false;
    }
    
    if (parentTeam.permissions.has(permission)) {
      return true;
    }
    
    // Recursive check
    return this.checkInheritedTeamPermission(parentTeamId, permission);
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Create user session
   */
  createSession(userId, sessionData = {}) {
    const sessionId = this.generateSessionId();
    
    const session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      expiresAt: Date.now() + this.config.security.sessionTimeout,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      isActive: true,
      metadata: sessionData.metadata || {}
    };
    
    this.userSessions.set(sessionId, session);
    
    // Update user last login
    const user = this.users.get(userId);
    if (user) {
      user.lastLoginAt = Date.now();
      user.lastActivityAt = Date.now();
    }
    
    this.emit('session_created', session);
    
    return session;
  }

  /**
   * Validate session
   */
  validateSession(sessionId) {
    const session = this.userSessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }
    
    if (!session.isActive) {
      return { valid: false, reason: 'session_inactive' };
    }
    
    if (Date.now() > session.expiresAt) {
      this.endSession(sessionId);
      return { valid: false, reason: 'session_expired' };
    }
    
    // Update activity
    session.lastActivityAt = Date.now();
    
    // Update user activity
    const user = this.users.get(session.userId);
    if (user) {
      user.lastActivityAt = Date.now();
    }
    
    return { valid: true, session };
  }

  /**
   * End session
   */
  endSession(sessionId) {
    const session = this.userSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.endedAt = Date.now();
      
      this.emit('session_ended', session);
    }
  }

  /**
   * End all user sessions
   */
  async endAllUserSessions(userId) {
    const userSessions = Array.from(this.userSessions.values())
      .filter(session => session.userId === userId && session.isActive);
    
    for (const session of userSessions) {
      this.endSession(session.id);
    }
    
    console.log(`🔐 Ended ${userSessions.length} sessions for user ${userId}`);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Setup default roles and permissions
   */
  setupDefaultRolesAndPermissions() {
    // Create system permissions
    for (const permission of this.systemPermissions) {
      this.permissions.set(permission, {
        id: permission,
        name: permission,
        description: `System permission: ${permission}`,
        type: 'system'
      });
    }
    
    // Create system roles
    const rolesConfig = [
      {
        id: 'super_admin',
        name: 'Super Administrator',
        permissions: Array.from(this.systemPermissions),
        level: 100
      },
      {
        id: 'admin',
        name: 'Administrator',
        permissions: ['read', 'write', 'delete', 'admin', 'create_team', 'manage_team', 'invite_users'],
        level: 80
      },
      {
        id: 'moderator',
        name: 'Moderator',
        permissions: ['read', 'write', 'moderate', 'create_team'],
        level: 60
      },
      {
        id: 'user',
        name: 'User',
        permissions: ['read', 'write'],
        level: 40
      },
      {
        id: 'guest',
        name: 'Guest',
        permissions: ['read'],
        level: 20
      }
    ];
    
    for (const roleConfig of rolesConfig) {
      this.roles.set(roleConfig.id, {
        ...roleConfig,
        type: 'system',
        createdAt: Date.now()
      });
      
      this.rolePermissions.set(roleConfig.id, new Set(roleConfig.permissions));
    }
    
    this.metrics.totalPermissions = this.permissions.size;
    this.metrics.totalRoles = this.roles.size;
    
    console.log('✅ Default roles and permissions setup complete');
  }

  /**
   * Setup permission caching
   */
  setupPermissionCaching() {
    if (!this.config.rbac.permissionCaching) return;
    
    // Clear expired cache entries periodically
    setInterval(() => {
      this.cleanupPermissionCache();
    }, this.config.rbac.cacheTimeout / 2);
  }

  /**
   * Setup user lifecycle monitoring
   */
  setupUserLifecycleMonitoring() {
    // Check for inactive users
    setInterval(() => {
      this.checkInactiveUsers();
    }, 86400000); // Daily
    
    // Check for password expiry
    setInterval(() => {
      this.checkPasswordExpiry();
    }, 86400000); // Daily
  }

  /**
   * Calculate team nesting level
   */
  calculateTeamLevel(parentTeamId) {
    if (!parentTeamId) return 0;
    
    const parentTeam = this.teams.get(parentTeamId);
    if (!parentTeam) return 0;
    
    return parentTeam.level + 1;
  }

  /**
   * Clear user permission cache
   */
  clearUserPermissionCache(userId) {
    const keysToDelete = [];
    
    for (const [key] of this.permissionCache) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.permissionCache.delete(key);
    }
  }

  /**
   * Get user management statistics
   */
  getUserManagementStats() {
    return {
      ...this.metrics,
      cacheSize: this.permissionCache.size,
      activeSessions: Array.from(this.userSessions.values())
        .filter(session => session.isActive).length,
      totalSessions: this.userSessions.size
    };
  }

  // ==================== PLACEHOLDER METHODS ====================

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRoleId() {
    return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTeamId() {
    return `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async hashPassword(password) {
    // Implementation would use bcrypt or similar
    return `hashed_${password}`;
  }

  cleanupPermissionCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, cached] of this.permissionCache) {
      if (now - cached.timestamp > this.config.rbac.cacheTimeout) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.permissionCache.delete(key);
    }
  }

  checkInactiveUsers() {
    const inactivityThreshold = Date.now() - (this.config.lifecycle.inactivityThreshold * 86400000);
    
    for (const user of this.users.values()) {
      if (user.status === 'active' && 
          user.lastActivityAt && 
          user.lastActivityAt < inactivityThreshold) {
        
        if (this.config.lifecycle.autoDeactivation) {
          this.deactivateUser(user.id, 'inactivity');
        } else {
          this.emit('user_inactive', user);
        }
      }
    }
  }

  checkPasswordExpiry() {
    const expiryThreshold = Date.now() - (this.config.lifecycle.passwordExpiry * 86400000);
    
    for (const user of this.users.values()) {
      if (user.status === 'active' && 
          user.passwordLastChanged < expiryThreshold) {
        
        this.emit('password_expired', user);
      }
    }
  }

  /**
   * Shutdown user management system
   */
  shutdown() {
    this.users.clear();
    this.roles.clear();
    this.permissions.clear();
    this.teams.clear();
    this.userSessions.clear();
    this.permissionCache.clear();
    this.userRoles.clear();
    this.rolePermissions.clear();
    this.teamMembers.clear();
    this.userTeams.clear();
    this.teamHierarchy.clear();
    
    this.emit('shutdown');
  }
}

export default AdvancedUserManagementSystem;
