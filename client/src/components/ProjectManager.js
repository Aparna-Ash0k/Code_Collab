import React, { useState, useContext } from 'react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { CollaborationContext } from '../contexts/CollaborationContext';
import { SessionContext } from '../contexts/SessionContext';
import './ProjectManager.css';

const ProjectManager = ({ isOpen, onClose }) => {
  const { 
    projects, 
    currentProject, 
    createProject,
    deleteProject,
    renameProject,
    duplicateProject,
    exportProject,
    importProject,
    isLoading 
  } = useContext(ProjectSystemContext);
  
  const { 
    shareProject, 
    isCollaborating, 
    session 
  } = useContext(CollaborationContext);
  
  const { user } = useContext(SessionContext);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRenameForm, setShowRenameForm] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('javascript');
  const [renameValue, setRenameValue] = useState('');
  const [shareSettings, setShareSettings] = useState({
    accessLevel: 'editor',
    allowFileDownload: true,
    sessionTimeout: 60
  });

  const projectTemplates = [
    { id: 'javascript', name: 'JavaScript', description: 'Basic JavaScript project' },
    { id: 'nodejs', name: 'Node.js', description: 'Node.js backend project' },
    { id: 'react', name: 'React', description: 'React application' },
    { id: 'python', name: 'Python', description: 'Python script project' },
    { id: 'flask', name: 'Flask', description: 'Python Flask web app' },
    { id: 'blank', name: 'Blank', description: 'Empty project' }
  ];

  if (!isOpen) return null;

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await createProject(newProjectName.trim(), selectedTemplate);
      setNewProjectName('');
      setSelectedTemplate('javascript');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleRenameProject = async (projectId, e) => {
    e.preventDefault();
    if (!renameValue.trim()) return;

    try {
      await renameProject(projectId, renameValue.trim());
      setShowRenameForm(null);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename project:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (window.confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) {
      try {
        await deleteProject(projectId);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleDuplicateProject = async (projectId) => {
    try {
      await duplicateProject(projectId);
    } catch (error) {
      console.error('Failed to duplicate project:', error);
    }
  };

  const handleExportProject = async (projectId) => {
    try {
      await exportProject(projectId);
    } catch (error) {
      console.error('Failed to export project:', error);
    }
  };

  const handleImportProject = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await importProject(file);
      event.target.value = ''; // Reset file input
    } catch (error) {
      console.error('Failed to import project:', error);
    }
  };

  const handleShareProject = async () => {
    if (!currentProject) return;
    
    try {
      await shareProject(currentProject.id, shareSettings);
      setShowShareDialog(false);
    } catch (error) {
      console.error('Failed to share project:', error);
    }
  };

  const getProjectStats = (project) => {
    const stats = {
      files: 0,
      folders: 0,
      size: 0
    };

    const countItems = (item) => {
      if (item.type === 'file') {
        stats.files++;
        stats.size += item.content?.length || 0;
      } else if (item.type === 'folder') {
        stats.folders++;
        if (item.children) {
          item.children.forEach(countItems);
        }
      }
    };

    if (project.fileSystem?.children) {
      project.fileSystem.children.forEach(countItems);
    }

    return stats;
  };

  return (
    <div className="project-manager-overlay" onClick={onClose}>
      <div className="project-manager" onClick={(e) => e.stopPropagation()}>
        <div className="project-manager-header">
          <h2>Project Manager</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="project-manager-tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create
          </button>
          <button 
            className={`tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            Manage
          </button>
          <button 
            className={`tab ${activeTab === 'share' ? 'active' : ''}`}
            onClick={() => setActiveTab('share')}
            disabled={!currentProject}
          >
            Share
          </button>
        </div>

        <div className="project-manager-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="current-project-info">
                <h3>Current Project</h3>
                {currentProject ? (
                  <div className="project-details">
                    <div className="project-header">
                      <span className="project-icon">📁</span>
                      <div>
                        <h4>{currentProject.name}</h4>
                        <p>{currentProject.template} project</p>
                      </div>
                    </div>
                    
                    <div className="project-stats">
                      {(() => {
                        const stats = getProjectStats(currentProject);
                        return (
                          <div className="stats-grid">
                            <div className="stat">
                              <span className="stat-value">{stats.files}</span>
                              <span className="stat-label">Files</span>
                            </div>
                            <div className="stat">
                              <span className="stat-value">{stats.folders}</span>
                              <span className="stat-label">Folders</span>
                            </div>
                            <div className="stat">
                              <span className="stat-value">{Math.round(stats.size / 1024)}KB</span>
                              <span className="stat-label">Size</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="project-meta">
                      <p><strong>Created:</strong> {new Date(currentProject.createdAt).toLocaleString()}</p>
                      <p><strong>Last Modified:</strong> {new Date(currentProject.updatedAt).toLocaleString()}</p>
                      {isCollaborating && (
                        <p><strong>Status:</strong> Collaborating ({session?.collaborators?.length || 0} members)</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p>No project selected</p>
                )}
              </div>

              <div className="projects-summary">
                <h3>All Projects ({projects.length})</h3>
                <div className="projects-grid">
                  {projects.map(project => {
                    const stats = getProjectStats(project);
                    return (
                      <div key={project.id} className="project-card">
                        <div className="project-card-header">
                          <span className="project-icon">📁</span>
                          <h4>{project.name}</h4>
                        </div>
                        <p className="project-template">{project.template}</p>
                        <div className="project-stats-mini">
                          <span>{stats.files} files</span>
                          <span>{Math.round(stats.size / 1024)}KB</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="create-tab">
              <h3>Create New Project</h3>
              <form onSubmit={handleCreateProject} className="create-project-form">
                <div className="form-group">
                  <label>Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Template</label>
                  <div className="template-grid">
                    {projectTemplates.map(template => (
                      <div 
                        key={template.id}
                        className={`template-option ${selectedTemplate === template.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <h4>{template.name}</h4>
                        <p>{template.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={!newProjectName.trim() || isLoading}
                  className="create-btn"
                >
                  {isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </form>

              <div className="import-section">
                <h3>Import Project</h3>
                <p>Import a project from a ZIP file</p>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleImportProject}
                  id="import-input"
                  style={{ display: 'none' }}
                />
                <button 
                  onClick={() => document.getElementById('import-input').click()}
                  className="import-btn"
                >
                  Select ZIP File
                </button>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="manage-tab">
              <h3>Manage Projects</h3>
              <div className="projects-list">
                {projects.map(project => (
                  <div key={project.id} className="project-item">
                    <div className="project-info">
                      <span className="project-icon">📁</span>
                      <div>
                        {showRenameForm === project.id ? (
                          <form 
                            onSubmit={(e) => handleRenameProject(project.id, e)}
                            className="rename-form"
                          >
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                              onBlur={() => setShowRenameForm(null)}
                            />
                          </form>
                        ) : (
                          <>
                            <h4>{project.name}</h4>
                            <p>{project.template} • {new Date(project.createdAt).toLocaleDateString()}</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="project-actions">
                      <button
                        onClick={() => {
                          setShowRenameForm(project.id);
                          setRenameValue(project.name);
                        }}
                        title="Rename"
                        disabled={isCollaborating && currentProject?.id === project.id}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDuplicateProject(project.id)}
                        title="Duplicate"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleExportProject(project.id)}
                        title="Export"
                      >
                        📤
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        title="Delete"
                        className="delete-btn"
                        disabled={isCollaborating && currentProject?.id === project.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'share' && currentProject && (
            <div className="share-tab">
              <h3>Share Project: {currentProject.name}</h3>
              
              {isCollaborating ? (
                <div className="collaboration-active">
                  <div className="collaboration-status">
                    <span className="status-icon">🤝</span>
                    <div>
                      <h4>Collaboration Active</h4>
                      <p>Session ID: {session?.sessionId}</p>
                      <p>{session?.collaborators?.length || 0} collaborators connected</p>
                    </div>
                  </div>
                  
                  {session?.collaborators && session.collaborators.length > 0 && (
                    <div className="collaborators-list">
                      <h4>Collaborators:</h4>
                      {session.collaborators.map(collaborator => (
                        <div key={collaborator.id} className="collaborator-item">
                          <span>{collaborator.name}</span>
                          <span className="role-badge">{collaborator.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="share-settings">
                  <div className="form-group">
                    <label>Default Access Level</label>
                    <select
                      value={shareSettings.accessLevel}
                      onChange={(e) => setShareSettings({
                        ...shareSettings,
                        accessLevel: e.target.value
                      })}
                    >
                      <option value="viewer">Viewer (Read-only)</option>
                      <option value="editor">Editor (Can edit files)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={shareSettings.allowFileDownload}
                        onChange={(e) => setShareSettings({
                          ...shareSettings,
                          allowFileDownload: e.target.checked
                        })}
                      />
                      Allow file downloads
                    </label>
                  </div>

                  <div className="form-group">
                    <label>Session Timeout (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={shareSettings.sessionTimeout}
                      onChange={(e) => setShareSettings({
                        ...shareSettings,
                        sessionTimeout: parseInt(e.target.value)
                      })}
                    />
                  </div>

                  <button 
                    onClick={handleShareProject}
                    className="share-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Starting...' : 'Start Collaboration Session'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManager;
