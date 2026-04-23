import React, { useState, useEffect, useContext, useCallback } from 'react';
import { FileSystemContext } from '../contexts/FileSystemContext';
import './FileSystemManager.css';

const FileSystemManager = ({ 
  isVisible, 
  onClose, 
  currentFilePath,
  onFileSelect,
  socket 
}) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });
  const [newItemModal, setNewItemModal] = useState({ visible: false, type: null, path: '' });
  const [renameModal, setRenameModal] = useState({ visible: false, item: null, newName: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'

  const {
    fileTree,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    moveFile,
    getFileContent,
    searchFiles,
    exportProject,
    importProject
  } = useContext(FileSystemContext);

  const [filteredTree, setFilteredTree] = useState(fileTree);

  // Filter file tree based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTree(fileTree);
    } else {
      const filtered = searchFiles(searchQuery);
      setFilteredTree(filtered);
    }
  }, [searchQuery, fileTree, searchFiles]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isVisible) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            if (e.shiftKey) {
              handleNewFolder();
            } else {
              handleNewFile();
            }
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('fs-search-input')?.focus();
            break;
          case 'Delete':
          case 'Backspace':
            if (selectedItems.length > 0) {
              e.preventDefault();
              handleDelete();
            }
            break;
        }
      }

      if (e.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
        setNewItemModal({ visible: false, type: null, path: '' });
        setRenameModal({ visible: false, item: null, newName: '' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, selectedItems]);

  const handleItemClick = useCallback((item, e) => {
    e.stopPropagation();
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-select
      setSelectedItems(prev => 
        prev.includes(item.path) 
          ? prev.filter(path => path !== item.path)
          : [...prev, item.path]
      );
    } else if (e.shiftKey && selectedItems.length > 0) {
      // Range select (simplified)
      const lastSelected = selectedItems[selectedItems.length - 1];
      // Implementation for range selection would go here
      setSelectedItems([...selectedItems, item.path]);
    } else {
      setSelectedItems([item.path]);
      if (item.type === 'file') {
        onFileSelect?.(item.path);
      }
    }
  }, [selectedItems, onFileSelect]);

  const handleItemDoubleClick = useCallback((item) => {
    if (item.type === 'file') {
      onFileSelect?.(item.path);
      onClose?.();
    }
  }, [onFileSelect, onClose]);

  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item
    });
  }, []);

  const handleNewFile = (parentPath = '') => {
    setNewItemModal({ visible: true, type: 'file', path: parentPath });
  };

  const handleNewFolder = (parentPath = '') => {
    setNewItemModal({ visible: true, type: 'folder', path: parentPath });
  };

  const handleRename = (item) => {
    setRenameModal({ visible: true, item, newName: item.name });
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
  };

  const handleDelete = () => {
    if (selectedItems.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedItems.length} item(s)?`
    );
    
    if (confirmed) {
      selectedItems.forEach(path => {
        deleteFile(path);
      });
      setSelectedItems([]);
    }
  };

  const handleDragStart = useCallback((e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetItem) => {
    e.preventDefault();
    
    if (!draggedItem || !targetItem) return;
    
    const sourcePath = draggedItem.path;
    const targetPath = targetItem.type === 'folder' 
      ? `${targetItem.path}/${draggedItem.name}`
      : targetItem.path;
    
    if (sourcePath !== targetPath) {
      moveFile(sourcePath, targetPath);
    }
    
    setDraggedItem(null);
  }, [draggedItem, moveFile]);

  const handleCreateItem = async () => {
    const { type, path } = newItemModal;
    const name = document.getElementById('new-item-name')?.value?.trim();
    
    if (!name) return;
    
    const fullPath = path ? `${path}/${name}` : name;
    
    try {
      if (type === 'file') {
        await createFile(fullPath, '');
      } else {
        await createFolder(fullPath);
      }
      setNewItemModal({ visible: false, type: null, path: '' });
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Failed to create item: ' + error.message);
    }
  };

  const handleRenameItem = async () => {
    const { item, newName } = renameModal;
    if (!item || !newName.trim()) return;
    
    try {
      const newPath = item.path.replace(/[^/]+$/, newName.trim());
      await renameFile(item.path, newPath);
      setRenameModal({ visible: false, item: null, newName: '' });
    } catch (error) {
      console.error('Error renaming item:', error);
      alert('Failed to rename item: ' + error.message);
    }
  };

  const renderFileTree = (items, level = 0) => {
    if (!items || !Array.isArray(items)) return null;

    return items.map(item => (
      <div
        key={item.path}
        className={`fs-item ${item.type} ${selectedItems.includes(item.path) ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 20}px` }}
        draggable
        onClick={(e) => handleItemClick(item, e)}
        onDoubleClick={() => handleItemDoubleClick(item)}
        onContextMenu={(e) => handleContextMenu(e, item)}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, item)}
      >
        <div className="fs-item-content">
          <span className="fs-item-icon">
            {item.type === 'folder' ? '📁' : '📄'}
          </span>
          <span className="fs-item-name">{item.name}</span>
          {item.type === 'file' && (
            <span className="fs-item-size">
              {item.size ? `${Math.round(item.size / 1024)}KB` : ''}
            </span>
          )}
        </div>
        {item.children && item.children.length > 0 && (
          <div className="fs-item-children">
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const renderListView = (items) => {
    const flatItems = [];
    
    const flatten = (items, parentPath = '') => {
      items?.forEach(item => {
        flatItems.push({ ...item, parentPath });
        if (item.children) {
          flatten(item.children, item.path);
        }
      });
    };
    
    flatten(items);
    
    return flatItems.map(item => (
      <div
        key={item.path}
        className={`fs-list-item ${selectedItems.includes(item.path) ? 'selected' : ''}`}
        onClick={(e) => handleItemClick(item, e)}
        onDoubleClick={() => handleItemDoubleClick(item)}
        onContextMenu={(e) => handleContextMenu(e, item)}
      >
        <span className="fs-item-icon">
          {item.type === 'folder' ? '📁' : '📄'}
        </span>
        <span className="fs-item-name">{item.name}</span>
        <span className="fs-item-path">{item.parentPath}</span>
        <span className="fs-item-modified">
          {item.lastModified ? new Date(item.lastModified).toLocaleDateString() : ''}
        </span>
      </div>
    ));
  };

  if (!isVisible) return null;

  return (
    <div className="file-system-manager">
      <div className="fs-header">
        <h3>File System Manager</h3>
        <div className="fs-controls">
          <input
            id="fs-search-input"
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fs-search"
          />
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="fs-view-mode"
          >
            <option value="tree">Tree View</option>
            <option value="list">List View</option>
          </select>
        </div>
        <button onClick={onClose} className="fs-close-btn">×</button>
      </div>

      <div className="fs-toolbar">
        <button onClick={() => handleNewFile()} title="New File (Ctrl+N)">
          📄 New File
        </button>
        <button onClick={() => handleNewFolder()} title="New Folder (Ctrl+Shift+N)">
          📁 New Folder
        </button>
        <button 
          onClick={handleDelete} 
          disabled={selectedItems.length === 0}
          title="Delete Selected"
        >
          🗑️ Delete
        </button>
        <button onClick={exportProject} title="Export Project">
          📤 Export
        </button>
        <button onClick={() => document.getElementById('import-input')?.click()} title="Import Project">
          📥 Import
        </button>
        <input
          id="import-input"
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              importProject(file);
            }
          }}
        />
      </div>

      <div className="fs-content">
        {viewMode === 'tree' ? (
          <div className="fs-tree-view">
            {renderFileTree(filteredTree)}
          </div>
        ) : (
          <div className="fs-list-view">
            <div className="fs-list-header">
              <span>Name</span>
              <span>Path</span>
              <span>Modified</span>
            </div>
            {renderListView(filteredTree)}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fs-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div onClick={() => handleRename(contextMenu.item)}>Rename</div>
          <div onClick={() => handleDelete()}>Delete</div>
          <div onClick={() => handleNewFile(contextMenu.item?.path)}>New File Here</div>
          <div onClick={() => handleNewFolder(contextMenu.item?.path)}>New Folder Here</div>
        </div>
      )}

      {/* New Item Modal */}
      {newItemModal.visible && (
        <div className="fs-modal-overlay">
          <div className="fs-modal">
            <h4>Create New {newItemModal.type}</h4>
            <input
              id="new-item-name"
              type="text"
              placeholder={`${newItemModal.type} name`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateItem();
                if (e.key === 'Escape') setNewItemModal({ visible: false, type: null, path: '' });
              }}
            />
            <div className="fs-modal-buttons">
              <button onClick={handleCreateItem}>Create</button>
              <button onClick={() => setNewItemModal({ visible: false, type: null, path: '' })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.visible && (
        <div className="fs-modal-overlay">
          <div className="fs-modal">
            <h4>Rename {renameModal.item?.type}</h4>
            <input
              type="text"
              value={renameModal.newName}
              onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameItem();
                if (e.key === 'Escape') setRenameModal({ visible: false, item: null, newName: '' });
              }}
            />
            <div className="fs-modal-buttons">
              <button onClick={handleRenameItem}>Rename</button>
              <button onClick={() => setRenameModal({ visible: false, item: null, newName: '' })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu.visible && (
        <div
          className="fs-context-overlay"
          onClick={() => setContextMenu({ visible: false, x: 0, y: 0, item: null })}
        />
      )}
    </div>
  );
};

export default FileSystemManager;
