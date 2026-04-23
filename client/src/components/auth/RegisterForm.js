import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';

const RegisterForm = ({ onSwitchToLogin, onClose }) => {
  const { register, isLoading, error } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(null);

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

    // Update password strength when password changes
    if (name === 'password') {
      const strength = authService.validatePasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  const validateForm = () => {
    const errors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    }

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!authService.isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    const passwordValidation = authService.validatePasswordStrength(formData.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.feedback[0] || 'Password is too weak';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Terms agreement validation
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const result = await register(formData);
      if (result.success) {
        onClose();
      }
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  const getPasswordStrengthColor = () => {
    if (!passwordStrength) return '#e0e0e0';
    const strengthInfo = authService.getPasswordStrengthLabel(passwordStrength.score);
    return strengthInfo.color;
  };

  const getPasswordStrengthLabel = () => {
    if (!passwordStrength) return '';
    const strengthInfo = authService.getPasswordStrengthLabel(passwordStrength.score);
    return strengthInfo.label;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">Create Account</h2>
        <p className="text-text-secondary mt-2">
          Join CodeCollab to collaborate with others
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-4 w-4 text-text-tertiary" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-bg-accent focus:border-transparent ${
                validationErrors.name 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-border-primary bg-surface-primary'
              }`}
            />
          </div>
          {validationErrors.name && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
          )}
        </div>

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
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Create a password"
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
          
          {/* Password Strength Indicator */}
          {formData.password && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300 rounded-full"
                    style={{ 
                      width: `${(passwordStrength?.score || 0) * 16.67}%`,
                      backgroundColor: getPasswordStrengthColor()
                    }}
                  />
                </div>
                <span 
                  className="text-xs font-medium"
                  style={{ color: getPasswordStrengthColor() }}
                >
                  {getPasswordStrengthLabel()}
                </span>
              </div>
              {passwordStrength?.feedback?.length > 0 && (
                <ul className="text-xs text-text-tertiary space-y-1">
                  {passwordStrength.feedback.map((tip, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-text-tertiary rounded-full" />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          
          {validationErrors.password && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-text-tertiary" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-bg-accent focus:border-transparent ${
                validationErrors.confirmPassword 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-border-primary bg-surface-primary'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />
              ) : (
                <Eye className="h-4 w-4 text-text-tertiary hover:text-text-secondary" />
              )}
            </button>
          </div>
          
          {/* Password Match Indicator */}
          {formData.confirmPassword && (
            <div className="mt-1 flex items-center gap-1">
              {formData.password === formData.confirmPassword ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600">Passwords match</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-600">Passwords don't match</span>
                </>
              )}
            </div>
          )}
          
          {validationErrors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
          )}
        </div>

        {/* Terms Agreement */}
        <div>
          <div className="flex items-start">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
              className={`h-4 w-4 text-bg-accent focus:ring-bg-accent border-border-primary rounded mt-0.5 ${
                validationErrors.agreeToTerms ? 'border-red-300' : ''
              }`}
            />
            <label htmlFor="agreeToTerms" className="ml-2 block text-sm text-text-secondary">
              I agree to the{' '}
              <button type="button" className="text-bg-accent hover:text-bg-accent-hover">
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" className="text-bg-accent hover:text-bg-accent-hover">
                Privacy Policy
              </button>
            </label>
          </div>
          {validationErrors.agreeToTerms && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.agreeToTerms}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-bg-accent text-white rounded-lg hover:bg-bg-accent-hover focus:ring-2 focus:ring-bg-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {/* Footer Actions */}
      <div className="text-center">
        <span className="text-sm text-text-secondary">Already have an account? </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm text-bg-accent hover:text-bg-accent-hover font-medium"
        >
          Sign in
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
