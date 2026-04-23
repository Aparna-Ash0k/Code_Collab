import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  Plus, 
  FileText, 
  FolderPlus, 
  Save, 
  Trash2, 
  Edit3,
  Search,
  Filter,
  MoreHorizontal,
  Code,
  FileImage,
  Database,
  Upload,
  Copy,
  Scissors,
  Clock
} from 'lucide-react';
import { useFileSystem } from '../contexts/FileSystemContext';

// Enhanced file icon mapping with colors
const getFileIcon = (fileName, type) => {
  if (type === 'folder') return Folder;
  
  if (!fileName || typeof fileName !== 'string') {
    return File;
  }
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  const fullName = fileName.toLowerCase();
  
  if (fullName.includes('package.json')) return Database;
  if (fullName.includes('readme')) return FileText;
  
  switch (ext) {
    case 'js': case 'jsx': case 'mjs': case 'ts': case 'tsx':
      return Code;
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp':
      return FileImage;
    case 'json': case 'yaml': case 'yml': case 'toml':
      return Database;
    default:
      return File;
  }
};

const getFileIconColor = (fileName, type) => {
  if (type === 'folder') return 'text-blue-400';
  
  if (!fileName || typeof fileName !== 'string') {
    return 'text-gray-400';
  }
  
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
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp':
      return 'text-purple-400';
    default:
      return 'text-text-tertiary';
  }
};

const FileTreeItem = ({ 
  name, 
  type, 
  level = 0, 
  isOpen, 
  onToggle, 
  children, 
  path, 
  isDirty,
  isGitModified = false,
  lastModified,
  size 
}) => {
  const { 
    createFile, 
    createFolder, 
    openFile, 
    deleteFile, 
    renameFile, 
    saveFile, 
    getCurrentTab, 
    getVirtualFileSystem 
  } = useFileSystem();
  
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [createType, setCreateType] = useState('');
  const [newName, setNewName] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const contextMenuRef = useRef(null);

  const Icon = type === 'folder' ? (isOpen ? FolderOpen : getFileIcon(name, type)) : getFileIcon(name, type);
  const iconColor = getFileIconColor(name, type);
  const hasChildren = children && Array.isArray(children) && children.length > 0;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async (type) => {
    setCreateType(type);
    setIsCreating(true);
    setShowCreateMenu(false);
    setNewName('');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newPath = path ? `${path}/${newName}` : newName;
    
    if (createType === 'file') {
      createFile(newPath, '// New file\n');
    } else {
      createFolder(newPath);
    }
    
    setIsCreating(false);
    setNewName('');
  };

  const handleCreateCancel = () => {
    setIsCreating(false);
    setNewName('');
  };

  const handleRename = () => {
    setIsRenaming(true);
    setNewName(name);
    setShowContextMenu(false);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim() || newName === name) {
      setIsRenaming(false);
      return;
    }

    const parentPath = path.split('/').slice(0, -1).join('/');
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    
    renameFile(path, newPath);
    setIsRenaming(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      deleteFile(path);
    }
    setShowContextMenu(false);
  };

  const handleSave = () => {
    const currentTab = getCurrentTab();
    if (currentTab && currentTab.filePath === path) {
      saveFile(currentTab.id, currentTab.content, path);
    }
    setShowContextMenu(false);
  };

  const handleFileClick = () => {
    if (type === 'file') {
      const vfs = getVirtualFileSystem();
      const file = vfs.readFile(path);
      if (file) {
        openFile(name, file.content, path);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatLastModified = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div>
      <div 
        className={`group relative flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-all duration-200 mx-1 ${
          isHovered ? 'bg-hover-primary' : ''
        } ${isDirty ? 'bg-text-warning bg-opacity-10 border-l-2 border-text-warning' : ''}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(true);
        }}
      >
        <div className="flex items-center flex-1 min-w-0" onClick={onToggle}>
          {/* Expand/Collapse Toggle */}
          {hasChildren ? (
            <div className="w-4 h-4 flex items-center justify-center mr-2 text-text-tertiary hover:text-text-primary transition-colors rounded-sm hover:bg-hover-primary">
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          ) : (
            <div className="w-4 mr-2" />
          )}
          
          {/* File/Folder Icon */}
          <Icon 
            size={16} 
            className={`mr-2 shrink-0 ${iconColor} ${isDirty ? 'opacity-100' : 'opacity-80'}`}
          />
          
          {/* File/Folder Name */}
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input w-full text-sm py-1 px-2"
                autoFocus
                onBlur={() => setIsRenaming(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
              />
            </form>
          ) : (
            <div className="flex-1 min-w-0" onClick={(e) => {
              e.stopPropagation();
              handleFileClick();
            }}>
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${
                  isDirty ? 'text-text-warning font-medium' : 'text-text-primary'
                } transition-colors`}>
                  {name}
                </span>
                
                {/* Status Indicators */}
                <div className="flex items-center gap-1">
                  {isDirty && (
                    <div className="w-1.5 h-1.5 rounded-full bg-text-warning animate-pulse" title="Unsaved changes" />
                  )}
                  {isGitModified && (
                    <div className="w-1.5 h-1.5 rounded-full bg-text-accent" title="Modified in git" />
                  )}
                </div>
              </div>
              
              {/* File metadata (shown on hover) */}
              {type === 'file' && isHovered && (size || lastModified) && (
                <div className="text-xs text-text-tertiary mt-0.5 flex items-center gap-2">
                  {size && <span>{formatFileSize(size)}</span>}
                  {lastModified && (
                    <span className="flex items-center gap-1">
                      <Clock size={8} />
                      {formatLastModified(lastModified)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className={`flex items-center gap-1 transition-opacity ${
          isHovered || showCreateMenu ? 'opacity-100' : 'opacity-0'
        }`}>
          {type === 'folder' && (
            <button
              className="btn-ghost p-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateMenu(!showCreateMenu);
              }}
              title="New File or Folder"
            >
              <Plus size={12} />
            </button>
          )}
          
          <button
            className="btn-ghost p-1"
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(!showContextMenu);
            }}
            title="More actions"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Create Menu */}
        {showCreateMenu && (
          <div className="absolute right-0 top-8 surface-overlay border border-border-primary rounded-lg shadow-xl z-20 py-1 min-w-40">
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-hover-primary w-full text-left transition-colors rounded-md mx-1"
              onClick={() => handleCreate('file')}
            >
              <FileText size={12} />
              New File
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-hover-primary w-full text-left transition-colors rounded-md mx-1"
              onClick={() => handleCreate('folder')}
            >
              <FolderPlus size={12} />
              New Folder
            </button>
          </div>
        )}

        {/* Context Menu */}
        {showContextMenu && (
          <div 
            ref={contextMenuRef}
            className="absolute right-0 top-8 surface-overlay border border-border-primary rounded-lg shadow-xl z-30 py-1 min-w-48"
          >
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-hover-primary w-full text-left transition-colors"
              onClick={handleRename}
            >
              <Edit3 size={12} />
              Rename
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-hover-primary w-full text-left transition-colors"
              onClick={() => setShowContextMenu(false)}
            >
              <Copy size={12} />
              Copy
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-hover-primary w-full text-left transition-colors"
              onClick={() => setShowContextMenu(false)}
            >
              <Scissors size={12} />
              Cut
            </button>
            {type === 'file' && isDirty && (
              <>
                <div className="h-px bg-border-primary my-1"></div>
                <button
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-hover-primary w-full text-left transition-colors"
                  onClick={handleSave}
                >
                  <Save size={12} />
                  Save
                </button>
              </>
            )}
            <div className="h-px bg-border-primary my-1"></div>
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-error hover:bg-hover-primary w-full text-left transition-colors"
              onClick={handleDelete}
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Create New Item Form */}
      {isCreating && (
        <div style={{ paddingLeft: `${32 + level * 16}px` }} className="py-2 mx-1">
          <form onSubmit={handleCreateSubmit} className="flex items-center gap-2">
            {createType === 'file' ? 
              <FileText size={12} className="text-text-tertiary" /> : 
              <FolderPlus size={12} className="text-text-tertiary" />
            }
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input flex-1 text-sm py-1 px-2"
              placeholder={`Enter ${createType} name`}
              autoFocus
              onBlur={handleCreateCancel}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCreateCancel();
                }
              }}
            />
          </form>
        </div>
      )}

      {/* Children */}
      {isOpen && hasChildren && (
        <div>
          {(Array.isArray(children) ? children : []).map((child, index) => {
            const { key, ...childProps } = child;
            return (
              <FileTreeItem 
                key={`${child.path}-${index}`} 
                {...childProps} 
                level={level + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const Explorer = () => {
  const { fileTree, createFile, createFolder, getVirtualFileSystem } = useFileSystem();
  const [openFolders, setOpenFolders] = useState(new Set(['root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'modified' | 'size' | 'type'
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);

  const generateUniqueFileName = (baseName) => {
    const vfs = getVirtualFileSystem();
    
    let counter = 1;
    let fileName = baseName;
    
    while (vfs.exists(fileName)) {
      const ext = baseName.includes('.') ? baseName.split('.').pop() : '';
      const nameWithoutExt = baseName.includes('.') ? baseName.substring(0, baseName.lastIndexOf('.')) : baseName;
      fileName = ext ? `${nameWithoutExt}${counter}.${ext}` : `${nameWithoutExt}${counter}`;
      counter++;
    }
    
    return fileName;
  };

  const generateUniqueFolderName = (baseName) => {
    const vfs = getVirtualFileSystem();
    
    let counter = 1;
    let folderName = baseName;
    
    while (vfs.exists(folderName)) {
      folderName = `${baseName}${counter}`;
      counter++;
    }
    
    return folderName;
  };

  const toggleFolder = (path) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const renderTree = (items, level = 0) => {
    // Ensure items is an array
    if (!Array.isArray(items)) {
      console.warn('renderTree received non-array items:', items);
      return [];
    }
    
    // Handle empty array
    if (items.length === 0) {
      return [];
    }
    
    return items
      .filter(item => {
        // Ensure item exists and has a name property
        if (!item || !item.name) {
          console.warn('Invalid item in fileTree:', item);
          return false;
        }
        
        // Filter by search query
        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        // Filter hidden files
        if (!showHiddenFiles && item.name.startsWith('.')) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort folders first, then by selected criteria
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        
        switch (sortBy) {
          case 'modified':
            return (b.lastModified || 0) - (a.lastModified || 0);
          case 'size':
            return (b.size || 0) - (a.size || 0);
          case 'type':
            return (a.name.split('.').pop() || '').localeCompare(b.name.split('.').pop() || '');
          default:
            return a.name.localeCompare(b.name);
        }
      })
      .map((item, index) => {
        const { key, ...itemProps } = {
          ...item,
          level,
          isOpen: openFolders.has(item.path),
          onToggle: () => item.path && toggleFolder(item.path)
        };

        return <FileTreeItem key={`${item.path}-${index}`} {...itemProps} />;
      });
  };

  return (
    <div className="modern-explorer bg-surface-primary h-full overflow-hidden flex flex-col text-sm">
      {/* Explorer Header */}
      <div className="explorer-header border-b border-border-primary bg-surface-secondary">
        <div className="flex items-center justify-between p-3">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Explorer
          </h3>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost btn-sm p-1.5"
              onClick={() => createFile(generateUniqueFileName('untitled'), '// New file\n')}
              title="New File (Ctrl+N)"
            >
              <FileText size={14} />
            </button>
            <button
              className="btn-ghost btn-sm p-1.5"
              onClick={() => createFolder(generateUniqueFolderName('New Folder'))}
              title="New Folder (Ctrl+Shift+N)"
            >
              <FolderPlus size={14} />
            </button>
            <button
              className="btn-ghost btn-sm p-1.5"
              title="Upload files"
            >
              <Upload size={14} />
            </button>
          </div>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="px-3 pb-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-9 pr-3 py-1.5 text-sm"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input text-xs py-1 px-2 pr-6"
              >
                <option value="name">Name</option>
                <option value="modified">Modified</option>
                <option value="size">Size</option>
                <option value="type">Type</option>
              </select>
              
              <button
                className={`btn-ghost btn-sm p-1.5 ${showHiddenFiles ? 'text-text-accent' : 'text-text-tertiary'}`}
                onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                title="Show hidden files"
              >
                <Filter size={12} />
              </button>
            </div>
            
            <div className="text-xs text-text-tertiary">
              {Array.isArray(fileTree) ? fileTree.length : 0} items
            </div>
          </div>
        </div>
      </div>
      
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {!Array.isArray(fileTree) || fileTree.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-surface-tertiary rounded-full flex items-center justify-center">
                <FolderPlus size={24} className="text-text-tertiary" />
              </div>
              <h4 className="text-lg font-medium text-text-primary mb-2">No files yet</h4>
              <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">
                Get started by creating your first file or folder to begin coding
              </p>
            </div>
            <div className="flex flex-col gap-2 items-center">
              <button
                className="btn-primary btn-sm flex items-center gap-2"
                onClick={() => createFile(generateUniqueFileName('example'), '// Your first file\nconsole.log("Hello, CodeCollab!");')}
              >
                <FileText size={14} />
                Create First File
              </button>
              <button
                className="btn-secondary btn-sm flex items-center gap-2"
                onClick={() => createFolder(generateUniqueFolderName('src'))}
              >
                <FolderPlus size={14} />
                Create Folder
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {renderTree(Array.isArray(fileTree) ? fileTree : [])}
          </div>
        )}
      </div>
    </div>
  );
};

export default Explorer;
