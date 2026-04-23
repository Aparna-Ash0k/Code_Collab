import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Minimize2, Maximize2 } from 'lucide-react';

const Sidebar = ({ 
  activePanel, 
  children, 
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  width = 300,
  minWidth = 200,
  maxWidth = 600,
  onWidthChange
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(width);
  const [isHovered, setIsHovered] = useState(false);

  // Handle resize functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
      setCurrentWidth(newWidth);
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  if (!activePanel) return null;

  return (
    <div 
      className={`modern-sidebar bg-surface-primary border-r border-border-primary flex flex-col relative transition-all duration-300 ${
        isCollapsed ? 'w-0 overflow-hidden' : ''
      }`}
      style={{ width: isCollapsed ? 0 : currentWidth }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sidebar Header */}
      <div className="sidebar-header h-10 flex items-center justify-between px-4 border-b border-border-primary bg-surface-secondary">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-text-primary capitalize tracking-wide">
            {activePanel.replace(/([A-Z])/g, ' $1').trim()}
          </h2>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onToggleCollapse}
            title="Minimize sidebar"
          >
            <Minimize2 size={12} />
          </button>
          <button
            className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onClose}
            title="Close sidebar"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="sidebar-content flex-1 overflow-hidden">
        {children}
      </div>

      {/* Resize Handle */}
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-all duration-200 ${
          isHovered || isResizing ? 'bg-text-accent opacity-50' : 'bg-transparent'
        } hover:bg-text-accent hover:opacity-75`}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        title="Resize sidebar"
      />

      {/* Modern resize indicator */}
      {(isHovered || isResizing) && (
        <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-3 h-8 bg-surface-overlay border border-border-primary rounded-full shadow-md flex items-center justify-center">
          <div className="w-0.5 h-4 bg-text-tertiary rounded-full" />
        </div>
      )}

      {/* Collapse Button (when sidebar is visible) */}
      <button
        className={`absolute top-4 -right-3 w-6 h-6 bg-surface-overlay border border-border-primary rounded-full shadow-md flex items-center justify-center transition-all duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        } hover:bg-surface-raised hover:border-text-accent`}
        onClick={onToggleCollapse}
        title="Collapse sidebar"
      >
        <ChevronLeft size={12} className="text-text-secondary" />
      </button>
    </div>
  );
};

export default Sidebar;
