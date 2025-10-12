// Firebase Authentication Test
// You can run this in the browser console to test Firebase connection

import { auth } from './config';
import { onAuthStateChanged } from 'firebase/auth';

// Test Firebase Auth connection
export const testFirebaseAuth = () => {
  console.log('Testing Firebase Auth connection...');
  console.log('Auth instance:', auth);
  console.log('Current user:', auth.currentUser);
  
  // Listen for auth state changes
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('User is signed in:', user);
    } else {
      console.log('User is signed out');
    }
  });
  
  // Return unsubscribe function
  return unsubscribe;
};

// Test environment variables
export const testEnvVariables = () => {
  console.log('Environment Variables:');
  console.log('VITE_DEV_MODE:', import.meta.env.VITE_DEV_MODE);
  console.log('VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
  console.log('VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  console.log('VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '***' : 'NOT SET');
};