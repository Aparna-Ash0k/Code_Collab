import React, { useState, useContext, useEffect } from 'react';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { CollaborationContext } from '../contexts/CollaborationContext';
import { SessionContext } from '../contexts/SessionContext';
import './ProjectShareDialog.css';

const ProjectShareDialog = ({ isOpen, onClose, projectId }) => {
  const { projects, getProject } = useContext(ProjectSystemContext);
  const { 
    shareProject, 
    updateCollaboratorRole,
    removeCollaborator,
    isCollaborating, 
    session,
    generateShareableLink 
  } = useContext(CollaborationContext);
  const { user } = useContext(SessionContext);

  const [shareSettings, setShareSettings] = useState({
    accessLevel: 'editor',
    allowFileDownload: true,
    sessionTimeout: 60,
    requireAuth: true
  });
  const [shareLink, setShareLink] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  const project = projects.find(p => p.id === projectId) || getProject(projectId);

  useEffect(() => {
    if (isOpen && projectId) {
      // Reset state when dialog opens
      setShareLink('');
      setActiveTab('settings');
    }
  }, [isOpen, projectId]);

  if (!isOpen || !project) return null;

  const handleStartSharing = async () => {
    try {
      setIsGeneratingLink(true);
      const result = await shareProject(projectId, shareSettings);
      if (result?.shareLink) {
        setShareLink(result.shareLink);
        setActiveTab('link');
      }
    } catch (error) {
      console.error('Failed to share project:', error);
      alert('Failed to start sharing session. Please try again.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleGenerateNewLink = async () => {
    try {
      setIsGeneratingLink(true);
      const newLink = await generateShareableLink(projectId, shareSettings);
      setShareLink(newLink);
    } catch (error) {
      console.error('Failed to generate new link:', error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleRoleUpdate = async (collaboratorId, newRole) => {
    try {
      await updateCollaboratorRole(collaboratorId, newRole);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId) => {
    if (window.confirm('Are you sure you want to remove this collaborator?')) {
      try {
        await removeCollaborator(collaboratorId);
      } catch (error) {
        console.error('Failed to remove collaborator:', error);
      }
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Link copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="project-share-overlay" onClick={onClose}>
      <div className="project-share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Share Project: {project.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dialog-tabs">
          <button 
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button 
            className={`tab ${activeTab === 'link' ? 'active' : ''}`}
            onClick={() => setActiveTab('link')}
            disabled={!shareLink && !isCollaborating}
          >
            Share Link
          </button>
          <button 
            className={`tab ${activeTab === 'collaborators' ? 'active' : ''}`}
            onClick={() => setActiveTab('collaborators')}
            disabled={!isCollaborating}
          >
            Collaborators ({session?.collaborators?.length || 0})
          </button>
        </div>

        <div className="dialog-content">
          {activeTab === 'settings' && (
            <div className="settings-tab">
              <div className="setting-group">
                <label>Default Access Level</label>
                <p className="setting-description">
                  Choose the default permission level for new collaborators
                </p>
                <select
                  value={shareSettings.accessLevel}
                  onChange={(e) => setShareSettings({
                    ...shareSettings,
                    accessLevel: e.target.value
                  })}
                  disabled={isCollaborating}
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="editor">Editor - Can edit files</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Session Options</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={shareSettings.allowFileDownload}
                      onChange={(e) => setShareSettings({
                        ...shareSettings,
                        allowFileDownload: e.target.checked
                      })}
                      disabled={isCollaborating}
                    />
                    Allow collaborators to download files
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={shareSettings.requireAuth}
                      onChange={(e) => setShareSettings({
                        ...shareSettings,
                        requireAuth: e.target.checked
                      })}
                      disabled={isCollaborating}
                    />
                    Require authentication to join
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <label>Session Timeout</label>
                <p className="setting-description">
                  Automatically end the session after this many minutes of inactivity
                </p>
                <div className="timeout-input">
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={shareSettings.sessionTimeout}
                    onChange={(e) => setShareSettings({
                      ...shareSettings,
                      sessionTimeout: parseInt(e.target.value) || 60
                    })}
                    disabled={isCollaborating}
                  />
                  <span>minutes</span>
                </div>
              </div>

              {!isCollaborating ? (
                <button 
                  className="start-sharing-btn"
                  onClick={handleStartSharing}
                  disabled={isGeneratingLink}
                >
                  {isGeneratingLink ? 'Starting Session...' : 'Start Collaboration Session'}
                </button>
              ) : (
                <div className="active-session-info">
                  <div className="session-status">
                    <span className="status-icon">🟢</span>
                    <div>
                      <h4>Session Active</h4>
                      <p>ID: {session?.sessionId}</p>
                      <p>Started: {session?.startTime ? new Date(session.startTime).toLocaleString() : 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'link' && shareLink && (
            <div className="link-tab">
              <div className="share-link-section">
                <label>Shareable Link</label>
                <p className="link-description">
                  Share this link with collaborators to invite them to your project
                </p>
                <div className="link-container">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="share-link-input"
                  />
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(shareLink)}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="link-options">
                <button
                  className="generate-new-btn"
                  onClick={handleGenerateNewLink}
                  disabled={isGeneratingLink}
                >
                  {isGeneratingLink ? 'Generating...' : 'Generate New Link'}
                </button>
                
                <div className="link-info">
                  <h4>Link Information</h4>
                  <ul>
                    <li>Access Level: <strong>{shareSettings.accessLevel}</strong></li>
                    <li>File Downloads: <strong>{shareSettings.allowFileDownload ? 'Allowed' : 'Disabled'}</strong></li>
                    <li>Authentication: <strong>{shareSettings.requireAuth ? 'Required' : 'Not Required'}</strong></li>
                    <li>Session Timeout: <strong>{shareSettings.sessionTimeout} minutes</strong></li>
                  </ul>
                </div>
              </div>

              <div className="security-notice">
                <h4>🔒 Security Notice</h4>
                <p>
                  Anyone with this link can access your project with the specified permissions. 
                  Only share with trusted collaborators. You can generate a new link at any time 
                  to revoke access to the previous link.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'collaborators' && isCollaborating && (
            <div className="collaborators-tab">
              {session?.collaborators && session.collaborators.length > 0 ? (
                <div className="collaborators-list">
                  <h4>Active Collaborators</h4>
                  {session.collaborators.map(collaborator => (
                    <div key={collaborator.id} className="collaborator-item">
                      <div className="collaborator-info">
                        <div className="collaborator-avatar">
                          {collaborator.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="collaborator-details">
                          <h5>{collaborator.name || 'Anonymous'}</h5>
                          <p>Joined: {collaborator.joinedAt ? new Date(collaborator.joinedAt).toLocaleString() : 'Unknown'}</p>
                          {collaborator.isOnline !== undefined && (
                            <p className={`online-status ${collaborator.isOnline ? 'online' : 'offline'}`}>
                              {collaborator.isOnline ? 'Online' : 'Offline'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="collaborator-controls">
                        <select
                          value={collaborator.role}
                          onChange={(e) => handleRoleUpdate(collaborator.id, e.target.value)}
                          className="role-select"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveCollaborator(collaborator.id)}
                          title="Remove collaborator"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-collaborators">
                  <p>No collaborators have joined yet.</p>
                  <p>Share the link to invite others to collaborate on this project.</p>
                </div>
              )}

              <div className="session-controls">
                <h4>Session Management</h4>
                <div className="session-stats">
                  <div className="stat">
                    <span className="stat-label">Session Duration</span>
                    <span className="stat-value">
                      {session?.startTime ? 
                        Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000) + ' minutes' 
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Total Collaborators</span>
                    <span className="stat-value">{session?.collaborators?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="close-dialog-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectShareDialog;
