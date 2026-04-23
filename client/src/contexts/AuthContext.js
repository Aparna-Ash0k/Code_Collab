import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { firebaseAuthService } from '../services/FirebaseAuthService';
import { authenticationIntegrationService } from '../services/AuthenticationIntegrationService';
import { getServerUrl } from '../utils/serverConfig';

// Authentication action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  LOGOUT: 'LOGOUT',
  SET_TOKEN: 'SET_TOKEN'
};

// Initial authentication state
const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  error: null
};

// Authentication reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload, error: null };
      
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null
      };
      
    case AUTH_ACTIONS.SET_TOKEN:
      return { ...state, token: action.payload };
      
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
      
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
      
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false
      };
      
    default:
      return state;
  }
}

// Authentication context
const AuthContext = createContext();

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Token validation using Firebase service
  const isTokenValid = useCallback(() => {
    return firebaseAuthService.isTokenValid();
  }, []);

  // Initialize authentication state from Firebase
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Wait for Firebase auth to initialize
        await firebaseAuthService.waitForInitialization();
        
        // Initialize authentication integration service
        authenticationIntegrationService.addAuthListener((event, data) => {
          console.log('🔐 Auth integration event:', event, data);
          
          switch (event) {
            case 'user_logged_in':
              // Handle integrated login
              break;
            case 'user_logged_out':
              // Handle integrated logout
              break;
            case 'auth_state_validated':
              // Handle auth state validation
              if (!data.consistent) {
                console.warn('⚠️ Auth state inconsistencies detected');
              }
              break;
            case 'network_state_changed':
              // Handle network changes
              console.log(`🌐 Network state: ${data.isOnline ? 'online' : 'offline'}`);
              break;
          }
        });

        // Set up Firebase auth state listener
        const unsubscribe = firebaseAuthService.addAuthStateListener(async (event, data) => {
          switch (event) {
            case 'signed_in':
              try {
                const userData = {
                  id: data.user.uid,
                  email: data.user.email,
                  name: data.user.displayName || data.user.email?.split('@')[0] || 'User',
                  avatar: data.user.photoURL || null,
                  role: 'user',
                  provider: 'google',
                  isEmailVerified: data.user.emailVerified
                };

                // Update localStorage with fresh data
                localStorage.setItem('codecollab_token', data.token);
                localStorage.setItem('codecollab_user', JSON.stringify(userData));

                dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: data.token });
                dispatch({ type: AUTH_ACTIONS.SET_USER, payload: userData });
                
                console.log('✅ Firebase auth state updated');
              } catch (error) {
                console.warn('Failed to process Firebase auth state:', error);
                dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Authentication failed' });
              }
              break;
              
            case 'signed_out':
              // Clear localStorage
              localStorage.removeItem('codecollab_token');
              localStorage.removeItem('codecollab_user');
              
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
              break;
              
            case 'token_refreshed':
              // Update token in storage and state
              localStorage.setItem('codecollab_token', data.token);
              dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: data.token });
              console.log('✅ Token refreshed automatically');
              break;
              
            case 'token_refresh_failed':
              console.warn('⚠️ Token refresh failed, user may need to re-authenticate');
              dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Session expired. Please sign in again.' });
              break;
              
            case 'error':
              dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.error });
              break;
          }
        });

        // Check if user is already authenticated
        if (firebaseAuthService.isAuthenticated()) {
          const currentUser = firebaseAuthService.getCurrentUser();
          const currentToken = await firebaseAuthService.getCurrentToken();
          
          if (currentUser && currentToken) {
            const userData = {
              id: currentUser.uid,
              email: currentUser.email,
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              avatar: currentUser.photoURL || null,
              role: 'user',
              provider: 'google',
              isEmailVerified: currentUser.emailVerified
            };

            dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: currentToken });
            dispatch({ type: AUTH_ACTIONS.SET_USER, payload: userData });
            console.log('✅ User session restored from Firebase');
          }
        } else {
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }

        // Cleanup function
        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Failed to initialize authentication' });
      }
    };

    initializeAuth();
  }, []);

  // Google login function with proper Firebase token handling
  const loginWithGoogle = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const result = await firebaseAuthService.signInWithGoogle();
      
      if (result.success) {
        // Firebase auth state listener will handle the rest
        console.log('✅ Google login successful');
        return { success: true };
      } else {
        throw new Error('Google sign-in failed');
      }
    } catch (error) {
      const errorMessage = error.message || 'Google login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  }, []);

  // Login function
  const login = useCallback(async (email, password, rememberMe = false) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      // Call our server's login endpoint
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        const { user, accessToken } = data.data;
        
        // Store in localStorage
        if (rememberMe) {
          localStorage.setItem('codecollab_token', accessToken);
          localStorage.setItem('codecollab_user', JSON.stringify(user));
        } else {
          // Use sessionStorage for non-persistent login
          sessionStorage.setItem('codecollab_token', accessToken);
          sessionStorage.setItem('codecollab_user', JSON.stringify(user));
        }

        dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: accessToken });
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
        
        // Handle login through authentication integration service
        try {
          await authenticationIntegrationService.handleUserLogin(user, 'email');
        } catch (integrationError) {
          console.warn('Auth integration login handling failed:', integrationError);
        }
        
        console.log('✅ User logged in successfully');
        return { success: true };
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.message });
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  }, []);

  // Register function
  const register = useCallback(async (userData) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      // Call our server's register endpoint
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();
      
      if (data.success) {
        const { user, accessToken } = data.data;
        
        // Store in localStorage
        localStorage.setItem('codecollab_token', accessToken);
        localStorage.setItem('codecollab_user', JSON.stringify(user));

        dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: accessToken });
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
        
        // Handle registration through authentication integration service
        try {
          await authenticationIntegrationService.handleUserLogin(user, 'registration');
        } catch (integrationError) {
          console.warn('Auth integration registration handling failed:', integrationError);
        }
        
        console.log('✅ User registered successfully');
        return { success: true };
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.message });
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Registration failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  }, []);

  // Logout function with proper Firebase cleanup
  const logout = useCallback(async () => {
    const currentUser = state.user;
    
    try {
      // Handle logout through authentication integration service
      if (currentUser) {
        try {
          await authenticationIntegrationService.handleUserLogout(currentUser);
        } catch (integrationError) {
          console.warn('Auth integration logout handling failed:', integrationError);
        }
      }
      
      // Sign out from Firebase
      await firebaseAuthService.signOut();
      
      // Firebase auth state listener will handle the rest of cleanup
      console.log('✅ User logged out');
    } catch (error) {
      console.warn('Sign-out error:', error);
      
      // Force cleanup even if sign-out fails
      localStorage.removeItem('codecollab_token');
      localStorage.removeItem('codecollab_user');
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  }, [state.user]);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

    try {
      // Simulate API call
      const updatedUser = { ...state.user, ...updates };
      
      // Update localStorage
      localStorage.setItem('codecollab_user', JSON.stringify(updatedUser));
      
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: updatedUser });
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Failed to update profile' });
      return { success: false, message: error.message };
    }
  }, [state.user]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  // Get authentication header for API calls with fresh token
  const getAuthHeader = useCallback(async () => {
    try {
      return await firebaseAuthService.getAuthHeader();
    } catch (error) {
      console.warn('Failed to get auth header:', error);
      return {};
    }
  }, []);

  const value = {
    // State
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    
    // Actions
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    clearError,
    getAuthHeader,
    isTokenValid
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use authentication context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Simulated API functions (replace with actual API calls)
const simulateLoginAPI = async (email, password) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Demo users for testing
  const demoUsers = [
    {
      email: 'admin@codecollab.com',
      password: 'admin123',
      user: {
        id: '1',
        email: 'admin@codecollab.com',
        name: 'Admin User',
        avatar: 'A',
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    },
    {
      email: 'user@codecollab.com',
      password: 'user123',
      user: {
        id: '2',
        email: 'user@codecollab.com',
        name: 'Demo User',
        avatar: 'U',
        role: 'user',
        createdAt: new Date().toISOString()
      }
    }
  ];

  const foundUser = demoUsers.find(u => u.email === email && u.password === password);
  
  if (foundUser) {
    const token = generateMockJWT(foundUser.user);
    return {
      success: true,
      data: {
        user: foundUser.user,
        token
      }
    };
  } else {
    return {
      success: false,
      message: 'Invalid email or password'
    };
  }
};

const simulateRegisterAPI = async (userData) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Basic validation
  if (!userData.email || !userData.password || !userData.name) {
    return {
      success: false,
      message: 'All fields are required'
    };
  }

  if (userData.password.length < 6) {
    return {
      success: false,
      message: 'Password must be at least 6 characters long'
    };
  }

  // Check if email already exists (demo check)
  if (userData.email === 'admin@codecollab.com' || userData.email === 'user@codecollab.com') {
    return {
      success: false,
      message: 'Email already exists'
    };
  }

  const newUser = {
    id: Date.now().toString(),
    email: userData.email,
    name: userData.name,
    avatar: userData.name.charAt(0).toUpperCase(),
    role: 'user',
    createdAt: new Date().toISOString()
  };

  const token = generateMockJWT(newUser);

  return {
    success: true,
    data: {
      user: newUser,
      token
    }
  };
};

// Generate mock JWT token
const generateMockJWT = (user) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  };

  // Simple base64 encoding (not secure, just for demo)
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = btoa(`mock_signature_${user.id}_${Date.now()}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export default AuthContext;
