import React, { useState, useContext } from 'react';
import { X, FileText, Code, Plus } from 'lucide-react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import FilenameModal from './FilenameModal';

const FigmaTabBar = ({ 
  tabs = [], 
  activeTab, 
  onTabSelect, 
  onTabClose, 
  collaborators = [] 
}) => {
  const { openNewTab, createFile, openFile } = useContext(ProjectSystemContext);
  const [showFilenameModal, setShowFilenameModal] = useState(false);

  const handleNewFileClick = () => {
    setShowFilenameModal(true);
  };

  const handleFilenameConfirm = (fileName) => {
    const initialContent = getInitialFileContent(fileName);
    createFile(fileName, initialContent);
    setShowFilenameModal(false);
  };

  const handleFilenameCancel = () => {
    setShowFilenameModal(false);
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
  // User color assignment function
  const getUserColor = (userIndex) => {
    const colors = [
      'user-color-1', 'user-color-2', 'user-color-3', 
      'user-color-4', 'user-color-5', 'user-color-6'
    ];
    return colors[userIndex % colors.length];
  };

  // Get user initials
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get file icon based on extension
  const getFileIcon = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
      return <File size={14} className="text-gray-500" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <Code size={14} className="text-blue-500" />;
      case 'css':
      case 'scss':
      case 'less':
        return <FileText size={14} className="text-purple-500" />;
      case 'html':
        return <FileText size={14} className="text-orange-500" />;
      case 'json':
        return <FileText size={14} className="text-green-500" />;
      case 'md':
        return <FileText size={14} className="text-gray-500" />;
      default:
        return <FileText size={14} className="text-gray-400" />;
    }
  };

  // Use real tabs data only
  const tabsToRender = tabs;

  return (
    <div className="figma-tab-bar">
      {tabsToRender.map((tab) => (
        <div
          key={tab.id}
          className={`figma-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabSelect && onTabSelect(tab.id)}
        >
          {/* File Icon */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {getFileIcon(tab.fileName)}
          </div>

          {/* User Indicator */}
          {tab.user && (
            <div 
              className={`tab-user-indicator ${getUserColor(tab.user.index)}`}
              title={`Edited by ${tab.user.name}`}
            >
              {getInitials(tab.user.name)}
            </div>
          )}

          {/* File Name */}
          <span className="tab-file-name">
            {tab.fileName}
            {tab.isDirty && <span className="text-orange-500 ml-1">•</span>}
          </span>

          {/* Close Button */}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose && onTabClose(tab.id);
            }}
            title="Close tab"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Add Tab Button */}
      <button 
        className="flex items-center justify-center w-10 h-full hover:bg-gray-200 transition-colors border-r border-gray-200"
        title="New file"
        onClick={handleNewFileClick}
      >
        <Plus size={16} className="text-gray-500" />
      </button>

      <FilenameModal
        isOpen={showFilenameModal}
        onClose={handleFilenameCancel}
        onConfirm={handleFilenameConfirm}
        defaultValue=""
        title="Create New File"
      />
    </div>
  );
};

export default FigmaTabBar;
