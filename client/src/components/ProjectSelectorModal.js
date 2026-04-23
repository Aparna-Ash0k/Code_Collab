import React, { useState } from 'react';
import { X, Folder, Plus, Search, Clock, Star, Users } from 'lucide-react';
import './ProjectSelectorModal.css';

const ProjectSelectorModal = ({ isOpen, onClose, onProjectSelect, currentProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('recent');

  // Mock project data
  const projects = [
    {
      id: 1,
      name: 'CodeCollab Frontend',
      path: '/workspace/codecollab-frontend',
      lastOpened: '2 hours ago',
      type: 'React',
      collaborators: 3,
      starred: true
    },
    {
      id: 2,
      name: 'API Gateway',
      path: '/workspace/api-gateway',
      lastOpened: '1 day ago',
      type: 'Node.js',
      collaborators: 2,
      starred: false
    },
    {
      id: 3,
      name: 'Mobile App',
      path: '/workspace/mobile-app',
      lastOpened: '3 days ago',
      type: 'React Native',
      collaborators: 5,
      starred: true
    },
    {
      id: 4,
      name: 'Documentation Site',
      path: '/workspace/docs',
      lastOpened: '1 week ago',
      type: 'Next.js',
      collaborators: 1,
      starred: false
    }
  ];

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectsByTab = () => {
    switch (activeTab) {
      case 'recent':
        return filteredProjects.sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened));
      case 'starred':
        return filteredProjects.filter(p => p.starred);
      case 'all':
        return filteredProjects.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return filteredProjects;
    }
  };

  const handleProjectSelect = (project) => {
    onProjectSelect(project);
    onClose();
  };

  const getProjectIcon = (type) => {
    const icons = {
      'React': '⚛️',
      'Node.js': '💚',
      'React Native': '📱',
      'Next.js': '▲',
      'Vue.js': '💚',
      'Angular': '🅰️',
      'Python': '🐍',
      'Java': '☕',
      'TypeScript': '📘'
    };
    return icons[type] || '📁';
  };

  if (!isOpen) return null;

  return (
    <div className="project-selector-overlay">
      <div className="project-selector-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <Folder size={20} className="header-icon" />
            <h2>Select Project</h2>
          </div>
          <button onClick={onClose} className="close-button">
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-section">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <button
            className={`tab ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            <Clock size={14} />
            Recent
          </button>
          <button
            className={`tab ${activeTab === 'starred' ? 'active' : ''}`}
            onClick={() => setActiveTab('starred')}
          >
            <Star size={14} />
            Starred
          </button>
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Folder size={14} />
            All Projects
          </button>
        </div>

        {/* Projects List */}
        <div className="projects-list">
          {getProjectsByTab().length === 0 ? (
            <div className="empty-state">
              <Folder size={48} className="empty-icon" />
              <p>No projects found</p>
              <span>Try adjusting your search or create a new project</span>
            </div>
          ) : (
            getProjectsByTab().map((project) => (
              <div
                key={project.id}
                className={`project-item ${currentProject?.id === project.id ? 'current' : ''}`}
                onClick={() => handleProjectSelect(project)}
              >
                <div className="project-icon">
                  {getProjectIcon(project.type)}
                </div>
                <div className="project-info">
                  <div className="project-header">
                    <span className="project-name">{project.name}</span>
                    {project.starred && <Star size={12} className="star-icon filled" />}
                  </div>
                  <div className="project-details">
                    <span className="project-path">{project.path}</span>
                    <span className="project-meta">
                      {project.type} • {project.lastOpened}
                    </span>
                  </div>
                  {project.collaborators > 1 && (
                    <div className="collaborators">
                      <Users size={12} />
                      <span>{project.collaborators} collaborators</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button className="footer-button secondary">
            <Plus size={16} />
            New Project
          </button>
          <button className="footer-button secondary">
            <Folder size={16} />
            Open Folder
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelectorModal;
