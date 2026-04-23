import React from 'react';
import { Code, Settings, Users, Search, Sun, Moon, Palette } from 'lucide-react';
import UserProfile from './UserProfile';

const MinimalTopBar = ({ 
  projectName = "CodeCollab",
  onToggleSidebar,
  onSettings,
  collaborators = [],
  isConnected = false,
  theme = 'light',
  onThemeToggle,
  onAppThemeToggle,
  appTheme = 'minimal',
  user,
  isAuthenticated,
  onLogin,
  onRegister
}) => {
  return (
    <div className="minimal-topbar">
      {/* Left Section */}
      <div className="logo">
        <div className="logo-icon">
          <Code size={12} />
        </div>
        <span>{projectName}</span>
      </div>

      {/* Center Section - Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search files..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-surface-secondary border border-border-primary rounded-md focus:border-border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="actions">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-text-success' : 'bg-text-tertiary'
          }`} />
          <span className="text-xs text-text-secondary hidden sm:inline">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Collaborators - only show if authenticated */}
        {isAuthenticated && collaborators.length > 0 && (
          <button className="btn-minimal">
            <Users size={14} />
            <span className="hidden sm:inline">{collaborators.length}</span>
          </button>
        )}

        {/* User Profile Component */}
        <UserProfile onAuthModalOpen={onLogin} />

        {/* App Theme Toggle */}
        <button 
          className="btn-minimal" 
          onClick={onAppThemeToggle}
          title={`Switch to ${appTheme === 'minimal' ? 'Figma' : 'Minimal'} theme`}
        >
          <Palette size={14} />
          <span className="hidden sm:inline text-xs">
            {appTheme === 'minimal' ? 'Figma' : 'Minimal'}
          </span>
        </button>

        {/* Theme Toggle */}
        <button 
          className="btn-minimal" 
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {/* Settings */}
        <button className="btn-minimal" onClick={onSettings}>
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
};

export default MinimalTopBar;
