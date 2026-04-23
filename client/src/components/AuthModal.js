import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, loginWithGoogle, register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        setSuccess('Login successful!');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1000);
      } else {
        await register(formData);
        setSuccess('Registration successful! You can now log in.');
        setTimeout(() => {
          switchMode('login');
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await loginWithGoogle();
      setSuccess('Google login successful!');
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Google login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (type) => {
    setIsLoading(true);
    setError('');

    try {
      if (type === 'admin') {
        await login('admin@codecollab.com', 'admin123');
      } else {
        await login('user@codecollab.com', 'user123');
      }
      setSuccess('Demo login successful!');
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="auth-modal-header">
          <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <p className="auth-modal-subtitle">
            {mode === 'login' 
              ? 'Sign in to access collaboration features' 
              : 'Join CodeCollab to start collaborating'
            }
          </p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="auth-alert auth-alert-success">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="auth-form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Enter your full name"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="Enter your password"
              disabled={isLoading}
              minLength={6}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm your password"
                disabled={isLoading}
                minLength={6}
              />
            </div>
          )}

          <button 
            type="submit" 
            className="auth-btn auth-btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="auth-spinner"></span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="auth-btn auth-btn-google"
          disabled={isLoading}
        >
          <svg className="auth-google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? (
            <span className="auth-spinner"></span>
          ) : (
            'Continue with Google'
          )}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-demo-section">
          <p className="auth-demo-label">Try with demo accounts:</p>
          <div className="auth-demo-buttons">
            <button
              onClick={() => handleDemoLogin('admin')}
              className="auth-btn auth-btn-demo"
              disabled={isLoading}
            >
              Demo Admin
            </button>
            <button
              onClick={() => handleDemoLogin('user')}
              className="auth-btn auth-btn-demo"
              disabled={isLoading}
            >
              Demo User
            </button>
          </div>
        </div>

        <div className="auth-switch">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="auth-link"
                disabled={isLoading}
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="auth-link"
                disabled={isLoading}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
