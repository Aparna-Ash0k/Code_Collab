import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  File, 
  Plus, 
  FolderPlus 
} from 'lucide-react';
import { useFileSystem } from '../contexts/FileSystemContext';

const MinimalFileExplorer = () => {
  const { fileTree, openFile, createFile, createFolder } = useFileSystem();
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = (file) => {
    if (file.type === 'file') {
      openFile(file.name, file.content || '', file.path);
    } else {
      toggleFolder(file.path);
    }
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const Icon = item.type === 'folder' 
        ? (isExpanded ? FolderOpen : Folder)
        : File;

      return (
        <div key={item.path}>
          <div
            className="file-item"
            style={{ paddingLeft: `${8 + level * 16}px` }}
            onClick={() => handleFileClick(item)}
          >
            <Icon size={14} className="file-icon" />
            <span>{item.name}</span>
          </div>
          
          {item.type === 'folder' && isExpanded && item.children && (
            <div>
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleCreateFile = () => {
    const fileName = prompt('Enter file name:');
    if (fileName) {
      createFile(fileName, '');
    }
  };

  const handleCreateFolder = () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      createFolder(folderName);
    }
  };

  return (
    <div className="file-tree">
      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button 
          className="btn-minimal text-xs"
          onClick={handleCreateFile}
          title="New File"
        >
          <Plus size={12} />
          File
        </button>
        <button 
          className="btn-minimal text-xs"
          onClick={handleCreateFolder}
          title="New Folder"
        >
          <FolderPlus size={12} />
          Folder
        </button>
      </div>

      {/* File Tree */}
      <div>
        {fileTree.length > 0 ? (
          renderFileTree(fileTree)
        ) : (
          <div className="text-text-tertiary text-xs text-center py-8">
            No files yet. Create your first file to get started.
          </div>
        )}
      </div>
    </div>
  );
};

export default MinimalFileExplorer;
