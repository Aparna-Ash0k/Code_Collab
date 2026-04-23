import React from 'react';
import { X, Plus } from 'lucide-react';

const MinimalTabBar = ({ 
  tabs, 
  activeTab, 
  setActiveTab, 
  closeTab, 
  openNewTab 
}) => {
  return (
    <div className="minimal-tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-name">
            {tab.fileName}
            {tab.isDirty && <span className="text-text-warning ml-1">•</span>}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      
      {/* New Tab Button */}
      <button
        className="tab-item"
        onClick={openNewTab}
        title="New Tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default MinimalTabBar;
