import React from 'react';
import { 
  Files, 
  Search, 
  GitBranch, 
  MessageSquare, 
  Users,
  Settings,
  Terminal
} from 'lucide-react';

const MinimalActivityBar = ({ 
  activePanel, 
  setActivePanel
}) => {
  const activities = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'collaborators', icon: Users, label: 'Collaborators' },
    { id: 'terminal', icon: Terminal, label: 'Terminal' },
  ];

  return (
    <div className="minimal-activity-bar">
      {activities.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`activity-item ${activePanel === id ? 'active' : ''}`}
          onClick={() => setActivePanel(activePanel === id ? null : id)}
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
      
      {/* Settings at bottom */}
      <div style={{ marginTop: 'auto' }}>
        <button
          className={`activity-item ${activePanel === 'settings' ? 'active' : ''}`}
          onClick={() => setActivePanel('settings')}
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};

export default MinimalActivityBar;
