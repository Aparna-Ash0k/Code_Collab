import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FolderPlus, 
  Users, 
  Settings, 
  Globe, 
  Lock, 
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Copy,
  Share2,
  Calendar,
  FileText,
  Search,
  Filter,
  MoreVertical
} from 'lucide-react';
import './ProjectManager.css';

const ProjectManager = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all'); // all, owned, collaborated, public
  const [sortBy, setSortBy] = useState('updated'); // updated, created, name
  const [selectedProject, setSelectedProject] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    visibility: 'private',
    template: 'blank',
    language: 'javascript'
  });

  // Mock projects data - replace with actual API calls
  useEffect(() => {
    if (user) {
      setProjects([
        {
          id: '1',
          name: 'React Todo App',
          description: 'A simple todo application built with React',
          visibility: 'private',
          language: 'javascript',
          owner: user.id,
          ownerName: user.name,
          collaborators: [
            { id: user.id, name: user.name, role: 'owner', avatar: user.avatar },
            { id: '2', name: 'John Doe', role: 'editor', avatar: 'JD' }
          ],
          fileCount: 8,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z',
          lastActivity: 'Modified App.js'
        },
        {
          id: '2',
          name: 'Python ML Project',
          description: 'Machine learning project for data analysis',
          visibility: 'public',
          language: 'python',
          owner: '2',
          ownerName: 'Jane Smith',
          collaborators: [
            { id: '2', name: 'Jane Smith', role: 'owner', avatar: 'JS' },
            { id: user.id, name: user.name, role: 'editor', avatar: user.avatar }
          ],
          fileCount: 15,
          createdAt: '2024-01-10T08:00:00Z',
          updatedAt: '2024-01-19T12:00:00Z',
          lastActivity: 'Added model.py'
        },
        {
          id: '3',
          name: 'API Documentation',
          description: 'Documentation for REST API endpoints',
          visibility: 'unlisted',
          language: 'markdown',
          owner: user.id,
          ownerName: user.name,
          collaborators: [
            { id: user.id, name: user.name, role: 'owner', avatar: user.avatar }
          ],
          fileCount: 5,
          createdAt: '2024-01-18T14:00:00Z',
          updatedAt: '2024-01-18T16:45:00Z',
          lastActivity: 'Created README.md'
        }
      ]);
    }
  }, [user]);

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;

    const project = {
      id: Date.now().toString(),
      ...newProject,
      owner: user.id,
      ownerName: user.name,
      collaborators: [
        { id: user.id, name: user.name, role: 'owner', avatar: user.avatar }
      ],
      fileCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivity: 'Project created'
    };

    setProjects(prev => [project, ...prev]);
    setIsCreating(false);
    setNewProject({
      name: '',
      description: '',
      visibility: 'private',
      template: 'blank',
      language: 'javascript'
    });
  };

  const handleDeleteProject = (projectId) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  const handleInviteCollaborator = (projectId, email, role) => {
    // Mock invite functionality
    console.log(`Inviting ${email} as ${role} to project ${projectId}`);
    setShowInviteModal(false);
  };

  const getFilteredProjects = () => {
    let filtered = projects;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    switch (filterBy) {
      case 'owned':
        filtered = filtered.filter(p => p.owner === user.id);
        break;
      case 'collaborated':
        filtered = filtered.filter(p => 
          p.owner !== user.id && 
          p.collaborators.some(c => c.id === user.id)
        );
        break;
      case 'public':
        filtered = filtered.filter(p => p.visibility === 'public');
        break;
      default:
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'updated':
        default:
          return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
    });

    return filtered;
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'public':
        return <Globe size={14} />;
      case 'unlisted':
        return <Eye size={14} />;
      case 'private':
      default:
        return <Lock size={14} />;
    }
  };

  const getLanguageColor = (language) => {
    const colors = {
      javascript: '#f7df1e',
      python: '#3776ab',
      java: '#ed8b00',
      cpp: '#00599c',
      html: '#e34f26',
      css: '#1572b6',
      typescript: '#3178c6',
      markdown: '#083fa1'
    };
    return colors[language] || '#6b7280';
  };

  if (!isOpen) return null;

  return (
    <div className="project-manager-overlay" onClick={onClose}>
      <div className="project-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-manager-header">
          <h2>
            <FolderPlus size={20} />
            Project Manager
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setIsCreating(true)}
            >
              <FolderPlus size={16} />
              New Project
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="project-manager-content">
          {/* Search and Filters */}
          <div className="project-filters">
            <div className="search-bar">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filter-controls">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
              >
                <option value="all">All Projects</option>
                <option value="owned">Owned by Me</option>
                <option value="collaborated">Collaborated</option>
                <option value="public">Public</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {/* Projects Grid */}
          <div className="projects-grid">
            {getFilteredProjects().map(project => (
              <div key={project.id} className="project-card">
                <div className="project-header">
                  <div className="project-info">
                    <h4>{project.name}</h4>
                    <div className="project-meta">
                      <span className="visibility">
                        {getVisibilityIcon(project.visibility)}
                        {project.visibility}
                      </span>
                      <span 
                        className="language"
                        style={{ color: getLanguageColor(project.language) }}
                      >
                        ● {project.language}
                      </span>
                    </div>
                  </div>
                  
                  <div className="project-actions">
                    <button
                      className="action-btn"
                      onClick={() => setSelectedProject(project)}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>

                <p className="project-description">{project.description}</p>

                <div className="project-stats">
                  <span className="file-count">
                    <FileText size={14} />
                    {project.fileCount} files
                  </span>
                  <span className="collaborator-count">
                    <Users size={14} />
                    {project.collaborators.length} collaborators
                  </span>
                </div>

                <div className="project-footer">
                  <span className="last-activity">
                    {project.lastActivity}
                  </span>
                  <span className="updated-date">
                    <Calendar size={12} />
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="project-collaborators">
                  {project.collaborators.slice(0, 3).map(collaborator => (
                    <div key={collaborator.id} className="collaborator-avatar">
                      {collaborator.avatar}
                    </div>
                  ))}
                  {project.collaborators.length > 3 && (
                    <div className="collaborator-count-badge">
                      +{project.collaborators.length - 3}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {getFilteredProjects().length === 0 && (
            <div className="empty-state">
              <FolderPlus size={48} />
              <h3>No projects found</h3>
              <p>
                {searchQuery || filterBy !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first project to get started'
                }
              </p>
              {!searchQuery && filterBy === 'all' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsCreating(true)}
                >
                  <FolderPlus size={16} />
                  Create Project
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create Project Modal */}
        {isCreating && (
          <div className="create-project-modal">
            <div className="modal-content">
              <h3>Create New Project</h3>
              
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter project name"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your project"
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Primary Language</label>
                  <select
                    value={newProject.language}
                    onChange={(e) => setNewProject(prev => ({ ...prev, language: e.target.value }))}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Visibility</label>
                  <select
                    value={newProject.visibility}
                    onChange={(e) => setNewProject(prev => ({ ...prev, visibility: e.target.value }))}
                  >
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim()}
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Context Menu */}
        {selectedProject && (
          <div className="project-context-menu">
            <div className="context-menu-content">
              <button onClick={() => console.log('Open project')}>
                <Edit3 size={16} />
                Open Project
              </button>
              <button onClick={() => setShowInviteModal(true)}>
                <Share2 size={16} />
                Invite Collaborators
              </button>
              <button onClick={() => console.log('Copy link')}>
                <Copy size={16} />
                Copy Share Link
              </button>
              <hr />
              <button onClick={() => console.log('Project settings')}>
                <Settings size={16} />
                Project Settings
              </button>
              {selectedProject.owner === user.id && (
                <button
                  className="danger"
                  onClick={() => handleDeleteProject(selectedProject.id)}
                >
                  <Trash2 size={16} />
                  Delete Project
                </button>
              )}
            </div>
            <div
              className="context-menu-overlay"
              onClick={() => setSelectedProject(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectManager;
