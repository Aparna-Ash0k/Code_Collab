import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAuth = true, redirectTo = '/login', guestFallback = null }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bg-accent mx-auto mb-4"></div>
          <p className="text-text-secondary">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    // Show guest fallback component if provided
    if (guestFallback) {
      return guestFallback;
    }
    
    // Otherwise redirect to login with return URL
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If authentication is NOT required but user IS authenticated, redirect away
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Render children if authentication requirements are met
  return children;
};

// HOC version for class components or additional functionality
export const withAuth = (Component, options = {}) => {
  const { requireAuth = true, redirectTo = '/login' } = options;
  
  return function AuthenticatedComponent(props) {
    return (
      <ProtectedRoute requireAuth={requireAuth} redirectTo={redirectTo}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};

// Helper component for guest-only routes (login, register pages)
export const GuestOnlyRoute = ({ children, redirectTo = '/' }) => {
  return (
    <ProtectedRoute requireAuth={false} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  );
};

export default ProtectedRoute;
