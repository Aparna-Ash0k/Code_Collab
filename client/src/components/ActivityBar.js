import React, { useState } from 'react';
import { 
  Files, 
  Search, 
  GitBranch, 
  Bug, 
  Package, 
  Settings,
  User,
  MessageCircle,
  MousePointer,
  Users,
  History,
  Terminal,
  Database,
  Zap,
  Globe,
  Shield
} from 'lucide-react';

const ActivityIcon = ({ icon: Icon, isActive, onClick, tooltip, badge, disabled = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`group relative flex items-center justify-center w-12 h-12 cursor-pointer transition-all duration-200 rounded-lg mx-1 my-0.5 ${
        disabled 
          ? 'opacity-40 cursor-not-allowed' 
          : isActive 
            ? 'bg-surface-tertiary text-text-accent shadow-md border border-border-accent' 
            : 'text-text-secondary hover:text-text-primary hover:bg-hover-primary'
      }`}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={tooltip}
    >
      <div className="relative">
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        
        {/* Badge */}
        {badge && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-text-error text-white text-xs rounded-full flex items-center justify-center font-medium">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        
        {/* Active indicator */}
        {isActive && (
          <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-text-accent rounded-r-full" />
        )}
      </div>
      
      {/* Enhanced Tooltip */}
      <div className={`absolute left-full ml-4 px-3 py-2 bg-surface-overlay border border-border-primary text-text-primary text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg ${
        isHovered ? 'translate-x-0' : 'translate-x-2'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{tooltip}</span>
          {badge && badge > 0 && (
            <span className="px-1.5 py-0.5 bg-text-error text-white text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        
        {/* Tooltip arrow */}
        <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-full">
          <div className="border-4 border-transparent border-r-surface-overlay"></div>
        </div>
      </div>
    </div>
  );
};

const ActivityBar = ({ activePanel, setActivePanel }) => {
  const primaryIcons = [
    { icon: Files, id: 'explorer', tooltip: 'Explorer', badge: 0 },
    { icon: Search, id: 'search', tooltip: 'Search', badge: 0 },
    { icon: MessageCircle, id: 'chat', tooltip: 'Team Chat', badge: 3 },
    { icon: MousePointer, id: 'cursors', tooltip: 'Live Cursors', badge: 0 },
    { icon: GitBranch, id: 'git', tooltip: 'Source Control', badge: 4 },
    { icon: History, id: 'history', tooltip: 'Timeline', badge: 0 },
    { icon: Users, id: 'collaborators', tooltip: 'Collaborators', badge: 2 },
  ];

  const secondaryIcons = [
    { icon: Bug, id: 'debug', tooltip: 'Run & Debug', badge: 0 },
    { icon: Terminal, id: 'terminal', tooltip: 'Terminal', badge: 0 },
    { icon: Database, id: 'database', tooltip: 'Database', badge: 0, disabled: true },
    { icon: Package, id: 'extensions', tooltip: 'Extensions', badge: 1 },
  ];

  const bottomIcons = [
    { icon: Globe, id: 'remote', tooltip: 'Remote Explorer', badge: 0, disabled: true },
    { icon: Shield, id: 'security', tooltip: 'Security', badge: 0, disabled: true },
    { icon: User, id: 'account', tooltip: 'Account', badge: 0 },
    { icon: Settings, id: 'settings', tooltip: 'Settings', badge: 0 },
  ];

  const handleIconClick = (id, disabled = false) => {
    if (!disabled) {
      setActivePanel(activePanel === id ? null : id);
    }
  };

  return (
    <div className="modern-activity-bar w-12 bg-surface-secondary border-r border-border-primary flex flex-col relative">
      {/* Top section with brand indicator */}
      <div className="flex items-center justify-center h-10 border-b border-border-primary">
        <div className="w-6 h-6 bg-gradient-to-br from-text-accent to-bg-accent rounded-md flex items-center justify-center">
          <Zap size={12} className="text-white" />
        </div>
      </div>
      
      {/* Primary Icons */}
      <div className="flex-1 py-2 space-y-1">
        {primaryIcons.map(({ icon, id, tooltip, badge, disabled }) => (
          <ActivityIcon
            key={id}
            icon={icon}
            isActive={activePanel === id}
            onClick={() => handleIconClick(id, disabled)}
            tooltip={tooltip}
            badge={badge}
            disabled={disabled}
          />
        ))}
        
        {/* Separator */}
        <div className="h-px bg-border-primary mx-2 my-2" />
        
        {/* Secondary Icons */}
        {secondaryIcons.map(({ icon, id, tooltip, badge, disabled }) => (
          <ActivityIcon
            key={id}
            icon={icon}
            isActive={activePanel === id}
            onClick={() => handleIconClick(id, disabled)}
            tooltip={tooltip}
            badge={badge}
            disabled={disabled}
          />
        ))}
      </div>
      
      {/* Bottom Icons */}
      <div className="border-t border-border-primary py-2 space-y-1">
        {bottomIcons.map(({ icon, id, tooltip, badge, disabled }) => (
          <ActivityIcon
            key={id}
            icon={icon}
            isActive={activePanel === id}
            onClick={() => handleIconClick(id, disabled)}
            tooltip={tooltip}
            badge={badge}
            disabled={disabled}
          />
        ))}
      </div>
      
      {/* Focus indicator for keyboard navigation */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .modern-activity-bar div:focus-visible {
          outline: 2px solid var(--text-accent);
          outline-offset: 2px;
        }`
      }} />
    </div>
  );
};

export default ActivityBar;
