/**
 * InteractiveFileTree - Advanced file tree component with real-time collaboration
 * Supports create/delete/rename operations and integrates with the FileSystemService
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  FileCode, 
  FileImage, 
  FileVideo, 
  FileArchive,
  Plus,
  Trash2,
  Edit3,
  MoreHorizontal,
  Download,
  Upload,
  Copy,
  Move,
  Search,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import './InteractiveFileTree.css';

// File type to icon mapping
const getFileIcon = (fileName, type, mime) => {
  if (type === 'folder') return Folder;
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs'].includes(extension)) {
    return FileCode;
  }
  
  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(extension)) {
    return FileImage;
  }
  
  // Video files
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
    return FileVideo;
  }
  
  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return FileArchive;
  }
  
  // Text files
  if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv'].includes(extension)) {
    return FileText;
  }
  
  return File;
};

// File tree item component
const FileTreeItem = ({ 
  item, 
  level = 0, 
  onSelect, 
  onRename, 
  onDelete, 
  onCreateFile, 
  onCreateFolder,
  selectedId,
  expandedIds,
  onToggleExpand,
  contextMenu,
  onContextMenu,
  isRenaming,
  onStartRename,
  onEndRename,
  collaborators = [],
  currentUser
}) => {
  const [newName, setNewName] = useState(item.name);
  const inputRef = useRef(null);
  
  const isSelected = selectedId === item.id;
  const isExpanded = expandedIds.has(item.id);
  const isFolder = item.type === 'folder';
  const FileIcon = getFileIcon(item.name, item.type, item.mime);
  
  // Get collaborator info for this file
  const fileCollaborators = useMemo(() => {
    return collaborators.filter(collab => 
      collab.currentFile === item.path && collab.id !== currentUser?.uid
    );
  }, [collaborators, item.path, currentUser]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isFolder) {
      onToggleExpand(item.id);
    } else {
      onSelect(item);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!isFolder) {
      onSelect(item);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, item);
  };

  const handleRename = () => {
    if (newName.trim() && newName !== item.name) {
      onRename(item.id, newName.trim());
    }
    onEndRename();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewName(item.name);
      onEndRename();
    }
  };

  const renderCollaboratorIndicators = () => {
    if (fileCollaborators.length === 0) return null;
    
    return (
      <div className="file-collaborators">
        {fileCollaborators.slice(0, 3).map((collab, index) => (
          <div
            key={collab.id}
            className="collaborator-indicator"
            style={{ 
              backgroundColor: collab.color,
              zIndex: 3 - index
            }}
            title={`${collab.name} is viewing this file`}
          >
            {collab.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {fileCollaborators.length > 3 && (
          <div className="collaborator-overflow" title={`+${fileCollaborators.length - 3} more`}>
            +{fileCollaborators.length - 3}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`file-tree-item ${isSelected ? 'selected' : ''}`}>
      <div
        className="file-tree-item-content"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {isFolder && (
          <button 
            className="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        
        <div className="file-icon">
          {isFolder ? (
            isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />
          ) : (
            <FileIcon size={16} />
          )}
        </div>
        
        <div className="file-info">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              className="rename-input"
            />
          ) : (
            <span className="file-name">{item.name}</span>
          )}
          
          {item.size > 0 && !isFolder && (
            <span className="file-size">
              {formatFileSize(item.size)}
            </span>
          )}
        </div>
        
        {renderCollaboratorIndicators()}
        
        {item.updatedByUid && item.updatedByUid !== currentUser?.uid && (
          <div className="modified-indicator" title={`Modified by ${item.updatedByUid}`}>
            •
          </div>
        )}
      </div>
    </div>
  );
};

// Context menu component
const ContextMenu = ({ 
  position, 
  item, 
  onClose, 
  onRename, 
  onDelete, 
  onCreateFile, 
  onCreateFolder,
  onDownload,
  onCopy,
  onMove 
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!position) return null;

  const isFolder = item?.type === 'folder';

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1000
      }}
    >
      {isFolder && (
        <>
          <button onClick={() => { onCreateFile(item); onClose(); }}>
            <Plus size={14} />
            New File
          </button>
          <button onClick={() => { onCreateFolder(item); onClose(); }}>
            <Folder size={14} />
            New Folder
          </button>
          <div className="menu-separator" />
        </>
      )}
      
      <button onClick={() => { onRename(item); onClose(); }}>
        <Edit3 size={14} />
        Rename
      </button>
      
      <button onClick={() => { onCopy(item); onClose(); }}>
        <Copy size={14} />
        Copy
      </button>
      
      <button onClick={() => { onMove(item); onClose(); }}>
        <Move size={14} />
        Move
      </button>
      
      <button onClick={() => { onDownload(item); onClose(); }}>
        <Download size={14} />
        Download
      </button>
      
      <div className="menu-separator" />
      
      <button 
        onClick={() => { onDelete(item); onClose(); }}
        className="destructive"
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
};

// Main InteractiveFileTree component
const InteractiveFileTree = ({ 
  files = [], 
  onFileSelect, 
  onFileChange,
  fileSystemService,
  collaborators = [],
  currentUser,
  projectId,
  className = ''
}) => {
  const [treeData, setTreeData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  
  // Build tree structure from flat file list
  const buildTree = useCallback((files) => {
    const fileMap = new Map();
    const rootItems = [];
    
    // First pass: create all items
    files.forEach(file => {
      fileMap.set(file.id, {
        ...file,
        children: []
      });
    });
    
    // Second pass: build hierarchy
    files.forEach(file => {
      const item = fileMap.get(file.id);
      
      if (file.parentId && fileMap.has(file.parentId)) {
        const parent = fileMap.get(file.parentId);
        parent.children.push(item);
      } else {
        rootItems.push(item);
      }
    });
    
    // Sort items: folders first, then by name
    const sortItems = (items) => {
      items.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      
      items.forEach(item => {
        if (item.children) {
          sortItems(item.children);
        }
      });
    };
    
    sortItems(rootItems);
    return rootItems;
  }, []);

  // Update tree when files change
  useEffect(() => {
    const tree = buildTree(files);
    setTreeData(tree);
  }, [files, buildTree]);

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = files.filter(file => 
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    );
    
    setFilteredFiles(filtered);
  }, [files, searchQuery]);

  // File system event handlers
  useEffect(() => {
    if (!fileSystemService) return;

    const handleFileCreated = (data) => {
      if (onFileChange) {
        onFileChange('created', data);
      }
    };

    const handleFileDeleted = (data) => {
      if (onFileChange) {
        onFileChange('deleted', data);
      }
    };

    const handleFileRenamed = (data) => {
      if (onFileChange) {
        onFileChange('renamed', data);
      }
    };

    fileSystemService.on('fileCreated', handleFileCreated);
    fileSystemService.on('fileDeleted', handleFileDeleted);
    fileSystemService.on('fileRenamed', handleFileRenamed);

    return () => {
      fileSystemService.off('fileCreated', handleFileCreated);
      fileSystemService.off('fileDeleted', handleFileDeleted);
      fileSystemService.off('fileRenamed', handleFileRenamed);
    };
  }, [fileSystemService, onFileChange]);

  const handleFileSelect = useCallback((file) => {
    setSelectedId(file.id);
    if (onFileSelect) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleToggleExpand = useCallback((itemId) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleContextMenu = useCallback((event, item) => {
    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      item
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleStartRename = useCallback((item) => {
    setRenamingId(item.id);
  }, []);

  const handleEndRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleRename = useCallback(async (fileId, newName) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      const newPath = file.path.replace(file.name, newName);
      
      if (fileSystemService) {
        await fileSystemService.renameFile(fileId, newName, newPath);
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  }, [files, fileSystemService]);

  const handleDelete = useCallback(async (item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      if (fileSystemService) {
        await fileSystemService.deleteFile(item.id);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }, [fileSystemService]);

  const handleCreateFile = useCallback(async (parentItem) => {
    const fileName = prompt('Enter file name:');
    if (!fileName) return;

    try {
      const parentPath = parentItem ? parentItem.path : '/';
      const newPath = parentPath.endsWith('/') ? `${parentPath}${fileName}` : `${parentPath}/${fileName}`;
      
      if (fileSystemService) {
        await fileSystemService.createFile(
          newPath,
          fileName,
          'file',
          '',
          getMimeType(fileName)
        );
      }
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  }, [fileSystemService]);

  const handleCreateFolder = useCallback(async (parentItem) => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    try {
      const parentPath = parentItem ? parentItem.path : '/';
      const newPath = parentPath.endsWith('/') ? `${parentPath}${folderName}` : `${parentPath}/${folderName}`;
      
      if (fileSystemService) {
        await fileSystemService.createFile(
          newPath,
          folderName,
          'folder',
          '',
          'application/x-directory'
        );
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  }, [fileSystemService]);

  const handleDownload = useCallback(async (item) => {
    try {
      if (fileSystemService) {
        const content = fileSystemService.getFileContent(item.id);
        if (content !== null) {
          downloadFile(item.name, content);
        }
      }
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  }, [fileSystemService]);

  const handleCopy = useCallback((item) => {
    // TODO: Implement copy functionality
    console.log('Copy not implemented yet:', item);
  }, []);

  const handleMove = useCallback((item) => {
    // TODO: Implement move functionality
    console.log('Move not implemented yet:', item);
  }, []);

  const renderTreeItems = (items, level = 0) => {
    return items.map(item => (
      <div key={item.id}>
        <FileTreeItem
          item={item}
          level={level}
          onSelect={handleFileSelect}
          onRename={handleRename}
          onDelete={handleDelete}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          onContextMenu={handleContextMenu}
          isRenaming={renamingId === item.id}
          onStartRename={handleStartRename}
          onEndRename={handleEndRename}
          collaborators={collaborators}
          currentUser={currentUser}
        />
        {item.type === 'folder' && expandedIds.has(item.id) && item.children && (
          <div className="tree-children">
            {renderTreeItems(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className={`interactive-file-tree ${className}`}>
      {/* Search bar */}
      <div className="file-tree-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Toolbar */}
      <div className="file-tree-toolbar">
        <button
          onClick={() => handleCreateFile(null)}
          title="New File"
          className="toolbar-button"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => handleCreateFolder(null)}
          title="New Folder"
          className="toolbar-button"
        >
          <Folder size={16} />
        </button>
      </div>

      {/* File tree */}
      <div className="file-tree-content">
        {searchQuery ? (
          // Show search results
          <div className="search-results">
            {filteredFiles.map(file => (
              <FileTreeItem
                key={file.id}
                item={file}
                level={0}
                onSelect={handleFileSelect}
                onRename={handleRename}
                onDelete={handleDelete}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onContextMenu={handleContextMenu}
                isRenaming={renamingId === file.id}
                onStartRename={handleStartRename}
                onEndRename={handleEndRename}
                collaborators={collaborators}
                currentUser={currentUser}
              />
            ))}
          </div>
        ) : (
          // Show tree structure
          renderTreeItems(treeData)
        )}
      </div>

      {/* Context menu */}
      <ContextMenu
        position={contextMenu?.position}
        item={contextMenu?.item}
        onClose={handleCloseContextMenu}
        onRename={handleStartRename}
        onDelete={handleDelete}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onDownload={handleDownload}
        onCopy={handleCopy}
        onMove={handleMove}
      />
    </div>
  );
};

// Utility functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getMimeType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'js': 'text/javascript',
    'jsx': 'text/javascript',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'py': 'text/x-python',
    'java': 'text/x-java',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'cs': 'text/x-csharp',
    'php': 'text/x-php',
    'rb': 'text/x-ruby',
    'go': 'text/x-go',
    'rs': 'text/x-rustsrc',
    'html': 'text/html',
    'css': 'text/css',
    'json': 'application/json',
    'xml': 'application/xml',
    'md': 'text/markdown',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml'
  };
  
  return mimeTypes[extension] || 'text/plain';
}

function downloadFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default InteractiveFileTree;
