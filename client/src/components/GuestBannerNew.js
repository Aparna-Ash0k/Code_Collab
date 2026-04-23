import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const GuestBannerNew = ({ onSignInClick }) => {
  const { user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  if (user || isDismissed) {
    return null;
  }

  return (
    <div style={{ 
      background: 'linear-gradient(90deg, rgba(0, 122, 204, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
      borderBottom: '1px solid #333',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          background: '#007acc', 
          color: 'white', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#e1e5e9' }}>
            Start Coding Instantly!
          </div>
          <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '2px' }}>
            Create files and folders now. Sign in later to collaborate with your team.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={onSignInClick}
          style={{
            background: '#238636',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#2ea043'}
          onMouseOut={(e) => e.target.style.background = '#238636'}
        >
          Sign In to Collaborate
        </button>
        <button 
          onClick={() => setIsDismissed(true)}
          style={{
            background: 'transparent',
            color: '#8b949e',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.color = '#f85149'}
          onMouseOut={(e) => e.target.style.color = '#8b949e'}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default GuestBannerNew;
