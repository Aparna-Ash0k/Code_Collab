import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Search, 
  Filter, 
  FileText, 
  Folder, 
  Star, 
  Trash2, 
  Download, 
  Eye, 
  Edit3, 
  Calendar, 
  User, 
  MoreHorizontal,
  FolderOpen,
  File,
  Image,
  Code,
  Archive,
  Play,
  X,
  RefreshCw,
  SortAsc,
  SortDesc,
  Palette,
  Grid3X3,
  List,
  TrendingUp,
  Activity,
  Zap,
  Database,
  BarChart3,
  Clock3,
  Users,
  FileCheck,
  Sparkles
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import ModernModal from './ModernModal';
import toast from 'react-hot-toast';

const RecentFilesModal = ({ isOpen, onClose }) => {
  const { session } = useSession();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('lastModified');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  if (!isOpen) return null;

  // Mock recent files data - in production this would come from your backend
  const recentFiles = [
    {
      id: '1',
      name: 'index.js',
      path: '/src/index.js',
      type: 'javascript',
      size: 2456,
      lastModified: new Date('2024-01-20T10:30:00'),
      lastAccessed: new Date('2024-01-20T11:45:00'),
      author: 'John Doe',
      isStarred: true,
      isDirectory: false,
      sessionId: 'session-1',
      sessionName: 'React Project'
    },
    {
      id: '2',
      name: 'components',
      path: '/src/components',
      type: 'folder',
      size: null,
      lastModified: new Date('2024-01-20T09:15:00'),
      lastAccessed: new Date('2024-01-20T11:30:00'),
      author: 'Jane Smith',
      isStarred: false,
      isDirectory: true,
      sessionId: 'session-1',
      sessionName: 'React Project'
    },
    {
      id: '3',
      name: 'README.md',
      path: '/README.md',
      type: 'markdown',
      size: 1024,
      lastModified: new Date('2024-01-19T16:20:00'),
      lastAccessed: new Date('2024-01-20T10:00:00'),
      author: 'Mike Johnson',
      isStarred: true,
      isDirectory: false,
      sessionId: 'session-2',
      sessionName: 'Documentation'
    },
    {
      id: '4',
      name: 'styles.css',
      path: '/src/styles.css',
      type: 'css',
      size: 3072,
      lastModified: new Date('2024-01-19T14:45:00'),
      lastAccessed: new Date('2024-01-19T18:30:00'),
      author: 'Sarah Wilson',
      isStarred: false,
      isDirectory: false,
      sessionId: 'session-1',
      sessionName: 'React Project'
    },
    {
      id: '5',
      name: 'config.json',
      path: '/config/config.json',
      type: 'json',
      size: 512,
      lastModified: new Date('2024-01-18T11:00:00'),
      lastAccessed: new Date('2024-01-19T09:15:00'),
      author: 'John Doe',
      isStarred: false,
      isDirectory: false,
      sessionId: 'session-3',
      sessionName: 'Backend API'
    }
  ];

  const getFileIcon = (type, isDirectory) => {
    if (isDirectory) return <Folder size={20} className="text-blue-500" />;
    
    switch (type) {
      case 'javascript':
      case 'typescript':
        return <Code size={20} className="text-yellow-500" />;
      case 'css':
      case 'scss':
        return <Palette size={20} className="text-purple-500" />;
      case 'html':
        return <FileText size={20} className="text-orange-500" />;
      case 'json':
        return <File size={20} className="text-green-500" />;
      case 'markdown':
        return <FileText size={20} className="text-gray-500" />;
      case 'image':
        return <Image size={20} className="text-pink-500" />;
      case 'archive':
        return <Archive size={20} className="text-brown-500" />;
      case 'video':
        return <Play size={20} className="text-red-500" />;
      default:
        return <File size={20} className="text-gray-400" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = recentFiles.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.sessionName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || 
                         (filterType === 'folders' && file.isDirectory) ||
                         (filterType === 'files' && !file.isDirectory) ||
                         (filterType === 'starred' && file.isStarred) ||
                         file.type === filterType;
      
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'lastModified':
          aValue = a.lastModified;
          bValue = b.lastModified;
          break;
        case 'lastAccessed':
          aValue = a.lastAccessed;
          bValue = b.lastAccessed;
          break;
        case 'size':
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [searchTerm, filterType, sortBy, sortOrder]);

  const handleToggleStar = (fileId) => {
    console.log('Toggling star for file:', fileId);
    toast.success('File starred!');
  };

  const handleDeleteFile = (fileId, fileName) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      console.log('Deleting file:', fileId);
      toast.success(`${fileName} deleted successfully`);
    }
  };

  const handleOpenFile = (file) => {
    console.log('Opening file:', file);
    toast.success(`Opening ${file.name}...`);
    onClose();
  };

  const handleBulkAction = (action) => {
    if (selectedFiles.size === 0) {
      toast.error('No files selected');
      return;
    }

    console.log(`Bulk action: ${action} for files:`, Array.from(selectedFiles));
    toast.success(`${action} applied to ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}`);
    setSelectedFiles(new Set());
  };

  const toggleFileSelection = (fileId) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredAndSortedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredAndSortedFiles.map(f => f.id)));
    }
  };

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      title="Recent Files & Activity"
      subtitle="Browse, search, and manage your recently accessed files and projects"
      maxWidth="xl"
      headerActions={
        <div className="header-actions-enhanced">
          <div className="view-mode-toggle">
            <button
              onClick={() => setViewMode('list')}
              className={`view-mode-button ${viewMode === 'list' ? 'active' : ''}`}
              title="List View"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`view-mode-button ${viewMode === 'grid' ? 'active' : ''}`}
              title="Grid View"
            >
              <Grid3X3 size={16} />
            </button>
          </div>
          <div className="header-stats">
            <div className="stat-badge">
              <FileCheck size={14} />
              <span>{filteredAndSortedFiles.length} files</span>
            </div>
            {selectedFiles.size > 0 && (
              <div className="stat-badge selected">
                <Sparkles size={14} />
                <span>{selectedFiles.size} selected</span>
              </div>
            )}
          </div>
        </div>
      }
    >
      {/* Enhanced Dashboard Overview */}
      <div className="files-dashboard">
        <div className="dashboard-stats">
          <div className="stat-card-enhanced">
            <div className="stat-icon-wrapper files">
              <FileText size={24} />
            </div>
            <div className="stat-content-enhanced">
              <div className="stat-number">{recentFiles.filter(f => !f.isDirectory).length}</div>
              <div className="stat-label">Recent Files</div>
              <div className="stat-change positive">
                <TrendingUp size={12} />
                +3 today
              </div>
            </div>
          </div>
          
          <div className="stat-card-enhanced">
            <div className="stat-icon-wrapper folders">
              <Folder size={24} />
            </div>
            <div className="stat-content-enhanced">
              <div className="stat-number">{recentFiles.filter(f => f.isDirectory).length}</div>
              <div className="stat-label">Folders</div>
              <div className="stat-change neutral">
                <Activity size={12} />
                Active
              </div>
            </div>
          </div>
          
          <div className="stat-card-enhanced">
            <div className="stat-icon-wrapper starred">
              <Star size={24} />
            </div>
            <div className="stat-content-enhanced">
              <div className="stat-number">{recentFiles.filter(f => f.isStarred).length}</div>
              <div className="stat-label">Starred</div>
              <div className="stat-change">
                <Zap size={12} />
                Quick Access
              </div>
            </div>
          </div>
          
          <div className="stat-card-enhanced">
            <div className="stat-icon-wrapper activity">
              <Clock3 size={24} />
            </div>
            <div className="stat-content-enhanced">
              <div className="stat-number">2h</div>
              <div className="stat-label">Avg Session</div>
              <div className="stat-change positive">
                <BarChart3 size={12} />
                +15% this week
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="recent-activity">
          <h3 className="activity-title">
            <Activity size={18} />
            Recent Activity
          </h3>
          <div className="activity-timeline">
            <div className="activity-item">
              <div className="activity-dot"></div>
              <div className="activity-content">
                <span className="activity-action">Edited</span>
                <span className="activity-file">index.js</span>
                <span className="activity-time">2 minutes ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot"></div>
              <div className="activity-content">
                <span className="activity-action">Created</span>
                <span className="activity-file">components/Button.tsx</span>
                <span className="activity-time">1 hour ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot"></div>
              <div className="activity-content">
                <span className="activity-action">Starred</span>
                <span className="activity-file">README.md</span>
                <span className="activity-time">3 hours ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filter Bar */}
      <div className="search-filter-bar-enhanced">
        <div className="search-section">
          <div className="search-input-group-enhanced">
            <Search size={18} className="search-icon-enhanced" />
            <input
              type="text"
              placeholder="Search files, folders, or sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input-enhanced"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="search-clear-enhanced"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        
        <div className="filter-section">
          <div className="filter-group-enhanced">
            <Filter size={16} className="filter-icon-enhanced" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select-enhanced"
            >
              <option value="all">All Types</option>
              <option value="files">📄 Files Only</option>
              <option value="folders">📁 Folders Only</option>
              <option value="starred">⭐ Starred</option>
              <option value="javascript">🟨 JavaScript</option>
              <option value="css">🟦 CSS</option>
              <option value="html">🟧 HTML</option>
              <option value="json">🟩 JSON</option>
              <option value="markdown">⬜ Markdown</option>
            </select>
          </div>

          <div className="sort-group-enhanced">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select-enhanced"
            >
              <option value="lastModified">📅 Last Modified</option>
              <option value="lastAccessed">👁️ Last Accessed</option>
              <option value="name">🔤 Name</option>
              <option value="size">📏 Size</option>
              <option value="type">🏷️ Type</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-button-enhanced"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
            </button>
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setSortBy('lastModified');
              setSortOrder('desc');
            }}
            className="reset-button-enhanced"
            title="Reset all filters"
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedFiles.size > 0 && (
        <div className="bulk-actions-bar-enhanced">
          <div className="bulk-selection-enhanced">
            <div className="selection-indicator">
              <Sparkles size={16} />
              <span>{selectedFiles.size} of {filteredAndSortedFiles.length} selected</span>
            </div>
            <button
              onClick={toggleSelectAll}
              className="select-all-button-enhanced"
            >
              {selectedFiles.size === filteredAndSortedFiles.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="bulk-actions-buttons">
            <button
              onClick={() => handleBulkAction('Download')}
              className="bulk-action-button download"
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={() => handleBulkAction('Star')}
              className="bulk-action-button star"
            >
              <Star size={16} />
              Star
            </button>
            <button
              onClick={() => handleBulkAction('Delete')}
              className="bulk-action-button delete"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Files Display */}
      <div className={`files-container-enhanced ${viewMode}`}>
        {filteredAndSortedFiles.length === 0 ? (
          <div className="empty-state-enhanced">
            <div className="empty-illustration">
              <Clock size={64} />
              <div className="empty-sparkles">
                <Sparkles size={24} />
                <Sparkles size={16} />
                <Sparkles size={20} />
              </div>
            </div>
            <h3>No recent files found</h3>
            <p>Start coding to see your recent files here, or try adjusting your search criteria.</p>
            <div className="empty-actions">
              <button className="button button-primary">
                <FileText size={16} />
                Create New File
              </button>
              <button className="button button-outline">
                <Folder size={16} />
                Browse Projects
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="files-grid-enhanced">
            {filteredAndSortedFiles.map((file) => (
              <div
                key={file.id}
                className={`file-card-enhanced ${selectedFiles.has(file.id) ? 'selected' : ''}`}
                onClick={() => toggleFileSelection(file.id)}
              >
                <div className="file-card-header">
                  <div className="file-icon-large">
                    {getFileIcon(file.type, file.isDirectory)}
                    {file.isStarred && (
                      <Star size={14} className="star-overlay-large" />
                    )}
                  </div>
                  <div className="file-card-actions">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      className="file-checkbox-enhanced"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                
                <div className="file-card-content">
                  <h4 className="file-name-large">{file.name}</h4>
                  <p className="file-path-small">{file.path}</p>
                  <div className="file-meta-grid">
                    <div className="meta-item">
                      <Clock3 size={12} />
                      <span>{formatDate(file.lastModified)}</span>
                    </div>
                    <div className="meta-item">
                      <Database size={12} />
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <div className="session-tag">
                    <Users size={12} />
                    <span>{file.sessionName}</span>
                  </div>
                </div>

                <div className="file-card-footer">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFile(file);
                    }}
                    className="card-action-button primary"
                  >
                    {file.isDirectory ? <FolderOpen size={16} /> : <Edit3 size={16} />}
                    Open
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStar(file.id);
                    }}
                    className={`card-action-button ${file.isStarred ? 'starred' : 'outline'}`}
                  >
                    <Star size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="files-list-enhanced">
            {/* Enhanced Table Header */}
            <div className="files-header-enhanced">
              <div className="header-cell-enhanced select-cell">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
                  onChange={toggleSelectAll}
                  className="form-checkbox-enhanced"
                />
              </div>
              <div className="header-cell-enhanced name-cell">
                <FileText size={16} />
                <span>Name</span>
              </div>
              <div className="header-cell-enhanced session-cell">
                <Users size={16} />
                <span>Session</span>
              </div>
              <div className="header-cell-enhanced size-cell">
                <Database size={16} />
                <span>Size</span>
              </div>
              <div className="header-cell-enhanced modified-cell">
                <Clock3 size={16} />
                <span>Modified</span>
              </div>
              <div className="header-cell-enhanced author-cell">
                <User size={16} />
                <span>Author</span>
              </div>
              <div className="header-cell-enhanced actions-cell">
                <span>Actions</span>
              </div>
            </div>

            {/* Enhanced Files Rows */}
            {filteredAndSortedFiles.map((file) => (
              <div
                key={file.id}
                className={`file-row-enhanced ${selectedFiles.has(file.id) ? 'selected' : ''}`}
                onClick={() => toggleFileSelection(file.id)}
              >
                <div className="file-cell-enhanced select-cell">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="form-checkbox-enhanced"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="file-cell-enhanced name-cell">
                  <div className="file-info-enhanced">
                    <div className="file-icon-enhanced">
                      {getFileIcon(file.type, file.isDirectory)}
                      {file.isStarred && (
                        <Star size={10} className="star-overlay-enhanced" />
                      )}
                    </div>
                    <div className="file-details-enhanced">
                      <span className="file-name-enhanced">{file.name}</span>
                      <span className="file-path-enhanced">{file.path}</span>
                    </div>
                  </div>
                </div>

                <div className="file-cell-enhanced session-cell">
                  <div className="session-info-enhanced">
                    <div className="session-dot"></div>
                    <span className="session-name-enhanced">{file.sessionName}</span>
                  </div>
                </div>

                <div className="file-cell-enhanced size-cell">
                  <span className="file-size-enhanced">{formatFileSize(file.size)}</span>
                </div>

                <div className="file-cell-enhanced modified-cell">
                  <div className="date-info-enhanced">
                    <span className="relative-date-enhanced">{formatDate(file.lastModified)}</span>
                    <span className="absolute-date-enhanced">{file.lastModified.toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="file-cell-enhanced author-cell">
                  <div className="author-info-enhanced">
                    <div className="author-avatar">
                      {file.author.charAt(0).toUpperCase()}
                    </div>
                    <span>{file.author}</span>
                  </div>
                </div>

                <div className="file-cell-enhanced actions-cell">
                  <div className="file-actions-enhanced">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFile(file);
                      }}
                      className="action-button-enhanced primary"
                      title="Open file"
                    >
                      {file.isDirectory ? <FolderOpen size={16} /> : <Edit3 size={16} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStar(file.id);
                      }}
                      className={`action-button-enhanced ${file.isStarred ? 'starred' : ''}`}
                      title={file.isStarred ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Download file:', file.id);
                        toast.success(`Downloading ${file.name}...`);
                      }}
                      className="action-button-enhanced"
                      title="Download file"
                    >
                      <Download size={16} />
                    </button>
                    <div className="action-dropdown-enhanced">
                      <button className="action-button-enhanced dropdown-trigger">
                        <MoreHorizontal size={16} />
                      </button>
                      <div className="dropdown-menu-enhanced">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('View details:', file.id);
                          }}
                          className="dropdown-item-enhanced"
                        >
                          <Eye size={14} />
                          View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.id, file.name);
                          }}
                          className="dropdown-item-enhanced danger"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Footer */}
      <div className="modal-footer-enhanced">
        <div className="footer-stats">
          <div className="stat-item-enhanced">
            <FileText size={16} />
            <span>{recentFiles.filter(f => !f.isDirectory).length} Files</span>
          </div>
          <div className="stat-item-enhanced">
            <Folder size={16} />
            <span>{recentFiles.filter(f => f.isDirectory).length} Folders</span>
          </div>
          <div className="stat-item-enhanced">
            <Star size={16} />
            <span>{recentFiles.filter(f => f.isStarred).length} Starred</span>
          </div>
          <div className="stat-item-enhanced">
            <Activity size={16} />
            <span>Last activity: {formatDate(new Date(Math.max(...recentFiles.map(f => f.lastAccessed))))}</span>
          </div>
        </div>

        <div className="footer-actions">
          <button
            onClick={() => {
              console.log('Clearing recent files history');
              toast.success('Recent files history cleared');
            }}
            className="button button-outline"
          >
            <Trash2 size={16} />
            Clear History
          </button>
          <button
            onClick={onClose}
            className="button button-primary"
          >
            Close
          </button>
        </div>
      </div>
    </ModernModal>
  );
};

export default RecentFilesModal;
