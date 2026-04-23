const bcrypt = require('bcrypt');

// User model for in-memory storage (replace with actual database model)
class User {
  constructor(userData) {
    this.id = userData.id || this.generateId();
    this.name = userData.name;
    this.email = userData.email;
    this.password = userData.password; // Should be hashed
    this.avatar = userData.avatar || this.generateAvatar(userData.name);
    this.role = userData.role || 'user';
    this.isActive = userData.isActive !== undefined ? userData.isActive : true;
    this.isOnline = false;
    this.lastActivity = new Date();
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = new Date();
    
    // Profile information
    this.bio = userData.bio || '';
    this.company = userData.company || '';
    this.location = userData.location || '';
    this.website = userData.website || '';
    
    // Settings and preferences
    this.preferences = {
      emailNotifications: true,
      collaborationNotifications: true,
      projectUpdates: true,
      theme: 'light',
      defaultProjectVisibility: 'private',
      ...userData.preferences
    };
    
    this.collaborationSettings = {
      defaultProjectVisibility: 'private',
      allowPublicProfile: false,
      showOnlineStatus: true,
      allowDirectMessages: true,
      autoSaveInterval: 5,
      showLiveCursors: true,
      enableVoiceChat: false,
      enableVideoChat: false,
      requireInviteApproval: true,
      allowGuestCollaborators: false,
      sessionTimeout: 24,
      emailNotifications: {
        projectInvites: true,
        collaboratorJoined: true,
        fileChanges: false,
        mentions: true,
        projectUpdates: true
      },
      pushNotifications: {
        projectInvites: true,
        collaboratorJoined: false,
        fileChanges: false,
        mentions: true,
        directMessages: true
      },
      enableGitSync: false,
      enableCloudBackup: true,
      enableAnalytics: true,
      ...userData.collaborationSettings
    };
  }

  generateId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAvatar(name) {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Hash password before saving
  async hashPassword(password) {
    const saltRounds = 12;
    this.password = await bcrypt.hash(password, saltRounds);
  }

  // Compare password for login
  async comparePassword(password) {
    return bcrypt.compare(password, this.password);
  }

  // Update user data
  update(data) {
    const allowedFields = [
      'name', 'email', 'avatar', 'bio', 'company', 'location', 'website',
      'preferences', 'collaborationSettings', 'role', 'isActive'
    ];
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'preferences' || key === 'collaborationSettings') {
          this[key] = { ...this[key], ...data[key] };
        } else {
          this[key] = data[key];
        }
      }
    });
    
    this.updatedAt = new Date();
  }

  // Get safe user data (without password)
  toSafeObject() {
    const { password, ...safeUser } = this;
    return safeUser;
  }

  // Update last activity
  updateActivity() {
    this.lastActivity = new Date();
    this.isOnline = true;
  }

  // Set offline status
  setOffline() {
    this.isOnline = false;
  }

  // Validate user data
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Valid email address is required');
    }

    if (!this.password || this.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Project model
class Project {
  constructor(projectData) {
    this.id = projectData.id || this.generateId();
    this.name = projectData.name;
    this.description = projectData.description || '';
    this.visibility = projectData.visibility || 'private'; // private, unlisted, public
    this.language = projectData.language || 'javascript';
    this.template = projectData.template || 'blank';
    
    this.owner = projectData.owner; // User ID
    this.ownerName = projectData.ownerName;
    this.collaborators = projectData.collaborators || [];
    
    this.fileCount = projectData.fileCount || 0;
    this.lastActivity = projectData.lastActivity || 'Project created';
    
    this.createdAt = projectData.createdAt || new Date();
    this.updatedAt = new Date();
    
    // Project settings
    this.settings = {
      allowGuests: false,
      requireInviteApproval: true,
      enableChat: true,
      enableVoiceChat: false,
      enableVideoChat: false,
      autoSave: true,
      autoSaveInterval: 5,
      ...projectData.settings
    };
    
    // File system structure
    this.files = projectData.files || {};
  }

  generateId() {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add collaborator
  addCollaborator(user, role = 'editor') {
    const existingIndex = this.collaborators.findIndex(c => c.id === user.id);
    
    if (existingIndex >= 0) {
      this.collaborators[existingIndex].role = role;
    } else {
      this.collaborators.push({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role, // owner, editor, viewer
        joinedAt: new Date(),
        lastActivity: new Date()
      });
    }
    
    this.updatedAt = new Date();
  }

  // Remove collaborator
  removeCollaborator(userId) {
    this.collaborators = this.collaborators.filter(c => c.id !== userId);
    this.updatedAt = new Date();
  }

  // Check if user has access
  hasAccess(userId, requiredRole = 'viewer') {
    if (this.owner === userId) return true;
    
    const collaborator = this.collaborators.find(c => c.id === userId);
    if (!collaborator) return false;
    
    const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
    const userRole = roleHierarchy[collaborator.role] || 0;
    const required = roleHierarchy[requiredRole] || 1;
    
    return userRole >= required;
  }

  // Update project data
  update(data) {
    const allowedFields = [
      'name', 'description', 'visibility', 'language', 'lastActivity',
      'fileCount', 'settings', 'files'
    ];
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'settings') {
          this.settings = { ...this.settings, ...data[key] };
        } else {
          this[key] = data[key];
        }
      }
    });
    
    this.updatedAt = new Date();
  }

  // Validate project data
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length < 1) {
      errors.push('Project name is required');
    }

    if (!this.owner) {
      errors.push('Project owner is required');
    }

    if (!['private', 'unlisted', 'public'].includes(this.visibility)) {
      errors.push('Invalid visibility setting');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Activity model
class Activity {
  constructor(activityData) {
    this.id = activityData.id || this.generateId();
    this.type = activityData.type; // file_edit, file_create, user_join, chat_message, etc.
    this.action = activityData.action;
    this.target = activityData.target;
    this.user = activityData.user;
    this.projectId = activityData.projectId;
    this.sessionId = activityData.sessionId;
    this.timestamp = activityData.timestamp || new Date();
    this.details = activityData.details || {};
  }

  generateId() {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Session model  
class Session {
  constructor(sessionData) {
    this.id = sessionData.id || this.generateId();
    this.userId = sessionData.userId;
    this.projectId = sessionData.projectId;
    this.name = sessionData.name || 'Untitled Session';
    this.description = sessionData.description || '';
    this.isActive = true;
    this.createdAt = sessionData.createdAt || new Date();
    this.updatedAt = new Date();
    this.lastActivity = new Date();
    
    // Session data
    this.virtualFileSystem = sessionData.virtualFileSystem || {};
    this.tabs = sessionData.tabs || [];
    this.activeTab = sessionData.activeTab || null;
    this.collaborators = sessionData.collaborators || [];
    
    // Settings
    this.settings = {
      autoSave: true,
      autoSaveInterval: 5,
      theme: 'light',
      ...sessionData.settings
    };
  }

  generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Update session data
  update(data) {
    const allowedFields = [
      'name', 'description', 'virtualFileSystem', 'tabs', 'activeTab',
      'collaborators', 'settings', 'projectId'
    ];
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        this[key] = data[key];
      }
    });
    
    this.updatedAt = new Date();
    this.lastActivity = new Date();
  }

  // Add collaborator to session
  addCollaborator(user, role = 'editor') {
    const existingIndex = this.collaborators.findIndex(c => c.id === user.id);
    
    if (existingIndex >= 0) {
      this.collaborators[existingIndex].role = role;
      this.collaborators[existingIndex].lastActivity = new Date();
    } else {
      this.collaborators.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role,
        joinedAt: new Date(),
        lastActivity: new Date()
      });
    }
  }

  // Remove collaborator from session
  removeCollaborator(userId) {
    this.collaborators = this.collaborators.filter(c => c.id !== userId);
  }
}

module.exports = {
  User,
  Project,
  Activity,
  Session
};
