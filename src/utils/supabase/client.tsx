import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { createOrUpdateUserProfile } from '../firebase/users';

export type User = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatar?: string;
  };
};

export type AuthState = {
  user: User | null;
  session: any;
  loading: boolean;
};

// Convert Firebase User to our User type
export const convertFirebaseUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null;
  
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || undefined,
    user_metadata: {
      name: firebaseUser.displayName || undefined,
      avatar: firebaseUser.photoURL || undefined,
    },
  };
};

// Firebase Auth wrapper functions
export const firebaseAuth = {
    // Sign in with email and password
  signInWithEmailAndPassword: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Create or update user profile in Firestore
      await createOrUpdateUserProfile(userCredential.user);
      
      return {
        data: { user: convertFirebaseUser(userCredential.user) },
        error: null
      };
    } catch (error: any) {
      return {
        data: { user: null },
        error: error
      };
    }
  },

  // Sign up with email and password
  signUpWithEmailAndPassword: async (email: string, password: string, name?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name if provided
      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
        // Reload the user to get updated data
        await userCredential.user.reload();
        
        // Get fresh user reference after reload
        const freshUser = auth.currentUser;
        if (freshUser) {
          console.log('✅ User display name after reload:', freshUser.displayName);
          // Create user profile in Firestore with fresh user
          await createOrUpdateUserProfile(freshUser);
          
          return {
            data: { user: convertFirebaseUser(freshUser) },
            error: null
          };
        }
      }
      
      // Fallback: Create user profile in Firestore
      await createOrUpdateUserProfile(userCredential.user);
      
      return {
        data: { user: convertFirebaseUser(userCredential.user) },
        error: null
      };
    } catch (error: any) {
      return {
        data: { user: null },
        error: error
      };
    }
  },

  // Sign in with Google
  signInWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      // Create or update user profile in Firestore
      await createOrUpdateUserProfile(userCredential.user);
      
      return {
        data: { user: convertFirebaseUser(userCredential.user) },
        error: null
      };
    } catch (error: any) {
      return {
        data: { user: null },
        error: error
      };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error: error };
    }
  },

  // Reset password
  resetPassword: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (error: any) {
      return { error: error };
    }
  },

  // Get current session
  getSession: async () => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        let session = null;
        
        console.log('🔍 Firebase auth state check:', {
          hasUser: !!user,
          userUid: user?.uid,
          userEmail: user?.email
        });
        
        if (user) {
          try {
            console.log('🔑 Firebase user found, getting ID token...');
            const idToken = await user.getIdToken();
            console.log('🎯 Firebase ID token obtained successfully');
            console.log('🔍 Token length:', idToken.length);
            console.log('🔍 Token preview:', idToken.substring(0, 100) + '...');
            
            session = { 
              access_token: idToken, 
              user: convertFirebaseUser(user) 
            };
            console.log('✅ Created session with real Firebase token');
          } catch (error) {
            console.error('❌ Error getting Firebase ID token:', error);
            console.log('🔄 No session created due to token error');
            // Fallback to null session if token fetch fails
          }
        } else {
          console.log('❌ No Firebase user signed in - returning null session');
        }
        
        resolve({
          data: { session }
        });
      });
    });
  },

  // Auth state change listener
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    console.log('🔄 Setting up Firebase auth state change listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🚨 Firebase auth state changed triggered!', {
        hasUser: !!user,
        userUid: user?.uid,
        userEmail: user?.email,
        isEmailVerified: user?.emailVerified,
        providerId: user?.providerId,
        authCurrentUser: !!auth.currentUser,
        timestamp: new Date().toISOString()
      });
      
      let session = null;
      
      if (user) {
        try {
          console.log('🔑 Firebase auth state changed - user found, getting ID token...');
          console.log('👤 User details:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            isAnonymous: user.isAnonymous,
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime
          });
          
          // Create or update user profile in Firestore
          await createOrUpdateUserProfile(user);
          
          const idToken = await user.getIdToken();
          console.log('🎯 Firebase ID token obtained - length:', idToken.length);
          session = { 
            access_token: idToken, 
            user: convertFirebaseUser(user) 
          };
          console.log('✅ Session created successfully');
        } catch (error) {
          console.error('❌ Error getting Firebase ID token in auth state change:', error);
          // Fallback to null session if token fetch fails
        }
      } else {
        console.log('❌ No Firebase user in auth state change');
        console.log('🔍 Auth instance current user:', auth.currentUser);
        console.log('🔍 Possible reasons:');
        console.log('   1. User was signed out');
        console.log('   2. Session expired');
        console.log('   3. Auth state was cleared');
        console.log('   4. No user was ever signed in');
      }
      
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    });

    return {
      data: {
        subscription: {
          unsubscribe
        }
      }
    };
  }
};

// Export as supabase for compatibility (temporary)
export const supabase = {
  auth: firebaseAuth
};