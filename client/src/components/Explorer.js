import React, { useState, useEffect, useContext, useCallback } from 'react';
import { FileSystemContext } from '../contexts/FileSystemContext';
import './Explorer.css';

const Explorer = ({ onFileSelect, currentFile }) => {
  const {
    fileTree,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameFile,
    renameFolder,
    refreshFileTree
  } = useContext(FileSystemContext);

  const [expandedFolders, setExpandedFolders] = useState(new Set([''])); // Root expanded by default
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Refresh file tree on mount
  useEffect(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      targetRect: rect
    });
  }, []);

  const handleItemClick = useCallback((item) => {
    if (item.isDirectory) {
      toggleFolder(item.path);
    } else {
      onFileSelect?.(item);
    }
  }, [toggleFolder, onFileSelect]);

  const handleCreateFile = useCallback(async (parentPath = '') => {
    const fileName = prompt('Enter file name:');
    if (fileName) {
      try {
        await createFile(parentPath ? `${parentPath}/${fileName}` : fileName, '');
        // Expand parent folder if not already expanded
        if (parentPath) {
          setExpandedFolders(prev => new Set([...prev, parentPath]));
        }
      } catch (error) {
        alert(`Error creating file: ${error.message}`);
      }
    }
    setContextMenu(null);
  }, [createFile]);

  const handleCreateFolder = useCallback(async (parentPath = '') => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      try {
        await createFolder(parentPath ? `${parentPath}/${folderName}` : folderName);
        // Expand parent folder if not already expanded
        if (parentPath) {
          setExpandedFolders(prev => new Set([...prev, parentPath]));
        }
      } catch (error) {
        alert(`Error creating folder: ${error.message}`);
      }
    }
    setContextMenu(null);
  }, [createFolder]);

  const handleDelete = useCallback(async (item) => {
    const confirmMessage = `Are you sure you want to delete ${item.isDirectory ? 'folder' : 'file'} "${item.name}"?`;
    if (window.confirm(confirmMessage)) {
      try {
        if (item.isDirectory) {
          await deleteFolder(item.path);
        } else {
          await deleteFile(item.path);
        }
      } catch (error) {
        alert(`Error deleting ${item.isDirectory ? 'folder' : 'file'}: ${error.message}`);
      }
    }
    setContextMenu(null);
  }, [deleteFile, deleteFolder]);

  const handleRename = useCallback((item) => {
    setEditingItem(item);
    setEditValue(item.name);
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (editingItem && editValue.trim() && editValue !== editingItem.name) {
      try {
        const newPath = editingItem.path.replace(editingItem.name, editValue.trim());
        if (editingItem.isDirectory) {
          await renameFolder(editingItem.path, newPath);
        } else {
          await renameFile(editingItem.path, newPath);
        }
      } catch (error) {
        alert(`Error renaming: ${error.message}`);
      }
    }
    setEditingItem(null);
    setEditValue('');
  }, [editingItem, editValue, renameFile, renameFolder]);

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingItem(null);
      setEditValue('');
    }
  }, [handleRenameSubmit]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e, item) => {
    e.preventDefault();
    if (item.isDirectory) {
      setHoveredItem(item.path);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Only clear hover if we're leaving the element entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setHoveredItem(null);
    }
  }, []);

  const handleDrop = useCallback(async (e, targetItem) => {
    e.preventDefault();
    setHoveredItem(null);
    
    if (!draggedItem || !targetItem.isDirectory || draggedItem.path === targetItem.path) {
      return;
    }

    try {
      const newPath = `${targetItem.path}/${draggedItem.name}`;
      if (draggedItem.isDirectory) {
        await renameFolder(draggedItem.path, newPath);
      } else {
        await renameFile(draggedItem.path, newPath);
      }
      
      // Expand target folder
      setExpandedFolders(prev => new Set([...prev, targetItem.path]));
    } catch (error) {
      alert(`Error moving item: ${error.message}`);
    }
    
    setDraggedItem(null);
  }, [draggedItem, renameFile, renameFolder]);

  const getFileIcon = useCallback((fileName, isDirectory) => {
    if (isDirectory) {
      return '📁';
    }
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return '📄';
      case 'ts':
      case 'tsx':
        return '🔷';
      case 'css':
      case 'scss':
      case 'sass':
        return '🎨';
      case 'html':
        return '🌐';
      case 'json':
        return '⚙️';
      case 'md':
        return '📝';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return '🖼️';
      default:
        return '📄';
    }
  }, []);

  const renderFileTree = useCallback((node, depth = 0) => {
    if (!node) return null;

    const isExpanded = expandedFolders.has(node.path);
    const isCurrentFile = currentFile === node.path;
    const isBeingEdited = editingItem?.path === node.path;
    const isDraggedOver = hoveredItem === node.path;

    return (
      <div key={node.path} className="explorer-item-container">
        <div
          className={`explorer-item ${isCurrentFile ? 'active' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleItemClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable={!isBeingEdited}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
        >
          {node.isDirectory && (
            <span className={`folder-arrow ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          )}
          
          <span className="file-icon">
            {getFileIcon(node.name, node.isDirectory)}
          </span>
          
          {isBeingEdited ? (
            <input
              type="text"
              className="explorer-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              autoFocus
            />
          ) : (
            <span className="file-name">{node.name}</span>
          )}
        </div>
        
        {node.isDirectory && isExpanded && node.children && (
          <div className="explorer-children">
            {node.children.map(child => renderFileTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [
    expandedFolders,
    currentFile,
    editingItem,
    hoveredItem,
    editValue,
    handleItemClick,
    handleContextMenu,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleRenameSubmit,
    handleRenameKeyDown,
    getFileIcon
  ]);

  return (
    <div className="explorer">
      <div className="explorer-header">
        <h3>Explorer</h3>
        <div className="explorer-actions">
          <button
            className="explorer-action-btn"
            onClick={() => handleCreateFile()}
            title="New File"
          >
            📄
          </button>
          <button
            className="explorer-action-btn"
            onClick={() => handleCreateFolder()}
            title="New Folder"
          >
            📁
          </button>
          <button
            className="explorer-action-btn"
            onClick={refreshFileTree}
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>
      
      <div className="explorer-content">
        {fileTree ? renderFileTree(fileTree) : (
          <div className="explorer-loading">Loading files...</div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="explorer-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="context-menu-item" onClick={() => handleCreateFile(contextMenu.item.isDirectory ? contextMenu.item.path : '')}>
            📄 New File
          </div>
          <div className="context-menu-item" onClick={() => handleCreateFolder(contextMenu.item.isDirectory ? contextMenu.item.path : '')}>
            📁 New Folder
          </div>
          <div className="context-menu-separator"></div>
          <div className="context-menu-item" onClick={() => handleRename(contextMenu.item)}>
            ✏️ Rename
          </div>
          <div className="context-menu-item danger" onClick={() => handleDelete(contextMenu.item)}>
            🗑️ Delete
          </div>
        </div>
      )}
    </div>
  );
};

export default Explorer;
