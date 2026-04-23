import React from 'react';
import ProjectCollaborationModal from './ProjectCollaborationModal';

const ProjectSharingModal = ({ isOpen, onClose }) => {
  // Use the new ProjectCollaborationModal instead
  return (
    <ProjectCollaborationModal 
      isOpen={isOpen} 
      onClose={onClose} 
    />
  );
};

export default ProjectSharingModal;
