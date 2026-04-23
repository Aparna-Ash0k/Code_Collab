import React, { useState, useEffect, useRef, useContext } from 'react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import FilenameModal from './FilenameModal';
import FolderModal from './FolderModal';
import CollaboratorsSidebar from './CollaboratorsSidebar';
import InviteCollaboratorsModal from './InviteCollaboratorsModal';
import '../styles/collaboration-enhancements.css';
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  Code, 
  Image,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  FolderPlus,
  FileText as FileIcon,
  Trash2,
  Edit
} from 'lucide-react';

const FigmaFileExplorer = ({ onFileSelect, currentFile }) => {
  const { 
    openFile, 
    fileTree, 
    createFile, 
    createFolder, 
    deleteFile,
    deleteFolder,
    renameFile, 
    renameFolder, 
    getVirtualFileSystem, 
    currentProject, 
    refreshFileTree, 
    unifiedFileSystem 
  } = useContext(ProjectSystemContext);
  const { isAuthenticated, user } = useAuth();
  const { session } = useSession();
  const [expandedFolders, setExpandedFolders] = useState({});
  const [fileStructure, setFileStructure] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [currentFolderPath, setCurrentFolderPath] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [currentParentPath, setCurrentParentPath] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [contextMenuTarget, setContextMenuTarget] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const moreMenuRef = useRef(null);

  // Convert flat files array to hierarchical tree structure
  const buildHierarchicalTree = (flatFiles) => {
    console.log('🏗️ Building hierarchical tree from flat files:', flatFiles);
    
    // Deduplicate input files first
    const uniqueFiles = [];
    const seenPaths = new Set();
    
    flatFiles.forEach(item => {
      if (!seenPaths.has(item.path)) {
        seenPaths.add(item.path);
        uniqueFiles.push(item);
      } else {
        console.warn('⚠️ Removing duplicate input file:', item.path);
      }
    });
    
    console.log('🔄 Deduplicated input files:', uniqueFiles.length, 'from', flatFiles.length);
    
    const tree = [];
    const folderMap = new Map();

    // First pass: create all folders from file paths
    uniqueFiles.forEach(item => {
      if (item.path.includes('/')) {
        const pathParts = item.path.split('/');
        // Create all parent folders for this file
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderPath = pathParts.slice(0, i + 1).join('/');
          if (!folderMap.has(folderPath)) {
            const folderItem = {
              name: pathParts[i],
              path: folderPath,
              type: 'folder',
              isDirectory: true,
              children: []
            };
            folderMap.set(folderPath, folderItem);
            console.log('📁 Created folder:', folderPath, folderItem);
          }
        }
      }
    });

    // Second pass: organize files and avoid duplicate folders
    const filesToProcess = uniqueFiles.filter(file => {
      // If this is a folder that we already created in folderMap, skip it
      if (file.type === 'folder' && folderMap.has(file.path)) {
        console.log('⏭️ Skipping duplicate folder:', file.path);
        return false;
      }
      return true;
    });
    
    console.log('🔗 Files to organize (after deduplication):', filesToProcess.length, filesToProcess);
    
    filesToProcess.forEach(file => {
      const parentPath = file.path.includes('/') ? 
        file.path.substring(0, file.path.lastIndexOf('/')) : '';
      
      if (parentPath && folderMap.has(parentPath)) {
        const parent = folderMap.get(parentPath);
        parent.children.push(file);
        console.log('👶 Added child', file.name, '(' + file.path + ') to parent', parent.name, '(' + parentPath + ')');
      } else if (!parentPath) {
        tree.push(file);
        console.log('🌳 Added root file:', file.name, '(' + file.path + ')');
      } else {
        console.warn('⚠️ Could not find parent for:', file.path, 'parent should be:', parentPath);
      }
    });
    
    // Third pass: add folders to tree (only root folders)
    folderMap.forEach((folder, path) => {
      if (!path.includes('/')) { // Root level folder
        tree.push(folder);
        console.log('🌳 Added root folder:', folder.name, '(' + folder.path + ')');
      }
    });

    // Sort folders first, then files
    const sortItems = (items) => {
      items.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          console.log('🔄 Sorting children for:', item.name, 'children:', item.children.length);
          sortItems(item.children);
        }
      });
    };

    sortItems(tree);
    console.log('✅ Final hierarchical tree:', tree);
    
    // Log folder contents for debugging
    tree.forEach(item => {
      if (item.type === 'folder') {
        console.log(`📂 Folder "${item.name}" has ${item.children?.length || 0} children:`, item.children?.map(c => c.name));
      }
    });
    
    return tree;
  };

  // Update file structure based on authentication status and virtual file system
  useEffect(() => {
    console.log('🔍 FigmaFileExplorer: Updating file structure...');
    console.log('📁 fileTree:', fileTree);
    
    // Always show the unified file system, whether authenticated or not
    const virtualFS = getVirtualFileSystem();
    console.log('🗂️ virtualFS:', virtualFS);
    console.log('🎯 unifiedFileSystem:', unifiedFileSystem);
    
    if (fileTree && Array.isArray(fileTree) && fileTree.length > 0) {
      console.log('✅ Setting fileStructure from fileTree:', fileTree.length, 'items');
      
      // Deduplicate fileTree first to prevent duplicate paths
      const deduplicatedFileTree = (() => {
        const seen = new Set();
        return fileTree.filter(item => {
          if (seen.has(item.path)) {
            console.warn(`⚠️ Removing duplicate item during processing:`, item);
            return false;
          }
          seen.add(item.path);
          return true;
        });
      })();
      
      console.log('✅ Deduplicated fileTree:', deduplicatedFileTree.length, 'items (removed', fileTree.length - deduplicatedFileTree.length, 'duplicates)');
      
      // Check if fileTree is flat (items don't have children) and convert to hierarchical
      const hasHierarchy = deduplicatedFileTree.some(item => item.children && Array.isArray(item.children) && item.children.length > 0);
      
      console.log('🔍 Hierarchy check:', { hasHierarchy, sampleItem: deduplicatedFileTree[0] });
      
      if (hasHierarchy) {
        // Already hierarchical
        console.log('📋 Using existing hierarchical structure');
        setFileStructure(deduplicatedFileTree);
      } else {
        // Convert flat structure to hierarchical
        console.log('🔄 Converting flat fileTree to hierarchical structure');
        
        // Filter out folder items that are just placeholders (they'll be recreated properly)
        const actualFiles = deduplicatedFileTree.filter(item => {
          // Keep files and folders that don't have a slash in their path (root level folders)
          // Remove intermediate folder items that are created as placeholders
          const isRealItem = item.type !== 'folder' || !item.path.includes('/');
          console.log(`🔍 Item "${item.name}" (${item.path}): type=${item.type}, isRealItem=${isRealItem}`);
          return isRealItem;
        });
        
        console.log('📄 Actual items (after filtering):', actualFiles);
        const hierarchicalTree = buildHierarchicalTree(actualFiles);
        setFileStructure(hierarchicalTree);
      }
    } else if (unifiedFileSystem && unifiedFileSystem.files && unifiedFileSystem.files.size > 0) {
      // Try to get files directly from unified file system first
      console.log('🔄 Getting files from unifiedFileSystem.files:', unifiedFileSystem.files.size, 'files');
      const filesArray = Array.from(unifiedFileSystem.files.entries()).map(([path, fileData]) => ({
        name: path.split('/').pop(),
        path: path,
        type: 'file',
        isDirectory: false,
        content: fileData.content,
        size: fileData.content?.length || 0,
        lastModified: fileData.lastModified || Date.now()
      }));
      
      // Deduplicate files by path
      const deduplicatedFiles = (() => {
        const seen = new Set();
        return filesArray.filter(file => {
          if (seen.has(file.path)) {
            console.warn(`⚠️ Removing duplicate file from unifiedFileSystem:`, file);
            return false;
          }
          seen.add(file.path);
          return true;
        });
      })();
      
      console.log('📄 Files from unifiedFileSystem:', deduplicatedFiles.length, 'files (removed', filesArray.length - deduplicatedFiles.length, 'duplicates)');
      const hierarchicalTree = buildHierarchicalTree(deduplicatedFiles);
      setFileStructure(hierarchicalTree);
    } else if (virtualFS && virtualFS.files && virtualFS.files.size > 0) {
      // Fallback to legacy virtual file system
      console.log('🔄 Getting files from virtualFS.files:', virtualFS.files.size, 'files');
      const filesArray = Array.from(virtualFS.files.entries()).map(([path, fileData]) => ({
        name: path.split('/').pop(),
        path: path,
        type: 'file',
        isDirectory: false,
        content: fileData.content,
        size: fileData.content?.length || 0,
        lastModified: fileData.lastModified || Date.now()
      }));
      
      // Deduplicate files by path
      const deduplicatedFiles = (() => {
        const seen = new Set();
        return filesArray.filter(file => {
          if (seen.has(file.path)) {
            console.warn(`⚠️ Removing duplicate file from virtualFS:`, file);
            return false;
          }
          seen.add(file.path);
          return true;
        });
      })();
      
      console.log('📄 Files from virtualFS:', deduplicatedFiles.length, 'files (removed', filesArray.length - deduplicatedFiles.length, 'duplicates)');
      const hierarchicalTree = buildHierarchicalTree(deduplicatedFiles);
      setFileStructure(hierarchicalTree);
    } else {
      // Initialize with a basic structure if empty
      console.log('❌ No files found, setting empty structure');
      setFileStructure([]);
    }
  }, [fileTree, getVirtualFileSystem, unifiedFileSystem]);

  // Handle clicks outside the more menu and context menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
      // Close context menu on any click
      if (showContextMenu) {
        setShowContextMenu(false);
        setContextMenuTarget(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  const getFileIcon = (fileName, customIcon) => {
    if (customIcon) {
      return <img src={customIcon} alt="" className="figma-file-icon" />;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'jsx':
        return <Code size={16} className="text-yellow-600" />;
      case 'ts':
      case 'tsx':
        return <Code size={16} className="text-blue-600" />;
      case 'css':
      case 'scss':
      case 'sass':
        return <FileText size={16} className="text-blue-500" />;
      case 'md':
        return <FileText size={16} className="text-gray-700" />;
      case 'json':
        return <FileText size={16} className="text-gray-600" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image size={16} className="text-green-500" />;
      default:
        return <File size={16} className="text-gray-500" />;
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleFileClick = (file) => {
    if (file.type === 'folder') {
      // Toggle folder expanded state
      setExpandedFolders(prev => ({
        ...prev,
        [file.path]: !prev[file.path]
      }));
      
      // Log folder navigation for debugging
      console.log('📁 Toggled folder:', file.path, 'expanded:', !expandedFolders[file.path]);
    } else {
      // Get file content from unified file system with null safety
      let content = `// ${file.name}\n// Start editing this file...\n`;
      
      if (unifiedFileSystem && unifiedFileSystem.files) {
        const fileData = unifiedFileSystem.files.get(file.path);
        content = fileData?.content || content;
      } else if (getVirtualFileSystem && getVirtualFileSystem() && getVirtualFileSystem().files) {
        // Fallback to legacy method
        const fileData = getVirtualFileSystem().files.get(file.path);
        content = fileData?.content || content;
      } else {
        console.warn('🚨 No file system available (neither unifiedFileSystem nor virtualFileSystem)');
      }
      
      openFile(file.name, content, file.path);
      onFileSelect && onFileSelect(file);
    }
  };

  const handleCreateFile = (folderPath = '') => {
    // Normalize folder path - remove trailing slash for consistent path building
    const normalizedFolderPath = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
    setCurrentFolderPath(normalizedFolderPath);
    setShowFilenameModal(true);
  };

  const handleFilenameConfirm = (fileName) => {
    if (!fileName || !fileName.trim()) {
      console.warn('⚠️ Empty filename provided');
      return;
    }

    // Build file path with proper separator handling
    const cleanFolderPath = currentFolderPath.trim();
    const cleanFileName = fileName.trim();
    const filePath = cleanFolderPath ? `${cleanFolderPath}/${cleanFileName}` : cleanFileName;
    
    console.log('📄 Creating file:', { folderPath: currentFolderPath, fileName, finalPath: filePath });
    
    try {
      const initialContent = getInitialFileContent(fileName);
      createFile(filePath, initialContent);
      
      // Expand parent folder to show the new file
      if (cleanFolderPath) {
        setExpandedFolders(prev => ({ ...prev, [cleanFolderPath]: true }));
      }
      
      setShowFilenameModal(false);
      setCurrentFolderPath('');
      
      // Immediately refresh file tree after creation
      if (refreshFileTree) {
        console.log('🔄 Refreshing file tree after file creation');
        refreshFileTree();
      } else {
        console.warn('⚠️ refreshFileTree function not available');
      }
    } catch (error) {
      console.error('❌ Failed to create file:', error);
      alert('Failed to create file: ' + error.message);
    }
  };

  const handleFilenameCancel = () => {
    setShowFilenameModal(false);
    setCurrentFolderPath('');
  };

  const handleCreateFolder = (parentPath = '') => {
    // Normalize parent path - remove trailing slash for consistent path building
    const normalizedParentPath = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath;
    setCurrentParentPath(normalizedParentPath);
    setShowFolderModal(true);
  };

  const handleFolderConfirm = (folderName) => {
    if (!folderName || !folderName.trim()) {
      console.warn('⚠️ Empty folder name provided');
      return;
    }

    // Build folder path with proper separator handling
    const cleanParentPath = currentParentPath.trim();
    const cleanFolderName = folderName.trim();
    const folderPath = cleanParentPath ? `${cleanParentPath}/${cleanFolderName}` : cleanFolderName;
    
    console.log('📁 Creating folder:', { parentPath: currentParentPath, folderName, finalPath: folderPath });
    
    try {
      createFolder(folderPath);
      
      // Expand both parent and newly created folder
      if (cleanParentPath) {
        setExpandedFolders(prev => ({ ...prev, [cleanParentPath]: true, [folderPath]: true }));
      } else {
        setExpandedFolders(prev => ({ ...prev, [folderPath]: true }));
      }
      
      setShowFolderModal(false);
      setCurrentParentPath('');
      
      // Immediately refresh file tree after creation
      if (refreshFileTree) {
        console.log('🔄 Refreshing file tree after folder creation');
        refreshFileTree();
      } else {
        console.warn('⚠️ refreshFileTree function not available');
      }
    } catch (error) {
      console.error('❌ Failed to create folder:', error);
      alert('Failed to create folder: ' + error.message);
    }
  };

  const handleFolderCancel = () => {
    setShowFolderModal(false);
    setCurrentParentPath('');
  };

  // Delete handlers
  const handleDelete = async (item) => {
    const confirmMessage = item.type === 'folder' 
      ? `Are you sure you want to delete the folder "${item.name}" and all its contents? This action cannot be undone.`
      : `Are you sure you want to delete the file "${item.name}"? This action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        console.log('🗑️ Delete operation starting for:', item.type, item.path);
        
        if (item.type === 'folder') {
          const result = await deleteFolder(item.path);
          console.log('✅ Folder deletion completed:', result);
        } else {
          const result = await deleteFile(item.path);
          console.log('✅ File deletion completed:', result);
        }
        
        // Immediately refresh file tree after deletion - remove setTimeout for immediate response
        if (refreshFileTree) {
          console.log('🔄 Refreshing file tree after deletion');
          refreshFileTree();
        } else {
          console.warn('⚠️ refreshFileTree function not available');
        }
      } catch (error) {
        console.error('❌ Failed to delete:', error);
        alert(`Failed to delete ${item.type}: ${error.message}`);
      }
    }
    setShowContextMenu(false);
  };

  // Rename handlers
  const handleRename = (item) => {
    setRenameTarget(item);
    setShowRenameModal(true);
    setShowContextMenu(false);
  };

  const handleRenameConfirm = async (newName) => {
    if (!renameTarget || !newName.trim()) {
      setShowRenameModal(false);
      setRenameTarget(null);
      return;
    }

    try {
      console.log('🏷️ Rename operation starting for:', renameTarget.type, renameTarget.path);
      
      const oldPath = renameTarget.path;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName.trim();
      const newPath = pathParts.join('/');

      if (renameTarget.type === 'folder') {
        const result = await renameFolder(oldPath, newPath);
        console.log('✅ Folder rename completed:', result);
      } else {
        const result = await renameFile(oldPath, newPath);
        console.log('✅ File rename completed:', result);
      }

      // Immediately refresh file tree after rename - remove setTimeout for immediate response
      if (refreshFileTree) {
        console.log('🔄 Refreshing file tree after rename');
        refreshFileTree();
      } else {
        console.warn('⚠️ refreshFileTree function not available');
      }
    } catch (error) {
      console.error('❌ Failed to rename:', error);
      alert(`Failed to rename ${renameTarget.type}: ${error.message}`);
    }

    setShowRenameModal(false);
    setRenameTarget(null);
  };

  const handleRenameCancel = () => {
    setShowRenameModal(false);
    setRenameTarget(null);
  };

  // Context menu handlers
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuTarget(item);
    
    // Calculate context menu position to avoid overflow
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const contextMenuWidth = 200; // Approximate width
    const contextMenuHeight = 120; // Approximate height
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if menu would go off-screen
    if (x + contextMenuWidth > windowWidth) {
      x = windowWidth - contextMenuWidth - 10;
    }
    if (y + contextMenuHeight > windowHeight) {
      y = windowHeight - contextMenuHeight - 10;
    }
    
    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
  };

  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
    setContextMenuTarget(null);
  };

  const handleInviteCollaborators = () => {
    setShowInviteModal(true);
  };

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
  };

  const handleStartNewProject = () => {
    setShowMoreMenu(false);
    if (window.confirm('Start a new project? This will clear your current work.')) {
      window.location.reload();
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (item.type === 'folder') {
      setDragOver(item.path);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  };

  const handleDrop = (e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem || !targetItem || draggedItem.path === targetItem.path) {
      setDraggedItem(null);
      setDragOver(null);
      return;
    }
    
    // Only allow dropping into folders
    if (targetItem.type === 'folder') {
      const newPath = `${targetItem.path}/${draggedItem.name}`;
      
      // Check if the item is not being dropped into itself
      if (!targetItem.path.startsWith(draggedItem.path)) {
        // This would be handled by a renameFile function in FileSystemContext
        console.log(`Moving ${draggedItem.path} to ${newPath}`);
        // For now, just log the action - full implementation would need server support
      }
    }
    
    setDraggedItem(null);
    setDragOver(null);
  };

  const getInitialFileContent = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'jsx':
        return `// ${fileName}\n\nexport default function() {\n  return (\n    <div>\n      <h1>Hello from ${fileName}!</h1>\n    </div>\n  );\n}`;
      case 'ts':
      case 'tsx':
        return `// ${fileName}\n\ninterface Props {}\n\nexport default function Component(props: Props) {\n  return (\n    <div>\n      <h1>Hello from ${fileName}!</h1>\n    </div>\n  );\n}`;
      case 'css':
        return `/* ${fileName} */\n\n.container {\n  /* Your styles here */\n}`;
      case 'md':
        return `# ${fileName.replace('.md', '')}\n\nYour content here...`;
      case 'json':
        return '{\n  \n}';
      default:
        return `// ${fileName}\n// Start editing...`;
    }
  };

  const getFileTypeClass = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return `file-type-${extension}`;
  };

  const renderFileItem = (item, level = 0, parentPath = '') => {
    const isExpanded = expandedFolders[item.path];
    const isActive = currentFile === item.path;
    const isDraggedOver = dragOver === item.path;
    const fileTypeClass = item.type === 'file' ? getFileTypeClass(item.name) : '';

    // Create a stable unique key that includes parent context to avoid duplicates
    const contextualPath = parentPath ? `${parentPath}/${item.name}` : item.path;
    const uniqueKey = `${item.type}-${encodeURIComponent(contextualPath)}-L${level}`;

    return (
      <div key={uniqueKey} className="file-tree-item-container">
        <div
          className={`file-tree-item figma-file-item ${isActive ? 'active' : ''} ${item.type === 'folder' ? 'folder' : 'file'} ${isDraggedOver ? 'drag-over' : ''} ${fileTypeClass}`}
          style={{ 
            paddingLeft: `${level * 16 + 12}px`,
            marginLeft: level > 0 ? '8px' : '0'
          }}
          onClick={() => handleFileClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, item)}
          onDragOver={(e) => handleDragOver(e, item)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {item.type === 'folder' && (
              <div className="folder-chevron transition-transform duration-200">
                {isExpanded ? (
                  <ChevronDown size={14} className="text-blue-600" />
                ) : (
                  <ChevronRight size={14} className="text-blue-600" />
                )}
              </div>
            )}
            
            <div className="figma-file-icon">
              {item.type === 'folder' ? (
                isExpanded ? (
                  <FolderOpen size={18} className="text-blue-600" />
                ) : (
                  <Folder size={18} className="text-blue-600" />
                )
              ) : (
                getFileIcon(item.name, item.icon)
              )}
            </div>
            
            <span className="figma-file-name" title={item.name}>{item.name}</span>
          </div>
          
          {item.type === 'folder' && (
            <div className="folder-actions">
              <button 
                className="folder-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateFile(item.path);
                }}
                title="New File"
              >
                <FileIcon size={12} className="text-gray-600" />
              </button>
              <button 
                className="folder-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateFolder(item.path);
                }}
                title="New Folder"
              >
                <FolderPlus size={12} className="text-gray-600" />
              </button>
            </div>
          )}
        </div>
        
        {/* Only render children if folder is expanded AND has children */}
        {item.type === 'folder' && isExpanded && item.children && item.children.length > 0 && (
          <div className="figma-folder-children">
            {item.children.map(child => renderFileItem(child, level + 1, item.path))}
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="file-tree-empty">
      <div className="file-tree-empty-icon">
        <Folder size={48} className="text-gray-400" />
      </div>
      <div className="file-tree-empty-title">No files yet</div>
      <div className="file-tree-empty-description">
        Create files to get started. Sign in to save them permanently!
      </div>
      <button 
        className="create-first-file-btn"
        onClick={() => handleCreateFile()}
      >
        <Plus size={16} />
        Create your first file
      </button>
    </div>
  );

  return (
    <div className="figma-sidebar">
      <div className="figma-sidebar-header">
        <div className="flex items-center justify-between">
          <h2 className="figma-sidebar-title">Files</h2>
          <div className="sidebar-toolbar">
            <button 
              onClick={() => handleCreateFile()}
              title="New File"
            >
              <FileIcon size={16} />
            </button>
            <button 
              onClick={() => handleCreateFolder()}
              title="New Folder"
            >
              <FolderPlus size={16} />
            </button>
            <button 
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                if (refreshFileTree) {
                  refreshFileTree();
                } else {
                  console.warn('refreshFileTree function not available');
                }
              }}
              title="Refresh Files"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
            </button>
            <div className="relative" ref={moreMenuRef}>
              <button 
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                title="More options"
              >
                <MoreHorizontal size={16} />
              </button>
              
              {/* Dropdown Menu */}
              {showMoreMenu && (
                <div className="file-explorer-dropdown">
                  {/* Start New Project - Only show when not in session */}
                  {isAuthenticated && !session && (
                    <button
                      onClick={handleStartNewProject}
                    >
                      <FileIcon size={16} style={{ marginRight: '8px' }} />
                      Start New Project
                    </button>
                  )}
                  
                  {/* Refresh Workspace */}
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      window.location.reload();
                    }}
                  >
                    <div style={{ width: '16px', height: '16px', marginRight: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        border: '2px solid currentColor', 
                        borderTop: '2px solid transparent', 
                        borderRadius: '50%' 
                      }}></div>
                    </div>
                    Refresh Workspace
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="figma-sidebar-content">
        {fileStructure.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="figma-file-tree">
            {fileStructure.map((item, index) => renderFileItem(item, 0, ''))}
          </div>
        )}
        
        {!isAuthenticated && fileStructure.length > 0 && (
          <div className="local-session-notice mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span className="font-semibold text-blue-900 text-sm">Local Session</span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Your files are stored locally. Sign in to save them permanently and collaborate with others!
            </p>
          </div>
        )}
      </div>

      {/* Collaborators Sidebar - Only show during active collaboration sessions */}
      {session && <CollaboratorsSidebar onInviteClick={handleInviteCollaborators} />}

      {/* Modals */}
      <FilenameModal
        isOpen={showFilenameModal}
        onClose={handleFilenameCancel}
        onConfirm={handleFilenameConfirm}
        initialValue=""
        title="Create New File"
      />

      <FolderModal
        isOpen={showFolderModal}
        onClose={handleFolderCancel}
        onConfirm={handleFolderConfirm}
        initialValue=""
        title="Create New Folder"
      />

      {/* Invite Modal - Only show during active collaboration sessions */}
      {session && (
        <InviteCollaboratorsModal
          isOpen={showInviteModal}
          onClose={handleCloseInviteModal}
        />
      )}

      {/* Rename Modal */}
      <FilenameModal
        isOpen={showRenameModal}
        onClose={handleRenameCancel}
        onConfirm={handleRenameConfirm}
        initialValue={renameTarget?.name || ''}
        title={`Rename ${renameTarget?.type === 'folder' ? 'Folder' : 'File'}`}
      />

      {/* Context Menu */}
      {showContextMenu && contextMenuTarget && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            backgroundColor: 'var(--vscode-menu-background, #2a2a2a)',
            border: '1px solid var(--vscode-menu-border, #404040)',
            borderRadius: '4px',
            padding: '4px 0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: '140px'
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => handleRename(contextMenuTarget)}
            style={{
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: 'var(--vscode-menu-foreground, #ffffff)',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--vscode-list-hoverBackground, #404040)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <Edit size={14} />
            Rename
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleDelete(contextMenuTarget)}
            style={{
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: 'var(--vscode-errorForeground, #f14c4c)',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--vscode-list-hoverBackground, #404040)';
              e.target.style.color = 'var(--vscode-errorForeground, #f14c4c)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = 'var(--vscode-errorForeground, #f14c4c)';
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default FigmaFileExplorer;
