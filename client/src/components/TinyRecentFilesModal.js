import React, { useState, useEffect, useContext } from 'react';
import { 
  Clock, 
  File, 
  Folder, 
  Star, 
  Search, 
  X, 
  FileText, 
  Code, 
  Image, 
  Database,
  MoreHorizontal,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';

const TinyRecentFilesModal = ({ isOpen, onClose, onOpenFullModal }) => {
  const { recentFiles, openRecentFile, clearRecentFiles } = useContext(ProjectSystemContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredFiles(
        recentFiles.filter(file =>
          file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          file.path.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredFiles(recentFiles.slice(0, 8)); // Show max 8 files
    }
  }, [recentFiles, searchTerm]);

  if (!isOpen) return null;

  const getFileIcon = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
      return <File size={16} className="file-icon default" />;
    }
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <Code size={16} className="file-icon code" />;
      case 'html':
      case 'css':
      case 'scss':
        return <Code size={16} className="file-icon web" />;
      case 'json':
      case 'xml':
        return <Database size={16} className="file-icon data" />;
      case 'md':
      case 'txt':
        return <FileText size={16} className="file-icon text" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image size={16} className="file-icon image" />;
      default:
        return <File size={16} className="file-icon default" />;
    }
  };

  const formatFileSize = (size) => {
    if (!size) return '';
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatDate = (date) => {
    const now = new Date();
    const fileDate = new Date(date);
    const diffMs = now - fileDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return fileDate.toLocaleDateString();
  };

  const handleFileClick = (file) => {
    openRecentFile(file);
    onClose();
  };

  const handleClearAll = () => {
    clearRecentFiles();
  };

  const handleViewAll = () => {
    onClose();
    onOpenFullModal && onOpenFullModal();
  };

  return (
    <div className="tiny-modal-overlay" onClick={onClose}>
      <div className="tiny-recent-files-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tiny-recent-header">
          <div className="header-left">
            <Clock size={18} />
            <h3>Recent Files</h3>
            {recentFiles.length > 0 && (
              <span className="file-count">{recentFiles.length}</span>
            )}
          </div>
          <div className="header-actions">
            {recentFiles.length > 0 && (
              <button
                onClick={handleClearAll}
                className="clear-button"
                title="Clear all recent files"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="close-button">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        {recentFiles.length > 0 && (
          <div className="tiny-search-container">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search recent files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="clear-search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Files List */}
        <div className="tiny-files-list">
          {filteredFiles.length === 0 ? (
            <div className="empty-state">
              <Clock size={32} className="empty-icon" />
              <h4>No recent files</h4>
              <p>Files you open will appear here</p>
            </div>
          ) : (
            <>
              {filteredFiles.map((file, index) => (
                <div
                  key={`${file.path}-${index}`}
                  className="file-item"
                  onClick={() => handleFileClick(file)}
                >
                  <div className="file-icon-container">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      <span className="file-path">{file.path}</span>
                      <span className="file-time">{formatDate(file.lastAccessed)}</span>
                    </div>
                  </div>
                  <div className="file-actions">
                    {file.size && (
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    )}
                  </div>
                </div>
              ))}
              
              {recentFiles.length > 8 && !searchTerm && (
                <div className="view-all-container">
                  <button
                    onClick={handleViewAll}
                    className="view-all-button"
                  >
                    <ExternalLink size={14} />
                    View All Recent Files ({recentFiles.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TinyRecentFilesModal;
