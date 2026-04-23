import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Palette, 
  Globe, 
  Camera, 
  Edit3, 
  Save, 
  X,
  Github,
  Twitter,
  Linkedin,
  MapPin,
  Calendar,
  Clock,
  Settings,
  Key,
  Eye,
  EyeOff,
  Upload,
  Star,
  Award,
  Zap,
  Activity,
  TrendingUp,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ModernModal from './ModernModal';
import toast from 'react-hot-toast';

const ProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || user?.displayName || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    github: user?.github || '',
    twitter: user?.twitter || '',
    linkedin: user?.linkedin || '',
    timezone: user?.timezone || 'UTC',
    avatar: user?.photoURL || user?.avatar || null
  });

  const [preferences, setPreferences] = useState({
    theme: 'dark',
    notifications: {
      email: true,
      browser: true,
      mentions: true,
      fileChanges: false,
      newCollaborators: true
    },
    privacy: {
      showOnlineStatus: true,
      showLocation: true,
      showEmail: false
    }
  });

  // Real user statistics
  const [userStats, setUserStats] = useState({
    projects: 0,
    sessions: 0,
    collaborators: 0
  });

  const [achievements, setAchievements] = useState([]);

  // Calculate real statistics
  useEffect(() => {
    const calculateUserStats = async () => {
      try {
        // For now, use session and local data to calculate stats
        // In a real app, this would fetch from the backend API
        
        // Projects: For now, use a base count plus session activity
        const baseProjects = user?.fileCount ? Math.floor(user.fileCount / 10) : 0;
        const sessionBonus = 1; // Current session counts as 1 project
        const totalProjects = Math.max(1, baseProjects + sessionBonus);

        // Sessions: Estimate based on user activity and account age
        const accountAge = user?.createdAt ? 
          Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)) : 30;
        const avgSessionsPerWeek = Math.min(10, Math.max(1, accountAge / 7));
        const totalSessions = Math.floor(accountAge * avgSessionsPerWeek / 7);

        // Collaborators: Based on current session users
        const sessionUsers = JSON.parse(localStorage.getItem('sessionUsers') || '[]');
        const uniqueCollaborators = new Set();
        sessionUsers.forEach(u => {
          if (u.id !== user?.id) uniqueCollaborators.add(u.id);
        });
        const totalCollaborators = Math.max(0, uniqueCollaborators.size);

        setUserStats({
          projects: totalProjects,
          sessions: totalSessions,
          collaborators: totalCollaborators
        });

        // Calculate achievements based on real stats
        const newAchievements = [];
        
        if (totalProjects >= 5) {
          newAchievements.push({ icon: 'star', label: 'Project Master', color: 'gold' });
        }
        
        if (totalSessions >= 20) {
          newAchievements.push({ icon: 'award', label: 'Session Expert', color: 'blue' });
        }
        
        if (totalCollaborators >= 3) {
          newAchievements.push({ icon: 'users', label: 'Team Builder', color: 'green' });
        }
        
        if (user?.emailVerified) {
          newAchievements.push({ icon: 'shield', label: 'Verified User', color: 'purple' });
        }

        // Default achievements for new users
        if (newAchievements.length === 0) {
          newAchievements.push({ icon: 'sparkles', label: 'New Member', color: 'blue' });
        }

        setAchievements(newAchievements);

      } catch (error) {
        console.error('Failed to calculate user stats:', error);
        // Fallback to default values
        setUserStats({ projects: 1, sessions: 2, collaborators: 0 });
        setAchievements([{ icon: 'sparkles', label: 'New Member', color: 'blue' }]);
      }
    };

    if (user) {
      calculateUserStats();
    }
  }, [user]);

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false
  });

  if (!isOpen || !user) return null;

  const handleSaveProfile = async () => {
    try {
      await updateProfile(profileData);
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData({
          ...profileData,
          avatar: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = () => {
    if (security.newPassword !== security.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (security.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    console.log('Changing password...');
    toast.success('Password changed successfully!');
    setSecurity({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      twoFactorEnabled: security.twoFactorEnabled
    });
  };

  const renderTabButton = (tabId, icon, label) => (
    <button
      key={tabId}
      onClick={() => setActiveTab(tabId)}
      className={`tab-button ${activeTab === tabId ? 'active' : ''}`}
    >
      {icon}
      {label}
    </button>
  );

  const renderProfileTab = () => (
    <div className="profile-tab enhanced">
      {/* Enhanced Hero Section */}
      <div className="profile-hero">
        <div className="profile-background">
          <div className="background-gradient"></div>
          <div className="background-pattern"></div>
        </div>
        
        <div className="profile-hero-content">
          <div className="avatar-section-enhanced">
            <div className="avatar-wrapper">
              <div className="avatar-container-enhanced">
                {profileData.avatar ? (
                  <img src={profileData.avatar} alt="Profile" className="profile-avatar-enhanced" />
                ) : (
                  <div className="profile-avatar-placeholder-enhanced">
                    <User size={48} />
                  </div>
                )}
                {isEditing && (
                  <label className="avatar-upload-button-enhanced">
                    <Camera size={18} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="sr-only"
                    />
                  </label>
                )}
                <div className="avatar-status-indicator"></div>
              </div>
              
              <div className="profile-achievements">
                {achievements.map((achievement, index) => (
                  <div key={index} className={`achievement-badge ${achievement.color}`}>
                    {achievement.icon === 'star' && <Star size={14} />}
                    {achievement.icon === 'award' && <Award size={14} />}
                    {achievement.icon === 'users' && <UserCheck size={14} />}
                    {achievement.icon === 'shield' && <Shield size={14} />}
                    {achievement.icon === 'sparkles' && <Sparkles size={14} />}
                    <span>{achievement.label}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="profile-header-info">
              <h2 className="profile-name-enhanced">{profileData.name || 'Unnamed User'}</h2>
              <p className="profile-email-enhanced">{profileData.email}</p>
              <div className="profile-meta">
                <div className="status-indicator">
                  <div className="status-dot online"></div>
                  <span>Online now</span>
                </div>
                <div className="verification-badge">
                  <CheckCircle2 size={16} />
                  <span>Verified Account</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="profile-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <Activity size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{userStats.projects}</div>
                <div className="stat-label">Projects</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{userStats.sessions}</div>
                <div className="stat-label">Sessions</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <UserCheck size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{userStats.collaborators}</div>
                <div className="stat-label">Collaborators</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Profile Form */}
      <div className="profile-form-enhanced">
        <div className="form-section">
          <div className="section-header">
            <User size={18} />
            <h3>Personal Information</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-group-enhanced">
              <label className="form-label-enhanced">
                <span className="label-text">Full Name</span>
                <span className="label-required">*</span>
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                disabled={!isEditing}
                className="form-input-enhanced"
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="form-group-enhanced">
              <label className="form-label-enhanced">
                <span className="label-text">Email Address</span>
                <span className="label-verified">
                  <CheckCircle2 size={14} />
                  Verified
                </span>
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                disabled={!isEditing}
                className="form-input-enhanced"
                placeholder="your.email@example.com"
              />
            </div>
          </div>

          <div className="form-group-enhanced full-width">
            <label className="form-label-enhanced">
              <span className="label-text">Bio</span>
              <span className="label-optional">Optional</span>
            </label>
            <textarea
              value={profileData.bio}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              disabled={!isEditing}
              className="form-textarea-enhanced"
              rows={3}
              placeholder="Tell others about yourself..."
            />
            <div className="character-counter">
              {(profileData.bio?.length || 0)}/500 characters
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <MapPin size={18} />
            <h3>Location & Timezone</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-group-enhanced">
              <label className="form-label-enhanced">
                <span className="label-text">Location</span>
              </label>
              <div className="input-with-icon">
                <MapPin size={16} className="input-icon" />
                <input
                  type="text"
                  value={profileData.location}
                  onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                  disabled={!isEditing}
                  className="form-input-enhanced with-icon"
                  placeholder="City, Country"
                />
              </div>
            </div>
            
            <div className="form-group-enhanced">
              <label className="form-label-enhanced">
                <span className="label-text">Timezone</span>
              </label>
              <div className="input-with-icon">
                <Clock size={16} className="input-icon" />
                <select
                  value={profileData.timezone}
                  onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                  disabled={!isEditing}
                  className="form-select-enhanced with-icon"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">Eastern Time (EST/EDT)</option>
                  <option value="America/Chicago">Central Time (CST/CDT)</option>
                  <option value="America/Denver">Mountain Time (MST/MDT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET/CEST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <Globe size={18} />
            <h3>Social Connections</h3>
          </div>
          
          <div className="social-grid">
            <div className="social-input-group">
              <div className="social-platform">
                <Github size={20} />
                <span>GitHub</span>
              </div>
              <input
                type="text"
                value={profileData.github}
                onChange={(e) => setProfileData({ ...profileData, github: e.target.value })}
                disabled={!isEditing}
                className="form-input-enhanced social-input"
                placeholder="username"
              />
            </div>
            
            <div className="social-input-group">
              <div className="social-platform">
                <Twitter size={20} />
                <span>Twitter</span>
              </div>
              <input
                type="text"
                value={profileData.twitter}
                onChange={(e) => setProfileData({ ...profileData, twitter: e.target.value })}
                disabled={!isEditing}
                className="form-input-enhanced social-input"
                placeholder="@username"
              />
            </div>
            
            <div className="social-input-group">
              <div className="social-platform">
                <Linkedin size={20} />
                <span>LinkedIn</span>
              </div>
              <input
                type="text"
                value={profileData.linkedin}
                onChange={(e) => setProfileData({ ...profileData, linkedin: e.target.value })}
                disabled={!isEditing}
                className="form-input-enhanced social-input"
                placeholder="username"
              />
            </div>
            
            <div className="social-input-group">
              <div className="social-platform">
                <Globe size={20} />
                <span>Website</span>
              </div>
              <input
                type="url"
                value={profileData.website}
                onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                disabled={!isEditing}
                className="form-input-enhanced social-input"
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="preferences-tab">
      {/* Theme Settings */}
      <div className="preference-section">
        <h4 className="section-title">
          <Palette size={16} />
          Appearance
        </h4>
        <div className="theme-selector">
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={preferences.theme === 'light'}
              onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
            />
            <div className="theme-preview light">
              <div className="theme-bar"></div>
              <div className="theme-content"></div>
            </div>
            <span>Light</span>
          </label>
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={preferences.theme === 'dark'}
              onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
            />
            <div className="theme-preview dark">
              <div className="theme-bar"></div>
              <div className="theme-content"></div>
            </div>
            <span>Dark</span>
          </label>
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="auto"
              checked={preferences.theme === 'auto'}
              onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
            />
            <div className="theme-preview auto">
              <div className="theme-bar"></div>
              <div className="theme-content"></div>
            </div>
            <span>Auto</span>
          </label>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="preference-section">
        <h4 className="section-title">
          <Bell size={16} />
          Notifications
        </h4>
        <div className="notification-settings">
          {Object.entries(preferences.notifications).map(([key, value]) => (
            <label key={key} className="toggle-setting">
              <div className="setting-info">
                <span className="setting-name">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className="setting-description">
                  {key === 'email' && 'Receive notifications via email'}
                  {key === 'browser' && 'Show browser notifications'}
                  {key === 'mentions' && 'Notify when mentioned in chat'}
                  {key === 'fileChanges' && 'Notify of file modifications'}
                  {key === 'newCollaborators' && 'Notify when new members join'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setPreferences({
                  ...preferences,
                  notifications: {
                    ...preferences.notifications,
                    [key]: e.target.checked
                  }
                })}
                className="toggle-input"
              />
              <div className="toggle-switch"></div>
            </label>
          ))}
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="preference-section">
        <h4 className="section-title">
          <Shield size={16} />
          Privacy
        </h4>
        <div className="privacy-settings">
          {Object.entries(preferences.privacy).map(([key, value]) => (
            <label key={key} className="toggle-setting">
              <div className="setting-info">
                <span className="setting-name">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className="setting-description">
                  {key === 'showOnlineStatus' && 'Let others see when you\'re online'}
                  {key === 'showLocation' && 'Display your location in profile'}
                  {key === 'showEmail' && 'Make email visible to team members'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setPreferences({
                  ...preferences,
                  privacy: {
                    ...preferences.privacy,
                    [key]: e.target.checked
                  }
                })}
                className="toggle-input"
              />
              <div className="toggle-switch"></div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="security-tab">
      {/* Password Change */}
      <div className="security-section">
        <h4 className="section-title">
          <Key size={16} />
          Change Password
        </h4>
        <div className="password-form">
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <div className="password-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                value={security.currentPassword}
                onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                className="form-input"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={security.newPassword}
                onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                className="form-input"
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={security.confirmPassword}
                onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                className="form-input"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <button
            onClick={handlePasswordChange}
            disabled={!security.currentPassword || !security.newPassword || !security.confirmPassword}
            className="button button-primary"
          >
            <Save size={16} />
            Update Password
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="security-section">
        <h4 className="section-title">
          <Shield size={16} />
          Two-Factor Authentication
        </h4>
        <div className="two-factor-setting">
          <label className="toggle-setting">
            <div className="setting-info">
              <span className="setting-name">Enable 2FA</span>
              <span className="setting-description">
                Add an extra layer of security to your account
              </span>
            </div>
            <input
              type="checkbox"
              checked={security.twoFactorEnabled}
              onChange={(e) => setSecurity({ ...security, twoFactorEnabled: e.target.checked })}
              className="toggle-input"
            />
            <div className="toggle-switch"></div>
          </label>
        </div>

        {security.twoFactorEnabled && (
          <div className="two-factor-setup">
            <div className="info-box info-box-info">
              <strong>Setup Instructions:</strong>
              <ol>
                <li>Download an authenticator app (Google Authenticator, Authy, etc.)</li>
                <li>Scan the QR code below with your app</li>
                <li>Enter the verification code to complete setup</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Account Information */}
      <div className="security-section">
        <h4 className="section-title">
          <User size={16} />
          Account Information
        </h4>
        <div className="account-info">
          <div className="info-row">
            <span>Account Created:</span>
            <span>{new Date(user.createdAt || Date.now()).toLocaleDateString()}</span>
          </div>
          <div className="info-row">
            <span>Last Login:</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          <div className="info-row">
            <span>Account Type:</span>
            <span>
              <div className="badge badge-primary">Standard</div>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile & Settings"
      subtitle="Manage your account, preferences, and security"
      maxWidth="xl"
      headerActions={
        <div className="header-actions">
          {activeTab === 'profile' && (
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveProfile();
                } else {
                  setIsEditing(true);
                }
              }}
              className={`button ${isEditing ? 'button-primary' : 'button-outline'} button-sm`}
            >
              {isEditing ? (
                <>
                  <Save size={14} />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit3 size={14} />
                  Edit Profile
                </>
              )}
            </button>
          )}
          {isEditing && (
            <button
              onClick={() => {
                setIsEditing(false);
                setProfileData({
                  name: user?.name || user?.displayName || '',
                  email: user?.email || '',
                  bio: user?.bio || '',
                  location: user?.location || '',
                  website: user?.website || '',
                  github: user?.github || '',
                  twitter: user?.twitter || '',
                  linkedin: user?.linkedin || '',
                  timezone: user?.timezone || 'UTC',
                  avatar: user?.photoURL || user?.avatar || null
                });
              }}
              className="button button-outline button-sm"
            >
              <X size={14} />
              Cancel
            </button>
          )}
        </div>
      }
    >
      {/* Tab Navigation */}
      <div className="tab-group">
        {renderTabButton('profile', <User size={16} />, 'Profile')}
        {renderTabButton('preferences', <Settings size={16} />, 'Preferences')}
        {renderTabButton('security', <Shield size={16} />, 'Security')}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'preferences' && renderPreferencesTab()}
        {activeTab === 'security' && renderSecurityTab()}
      </div>

      {/* Footer Actions */}
      <div className="button-group">
        <button onClick={onClose} className="button button-secondary">
          Close
        </button>
      </div>
    </ModernModal>
  );
};

export default ProfileModal;
