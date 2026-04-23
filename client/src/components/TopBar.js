import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu,
  Settings, 
  UserPlus,
  MoreHorizontal,
  User,
  Search,
  Command,
  Zap,
  GitBranch,
  Star,
  Bell,
  Shield,
  Palette,
  Code,
  Download,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

const TopBar = ({ 
  projectName = "CodeCollab",
  currentUser = "developer@codecollab.com",
  onInviteCollaborators,
  onToggleSidebar,
  onSettings,
  onLanguageSelect,
  onVersionHistory,
  isMobile = false,
  collaborators = [],
  isConnected = false
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
        setShowQuickActions(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const collaboratorCount = collaborators?.length || 0;
  const notificationCount = 3; // Mock notification count

  return (
    <div className="modern-topbar h-9 bg-surface-primary border-b border-border-primary flex items-center justify-between px-3 text-sm relative z-50">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        {/* Mobile Menu Toggle */}
        {isMobile && (
          <button 
            className="btn-ghost btn-sm p-1"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu size={14} />
          </button>
        )}
        
        {/* Project Branding */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-gradient-to-br from-text-accent to-bg-accent rounded-md flex items-center justify-center">
              <Code size={12} className="text-white" />
            </div>
            <span className="text-text-primary font-semibold text-sm tracking-tight hidden sm:inline">
              {projectName}
            </span>
          </div>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isConnected ? 'bg-text-success' : 'bg-text-error'
            }`} />
            <span className="text-text-tertiary text-xs hidden md:inline">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Center Section - Global Search */}
      <div className="flex-1 max-w-md mx-3 hidden md:block">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search files, code, commands..."
            className="input w-full pl-8 pr-10 py-1 text-xs bg-surface-secondary border-border-secondary"
          />
          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <kbd className="px-1 py-0.5 text-xs bg-surface-tertiary text-text-tertiary rounded border border-border-primary">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1.5" ref={menuRef}>
        {/* Collaborators Preview */}
        {collaboratorCount > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-text-secondary">
            <div className="flex -space-x-1">
              {collaborators.slice(0, 3).map((collaborator, index) => (
                <div
                  key={index}
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-bg-accent to-text-accent flex items-center justify-center text-white text-xs font-medium border border-surface-primary"
                  title={collaborator.name}
                >
                  {collaborator.name?.charAt(0).toUpperCase()}
                </div>
              ))}
              {collaboratorCount > 3 && (
                <div className="w-5 h-5 rounded-full bg-surface-tertiary flex items-center justify-center text-text-secondary text-xs font-medium border border-surface-primary">
                  +{collaboratorCount - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions Button */}
        <button 
          className="btn-ghost btn-sm p-1 relative"
          onClick={() => setShowQuickActions(!showQuickActions)}
          aria-label="Quick actions"
        >
          <Command size={14} />
        </button>

        {/* Notifications */}
        <button 
          className="btn-ghost btn-sm p-1 relative"
          onClick={() => setShowNotifications(!showNotifications)}
          aria-label="Notifications"
        >
          <Bell size={14} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-text-error text-white text-xs rounded-full flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Invite Collaborators */}
        <button 
          className="btn-primary btn-sm flex items-center gap-1 px-2 py-1"
          onClick={onInviteCollaborators}
        >
          <UserPlus size={12} />
          <span className="hidden sm:inline text-xs">Share</span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button 
            className="btn-ghost btn-sm flex items-center gap-1 px-1.5"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-text-accent to-bg-accent flex items-center justify-center text-white text-xs font-medium">
              {currentUser.charAt(0).toUpperCase()}
            </div>
            <span className="hidden lg:inline text-text-secondary max-w-20 truncate text-xs">
              {currentUser.split('@')[0]}
            </span>
            <ChevronDown size={10} className="text-text-tertiary" />
          </button>
          
          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 surface-overlay border border-border-primary rounded-lg shadow-xl z-50 animation-slide-in-up">
              <div className="p-4 border-b border-border-primary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-text-accent to-bg-accent flex items-center justify-center text-white font-medium">
                    {currentUser.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary font-medium truncate">
                      {currentUser.split('@')[0]}
                    </div>
                    <div className="text-text-secondary text-xs truncate">
                      {currentUser}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-surface-tertiary rounded-full">
                    <Shield size={10} className="text-text-success" />
                    <span className="text-xs text-text-secondary">Pro</span>
                  </div>
                </div>
              </div>
              
              <div className="py-2">
                <button className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-hover-primary flex items-center gap-3 transition-colors">
                  <User size={14} />
                  Profile Settings
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-hover-primary flex items-center gap-3 transition-colors"
                  onClick={onSettings}
                >
                  <Settings size={14} />
                  Preferences
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-hover-primary flex items-center gap-3 transition-colors">
                  <Palette size={14} />
                  Themes
                </button>
                <div className="border-t border-border-primary my-2"></div>
                <button className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-hover-primary flex items-center gap-3 transition-colors">
                  <Star size={14} />
                  Upgrade to Pro
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-hover-primary flex items-center gap-3 transition-colors">
                  <Download size={14} />
                  Download Desktop
                </button>
                <div className="border-t border-border-primary my-2"></div>
                <button className="w-full text-left px-4 py-2 text-sm text-text-error hover:bg-hover-primary flex items-center gap-3 transition-colors">
                  <ExternalLink size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions Dropdown */}
        {showQuickActions && (
          <div className="absolute top-full right-20 mt-2 w-56 surface-overlay border border-border-primary rounded-lg shadow-xl z-50 animation-slide-in-up">
            <div className="p-2">
              <div className="text-text-secondary text-xs font-medium px-3 py-2 uppercase tracking-wide">
                Quick Actions
              </div>
              <button 
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-hover-primary rounded-md flex items-center gap-3 transition-colors"
                onClick={onLanguageSelect}
              >
                <Code size={14} />
                Change Language
              </button>
              <button 
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-hover-primary rounded-md flex items-center gap-3 transition-colors"
                onClick={onVersionHistory}
              >
                <GitBranch size={14} />
                Version History
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-hover-primary rounded-md flex items-center gap-3 transition-colors">
                <Zap size={14} />
                Performance
              </button>
            </div>
          </div>
        )}

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute top-full right-32 mt-2 w-80 surface-overlay border border-border-primary rounded-lg shadow-xl z-50 animation-slide-in-up">
            <div className="p-4 border-b border-border-primary">
              <div className="flex items-center justify-between">
                <h3 className="text-text-primary font-medium">Notifications</h3>
                <button className="text-text-accent text-sm hover:text-text-accent-hover">
                  Mark all read
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="p-3 border-b border-border-primary hover:bg-hover-primary transition-colors">
                <div className="text-sm text-text-primary">New collaborator joined</div>
                <div className="text-xs text-text-secondary mt-1">Sarah joined the project</div>
                <div className="text-xs text-text-tertiary mt-1">2 minutes ago</div>
              </div>
              <div className="p-3 border-b border-border-primary hover:bg-hover-primary transition-colors">
                <div className="text-sm text-text-primary">File conflicts detected</div>
                <div className="text-xs text-text-secondary mt-1">3 files need manual merge</div>
                <div className="text-xs text-text-tertiary mt-1">5 minutes ago</div>
              </div>
              <div className="p-3 hover:bg-hover-primary transition-colors">
                <div className="text-sm text-text-primary">Project updated</div>
                <div className="text-xs text-text-secondary mt-1">New features available</div>
                <div className="text-xs text-text-tertiary mt-1">1 hour ago</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
