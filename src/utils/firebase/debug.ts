// Firebase Auth Debug Utilities
import { auth } from './config';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Debug the current auth state
export const debugAuthState = () => {
  console.log('🔍 Firebase Auth Debug Report');
  console.log('==================================');
  console.log('Auth instance:', !!auth);
  console.log('Current user:', auth.currentUser?.uid || 'No user signed in');
  console.log('User email:', auth.currentUser?.email || 'N/A');
  console.log('Email verified:', auth.currentUser?.emailVerified || 'N/A');
  console.log('User creation time:', auth.currentUser?.metadata?.creationTime || 'N/A');
  console.log('Last sign in time:', auth.currentUser?.metadata?.lastSignInTime || 'N/A');
  console.log('==================================');
  
  return {
    hasAuth: !!auth,
    hasUser: !!auth.currentUser,
    userUid: auth.currentUser?.uid,
    userEmail: auth.currentUser?.email
  };
};

// Test sign in with a test account (for debugging purposes)
export const testSignIn = async (email: string = 'test@example.com', password: string = 'testpass123') => {
  try {
    console.log('🧪 Testing sign in with:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Test sign in successful:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.log('❌ Test sign in failed:', error.code, error.message);
    
    // If user doesn't exist, try to create it for testing
    if (error.code === 'auth/user-not-found') {
      console.log('🔧 Creating test user...');
      try {
        const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Test user created:', newUserCredential.user.uid);
        return newUserCredential.user;
      } catch (createError: any) {
        console.log('❌ Failed to create test user:', createError.code, createError.message);
        return null;
      }
    }
    return null;
  }
};

// Listen to auth state changes with detailed logging
export const watchAuthState = () => {
  console.log('👁️  Setting up auth state watcher...');
  
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    console.log('🔄 AUTH STATE CHANGED:');
    if (user) {
      console.log('  ✅ User signed in:', user.uid);
      console.log('  📧 Email:', user.email);
      console.log('  ✉️ Email verified:', user.emailVerified);
      console.log('  🕒 Creation time:', user.metadata.creationTime);
      console.log('  🕒 Last sign in:', user.metadata.lastSignInTime);
    } else {
      console.log('  ❌ No user signed in');
    }
  });
  
  return unsubscribe;
};

// Call this from browser console to debug
(window as any).firebaseDebug = {
  debugAuthState,
  testSignIn,
  watchAuthState
};