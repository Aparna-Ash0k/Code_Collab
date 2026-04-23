import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useCollaboration } from '../contexts/CollaborationContext';
import { useFileSystem } from '../contexts/FileSystemContext';
import { virtualFileSystem } from '../utils/virtualFileSystem';
import './ProjectCollaborationModal.css';

const ProjectCollaborationModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1); // 1: mode choice, 2: project details, 3: confirmation
  const [collaborationMode, setCollaborationMode] = useState(''); // 'existing' | 'new'
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    type: 'general'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentProjectSnapshot, setCurrentProjectSnapshot] = useState(null);

  const { session } = useSession();
  const { initializeProjectShare } = useCollaboration();
  const { fileTree } = useFileSystem();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCollaborationMode('');
      setProjectData({
        name: '',
        description: '',
        type: 'general'
      });
      setIsLoading(false);
      setCurrentProjectSnapshot(null);
    }
  }, [isOpen]);

  // Capture current project state when sharing existing
  useEffect(() => {
    if (collaborationMode === 'existing') {
      const snapshot = captureProjectSnapshot();
      setCurrentProjectSnapshot(snapshot);
    }
  }, [collaborationMode]);

  const captureProjectSnapshot = () => {
    const files = [];
    const folders = [];
    
    // Capture all files from VFS
    for (const [path, fileData] of virtualFileSystem.files) {
      files.push({
        id: generateFileId(),
        path,
        name: path.split('/').pop(),
        type: 'file',
        content: fileData.content,
        lastModified: fileData.lastModified || Date.now()
      });
    }
    
    // Capture all folders from VFS
    for (const folderPath of virtualFileSystem.folders) {
      folders.push({
        id: generateFolderId(),
        path: folderPath,
        name: folderPath.split('/').pop(),
        type: 'folder',
        children: []
      });
    }
    
    return {
      files,
      folders,
      totalFiles: files.length,
      totalSize: files.reduce((size, file) => size + (file.content?.length || 0), 0)
    };
  };

  const generateFileId = () => `f_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const generateFolderId = () => `d_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleModeSelection = (mode) => {
    setCollaborationMode(mode);
    
    if (mode === 'existing') {
      // Auto-fill project name if we can detect it
      const suggestedName = detectProjectName();
      setProjectData(prev => ({
        ...prev,
        name: suggestedName,
        type: detectProjectType()
      }));
    } else {
      setProjectData(prev => ({
        ...prev,
        name: '',
        type: 'general'
      }));
    }
    
    setStep(2);
  };

  const detectProjectName = () => {
    // Try to detect project name from package.json, project structure, etc.
    const packageJsonFile = virtualFileSystem.readFile('package.json');
    if (packageJsonFile) {
      try {
        const packageData = JSON.parse(packageJsonFile.content);
        return packageData.name || 'My Project';
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return `Project ${new Date().toLocaleDateString()}`;
  };

  const detectProjectType = () => {
    const files = Array.from(virtualFileSystem.files.keys());
    
    if (files.includes('package.json')) {
      const packageJsonFile = virtualFileSystem.readFile('package.json');
      if (packageJsonFile?.content.includes('react')) return 'react';
      if (packageJsonFile?.content.includes('express')) return 'nodejs';
      return 'nodejs';
    }
    
    if (files.includes('requirements.txt') || files.some(f => f.endsWith('.py'))) {
      return 'python';
    }
    
    if (files.some(f => f.endsWith('.java'))) return 'java';
    if (files.some(f => f.endsWith('.cpp') || f.endsWith('.c'))) return 'cpp';
    
    return 'general';
  };

  const handleProjectDetails = () => {
    if (!projectData.name.trim()) {
      alert('Please enter a project name');
      return;
    }
    setStep(3);
  };

  const handleStartCollaboration = async () => {
    if (!session) {
      alert('No active session found');
      return;
    }

    setIsLoading(true);
    
    try {
      const collaborationData = {
        name: projectData.name,
        description: projectData.description,
        type: projectData.type,
        mode: collaborationMode,
        timestamp: Date.now()
      };

      if (collaborationMode === 'existing') {
        // Include current project snapshot
        collaborationData.projectSnapshot = currentProjectSnapshot;
        collaborationData.files = currentProjectSnapshot.files;
        collaborationData.folders = currentProjectSnapshot.folders;
      } else {
        // Start with empty project
        collaborationData.projectSnapshot = {
          files: [],
          folders: [],
          totalFiles: 0,
          totalSize: 0
        };
        collaborationData.files = [];
        collaborationData.folders = [];
      }

      await initializeProjectShare(collaborationMode, collaborationData);
      
      // Show success message
      const modeText = collaborationMode === 'existing' ? 'shared' : 'created';
      alert(`Project "${projectData.name}" has been ${modeText} successfully! All collaborators will now see the same file structure.`);
      
      onClose();
    } catch (error) {
      console.error('Failed to start collaboration:', error);
      alert(`Failed to start collaboration: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="project-collaboration-modal-overlay">
      <div className="project-collaboration-modal">
        <div className="modal-header">
          <h2>
            {step === 1 && '🚀 Start Project Collaboration'}
            {step === 2 && '📝 Project Details'}
            {step === 3 && '✅ Confirm & Start'}
          </h2>
          <button className="close-button" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Step 1: Choose Collaboration Mode */}
          {step === 1 && (
            <div className="collaboration-mode-selection">
              <p className="mode-description">
                When you start collaboration, all team members will work on the same project. 
                Choose how you want to begin:
              </p>
              
              <div className="mode-options">
                <div 
                  className="mode-option"
                  onClick={() => handleModeSelection('existing')}
                >
                  <div className="mode-icon">📁</div>
                  <h3>Use Existing Project</h3>
                  <p>Share your current workspace with collaborators</p>
                  <div className="mode-features">
                    <span>✓ Share all current files and folders</span>
                    <span>✓ Preserve your project structure</span>
                    <span>✓ Immediate real-time sync</span>
                  </div>
                  <div className="mode-note">
                    Perfect when you have an existing project to work on together
                  </div>
                </div>

                <div 
                  className="mode-option"
                  onClick={() => handleModeSelection('new')}
                >
                  <div className="mode-icon">🆕</div>
                  <h3>Start New Project</h3>
                  <p>Begin with a clean, empty workspace</p>
                  <div className="mode-features">
                    <span>✓ Fresh start for everyone</span>
                    <span>✓ Build project structure together</span>
                    <span>✓ Equal starting point for all</span>
                  </div>
                  <div className="mode-note">
                    Great for starting a new project from scratch as a team
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Project Details */}
          {step === 2 && (
            <div className="project-details-form">
              <div className="form-group">
                <label htmlFor="projectName">Project Name *</label>
                <input
                  id="projectName"
                  type="text"
                  value={projectData.name}
                  onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter a descriptive project name"
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label htmlFor="projectDescription">Project Description</label>
                <textarea
                  id="projectDescription"
                  value={projectData.description}
                  onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this project about? (optional)"
                  rows="3"
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label htmlFor="projectType">Project Type</label>
                <select
                  id="projectType"
                  value={projectData.type}
                  onChange={(e) => setProjectData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="general">General</option>
                  <option value="react">React App</option>
                  <option value="nodejs">Node.js</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="web">Web Development</option>
                </select>
              </div>

              {collaborationMode === 'existing' && currentProjectSnapshot && (
                <div className="current-project-summary">
                  <h4>📊 Current Project Summary</h4>
                  <div className="project-stats">
                    <div className="stat">
                      <span className="stat-label">Files:</span>
                      <span className="stat-value">{currentProjectSnapshot.totalFiles}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Total Size:</span>
                      <span className="stat-value">{formatFileSize(currentProjectSnapshot.totalSize)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Folders:</span>
                      <span className="stat-value">{currentProjectSnapshot.folders.length}</span>
                    </div>
                  </div>
                  <p className="sharing-note">
                    All these files and folders will be shared with your collaborators
                  </p>
                </div>
              )}

              <div className="step-buttons">
                <button 
                  className="secondary-button"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button 
                  className="primary-button"
                  onClick={handleProjectDetails}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="collaboration-confirmation">
              <div className="confirmation-summary">
                <h3>🎯 Ready to Start Collaboration</h3>
                
                <div className="project-summary">
                  <div className="summary-item">
                    <span className="label">Project Name:</span>
                    <span className="value">{projectData.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Mode:</span>
                    <span className="value">
                      {collaborationMode === 'existing' ? 'Share Existing Project' : 'Start New Project'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Type:</span>
                    <span className="value">{projectData.type}</span>
                  </div>
                  {projectData.description && (
                    <div className="summary-item">
                      <span className="label">Description:</span>
                      <span className="value">{projectData.description}</span>
                    </div>
                  )}
                </div>

                <div className="collaboration-info">
                  <h4>📋 What happens next:</h4>
                  <ul>
                    <li>All collaborators will see the same file structure</li>
                    <li>File changes sync in real-time across all users</li>
                    <li>New files and folders created by anyone are visible to everyone</li>
                    <li>You can manage collaborator permissions anytime</li>
                  </ul>
                </div>

                {collaborationMode === 'existing' && (
                  <div className="sharing-warning">
                    <div className="warning-icon">⚠️</div>
                    <div>
                      <strong>Important:</strong> All your current files will be shared with collaborators. 
                      Make sure you're comfortable sharing this content with your team.
                    </div>
                  </div>
                )}
              </div>

              <div className="step-buttons">
                <button 
                  className="secondary-button"
                  onClick={() => setStep(2)}
                  disabled={isLoading}
                >
                  Back
                </button>
                <button 
                  className="primary-button start-collaboration"
                  onClick={handleStartCollaboration}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Starting Collaboration...
                    </>
                  ) : (
                    <>
                      🚀 Start Collaboration
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCollaborationModal;
