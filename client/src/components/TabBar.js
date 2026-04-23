import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Plus, 
  FileText, 
  Code, 
  FileImage, 
  Database, 
  File,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Save,
  RefreshCw
} from 'lucide-react';

// Enhanced file icon mapping
const getFileIcon = (fileName) => {
  if (!fileName || typeof fileName !== 'string') {
    return File;
  }
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  const fullName = fileName.toLowerCase();
  
  // Special files
  if (fullName.includes('package.json')) return Database;
  if (fullName.includes('readme')) return FileText;
  if (fullName.includes('license')) return FileText;
  
  switch (ext) {
    case 'js': case 'jsx': case 'mjs':
      return Code;
    case 'ts': case 'tsx':
      return Code;
    case 'py': case 'python':
      return Code;
    case 'java': case 'cpp': case 'c': case 'cs':
      return Code;
    case 'html': case 'htm': case 'xml':
      return Code;
    case 'css': case 'scss': case 'sass': case 'less':
      return Code;
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp':
      return FileImage;
    case 'json': case 'yaml': case 'yml': case 'toml':
      return Database;
    case 'sql': case 'db': case 'sqlite':
      return Database;
    case 'md': case 'markdown': case 'txt':
      return FileText;
    default:
      return File;
  }
};

// Get file type color
const getFileTypeColor = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'js': case 'jsx': case 'mjs':
      return 'text-yellow-400';
    case 'ts': case 'tsx':
      return 'text-blue-400';
    case 'py':
      return 'text-green-400';
    case 'html': case 'htm':
      return 'text-orange-400';
    case 'css': case 'scss': case 'sass':
      return 'text-blue-300';
    case 'json':
      return 'text-yellow-300';
    case 'md': case 'markdown':
      return 'text-gray-300';
    default:
      return 'text-text-tertiary';
  }
};

const Tab = ({ 
  fileName, 
  isActive, 
  isDirty, 
  onClose, 
  onClick, 
  isClosable = true,
  hasConflict = false,
  lastModified 
}) => {
  const IconComponent = getFileIcon(fileName);
  const iconColor = getFileTypeColor(fileName);
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className={`group relative flex items-center min-w-32 max-w-48 h-9 px-3 cursor-pointer transition-all duration-200 border-r border-border-primary ${
        isActive 
          ? 'bg-surface-primary text-text-primary shadow-sm border-t-2 border-t-text-accent' 
          : 'bg-surface-secondary text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
      }`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${fileName}${isDirty ? ' • Modified' : ''}${hasConflict ? ' • Conflict' : ''}`}
      role="tab"
      aria-selected={isActive}
    >
      {/* File Icon */}
      <IconComponent 
        size={14} 
        className={`mr-2 shrink-0 ${iconColor} ${isActive ? 'opacity-100' : 'opacity-70'}`} 
      />
      
      {/* File Name */}
      <span className="text-sm truncate flex-1 font-medium">
        {fileName}
      </span>
      
      {/* Status Indicators */}
      <div className="flex items-center gap-1 ml-1">
        {/* Dirty indicator */}
        {isDirty && (
          <div 
            className="w-2 h-2 rounded-full bg-text-accent shrink-0 animate-pulse" 
            title="Unsaved changes"
          />
        )}
        
        {/* Conflict indicator */}
        {hasConflict && (
          <div 
            className="w-2 h-2 rounded-full bg-text-warning shrink-0" 
            title="Merge conflict"
          />
        )}
      </div>
      
      {/* Close Button */}
      {isClosable && (
        <button 
          className={`ml-2 p-1 rounded transition-all duration-200 shrink-0 ${
            isHovered || isActive 
              ? 'opacity-70 hover:opacity-100 hover:bg-text-error hover:text-white' 
              : 'opacity-0'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close file (Ctrl+W)"
          aria-label={`Close ${fileName}`}
        >
          <X size={12} />
        </button>
      )}
      
      {/* Tab context menu trigger area */}
      <div 
        className="absolute inset-0" 
        onContextMenu={(e) => {
          e.preventDefault();
          // TODO: Show context menu
        }}
      />
    </div>
  );
};

const TabBar = ({ tabs, activeTab, setActiveTab, closeTab, openNewTab, saveCurrentFile }) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const tabsRef = useRef(null);
  const moreMenuRef = useRef(null);
  
  // Check if scrolling is needed
  useEffect(() => {
    const checkScroll = () => {
      if (tabsRef.current) {
        const { scrollWidth, clientWidth } = tabsRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };
    
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [tabs]);
  
  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const scrollTabs = (direction) => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      tabsRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };
  
  const closeAllTabs = () => {
    tabs.forEach(tab => closeTab(tab.id));
    setShowMoreMenu(false);
  };
  
  const closeOtherTabs = () => {
    tabs.forEach(tab => {
      if (tab.id !== activeTab) {
        closeTab(tab.id);
      }
    });
    setShowMoreMenu(false);
  };
  
  const closeTabsToRight = () => {
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (activeIndex !== -1) {
      tabs.slice(activeIndex + 1).forEach(tab => closeTab(tab.id));
    }
    setShowMoreMenu(false);
  };

  return (
    <div className="modern-tab-bar flex items-stretch bg-surface-secondary border-b border-border-primary h-9 relative">
      {/* Scroll Left Button */}
      {showScrollButtons && (
        <button 
          className="flex items-center justify-center w-8 h-9 hover:bg-hover-primary text-text-tertiary hover:text-text-primary transition-colors border-r border-border-primary"
          onClick={() => scrollTabs('left')}
          title="Scroll tabs left"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      
      {/* Tabs Container */}
      <div 
        ref={tabsRef}
        className="flex flex-1 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={(e) => setScrollPosition(e.target.scrollLeft)}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            fileName={tab.fileName}
            isActive={activeTab === tab.id}
            isDirty={tab.isDirty}
            onClick={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            isClosable={tabs.length > 1}
            hasConflict={tab.hasConflict}
            lastModified={tab.lastModified}
          />
        ))}
      </div>
      
      {/* Scroll Right Button */}
      {showScrollButtons && (
        <button 
          className="flex items-center justify-center w-8 h-9 hover:bg-hover-primary text-text-tertiary hover:text-text-primary transition-colors border-l border-border-primary"
          onClick={() => scrollTabs('right')}
          title="Scroll tabs right"
        >
          <ChevronRight size={14} />
        </button>
      )}
      
      {/* Action Buttons */}
      <div className="flex items-center border-l border-border-primary">
        {/* Save Button */}
        <button 
          className="flex items-center justify-center w-8 h-9 hover:bg-hover-primary text-text-tertiary hover:text-text-primary transition-colors"
          onClick={saveCurrentFile}
          title="Save current file (Ctrl+S)"
          disabled={!tabs.find(tab => tab.id === activeTab)?.isDirty}
        >
          <Save size={14} />
        </button>
        
        {/* New Tab Button */}
        <button 
          className="flex items-center justify-center w-8 h-9 hover:bg-hover-primary text-text-tertiary hover:text-text-primary transition-colors"
          onClick={openNewTab}
          title="New File (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
        
        {/* More Options */}
        <div className="relative" ref={moreMenuRef}>
          <button 
            className="flex items-center justify-center w-8 h-9 hover:bg-hover-primary text-text-tertiary hover:text-text-primary transition-colors"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title="More options"
          >
            <MoreHorizontal size={14} />
          </button>
          
          {/* More Menu */}
          {showMoreMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 surface-overlay border border-border-primary rounded-lg shadow-xl z-50 py-1">
              <button 
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-hover-primary transition-colors"
                onClick={closeOtherTabs}
              >
                Close Others
              </button>
              <button 
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-hover-primary transition-colors"
                onClick={closeTabsToRight}
              >
                Close to the Right
              </button>
              <div className="h-px bg-border-primary my-1"></div>
              <button 
                className="w-full text-left px-3 py-2 text-sm text-text-error hover:bg-hover-primary transition-colors"
                onClick={closeAllTabs}
              >
                Close All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TabBar;
