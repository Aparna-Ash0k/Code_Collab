import React, { useState, useContext } from 'react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { CollaborationContext } from '../contexts/CollaborationContext';
import './ProjectSelector.css';

const ProjectSelector = () => {
  const { 
    projects, 
    currentProject, 
    switchProject, 
    createProject,
    deleteProject,
    isLoading,
    error
  } = useContext(ProjectSystemContext);
  
  const { isCollaborating, session } = useContext(CollaborationContext);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('javascript');

  const handleProjectSwitch = async (projectId) => {
    if (isCollaborating) {
      alert('Cannot switch projects during collaboration. Leave the session first.');
      return;
    }
    
    await switchProject(projectId);
    setIsOpen(false);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await createProject(newProjectName.trim(), selectedTemplate);
      setNewProjectName('');
      setSelectedTemplate('javascript');
      setShowCreateForm(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    
    if (isCollaborating) {
      alert('Cannot delete projects during collaboration.');
      return;
    }

    const project = projects.find(p => p.id === projectId);
    if (window.confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) {
      try {
        await deleteProject(projectId);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const projectTemplates = [
    { id: 'javascript', name: 'JavaScript', description: 'Basic JavaScript project' },
    { id: 'nodejs', name: 'Node.js', description: 'Node.js backend project' },
    { id: 'react', name: 'React', description: 'React application' },
    { id: 'python', name: 'Python', description: 'Python script project' },
    { id: 'flask', name: 'Flask', description: 'Python Flask web app' },
    { id: 'blank', name: 'Blank', description: 'Empty project' }
  ];

  if (isLoading) {
    return (
      <div className="project-selector loading">
        <div className="project-selector-button">
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="project-selector">
      <button 
        className="project-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isCollaborating}
        title={isCollaborating ? 'Cannot switch projects during collaboration' : 'Select project'}
      >
        <div className="current-project">
          <span className="project-icon">📁</span>
          <span className="project-name">
            {currentProject ? currentProject.name : 'No Project'}
          </span>
          {isCollaborating && session?.project && (
            <span className="collaboration-badge">
              {session.isOwner ? '👑' : '🤝'}
            </span>
          )}
        </div>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="project-dropdown">
          <div className="dropdown-header">
            <h3>Projects</h3>
            <button 
              className="create-project-btn"
              onClick={() => setShowCreateForm(true)}
              disabled={isCollaborating}
            >
              + New
            </button>
          </div>

          {showCreateForm && (
            <form className="create-project-form" onSubmit={handleCreateProject}>
              <input
                type="text"
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
              <select 
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                {projectTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
              <div className="form-actions">
                <button type="submit" disabled={!newProjectName.trim()}>
                  Create
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="projects-list">
            {projects.length === 0 ? (
              <div className="empty-projects">
                <p>No projects yet</p>
                <button onClick={() => setShowCreateForm(true)}>
                  Create your first project
                </button>
              </div>
            ) : (
              projects.map(project => (
                <div 
                  key={project.id}
                  className={`project-item ${currentProject?.id === project.id ? 'active' : ''}`}
                  onClick={() => handleProjectSwitch(project.id)}
                >
                  <div className="project-info">
                    <span className="project-icon">📁</span>
                    <div className="project-details">
                      <span className="project-name">{project.name}</span>
                      <span className="project-meta">
                        {project.template} • {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {currentProject?.id !== project.id && (
                    <button
                      className="delete-project-btn"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      title="Delete project"
                      disabled={isCollaborating}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
