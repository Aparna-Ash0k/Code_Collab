import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthModal = ({ isOpen, onClose, onGuestMode, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-primary border border-border-primary rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-bg-accent text-white rounded-lg flex items-center justify-center font-bold">
              CC
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">CodeCollab</h1>
              <p className="text-xs text-text-tertiary">Real-time collaborative coding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-hover-primary rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {mode === 'login' ? (
            <LoginForm
              onSwitchToRegister={() => setMode('register')}
              onClose={onClose}
              onGuestMode={onGuestMode}
            />
          ) : (
            <RegisterForm
              onSwitchToLogin={() => setMode('login')}
              onClose={onClose}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-surface-secondary border-t border-border-primary text-center">
          <p className="text-xs text-text-tertiary">
            By continuing, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
