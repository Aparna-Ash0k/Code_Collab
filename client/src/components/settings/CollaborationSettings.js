import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Settings, 
  Bell, 
  Shield, 
  Globe, 
  Users, 
  Eye, 
  EyeOff, 
  Save,
  MessageSquare,
  Mail,
  Smartphone,
  Monitor
} from 'lucide-react';
import './CollaborationSettings.css';

const CollaborationSettings = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const [settings, setSettings] = useState({
    // Sharing & Privacy
    defaultProjectVisibility: 'private',
    allowPublicProfile: false,
    showOnlineStatus: true,
    allowDirectMessages: true,
    
    // Notifications
    emailNotifications: {
      projectInvites: true,
      collaboratorJoined: true,
      fileChanges: false,
      mentions: true,
      projectUpdates: true
    },
    
    pushNotifications: {
      projectInvites: true,
      collaboratorJoined: false,
      fileChanges: false,
      mentions: true,
      directMessages: true
    },
    
    // Collaboration Preferences
    autoSaveInterval: 5, // seconds
    showLiveCursors: true,
    enableVoiceChat: false,
    enableVideoChat: false,
    
    // Security
    requireInviteApproval: true,
    allowGuestCollaborators: false,
    sessionTimeout: 24, // hours
    
    // Integration
    enableGitSync: false,
    enableCloudBackup: true,
    enableAnalytics: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (user?.collaborationSettings) {
      setSettings(prev => ({
        ...prev,
        ...user.collaborationSettings
      }));
    }
  }, [user]);

  const handleSettingChange = (category, setting, value) => {
    if (category) {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [setting]: value
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [setting]: value
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const result = await updateProfile({
        collaborationSettings: settings
      });

      if (result.success) {
        setSaveMessage('Settings saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('Failed to save settings. Please try again.');
      }
    } catch (error) {
      setSaveMessage('An error occurred while saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="collaboration-settings-overlay" onClick={onClose}>
      <div className="collaboration-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>
            <Settings size={20} />
            Collaboration Settings
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {saveMessage && (
            <div className={`save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
              {saveMessage}
            </div>
          )}

          {/* Sharing & Privacy */}
          <div className="settings-section">
            <h3>
              <Shield size={18} />
              Sharing & Privacy
            </h3>
            
            <div className="setting-item">
              <label>Default Project Visibility</label>
              <select
                value={settings.defaultProjectVisibility}
                onChange={(e) => handleSettingChange(null, 'defaultProjectVisibility', e.target.value)}
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
              <span className="setting-description">
                Default visibility for new projects
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.allowPublicProfile}
                  onChange={(e) => handleSettingChange(null, 'allowPublicProfile', e.target.checked)}
                />
                <span className="setting-label">
                  <Globe size={16} />
                  Allow public profile
                </span>
              </label>
              <span className="setting-description">
                Let others view your public profile and projects
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.showOnlineStatus}
                  onChange={(e) => handleSettingChange(null, 'showOnlineStatus', e.target.checked)}
                />
                <span className="setting-label">
                  {settings.showOnlineStatus ? <Eye size={16} /> : <EyeOff size={16} />}
                  Show online status
                </span>
              </label>
              <span className="setting-description">
                Display your online status to collaborators
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.allowDirectMessages}
                  onChange={(e) => handleSettingChange(null, 'allowDirectMessages', e.target.checked)}
                />
                <span className="setting-label">
                  <MessageSquare size={16} />
                  Allow direct messages
                </span>
              </label>
              <span className="setting-description">
                Let other users send you direct messages
              </span>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="settings-section">
            <h3>
              <Mail size={18} />
              Email Notifications
            </h3>
            
            {Object.entries(settings.emailNotifications).map(([key, value]) => (
              <div key={key} className="setting-item">
                <label className="checkbox-setting">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => handleSettingChange('emailNotifications', key, e.target.checked)}
                  />
                  <span className="setting-label">
                    {getNotificationLabel(key)}
                  </span>
                </label>
                <span className="setting-description">
                  {getNotificationDescription(key)}
                </span>
              </div>
            ))}
          </div>

          {/* Push Notifications */}
          <div className="settings-section">
            <h3>
              <Smartphone size={18} />
              Push Notifications
            </h3>
            
            {Object.entries(settings.pushNotifications).map(([key, value]) => (
              <div key={key} className="setting-item">
                <label className="checkbox-setting">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => handleSettingChange('pushNotifications', key, e.target.checked)}
                  />
                  <span className="setting-label">
                    {getNotificationLabel(key)}
                  </span>
                </label>
                <span className="setting-description">
                  {getNotificationDescription(key)}
                </span>
              </div>
            ))}
          </div>

          {/* Collaboration Preferences */}
          <div className="settings-section">
            <h3>
              <Users size={18} />
              Collaboration Preferences
            </h3>
            
            <div className="setting-item">
              <label>Auto-save Interval</label>
              <select
                value={settings.autoSaveInterval}
                onChange={(e) => handleSettingChange(null, 'autoSaveInterval', parseInt(e.target.value))}
              >
                <option value={1}>1 second</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
              <span className="setting-description">
                How often to automatically save changes
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.showLiveCursors}
                  onChange={(e) => handleSettingChange(null, 'showLiveCursors', e.target.checked)}
                />
                <span className="setting-label">
                  <Monitor size={16} />
                  Show live cursors
                </span>
              </label>
              <span className="setting-description">
                Display other users' cursors in real-time
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.enableVoiceChat}
                  onChange={(e) => handleSettingChange(null, 'enableVoiceChat', e.target.checked)}
                />
                <span className="setting-label">
                  Enable voice chat
                </span>
              </label>
              <span className="setting-description">
                Allow voice communication during collaboration
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.enableVideoChat}
                  onChange={(e) => handleSettingChange(null, 'enableVideoChat', e.target.checked)}
                />
                <span className="setting-label">
                  Enable video chat
                </span>
              </label>
              <span className="setting-description">
                Allow video communication during collaboration
              </span>
            </div>
          </div>

          {/* Security Settings */}
          <div className="settings-section">
            <h3>
              <Shield size={18} />
              Security
            </h3>
            
            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.requireInviteApproval}
                  onChange={(e) => handleSettingChange(null, 'requireInviteApproval', e.target.checked)}
                />
                <span className="setting-label">
                  Require invite approval
                </span>
              </label>
              <span className="setting-description">
                Manually approve collaboration invitations
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.allowGuestCollaborators}
                  onChange={(e) => handleSettingChange(null, 'allowGuestCollaborators', e.target.checked)}
                />
                <span className="setting-label">
                  Allow guest collaborators
                </span>
              </label>
              <span className="setting-description">
                Let non-registered users join your projects
              </span>
            </div>

            <div className="setting-item">
              <label>Session Timeout</label>
              <select
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange(null, 'sessionTimeout', parseInt(e.target.value))}
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
                <option value={168}>1 week</option>
              </select>
              <span className="setting-description">
                Automatically log out after inactivity
              </span>
            </div>
          </div>

          {/* Integration Settings */}
          <div className="settings-section">
            <h3>
              <Globe size={18} />
              Integrations
            </h3>
            
            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.enableGitSync}
                  onChange={(e) => handleSettingChange(null, 'enableGitSync', e.target.checked)}
                />
                <span className="setting-label">
                  Enable Git synchronization
                </span>
              </label>
              <span className="setting-description">
                Sync projects with Git repositories
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.enableCloudBackup}
                  onChange={(e) => handleSettingChange(null, 'enableCloudBackup', e.target.checked)}
                />
                <span className="setting-label">
                  Enable cloud backup
                </span>
              </label>
              <span className="setting-description">
                Automatically backup projects to the cloud
              </span>
            </div>

            <div className="setting-item">
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={settings.enableAnalytics}
                  onChange={(e) => handleSettingChange(null, 'enableAnalytics', e.target.checked)}
                />
                <span className="setting-label">
                  Enable usage analytics
                </span>
              </label>
              <span className="setting-description">
                Help improve CodeCollab by sharing anonymous usage data
              </span>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

const getNotificationLabel = (key) => {
  const labels = {
    projectInvites: 'Project invitations',
    collaboratorJoined: 'Collaborator joined',
    fileChanges: 'File changes',
    mentions: 'Mentions',
    projectUpdates: 'Project updates',
    directMessages: 'Direct messages'
  };
  return labels[key] || key;
};

const getNotificationDescription = (key) => {
  const descriptions = {
    projectInvites: 'When someone invites you to collaborate',
    collaboratorJoined: 'When someone joins your project',
    fileChanges: 'When files are modified in your projects',
    mentions: 'When someone mentions you in chat',
    projectUpdates: 'Updates about your projects',
    directMessages: 'Personal messages from other users'
  };
  return descriptions[key] || '';
};

export default CollaborationSettings;
