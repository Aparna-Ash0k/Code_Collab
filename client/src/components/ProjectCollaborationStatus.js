import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useCollaboration } from '../contexts/CollaborationContext';
import { projectSyncService } from '../services/RealTimeProjectSync';
import './ProjectCollaborationStatus.css';

const ProjectCollaborationStatus = () => {
  const [projectState, setProjectState] = useState(null);
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [collaboratorCount, setCollaboratorCount] = useState(0);

  const { session } = useSession();
  const { state } = useCollaboration();

  useEffect(() => {
    if (projectSyncService.isInitialized) {
      const currentState = projectSyncService.getProjectState();
      setProjectState(currentState);
      setIsCollaborating(true);
      setCollaboratorCount(currentState.collaborators?.size || 0);
    } else {
      setIsCollaborating(false);
      setProjectState(null);
      setCollaboratorCount(0);
    }
  }, [session, state.projectMode]);

  // Listen for project state changes
  useEffect(() => {
    const handleProjectUpdate = () => {
      if (projectSyncService.isInitialized) {
        const currentState = projectSyncService.getProjectState();
        setProjectState(currentState);
        setCollaboratorCount(currentState.collaborators?.size || 0);
      }
    };

    projectSyncService.on('project_synced', handleProjectUpdate);
    projectSyncService.on('collaborator_joined', handleProjectUpdate);
    projectSyncService.on('collaborator_left', handleProjectUpdate);

    return () => {
      projectSyncService.off('project_synced', handleProjectUpdate);
      projectSyncService.off('collaborator_joined', handleProjectUpdate);
      projectSyncService.off('collaborator_left', handleProjectUpdate);
    };
  }, []);

  if (!isCollaborating || !projectState) {
    return null;
  }

  const formatFileCount = (count) => {
    if (count === 0) return 'No files';
    if (count === 1) return '1 file';
    return `${count} files`;
  };

  const formatCollaboratorCount = (count) => {
    if (count === 0) return 'Just you';
    if (count === 1) return '1 collaborator';
    return `${count} collaborators`;
  };

  return (
    <div className="project-collaboration-status">
      <div className="status-header">
        <div className="status-icon">
          <span className="collaboration-indicator">🤝</span>
          <span className="sync-pulse"></span>
        </div>
        <div className="status-text">
          <div className="project-name">{projectState.name}</div>
          <div className="status-details">
            {formatFileCount(projectState.files?.size || 0)} • {formatCollaboratorCount(collaboratorCount)}
          </div>
        </div>
      </div>
      
      <div className="sync-status">
        <span className="sync-indicator active">
          <span className="sync-dot"></span>
          Live Sync
        </span>
      </div>
    </div>
  );
};

export default ProjectCollaborationStatus;
