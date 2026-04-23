import React, { useState } from 'react';
import { Folder, ChevronDown } from 'lucide-react';
import ProjectSelectorModal from './ProjectSelectorModal';
import ProjectBreadcrumb from './ProjectBreadcrumb';
import './ProjectTopBar.css';

const ProjectTopBar = ({ currentPath = '', onNavigate, currentProject, onProjectChange }) => {
  const [showProjectModal, setShowProjectModal] = useState(false);

  const handleProjectSelect = (project) => {
    if (onProjectChange) {
      onProjectChange(project);
    }
  };

  return (
    <>
      <div className="project-top-bar">
        <div className="project-top-bar-left">
          <button 
            className="project-selector-trigger"
            onClick={() => setShowProjectModal(true)}
            title="Select project"
          >
            <Folder size={16} className="project-icon" />
            <span className="project-name">
              {currentProject ? currentProject.name : 'No Project'}
            </span>
            <ChevronDown size={14} className="dropdown-arrow" />
          </button>
        </div>
        
        <div className="project-top-bar-center">
          <ProjectBreadcrumb 
            currentPath={currentPath} 
            onNavigate={onNavigate}
            currentProject={currentProject}
          />
        </div>
        
        <div className="project-top-bar-right">
          {/* Reserved for future project-specific actions */}
        </div>
      </div>

      <ProjectSelectorModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onProjectSelect={handleProjectSelect}
        currentProject={currentProject}
      />
    </>
  );
};

export default ProjectTopBar;
