import React, { useState, useEffect, useRef } from 'react';
import './FileSearchModal.css';

const FileSearchModal = ({ isOpen, onClose, onFileSelect = null }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef(null);

  // Mock file system data - in real implementation, this would come from context
  const mockFiles = [
    { name: 'App.js', path: 'src/App.js', type: 'javascript' },
    { name: 'index.js', path: 'src/index.js', type: 'javascript' },
    { name: 'App.css', path: 'src/App.css', type: 'css' },
    { name: 'package.json', path: 'package.json', type: 'json' },
    { name: 'README.md', path: 'README.md', type: 'markdown' },
    { name: 'Header.js', path: 'src/components/Header.js', type: 'javascript' },
    { name: 'Footer.js', path: 'src/components/Footer.js', type: 'javascript' },
    { name: 'utils.js', path: 'src/utils/utils.js', type: 'javascript' },
    { name: 'config.js', path: 'src/config/config.js', type: 'javascript' },
    { name: 'styles.css', path: 'src/styles/styles.css', type: 'css' },
  ];

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        const filtered = mockFiles.filter(file =>
          file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.path.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered);
        setSelectedIndex(0);
        setIsSearching(false);
      }, 200); // Debounce search

      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setSelectedIndex(0);
    }
  }, [searchQuery]);

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          handleFileSelect(searchResults[selectedIndex]);
        }
        break;
    }
  };

  const handleFileSelect = (file) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
    onClose();
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'javascript':
        return '📄';
      case 'css':
        return '🎨';
      case 'json':
        return '⚙️';
      case 'markdown':
        return '📝';
      default:
        return '📄';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="file-search-modal-overlay" onClick={onClose}>
      <div className="file-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-search-header">
          <div className="file-search-input-container">
            <span className="file-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="file-search-input"
              placeholder="Search files... (Type to search)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button 
            className="file-search-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="file-search-results">
          {isSearching && (
            <div className="file-search-loading">
              <span className="loading-spinner"></span>
              Searching...
            </div>
          )}

          {!isSearching && searchQuery && searchResults.length === 0 && (
            <div className="file-search-no-results">
              <span className="no-results-icon">🔍</span>
              <p>No files found matching "{searchQuery}"</p>
              <small>Try a different search term</small>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="file-search-list">
              {searchResults.map((file, index) => (
                <div
                  key={file.path}
                  className={`file-search-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleFileSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="file-icon">{getFileIcon(file.type)}</span>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-path">{file.path}</div>
                  </div>
                  <div className="file-type-badge">{file.type}</div>
                </div>
              ))}
            </div>
          )}

          {!searchQuery && (
            <div className="file-search-instructions">
              <div className="instructions-content">
                <h3>Quick File Search</h3>
                <p>Start typing to find files in your project</p>
                <div className="keyboard-shortcuts">
                  <div className="shortcut">
                    <kbd>↑</kbd><kbd>↓</kbd>
                    <span>Navigate</span>
                  </div>
                  <div className="shortcut">
                    <kbd>Enter</kbd>
                    <span>Open file</span>
                  </div>
                  <div className="shortcut">
                    <kbd>Esc</kbd>
                    <span>Close</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileSearchModal;
