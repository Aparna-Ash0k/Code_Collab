/**
 * Firebase Firestore Schema and Security Rules
 * 
 * Implements the schema outlined in the architecture document:
 * - /projects/{projectId} - Project metadata
 * - /projects/{projectId}/files/{fileId} - File metadata and content
 * - /projects/{projectId}/snapshots/{snapshotId} - Snapshot metadata
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../utils/firebase';

// Firestore Security Rules (firestore.rules)
const FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(projectData) {
      return request.auth.uid == projectData.ownerUid;
    }
    
    function isCollaborator(projectData) {
      return request.auth.uid in projectData.collaborators;
    }
    
    function canReadProject(projectData) {
      return projectData.visibility == 'public' || 
             isOwner(projectData) || 
             isCollaborator(projectData);
    }
    
    function canWriteProject(projectData) {
      return isOwner(projectData) || isCollaborator(projectData);
    }

    // Projects collection
    match /projects/{projectId} {
      allow read: if isAuthenticated() && canReadProject(resource.data);
      allow create: if isAuthenticated() && 
                   request.auth.uid == request.resource.data.ownerUid;
      allow update: if isAuthenticated() && canWriteProject(resource.data);
      allow delete: if isAuthenticated() && isOwner(resource.data);
      
      // Files subcollection
      match /files/{fileId} {
        allow read: if isAuthenticated() && 
                   canReadProject(get(/databases/$(database)/documents/projects/$(projectId)).data);
        allow write: if isAuthenticated() && 
                    canWriteProject(get(/databases/$(database)/documents/projects/$(projectId)).data);
      }
      
      // Snapshots subcollection
      match /snapshots/{snapshotId} {
        allow read: if isAuthenticated() && 
                   canReadProject(get(/databases/$(database)/documents/projects/$(projectId)).data);
        allow write: if isAuthenticated() && 
                    canWriteProject(get(/databases/$(database)/documents/projects/$(projectId)).data);
      }
    }
    
    // Users collection (for user profiles)
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Activities collection (for audit logs)
    match /activities/{activityId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
    }
  }
}
`;

// Firebase Storage Security Rules (storage.rules)  
const STORAGE_RULES = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Snapshots
    match /snapshots/{projectId}/{snapshotId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // User uploads
    match /uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Project assets
    match /projects/{projectId}/assets/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
`;

// TypeScript interfaces for the schema
export interface Project {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  visibility: 'private' | 'team' | 'public';
  collaborators: { [uid: string]: 'owner' | 'editor' | 'viewer' };
  rootFolderId?: string;
  latestSnapshotStoragePath?: string;
  description?: string;
  language?: string;
  tags?: string[];
}

export interface ProjectFile {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  mime?: string;
  size: number;
  contentText?: string; // For small text files
  storagePath?: string; // For large files or binaries
  updatedAt: Timestamp;
  updatedByUid: string;
  parentPath?: string;
  checksum?: string;
  isDirectory: boolean;
  permissions?: {
    read: string[];
    write: string[];
  };
  metadata?: {
    language?: string;
    encoding?: string;
    lineCount?: number;
    [key: string]: any;
  };
}

export interface ProjectSnapshot {
  id: string;
  createdAt: Timestamp;
  createdByUid: string;
  storagePath: string;
  message?: string;
  fileCount: number;
  folderCount: number;
  size: number;
  tags?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'email' | 'google' | 'github';
  emailVerified: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  preferences?: {
    theme: 'light' | 'dark' | 'auto';
    editor: {
      fontSize: number;
      tabSize: number;
      wordWrap: boolean;
      minimap: boolean;
    };
  };
  quotas?: {
    maxProjects: number;
    maxStorageMB: number;
    maxCollaborators: number;
  };
  usage?: {
    projectCount: number;
    storageUsedMB: number;
    fileCount: number;
  };
}

export interface Activity {
  id: string;
  type: 'file_operation' | 'project_operation' | 'collaboration' | 'auth';
  action: string; // 'file_created', 'file_updated', 'user_joined', etc.
  userId: string;
  userName?: string;
  projectId?: string;
  timestamp: Timestamp;
  details?: {
    filePath?: string;
    fileSize?: number;
    collaboratorId?: string;
    changes?: any;
    [key: string]: any;
  };
  metadata?: {
    userAgent?: string;
    ip?: string;
    sessionId?: string;
  };
}

// Database initialization and helper functions
export class FirebaseSchema {
  static async initializeProject(projectData: Partial<Project>): Promise<string> {
    const projectRef = doc(collection(db, 'projects'));
    const project: Project = {
      id: projectRef.id,
      name: projectData.name || 'Untitled Project',
      ownerUid: projectData.ownerUid!,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      visibility: projectData.visibility || 'private',
      collaborators: { [projectData.ownerUid!]: 'owner' },
      ...projectData
    };
    
    await setDoc(projectRef, project);
    return projectRef.id;
  }

  static async createFile(projectId: string, fileData: Partial<ProjectFile>): Promise<string> {
    const fileRef = doc(collection(db, 'projects', projectId, 'files'));
    const file: ProjectFile = {
      id: fileRef.id,
      path: fileData.path!,
      name: fileData.name || this.getFileName(fileData.path!),
      type: fileData.type || 'file',
      size: fileData.size || 0,
      isDirectory: fileData.type === 'folder',
      updatedAt: serverTimestamp() as any,
      updatedByUid: fileData.updatedByUid!,
      ...fileData
    };
    
    await setDoc(fileRef, file);
    return fileRef.id;
  }

  static async createSnapshot(projectId: string, snapshotData: Partial<ProjectSnapshot>): Promise<string> {
    const snapshotRef = doc(collection(db, 'projects', projectId, 'snapshots'));
    const snapshot: ProjectSnapshot = {
      id: snapshotRef.id,
      createdAt: serverTimestamp() as any,
      createdByUid: snapshotData.createdByUid!,
      storagePath: snapshotData.storagePath!,
      fileCount: snapshotData.fileCount || 0,
      folderCount: snapshotData.folderCount || 0,
      size: snapshotData.size || 0,
      ...snapshotData
    };
    
    await setDoc(snapshotRef, snapshot);
    return snapshotRef.id;
  }

  static async logActivity(activityData: Partial<Activity>): Promise<string> {
    const activityRef = doc(collection(db, 'activities'));
    const activity: Activity = {
      id: activityRef.id,
      type: activityData.type!,
      action: activityData.action!,
      userId: activityData.userId!,
      timestamp: serverTimestamp() as any,
      ...activityData
    };
    
    await setDoc(activityRef, activity);
    return activityRef.id;
  }

  static async createUserProfile(userData: Partial<UserProfile>): Promise<void> {
    const userRef = doc(db, 'users', userData.uid!);
    const user: UserProfile = {
      uid: userData.uid!,
      email: userData.email!,
      name: userData.name!,
      provider: userData.provider || 'email',
      emailVerified: userData.emailVerified || false,
      createdAt: serverTimestamp() as any,
      lastLoginAt: serverTimestamp() as any,
      preferences: {
        theme: 'auto',
        editor: {
          fontSize: 14,
          tabSize: 2,
          wordWrap: true,
          minimap: true
        }
      },
      quotas: {
        maxProjects: 10,
        maxStorageMB: 100,
        maxCollaborators: 5
      },
      usage: {
        projectCount: 0,
        storageUsedMB: 0,
        fileCount: 0
      },
      ...userData
    };
    
    await setDoc(userRef, user, { merge: true });
  }

  // Helper functions
  static getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  static getParentPath(path: string): string {
    const parts = path.split('/');
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  }

  static detectMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const mimeMap: { [key: string]: string } = {
      'js': 'text/javascript',
      'jsx': 'text/javascript',
      'ts': 'text/typescript',
      'tsx': 'text/typescript',
      'py': 'text/x-python',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip'
    };
    return mimeMap[ext] || 'application/octet-stream';
  }
}

// Export rules as strings for deployment
export { FIRESTORE_RULES, STORAGE_RULES };
