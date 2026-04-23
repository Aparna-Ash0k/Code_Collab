const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User, Project, Activity } = require('../models/User');
const { authenticateGoogleUser, syncVFSToFirebase, loadFirebaseToVFS } = require('../services/database');
const { users, activities } = require('../storage/userStorage');

// Firebase Admin SDK for token verification
let admin = null;
try {
  if (process.env.FIREBASE_ADMIN_KEY) {
    admin = require('firebase-admin');
    // Firebase Admin is already initialized in index.js
    console.log('✅ Firebase Admin available in auth routes');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin not available in auth routes:', error.message);
}

const router = express.Router();

// In-memory storage (using shared storage)
const projects = new Map();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'codecollab-enhanced-secret-key';

// Helper function to generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

// Google Authentication with Firebase Integration
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    // Use the enhanced database service for Google authentication
    const authResult = await authenticateGoogleUser(idToken);
    
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { user } = authResult.data;

    // Check if user already exists in our system
    let existingUser = Array.from(users.values()).find(u => u.email === user.email || u.id === user.uid);

    if (existingUser) {
      // Update existing user with Google info
      existingUser.update({
        name: user.name || existingUser.name,
        avatar: user.picture || existingUser.avatar,
        provider: 'google',
        isEmailVerified: user.email_verified,
        lastLoginAt: new Date().toISOString()
      });
      
      existingUser.updateActivity();
      user = existingUser;
    } else {
      // Create new user
      const userData = {
        id: user.uid,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        avatar: user.picture || user.name?.charAt(0).toUpperCase() || 'U',
        role: 'user',
        provider: 'google',
        isEmailVerified: user.email_verified || false,
        isActive: true
      };

      const newUser = new User(userData);
      users.set(newUser.email, newUser);
      user = newUser;

      console.log(`✅ New Google user created: ${user.name} (${user.email})`);
    }

    // Log activity
    const activity = new Activity({
      type: 'user_login',
      action: 'signed in with Google',
      target: 'account',
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      details: {
        provider: 'google',
        email: user.email,
        userAgent: req.headers['user-agent']
      }
    });
    activities.push(activity);

    // Generate our own JWT token for the session
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: 'google'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
        firebaseToken: idToken // Include Firebase token for client-side Firebase operations
      }
    });

  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during Google authentication'
    });
  }
});

// User Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    if (users.has(email.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: 'user'
    };

    const user = new User(userData);
    await user.hashPassword(password);

    // Validate user data
    const validation = user.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(', ')
      });
    }

    // Save user
    users.set(user.email, user);

    // Log activity
    const activity = new Activity({
      type: 'user_register',
      action: 'registered',
      target: 'account',
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      details: {
        registrationMethod: 'email'
      }
    });
    activities.push(activity);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = users.get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update user activity
    user.updateActivity();

    // Log activity
    const activity = new Activity({
      type: 'user_login',
      action: 'logged in',
      target: 'account',
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      details: {
        loginMethod: 'email',
        userAgent: req.headers['user-agent']
      }
    });
    activities.push(activity);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// User Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = Array.from(users.values()).find(u => u.id === userId);
    
    if (user) {
      user.setOffline();
      
      // Log activity
      const activity = new Activity({
        type: 'user_logout',
        action: 'logged out',
        target: 'account',
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        }
      });
      activities.push(activity);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
});

// Get User Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = Array.from(users.values()).find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeObject()
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update User Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = Array.from(users.values()).find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user data
    user.update(req.body);

    // Validate updated data
    const validation = user.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(', ')
      });
    }

    // Log activity
    const activity = new Activity({
      type: 'user_profile_update',
      action: 'updated profile',
      target: 'account',
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      details: {
        updatedFields: Object.keys(req.body)
      }
    });
    activities.push(activity);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toSafeObject()
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.sub;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = Array.from(users.values()).find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    await user.hashPassword(newPassword);

    // Log activity
    const activity = new Activity({
      type: 'user_password_change',
      action: 'changed password',
      target: 'account',
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      }
    });
    activities.push(activity);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get User Activities
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Filter activities for the user
    const userActivities = activities
      .filter(activity => activity.user.id === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        activities: userActivities,
        total: activities.filter(a => a.user.id === userId).length
      }
    });

  } catch (error) {
    console.error('Activities fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Sync VFS to Firebase (for authenticated users)
router.post('/sync-vfs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { vfsData } = req.body;

    if (!vfsData) {
      return res.status(400).json({
        success: false,
        message: 'VFS data is required'
      });
    }

    const syncResult = await syncVFSToFirebase(userId, vfsData);
    
    if (!syncResult.success) {
      return res.status(500).json(syncResult);
    }

    // Log activity
    const user = Array.from(users.values()).find(u => u.id === userId);
    if (user) {
      const activity = new Activity({
        type: 'file_sync',
        action: 'synced files to Firebase',
        target: 'files',
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        },
        details: {
          fileCount: syncResult.data.syncedFiles,
          folderCount: syncResult.data.syncedFolders
        }
      });
      activities.push(activity);
    }

    res.json({
      success: true,
      message: 'VFS synced to Firebase successfully',
      data: syncResult.data
    });

  } catch (error) {
    console.error('VFS sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during VFS sync'
    });
  }
});

// Load Firebase to VFS (for authenticated users)
router.get('/load-vfs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;

    const loadResult = await loadFirebaseToVFS(userId);
    
    if (!loadResult.success) {
      return res.status(500).json(loadResult);
    }

    // Log activity
    const user = Array.from(users.values()).find(u => u.id === userId);
    if (user) {
      const activity = new Activity({
        type: 'file_load',
        action: 'loaded files from Firebase',
        target: 'files',
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        },
        details: {
          fileCount: loadResult.data.loadedFiles,
          folderCount: loadResult.data.loadedFolders
        }
      });
      activities.push(activity);
    }

    res.json({
      success: true,
      message: 'VFS loaded from Firebase successfully',
      data: loadResult.data
    });

  } catch (error) {
    console.error('VFS load error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during VFS load'
    });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = Array.from(users.values()).find(u => u.id === decoded.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    res.json({
      success: true,
      data: tokens
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
