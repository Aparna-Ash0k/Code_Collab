import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';

const LoginForm = ({ onSwitchToRegister, onClose, onGuestMode }) => {
  const { login, isLoading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!authService.isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const result = await login(formData.email, formData.password, formData.rememberMe);
      if (result.success) {
        onClose();
      }
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleDemoLogin = async (userType) => {
    const demoCredentials = {
      admin: { email: 'admin@codecollab.com', password: 'admin123' },
      user: { email: 'user@codecollab.com', password: 'user123' }
    };

    const credentials = demoCredentials[userType];
    if (credentials) {
      setFormData(prev => ({ ...prev, ...credentials }));
      
      try {
        const result = await login(credentials.email, credentials.password, true);
        if (result.success) {
          onClose();
        }
      } catch (err) {
        console.error('Demo login error:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">Welcome Back</h2>
        <p className="text-text-secondary mt-2">
          Sign in to access collaboration features
        </p>
      </div>

      {/* Demo Login Buttons */}
      <div className="space-y-2">
        <p className="text-xs text-text-tertiary text-center">Quick Demo Login:</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleDemoLogin('admin')}
            disabled={isLoading}
            className="flex-1 py-2 px-4 bg-bg-accent text-white rounded text-sm hover:bg-bg-accent-hover transition-colors disabled:opacity-50"
          >
            Demo Admin
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('user')}
            disabled={isLoading}
            className="flex-1 py-2 px-4 bg-surface-tertiary text-text-primary rounded text-sm hover:bg-hover-primary transition-colors disabled:opacity-50"
          >
            Demo User
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-primary"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-surface-primary text-text-tertiary">Or continue with</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-text-tertiary" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-bg-accent focus:border-transparent ${
                validationErrors.email 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-border-primary bg-surface-primary'
              }`}
            />
          </div>
          {validationErrors.email && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-text-tertiary" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-bg-accent focus:border-transparent ${
                validationErrors.password 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-border-primary bg-surface-primary'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />
              ) : (
                <Eye className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />
              )}
            </button>
          </div>
          {validationErrors.password && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="h-4 w-4 text-bg-accent focus:ring-bg-accent border-border-primary rounded"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-text-secondary">
              Remember me
            </label>
          </div>
          <button
            type="button"
            className="text-sm text-bg-accent hover:text-bg-accent-hover"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-bg-accent text-white rounded-lg hover:bg-bg-accent-hover focus:ring-2 focus:ring-bg-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Footer Actions */}
      <div className="space-y-3">
        <div className="text-center">
          <span className="text-sm text-text-secondary">Don't have an account? </span>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-sm text-bg-accent hover:text-bg-accent-hover font-medium"
          >
            Sign up
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onGuestMode}
            className="text-sm text-text-tertiary hover:text-text-secondary"
          >
            Continue as Guest (Limited Features)
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
