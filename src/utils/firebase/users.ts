import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from './config';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: any;
  updatedAt: any;
}

/**
 * Create or update user profile in Firestore
 */
export const createOrUpdateUserProfile = async (firebaseUser: FirebaseUser): Promise<UserProfile> => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    
    // Check if user already exists
    const userSnap = await getDoc(userRef);
    
    // Build user data object, excluding undefined values
    const userData: any = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      updatedAt: serverTimestamp(),
    };

    // Only add displayName if it exists
    if (firebaseUser.displayName) {
      userData.displayName = firebaseUser.displayName;
    }

    // Only add avatarUrl if it exists
    if (firebaseUser.photoURL) {
      userData.avatarUrl = firebaseUser.photoURL;
    }

    if (userSnap.exists()) {
      // Update existing user
      await updateDoc(userRef, userData);
      console.log('✅ Updated existing user profile:', firebaseUser.uid);
    } else {
      // Create new user
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
      console.log('✅ Created new user profile:', firebaseUser.uid);
    }

    return {
      ...userData,
      createdAt: userSnap.data()?.createdAt || serverTimestamp(),
    } as UserProfile;
  } catch (error: any) {
    console.error('⚠️ Error creating/updating user profile:', error);
    // If it's a network error or blocked by client, return a basic profile
    // This allows the app to continue functioning even if Firestore is blocked
    if (error.code === 'unavailable' || error.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('📡 Firestore blocked or unavailable, returning basic user profile');
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || undefined,
        avatarUrl: firebaseUser.photoURL || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as UserProfile;
    }
    throw error;
  }
};

/**
 * Get user profile from Firestore
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  uid: string, 
  updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    
    // Filter out undefined values
    const cleanUpdates: any = {
      updatedAt: serverTimestamp(),
    };
    
    if (updates.displayName !== undefined) {
      cleanUpdates.displayName = updates.displayName;
    }
    
    if (updates.avatarUrl !== undefined) {
      cleanUpdates.avatarUrl = updates.avatarUrl;
    }
    
    await updateDoc(userRef, cleanUpdates);
    console.log('✅ Updated user profile:', uid);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};