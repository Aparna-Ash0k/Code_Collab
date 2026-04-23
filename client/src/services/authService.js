// Authentication service for API communication
import { getServerUrl } from '../utils/serverConfig';

class AuthService {
  constructor() {
    const serverUrl = getServerUrl();
    this.baseURL = `${serverUrl}/api`;
  }

  // Helper method to make API requests
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, mergedOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // User registration
  async register(userData) {
    const { name, email, password, confirmPassword } = userData;

    // Client-side validation
    if (!name || !email || !password) {
      throw new Error('All fields are required');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    return await this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password
      })
    });
  }

  // User login
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    return await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        password
      })
    });
  }

  // User logout
  async logout(token) {
    return await this.makeRequest('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  // Refresh authentication token
  async refreshToken(refreshToken) {
    return await this.makeRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  // Get user profile
  async getProfile(token) {
    return await this.makeRequest('/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  // Update user profile
  async updateProfile(token, updates) {
    return await this.makeRequest('/auth/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
  }

  // Change password
  async changePassword(token, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error('Current and new passwords are required');
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    return await this.makeRequest('/auth/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });
  }

  // Request password reset
  async requestPasswordReset(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    return await this.makeRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: email.toLowerCase().trim()
      })
    });
  }

  // Reset password with token
  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw new Error('Reset token and new password are required');
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    return await this.makeRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        newPassword
      })
    });
  }

  // Verify email with token
  async verifyEmail(token) {
    if (!token) {
      throw new Error('Verification token is required');
    }

    return await this.makeRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  // Resend verification email
  async resendVerificationEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    return await this.makeRequest('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({
        email: email.toLowerCase().trim()
      })
    });
  }

  // Validate user session
  async validateSession(token) {
    try {
      return await this.makeRequest('/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      // If validation fails, the token is invalid
      return { valid: false };
    }
  }

  // Social login (Google)
  async googleLogin(googleToken) {
    return await this.makeRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token: googleToken })
    });
  }

  // Social login (GitHub)
  async githubLogin(githubCode) {
    return await this.makeRequest('/auth/github', {
      method: 'POST',
      body: JSON.stringify({ code: githubCode })
    });
  }

  // Get user sessions (for session management)
  async getUserSessions(token) {
    return await this.makeRequest('/auth/sessions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  // Revoke user session
  async revokeSession(token, sessionId) {
    return await this.makeRequest(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  // Upload user avatar
  async uploadAvatar(token, file) {
    const formData = new FormData();
    formData.append('avatar', file);

    return await this.makeRequest('/auth/avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData, let browser set it
      },
      body: formData
    });
  }

  // Delete user account
  async deleteAccount(token, password) {
    if (!password) {
      throw new Error('Password confirmation is required');
    }

    return await this.makeRequest('/auth/delete-account', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ password })
    });
  }

  // Helper method to validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Helper method to validate password strength
  validatePasswordStrength(password) {
    const result = {
      isValid: false,
      score: 0,
      feedback: []
    };

    if (!password) {
      result.feedback.push('Password is required');
      return result;
    }

    if (password.length < 6) {
      result.feedback.push('Password must be at least 6 characters long');
    } else {
      result.score += 1;
    }

    if (password.length >= 8) {
      result.score += 1;
    }

    if (/[A-Z]/.test(password)) {
      result.score += 1;
    } else {
      result.feedback.push('Add uppercase letters for stronger security');
    }

    if (/[a-z]/.test(password)) {
      result.score += 1;
    } else {
      result.feedback.push('Add lowercase letters for stronger security');
    }

    if (/[0-9]/.test(password)) {
      result.score += 1;
    } else {
      result.feedback.push('Add numbers for stronger security');
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      result.score += 1;
    } else {
      result.feedback.push('Add special characters for stronger security');
    }

    result.isValid = result.score >= 3 && password.length >= 6;

    return result;
  }

  // Helper method to get password strength label
  getPasswordStrengthLabel(score) {
    if (score <= 2) return { label: 'Weak', color: '#f44336' };
    if (score <= 4) return { label: 'Fair', color: '#ff9800' };
    if (score <= 5) return { label: 'Good', color: '#2196f3' };
    return { label: 'Strong', color: '#4caf50' };
  }
}

// Create and export singleton instance
const authService = new AuthService();
export default authService;
