/**
 * Network-Aware Authentication Configuration
 * Handles Firebase auth domain restrictions for network access
 */

import { getServerUrl } from './serverConfig';

/**
 * Check if we're accessing the app via network IP
 */
export const isNetworkAccess = () => {
  try {
    const hostname = window.location.hostname;
    // Check if hostname is an IP address (not localhost/127.0.0.1)
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    return ipPattern.test(hostname) && hostname !== '127.0.0.1';
  } catch (error) {
    return false;
  }
};

/**
 * Check if Firebase auth should be disabled for network access
 */
export const shouldDisableFirebaseAuth = () => {
  return isNetworkAccess() && process.env.REACT_APP_FIREBASE_ENABLED === 'true';
};

/**
 * Get network-aware Firebase configuration
 */
export const getNetworkAwareFirebaseConfig = () => {
  const baseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
  };

  // If accessing via network IP, disable Firebase auth to avoid domain restrictions
  if (isNetworkAccess()) {
    console.log('🌐 Network access detected - Using guest mode to avoid Firebase domain restrictions');
    return {
      ...baseConfig,
      enableAuth: false,
      networkMode: true,
      guestMode: true
    };
  }

  return {
    ...baseConfig,
    enableAuth: true,
    networkMode: false,
    guestMode: false
  };
};

/**
 * Get authentication method based on network access
 */
export const getAuthMethod = () => {
  if (isNetworkAccess()) {
    return 'guest';
  }
  return 'firebase';
};

/**
 * Create a guest user for network access
 */
export const createGuestUser = () => {
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  return {
    id: guestId,
    name: `Network User`,
    email: `${guestId}@network.codecollab.local`,
    avatar: null,
    role: 'guest',
    provider: 'network',
    isGuest: true,
    createdAt: new Date().toISOString()
  };
};

/**
 * Show network access notification to user
 */
export const showNetworkAccessInfo = () => {
  const hostname = window.location.hostname;
  console.log(`
🌐 CodeCollab Network Access Mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Connected via: ${hostname}
👤 Authentication: Guest Mode (Firebase auth disabled for network access)
🔧 All features available except:
   • Google Sign-in (domain restrictions)
   • Cloud storage (Firebase disabled)

💡 To use full authentication features:
   • Access via http://localhost:3000
   • Or configure Firebase authorized domains

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Show user-friendly notification
  if (window.showNotification) {
    window.showNotification({
      type: 'info',
      title: 'Network Access Mode',
      message: `Connected via ${hostname}. Using guest mode due to Firebase domain restrictions. All core features are available!`,
      duration: 8000
    });
  }
};

export default {
  isNetworkAccess,
  shouldDisableFirebaseAuth,
  getNetworkAwareFirebaseConfig,
  getAuthMethod,
  createGuestUser,
  showNetworkAccessInfo
};