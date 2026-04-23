import React, { useContext } from 'react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { CollaborationContext } from '../contexts/CollaborationContext';
import './ProjectBreadcrumb.css';

const ProjectBreadcrumb = ({ currentPath = '', onNavigate, currentProject: propCurrentProject }) => {
  // Use prop project if provided, otherwise fall back to context
  const { currentProject: contextProject, userRole } = useContext(ProjectSystemContext) || {};
  const { isCollaborating, session } = useContext(CollaborationContext) || {};
  
  const currentProject = propCurrentProject || contextProject;

  if (!currentProject) {
    return (
      <div className="project-breadcrumb empty">
        <span className="no-project">No project selected</span>
      </div>
    );
  }

  // Parse the current path into segments
  const pathSegments = currentPath
    .split('/')
    .filter(segment => segment.length > 0);

  const handleSegmentClick = (index) => {
    if (!onNavigate) return;
    
    // Build path up to clicked segment
    const newPath = pathSegments.slice(0, index + 1).join('/');
    onNavigate(newPath ? `/${newPath}` : '/');
  };

  const getCollaborationBadge = () => {
    if (!isCollaborating) return null;

    if (session?.isOwner) {
      return (
        <span className="collaboration-badge owner" title="You are the project owner">
          👑 Sharing
        </span>
      );
    } else {
      const role = session?.collaborators?.find(c => c.id === session?.user?.id)?.role || 'viewer';
      return (
        <span className={`collaboration-badge ${role}`} title={`Collaborating as ${role}`}>
          🤝 {role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
      );
    }
  };

  return (
    <div className="project-breadcrumb">
      <div className="breadcrumb-content">
        {/* Project root */}
        <div className="breadcrumb-segment project-root">
          <span 
            className="segment-link"
            onClick={() => handleSegmentClick(-1)}
            title={`${currentProject.name} (${currentProject.template})`}
          >
            <span className="project-icon">📁</span>
            <span className="project-name">{currentProject.name}</span>
          </span>
          {getCollaborationBadge()}
        </div>

        {/* Path segments */}
        {pathSegments.length > 0 && (
          <>
            <span className="breadcrumb-separator">/</span>
            {pathSegments.map((segment, index) => (
              <React.Fragment key={index}>
                <div 
                  className={`breadcrumb-segment ${index === pathSegments.length - 1 ? 'current' : ''}`}
                >
                  <span 
                    className="segment-link"
                    onClick={() => handleSegmentClick(index)}
                  >
                    {segment}
                  </span>
                </div>
                {index < pathSegments.length - 1 && (
                  <span className="breadcrumb-separator">/</span>
                )}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      {/* Additional info */}
      <div className="breadcrumb-info">
        {isCollaborating && session?.collaborators && (
          <div className="collaborators-indicator">
            <span className="collaborator-count">
              {session.collaborators.length} 
              {session.collaborators.length === 1 ? ' collaborator' : ' collaborators'}
            </span>
          </div>
        )}
        
        <div className="project-type">
          {currentProject.template}
        </div>
      </div>
    </div>
  );
};

export default ProjectBreadcrumb;
