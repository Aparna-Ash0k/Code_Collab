import React from 'react';
import { Circle, Terminal } from 'lucide-react';

const MinimalStatusBar = ({ 
  currentTab,
  dirtyTabs = [],
  isConnected = false,
  collaborators = [],
  onToggleBottomPanel
}) => {
  return (
    <div className="minimal-status-bar">
      <div className="status-left">
        <span className="status-item">JavaScript</span>
        <span className="status-item">UTF-8</span>
        {currentTab && (
          <span className="status-item">
            {currentTab.fileName}
          </span>
        )}
        {dirtyTabs.length > 0 && (
          <span className="status-item text-text-warning">
            {dirtyTabs.length} unsaved
          </span>
        )}
      </div>

      <div className="status-right">
        <button 
          className="status-item hover:bg-surface-secondary cursor-pointer"
          onClick={onToggleBottomPanel}
          title="Toggle Code Runner Panel"
        >
          <Terminal size={12} className="mr-1" />
          Run Code
        </button>
        
        <span className="status-item flex items-center gap-1">
          <Circle 
            size={6} 
            className={`fill-current ${
              isConnected ? 'text-text-success' : 'text-text-error'
            }`} 
          />
          {isConnected ? 'Connected' : 'Offline'}
        </span>
        
        {collaborators.length > 0 && (
          <span className="status-item">
            {collaborators.length} online
          </span>
        )}
      </div>
    </div>
  );
};

export default MinimalStatusBar;
