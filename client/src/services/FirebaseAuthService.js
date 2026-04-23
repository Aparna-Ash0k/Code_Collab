import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, googleProvider } from '../utils/firebase';

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.currentToken = null;
    this.tokenRefreshTimer = null;
    this.authStateListeners = [];
    this.isInitialized = false;
    
    // Initialize auth state listener
    this.initializeAuthListener();
  }

  initializeAuthListener() {
    if (!auth) {
      console.warn('⚠️ Firebase auth not available');
      return;
    }

    // Listen for Firebase auth state changes
    onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is signed in
          await this.handleUserSignedIn(firebaseUser);
        } else {
          // User is signed out
          this.handleUserSignedOut();
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        this.notifyAuthStateListeners('error', { error: error.message });
      }
    });

    this.isInitialized = true;
  }

  async handleUserSignedIn(firebaseUser) {
    try {
      // Get fresh ID token
      const idToken = await firebaseUser.getIdToken();
      
      // Store user info
      this.currentUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified
      };
      
      this.currentToken = idToken;
      
      // Set up token refresh
      this.scheduleTokenRefresh(firebaseUser);
      
      // Notify listeners
      this.notifyAuthStateListeners('signed_in', {
        user: this.currentUser,
        token: idToken
      });
      
      console.log('✅ User authenticated with Firebase:', this.currentUser.email);
    } catch (error) {
      console.error('Error handling user sign in:', error);
      throw error;
    }
  }

  handleUserSignedOut() {
    this.currentUser = null;
    this.currentToken = null;
    
    // Clear token refresh timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    
    // Notify listeners
    this.notifyAuthStateListeners('signed_out', {});
    
    console.log('✅ User signed out from Firebase');
  }

  scheduleTokenRefresh(firebaseUser) {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Firebase ID tokens expire after 1 hour, refresh after 50 minutes
    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        console.log('🔄 Refreshing Firebase ID token...');
        const newToken = await firebaseUser.getIdToken(true); // Force refresh
        
        this.currentToken = newToken;
        
        // Notify listeners of token refresh
        this.notifyAuthStateListeners('token_refreshed', {
          user: this.currentUser,
          token: newToken
        });
        
        // Schedule next refresh
        this.scheduleTokenRefresh(firebaseUser);
        
        console.log('✅ Firebase ID token refreshed successfully');
      } catch (error) {
        console.error('❌ Token refresh failed:', error);
        this.notifyAuthStateListeners('token_refresh_failed', { error: error.message });
        
        // Retry refresh in 5 minutes
        setTimeout(() => {
          if (firebaseUser && auth.currentUser) {
            this.scheduleTokenRefresh(firebaseUser);
          }
        }, 5 * 60 * 1000);
      }
    }, 50 * 60 * 1000); // 50 minutes
  }

  async signInWithGoogle() {
    if (!auth || !googleProvider) {
      throw new Error('Firebase authentication not available');
    }

    try {
      console.log('🔄 Starting Google sign-in...');
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Get the fresh ID token
      const idToken = await user.getIdToken();
      
      console.log('✅ Google sign-in successful');
      
      // The onAuthStateChanged listener will handle the rest
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        },
        token: idToken
      };
    } catch (error) {
      // Don't log popup-closed-by-user as an error since it's a user action, not a system error
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('ℹ️ Google sign-in cancelled by user');
      } else {
        console.error('❌ Google sign-in failed:', error);
      }
      
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Another sign-in attempt is already in progress.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with the same email but different sign-in credentials.';
          break;
      }
      
      throw new Error(errorMessage);
    }
  }

  async signOut() {
    if (!auth) {
      console.warn('Firebase auth not available for sign out');
      return;
    }

    try {
      await firebaseSignOut(auth);
      console.log('✅ Firebase sign-out successful');
    } catch (error) {
      console.error('❌ Firebase sign-out failed:', error);
      throw new Error('Failed to sign out from Firebase.');
    }
  }

  async getCurrentToken() {
    if (!auth?.currentUser) {
      return null;
    }

    try {
      // Always get a fresh token to ensure it's not expired
      const token = await auth.currentUser.getIdToken();
      this.currentToken = token;
      return token;
    } catch (error) {
      console.error('Error getting current token:', error);
      return null;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser && !!this.currentToken;
  }

  // Add listener for auth state changes
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
    
    // If already initialized, immediately call with current state
    if (this.isInitialized) {
      if (this.currentUser) {
        callback('signed_in', { user: this.currentUser, token: this.currentToken });
      } else {
        callback('signed_out', {});
      }
    }
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(listener => listener !== callback);
    };
  }

  notifyAuthStateListeners(event, data) {
    this.authStateListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  // Get auth header for API requests
  async getAuthHeader() {
    const token = await this.getCurrentToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // Check if token is valid (not expired)
  isTokenValid() {
    if (!this.currentToken) return false;
    
    try {
      // Decode JWT payload to check expiration
      const payload = JSON.parse(atob(this.currentToken.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Add 5 minute buffer for token expiration
      return payload.exp > (currentTime + 300);
    } catch (error) {
      console.warn('Token validation failed:', error);
      return false;
    }
  }

  // Wait for authentication to be initialized
  async waitForInitialization() {
    if (this.isInitialized) return;
    
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }
}

// Create singleton instance
export const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;