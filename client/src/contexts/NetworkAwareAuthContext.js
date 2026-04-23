/**
 * Network-Aware Authentication Provider
 * Handles authentication for both localhost and network access
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { firebaseAuthService } from '../services/FirebaseAuthService';
import { authenticationIntegrationService } from '../services/AuthenticationIntegrationService';
import { getServerUrl } from './serverConfig';
import { 
  isNetworkAccess, 
  shouldDisableFirebaseAuth, 
  createGuestUser, 
  showNetworkAccessInfo,
  getAuthMethod 
} from './networkConfig';

// Authentication action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  LOGOUT: 'LOGOUT',
  SET_TOKEN: 'SET_TOKEN',
  SET_NETWORK_MODE: 'SET_NETWORK_MODE'
};

// Initial authentication state
const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  isNetworkMode: false,
  authMethod: 'firebase'
};

// Authentication reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
      
    case AUTH_ACTIONS.SET_USER:
      return { 
        ...state, 
        user: action.payload, 
        isAuthenticated: !!action.payload,
        error: null,
        isLoading: false
      };
      
    case AUTH_ACTIONS.SET_TOKEN:
      return { ...state, token: action.payload };
      
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
      
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
      
    case AUTH_ACTIONS.SET_NETWORK_MODE:
      return { 
        ...state, 
        isNetworkMode: action.payload.isNetworkMode,
        authMethod: action.payload.authMethod
      };
      
    case AUTH_ACTIONS.LOGOUT:
      return { 
        ...initialState, 
        isLoading: false,
        isNetworkMode: state.isNetworkMode,
        authMethod: state.authMethod
      };
      
    default:
      return state;
  }
}

// Authentication context
const NetworkAwareAuthContext = createContext();

// Network-aware authentication provider
export const NetworkAwareAuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication based on network access
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      try {
        const networkMode = isNetworkAccess();
        const authMethod = getAuthMethod();
        
        dispatch({ 
          type: AUTH_ACTIONS.SET_NETWORK_MODE, 
          payload: { isNetworkMode: networkMode, authMethod }
        });

        if (networkMode) {
          // Network access mode - use guest authentication
          console.log('🌐 Initializing network access mode');
          showNetworkAccessInfo();
          await initializeGuestAuth();
        } else {
          // Local access mode - use Firebase authentication
          console.log('🏠 Initializing localhost access mode');
          await initializeFirebaseAuth();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      } finally {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Initialize guest authentication for network access
  const initializeGuestAuth = async () => {
    try {
      // Check if we have a stored guest user
      const storedGuestUser = localStorage.getItem('codecollab_network_guest_user');
      let guestUser;

      if (storedGuestUser) {
        guestUser = JSON.parse(storedGuestUser);
        console.log('🔄 Restored network guest user:', guestUser.name);
      } else {
        guestUser = createGuestUser();
        localStorage.setItem('codecollab_network_guest_user', JSON.stringify(guestUser));
        console.log('✅ Created new network guest user:', guestUser.name);
      }

      // Create a simple guest token
      const guestToken = btoa(JSON.stringify({
        sub: guestUser.id,
        email: guestUser.email,
        name: guestUser.name,
        role: guestUser.role,
        provider: guestUser.provider,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      }));

      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: guestUser });
      dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: guestToken });

      console.log('✅ Guest authentication initialized');
      
    } catch (error) {
      console.error('Guest auth initialization error:', error);
      throw error;
    }
  };

  // Initialize Firebase authentication for localhost access
  const initializeFirebaseAuth = async () => {
    try {
      // Check for stored authentication data
      const storedUser = localStorage.getItem('codecollab_auth_user');
      const storedToken = localStorage.getItem('codecollab_auth_token');

      if (storedUser && storedToken) {
        try {
          const user = JSON.parse(storedUser);
          dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
          dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: storedToken });
          console.log('🔄 Restored local user session:', user.name);
          return;
        } catch (parseError) {
          console.warn('Failed to parse stored auth data:', parseError);
          localStorage.removeItem('codecollab_auth_user');
          localStorage.removeItem('codecollab_auth_token');
        }
      }

      // Initialize Firebase auth service
      if (firebaseAuthService && firebaseAuthService.isAvailable) {
        firebaseAuthService.onAuthStateChange((authData) => {
          if (authData.user) {
            dispatch({ type: AUTH_ACTIONS.SET_USER, payload: authData.user });
            dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: authData.token });
            
            // Store auth data
            localStorage.setItem('codecollab_auth_user', JSON.stringify(authData.user));
            localStorage.setItem('codecollab_auth_token', authData.token);
          } else {
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
            localStorage.removeItem('codecollab_auth_user');
            localStorage.removeItem('codecollab_auth_token');
          }
        });

        console.log('✅ Firebase authentication service initialized');
      } else {
        console.log('⚠️ Firebase authentication not available, creating demo user');
        
        // Create a demo user for localhost when Firebase is not available
        const demoUser = {
          id: 'demo_user_localhost',
          name: 'Demo User',
          email: 'demo@localhost.codecollab',
          avatar: null,
          role: 'user',
          provider: 'demo',
          isDemoUser: true,
          createdAt: new Date().toISOString()
        };

        const demoToken = btoa(JSON.stringify({
          sub: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
          role: demoUser.role,
          provider: demoUser.provider,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }));

        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: demoUser });
        dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: demoToken });
      }
      
    } catch (error) {
      console.error('Firebase auth initialization error:', error);
      throw error;
    }
  };

  // Sign in with Google (localhost only)
  const signInWithGoogle = useCallback(async () => {
    if (state.isNetworkMode) {
      throw new Error('Google sign-in is not available in network mode due to Firebase domain restrictions. You are already signed in as a guest user.');
    }

    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const result = await firebaseAuthService.signInWithGoogle();
      
      if (result.success) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: result.user });
        dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: result.token });
        
        // Store auth data
        localStorage.setItem('codecollab_auth_user', JSON.stringify(result.user));
        localStorage.setItem('codecollab_auth_token', result.token);
        
        console.log('✅ Google sign-in successful');
        return result;
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, [state.isNetworkMode]);

  // Sign out
  const signOut = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    
    try {
      if (!state.isNetworkMode && firebaseAuthService) {
        await firebaseAuthService.signOut();
      }
      
      // Clear stored auth data
      localStorage.removeItem('codecollab_auth_user');
      localStorage.removeItem('codecollab_auth_token');
      
      if (state.isNetworkMode) {
        localStorage.removeItem('codecollab_network_guest_user');
        // Re-initialize guest auth after logout
        await initializeGuestAuth();
      } else {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
      
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, [state.isNetworkMode]);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    if (!state.user) return;

    try {
      const updatedUser = { ...state.user, ...updates };
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: updatedUser });
      
      // Update stored user data
      if (state.isNetworkMode) {
        localStorage.setItem('codecollab_network_guest_user', JSON.stringify(updatedUser));
      } else {
        localStorage.setItem('codecollab_auth_user', JSON.stringify(updatedUser));
      }
      
      console.log('✅ Profile updated');
      return updatedUser;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }, [state.user, state.isNetworkMode]);

  // Clear authentication error
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  // Get authentication status info
  const getAuthInfo = useCallback(() => {
    return {
      isNetworkMode: state.isNetworkMode,
      authMethod: state.authMethod,
      canUseGoogleAuth: !state.isNetworkMode,
      isGuest: state.user?.isGuest || false,
      isDemoUser: state.user?.isDemoUser || false,
      hostname: window.location.hostname
    };
  }, [state.isNetworkMode, state.authMethod, state.user]);

  const value = {
    // State
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    isNetworkMode: state.isNetworkMode,
    authMethod: state.authMethod,
    
    // Actions
    signInWithGoogle,
    signOut,
    updateProfile,
    clearError,
    getAuthInfo
  };

  return (
    <NetworkAwareAuthContext.Provider value={value}>
      {children}
    </NetworkAwareAuthContext.Provider>
  );
};

// Hook to use network-aware authentication
export const useNetworkAwareAuth = () => {
  const context = useContext(NetworkAwareAuthContext);
  if (!context) {
    throw new Error('useNetworkAwareAuth must be used within a NetworkAwareAuthProvider');
  }
  return context;
};

export default NetworkAwareAuthContext;