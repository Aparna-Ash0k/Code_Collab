import React from 'react';
import { UserPlus, Users, Lock, Zap } from 'lucide-react';

const GuestBanner = ({ onShowAuth }) => {
  return (
    <div className="bg-gradient-to-r from-bg-accent to-text-accent text-white shadow-lg border-b border-border-primary">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Users size={16} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">You're using CodeCollab as a guest</h3>
              <p className="text-xs text-white text-opacity-80">
                Sign up to unlock collaboration features and save your work
              </p>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onShowAuth('register')}
              className="px-4 py-2 bg-white text-bg-accent rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <UserPlus size={14} />
              Sign Up
            </button>
            <button
              onClick={() => onShowAuth('login')}
              className="px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-3 flex items-center gap-6 text-xs text-white text-opacity-80">
          <div className="flex items-center gap-1">
            <Lock size={12} />
            <span>Real-time collaboration</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap size={12} />
            <span>Save & share projects</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={12} />
            <span>Team chat</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestBanner;
