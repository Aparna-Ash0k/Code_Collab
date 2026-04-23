import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './GuestBanner.css';

const GuestBanner = ({ onSignInClick }) => {
  const { user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  if (user || isDismissed) {
    return null;
  }

  return (
    <div className="guest-banner">
      <div className="guest-banner-content">
        <div className="guest-banner-left">
          <div className="guest-banner-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div className="guest-banner-text">
            <div className="guest-banner-title">Start Coding Instantly!</div>
            <div className="guest-banner-subtitle">
              Create files and folders now. Sign in later to collaborate with your team.
            </div>
          </div>
        </div>

        <div className="guest-banner-features">
          <div className="guest-banner-feature">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            <span>Create files locally</span>
          </div>
          <div className="guest-banner-feature">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zM4 18v-4h3v4h2v-7h3v7h2V9h3v9h2V2H2v16h2z"/>
            </svg>
            <span>Real-time collaboration</span>
          </div>
        </div>

        <div className="guest-banner-actions">
          <button 
            className="guest-banner-btn guest-banner-btn-primary"
            onClick={onSignInClick}
          >
            Sign In to Collaborate
          </button>
          <button 
            className="guest-banner-btn guest-banner-btn-dismiss"
            onClick={() => setIsDismissed(true)}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestBanner;
