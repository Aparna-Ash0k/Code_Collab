/**
 * AuthenticationIntegrationService - Ensures Firebase Auth integrates consistently with database
 * Handles offline/online state transitions and user synchronization
 */

import { schemaHarmonizer } from '../utils/SchemaHarmonizer';
import { databaseSyncService } from './DatabaseSyncService';

export class AuthenticationIntegrationService {
  constructor() {
    this.authListeners = new Set();
    this.onlineStatusCheckers = new Map();
    this.authStateCache = new Map();
    this.syncPendingOperations = [];
    this.isOnline = navigator.onLine;
    this.lastHeartbeat = new Date();
    
    this.setupNetworkListeners();
    this.startHeartbeat();
    
    console.log('🔐 AuthenticationIntegrationService initialized');
  }

  /**
   * Add authentication event listener
   */
  addAuthListener(callback) {
    this.authListeners.add(callback);
  }

  /**
   * Remove authentication event listener
   */
  removeAuthListener(callback) {
    this.authListeners.delete(callback);
  }

  /**
   * Notify authentication listeners
   */
  notifyAuthListeners(event, data) {
    this.authListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  /**
   * Setup network status listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Network came online');
      this.isOnline = true;
      this.handleOnlineStateChange(true);
    });

    window.addEventListener('offline', () => {
      console.log('🌐 Network went offline');
      this.isOnline = false;
      this.handleOnlineStateChange(false);
    });
  }

  /**
   * Handle online/offline state changes
   */
  async handleOnlineStateChange(isOnline) {
    this.notifyAuthListeners('network_state_changed', { isOnline });

    if (isOnline) {
      // Coming back online - sync pending operations
      await this.syncPendingAuthOperations();
      await this.validateAuthStates();
    } else {
      // Going offline - prepare for offline mode
      await this.prepareOfflineMode();
    }
  }

  /**
   * Sync pending authentication operations when coming back online
   */
  async syncPendingAuthOperations() {
    if (this.syncPendingOperations.length === 0) {
      return;
    }

    console.log(`🔄 Syncing ${this.syncPendingOperations.length} pending auth operations...`);

    const results = [];
    for (const operation of this.syncPendingOperations) {
      try {
        const result = await this.executePendingAuthOperation(operation);
        results.push({ operation, result, success: true });
      } catch (error) {
        console.error('Failed to sync auth operation:', operation, error);
        results.push({ operation, error, success: false });
      }
    }

    // Clear successfully synced operations
    this.syncPendingOperations = this.syncPendingOperations.filter((_, index) => 
      !results[index].success
    );

    this.notifyAuthListeners('pending_operations_synced', { results });
  }

  /**
   * Execute a pending authentication operation
   */
  async executePendingAuthOperation(operation) {
    switch (operation.type) {
      case 'user_update':
        return await this.syncUserUpdate(operation.data);
      
      case 'login_event':
        return await this.syncLoginEvent(operation.data);
      
      case 'logout_event':
        return await this.syncLogoutEvent(operation.data);
      
      case 'status_change':
        return await this.syncStatusChange(operation.data);
      
      default:
        throw new Error(`Unknown pending operation type: ${operation.type}`);
    }
  }

  /**
   * Prepare for offline mode
   */
  async prepareOfflineMode() {
    console.log('📴 Preparing for offline mode...');

    // Cache current auth states
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      this.authStateCache.set('current_user', {
        ...currentUser,
        cachedAt: new Date(),
        isOfflineCached: true
      });
    }

    // Store authentication tokens for offline validation
    const tokens = this.getStoredTokens();
    if (tokens) {
      this.authStateCache.set('auth_tokens', {
        ...tokens,
        cachedAt: new Date()
      });
    }

    this.notifyAuthListeners('offline_mode_prepared', {
      cachedUser: currentUser,
      tokensAvailable: !!tokens
    });
  }

  /**
   * Validate authentication states across Firebase and database
   */
  async validateAuthStates() {
    console.log('🔍 Validating auth states across systems...');

    try {
      const firebaseUser = await this.getFirebaseUser();
      const databaseUser = await this.getDatabaseUser();
      const localUser = this.getLocalStorageUser();

      const validation = {
        firebase: !!firebaseUser,
        database: !!databaseUser,
        localStorage: !!localUser,
        consistent: true,
        conflicts: []
      };

      // Check for inconsistencies
      if (firebaseUser && databaseUser) {
        const compatibility = await schemaHarmonizer.checkSchemaCompatibility(
          this.transformDatabaseUser(databaseUser),
          this.transformFirebaseUser(firebaseUser),
          'users'
        );

        if (!compatibility.isCompatible) {
          validation.consistent = false;
          validation.conflicts.push(...compatibility.conflicts);
        }
      }

      // Check if user exists in one system but not another
      if ((firebaseUser && !databaseUser) || (!firebaseUser && databaseUser)) {
        validation.consistent = false;
        validation.conflicts.push({
          type: 'user_existence_mismatch',
          firebase: !!firebaseUser,
          database: !!databaseUser
        });
      }

      if (!validation.consistent) {
        await this.resolveAuthInconsistencies(validation.conflicts, {
          firebaseUser,
          databaseUser,
          localUser
        });
      }

      this.notifyAuthListeners('auth_state_validated', validation);
      return validation;

    } catch (error) {
      console.error('Auth state validation failed:', error);
      this.notifyAuthListeners('auth_validation_error', { error });
      throw error;
    }
  }

  /**
   * Resolve authentication inconsistencies
   */
  async resolveAuthInconsistencies(conflicts, userData) {
    console.log('🔧 Resolving auth inconsistencies...', conflicts);

    for (const conflict of conflicts) {
      try {
        switch (conflict.type) {
          case 'user_existence_mismatch':
            await this.resolveUserExistenceMismatch(userData);
            break;

          case 'value_mismatch':
            await this.resolveUserDataMismatch(conflict, userData);
            break;

          case 'missing_fields':
            await this.resolveMissingFields(conflict, userData);
            break;

          default:
            console.warn('Unknown conflict type:', conflict.type);
        }
      } catch (error) {
        console.error('Failed to resolve conflict:', conflict, error);
      }
    }
  }

  /**
   * Resolve user existence mismatch between Firebase and database
   */
  async resolveUserExistenceMismatch(userData) {
    const { firebaseUser, databaseUser } = userData;

    if (firebaseUser && !databaseUser) {
      // Create database user from Firebase user
      console.log('👤 Creating database user from Firebase user');
      
      const dbUserData = schemaHarmonizer.firebaseToPostgresql('users', 
        this.transformFirebaseUser(firebaseUser)
      );

      await this.createDatabaseUser(dbUserData);
      
    } else if (databaseUser && !firebaseUser) {
      // User exists in database but not Firebase - handle gracefully
      console.log('👤 Database user exists without Firebase auth - maintaining local session');
      
      // This might be a local-only user or a sign that Firebase auth failed
      // We'll maintain the local session but mark it as database-only
      this.authStateCache.set('database_only_user', {
        user: databaseUser,
        timestamp: new Date()
      });
    }
  }

  /**
   * Resolve user data mismatches
   */
  async resolveUserDataMismatch(conflict, userData) {
    const { firebaseUser, databaseUser } = userData;
    
    // Use latest timestamp to determine which version to keep
    const firebaseTime = new Date(firebaseUser.lastLoginAt || firebaseUser.updatedAt || 0);
    const databaseTime = new Date(databaseUser.updated_at || databaseUser.last_login_at || 0);

    if (firebaseTime >= databaseTime) {
      // Firebase is more recent, update database
      const updates = schemaHarmonizer.firebaseToPostgresql('users', 
        this.transformFirebaseUser(firebaseUser)
      );
      await this.updateDatabaseUser(databaseUser.id, updates);
    } else {
      // Database is more recent, update Firebase
      const updates = schemaHarmonizer.postgresqlToFirebase('users', 
        this.transformDatabaseUser(databaseUser)
      );
      await this.updateFirebaseUser(firebaseUser.uid, updates);
    }
  }

  /**
   * Resolve missing fields
   */
  async resolveMissingFields(conflict, userData) {
    const { firebaseUser, databaseUser } = userData;

    if (conflict.location === 'firebase') {
      // Add missing fields to Firebase
      const defaults = schemaHarmonizer.addFirebaseDefaults('users', {});
      const updates = {};
      
      conflict.fields.forEach(field => {
        if (defaults[field] !== undefined) {
          updates[field] = defaults[field];
        }
      });

      await this.updateFirebaseUser(firebaseUser.uid, updates);
      
    } else if (conflict.location === 'postgresql') {
      // Add missing fields to database
      const defaults = schemaHarmonizer.addPostgresDefaults('users', {});
      const updates = {};
      
      conflict.fields.forEach(field => {
        if (defaults[field] !== undefined) {
          updates[field] = defaults[field];
        }
      });

      await this.updateDatabaseUser(databaseUser.id, updates);
    }
  }

  /**
   * Handle user login event
   */
  async handleUserLogin(user, provider = 'email') {
    console.log(`🔑 Handling user login: ${user.email} via ${provider}`);

    try {
      // Update user's online status
      await this.updateUserOnlineStatus(user.id, true);

      // Sync user data across systems
      await this.syncUserAcrossSystems(user);

      // Queue login event for database sync
      if (this.isOnline) {
        databaseSyncService.queueSync({
          type: 'unidirectional',
          entityType: 'users',
          data: user,
          source: 'auth',
          target: 'database',
          options: {
            operation: 'login',
            provider,
            timestamp: new Date()
          }
        });
      } else {
        this.syncPendingOperations.push({
          type: 'login_event',
          data: { user, provider },
          timestamp: new Date()
        });
      }

      this.notifyAuthListeners('user_logged_in', { user, provider });

    } catch (error) {
      console.error('Login handling failed:', error);
      this.notifyAuthListeners('login_error', { user, error });
      throw error;
    }
  }

  /**
   * Handle user logout event
   */
  async handleUserLogout(user) {
    console.log(`🔓 Handling user logout: ${user.email}`);

    try {
      // Update user's online status
      await this.updateUserOnlineStatus(user.id, false);

      // Clear cached auth state
      this.authStateCache.delete('current_user');
      this.authStateCache.delete('auth_tokens');

      // Queue logout event
      if (this.isOnline) {
        databaseSyncService.queueSync({
          type: 'unidirectional',
          entityType: 'users',
          data: { ...user, isOnline: false },
          source: 'auth',
          target: 'database',
          options: {
            operation: 'logout',
            timestamp: new Date()
          }
        });
      } else {
        this.syncPendingOperations.push({
          type: 'logout_event',
          data: { user },
          timestamp: new Date()
        });
      }

      this.notifyAuthListeners('user_logged_out', { user });

    } catch (error) {
      console.error('Logout handling failed:', error);
      this.notifyAuthListeners('logout_error', { user, error });
      throw error;
    }
  }

  /**
   * Sync user data across all systems
   */
  async syncUserAcrossSystems(user) {
    const operations = [];

    // Sync to Firebase
    operations.push(
      databaseSyncService.queueSync({
        type: 'unidirectional',
        entityType: 'users',
        data: user,
        source: 'auth',
        target: 'firebase'
      })
    );

    // Sync to localStorage for offline access
    operations.push(
      databaseSyncService.queueSync({
        type: 'unidirectional',
        entityType: 'users',
        data: user,
        source: 'auth',
        target: 'localstorage'
      })
    );

    return Promise.all(operations);
  }

  /**
   * Update user online status
   */
  async updateUserOnlineStatus(userId, isOnline) {
    const statusUpdate = {
      id: userId,
      isOnline,
      lastActivity: new Date()
    };

    if (this.isOnline) {
      databaseSyncService.queueSync({
        type: 'unidirectional',
        entityType: 'users',
        data: statusUpdate,
        source: 'auth',
        target: 'database',
        options: {
          operation: 'status_update'
        }
      });
    } else {
      this.syncPendingOperations.push({
        type: 'status_change',
        data: statusUpdate,
        timestamp: new Date()
      });
    }
  }

  /**
   * Start heartbeat to monitor online status
   */
  startHeartbeat() {
    setInterval(() => {
      this.lastHeartbeat = new Date();
      
      if (this.isOnline) {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          this.updateUserOnlineStatus(currentUser.id, true);
        }
      }
    }, 30000); // 30 seconds
  }

  /**
   * Get current user from various sources
   */
  getCurrentUser() {
    // Try localStorage first
    let user = this.getLocalStorageUser();
    
    // Then try cache
    if (!user) {
      user = this.authStateCache.get('current_user');
    }

    return user;
  }

  /**
   * Get user from localStorage
   */
  getLocalStorageUser() {
    try {
      const userJson = localStorage.getItem('codecollab_user');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get stored authentication tokens
   */
  getStoredTokens() {
    try {
      const token = localStorage.getItem('codecollab_token') || 
                   sessionStorage.getItem('codecollab_token');
      return token ? { accessToken: token } : null;
    } catch {
      return null;
    }
  }

  /**
   * Transform Firebase user to standard format
   */
  transformFirebaseUser(firebaseUser) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      lastLoginAt: firebaseUser.metadata?.lastSignInTime,
      createdAt: firebaseUser.metadata?.creationTime,
      isOnline: true // Assume online if we have Firebase user
    };
  }

  /**
   * Transform database user to standard format
   */
  transformDatabaseUser(databaseUser) {
    return {
      id: databaseUser.id,
      email: databaseUser.email,
      display_name: databaseUser.display_name,
      is_online: databaseUser.is_online,
      created_at: databaseUser.created_at,
      updated_at: databaseUser.updated_at,
      last_login_at: databaseUser.last_login_at
    };
  }

  // Placeholder methods for actual Firebase/database operations
  async getFirebaseUser() {
    // This would integrate with Firebase Auth
    return null;
  }

  async getDatabaseUser() {
    // This would query the database
    return null;
  }

  async createDatabaseUser(userData) {
    console.log('Creating database user:', userData);
  }

  async updateDatabaseUser(userId, updates) {
    console.log('Updating database user:', userId, updates);
  }

  async updateFirebaseUser(uid, updates) {
    console.log('Updating Firebase user:', uid, updates);
  }

  async syncUserUpdate(data) {
    console.log('Syncing user update:', data);
  }

  async syncLoginEvent(data) {
    console.log('Syncing login event:', data);
  }

  async syncLogoutEvent(data) {
    console.log('Syncing logout event:', data);
  }

  async syncStatusChange(data) {
    console.log('Syncing status change:', data);
  }
}

// Create singleton instance
export const authenticationIntegrationService = new AuthenticationIntegrationService();

export default AuthenticationIntegrationService;
