import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('🔥 Firebase config check:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
  authDomain: firebaseConfig.authDomain || 'MISSING',
  projectId: firebaseConfig.projectId || 'MISSING',
  hasAllKeys: !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('🚀 Firebase app initialized:', !!app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
console.log('🔐 Firebase auth initialized:', !!auth);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
console.log('🗄️ Firebase Firestore initialized:', !!db);

// Initialize Analytics (only in production and browser environment)
export const analytics = typeof window !== 'undefined' && import.meta.env.PROD 
  ? getAnalytics(app) 
  : null;

// Set auth persistence to ensure sessions are maintained across browser sessions
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Firebase auth persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('❌ Error setting auth persistence:', error);
  });

// Check initial auth state after a small delay
setTimeout(() => {
  console.log('🔍 Initial auth state check:');
  console.log('   Current user:', auth.currentUser?.uid || 'none');
  console.log('   User email:', auth.currentUser?.email || 'none');
}, 100);

// Import debug utilities in development
if (import.meta.env.DEV) {
  import('./debug');
}

export default app;