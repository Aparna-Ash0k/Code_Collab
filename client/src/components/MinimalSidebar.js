import React from 'react';

const MinimalSidebar = ({ 
  activePanel, 
  children 
}) => {
  if (!activePanel) return null;

  const getPanelTitle = () => {
    const titles = {
      explorer: 'Explorer',
      search: 'Search',
      git: 'Source Control',
      chat: 'Chat',
      terminal: 'Terminal',
      settings: 'Settings'
    };
    return titles[activePanel] || 'Panel';
  };

  return (
    <div className="minimal-sidebar">
      <div className="sidebar-header">
        {getPanelTitle()}
      </div>
      <div className="sidebar-content">
        {children}
      </div>
    </div>
  );
};

export default MinimalSidebar;
