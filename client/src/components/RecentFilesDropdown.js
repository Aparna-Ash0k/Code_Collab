import React, { useState, useEffect, useRef } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { Clock, File, FileText, Code, X } from 'lucide-react';

const RecentFilesDropdown = ({ onOpenModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { recentFiles, openRecentFile, clearRecentFiles } = useFileSystem();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get file icon based on extension
  const getFileIcon = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
      return <File size={16} className="text-gray-500" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <Code size={16} className="text-yellow-500" />;
      case 'md':
        return <FileText size={16} className="text-blue-500" />;
      case 'css':
      case 'scss':
        return <FileText size={16} className="text-purple-500" />;
      case 'html':
        return <FileText size={16} className="text-orange-500" />;
      case 'json':
        return <FileText size={16} className="text-green-500" />;
      default:
        return <File size={16} className="text-gray-500" />;
    }
  };

  // Format time ago
  const getTimeAgo = (dateString) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const handleFileClick = (recentFile) => {
    openRecentFile(recentFile);
    setIsOpen(false);
  };

  const handleClearRecent = (e) => {
    e.stopPropagation();
    clearRecentFiles();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
          isOpen 
            ? 'bg-blue-100 text-blue-700' 
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        title="Recent Files"
      >
        <Clock size={20} />
        {recentFiles.length > 0 && (
          <span className="bg-gray-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
            {recentFiles.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Recent Files</h3>
            {recentFiles.length > 0 && (
              <button
                onClick={handleClearRecent}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
                title="Clear Recent Files"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {recentFiles.length === 0 ? (
            <div className="px-3 py-8 text-center text-gray-500">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent files</p>
              <p className="text-xs opacity-75 mt-1">Files you open will appear here</p>
            </div>
          ) : (
            <div className="py-1">
              {recentFiles.map((file, index) => (
                <button
                  key={`${file.filePath}-${index}`}
                  onClick={() => handleFileClick(file)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {getFileIcon(file.fileName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {file.fileName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {file.filePath}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {getTimeAgo(file.lastOpened)}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* View All Button */}
          {recentFiles.length > 0 && (
            <div className="border-t border-gray-100 mt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenModal && onOpenModal();
                }}
                className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
              >
                View All Recent Files...
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentFilesDropdown;
