import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthGuard.css';

const AuthGuard = ({ 
  children, 
  fallback, 
  requiredRole = null,
  showLoginPrompt = true,
  onLoginClick 
}) => {
  const { user, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="auth-guard-loading">
        <div className="auth-guard-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // User is not authenticated
  if (!user) {
    if (fallback) {
      return fallback;
    }

    if (showLoginPrompt) {
      return (
        <div className="auth-guard-prompt">
          <div className="auth-guard-prompt-content">
            <div className="auth-guard-prompt-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
              </svg>
            </div>
            <h3>Authentication Required</h3>
            <p>Please sign in to access this feature.</p>
            {onLoginClick && (
              <button 
                className="auth-guard-login-btn"
                onClick={onLoginClick}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      );
    }

    return null;
  }

  // Check role-based access if required
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="auth-guard-prompt">
        <div className="auth-guard-prompt-content">
          <div className="auth-guard-prompt-icon auth-guard-prompt-icon-warning">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z" />
            </svg>
          </div>
          <h3>Access Restricted</h3>
          <p>
            This feature requires {requiredRole} privileges. 
            {user.role && ` You are currently signed in as a ${user.role}.`}
          </p>
        </div>
      </div>
    );
  }

  // User is authenticated and has required permissions
  return children;
};

export default AuthGuard;
