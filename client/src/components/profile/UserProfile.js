import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService } from '../../utils/firebase';
import { 
  User, 
  Mail, 
  Calendar, 
  Settings, 
  Camera, 
  Save, 
  X, 
  Edit3, 
  Globe,
  Building,
  MapPin,
  Bell,
  Shield,
  Eye,
  Users,
  BarChart3
} from 'lucide-react';
import './UserProfile.css';

const UserProfile = ({ isOpen, onClose }) => {
  const { user, updateProfile, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    avatar: '',
    bio: '',
    company: '',
    location: '',
    website: '',
    preferences: {
      emailNotifications: true,
      collaborationNotifications: true,
      projectUpdates: true,
      theme: 'auto',
      defaultProjectVisibility: 'private',
      showOnlineStatus: true,
      allowDirectMessages: true,
      autoSaveInterval: 30
    },
    collaborationSettings: {
      defaultRole: 'editor',
      allowGuestUsers: false,
      requireApprovalForJoining: true,
      maxCollaborators: 10,
      sessionTimeout: 60
    }
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [userStats, setUserStats] = useState({
    projectsCreated: 0,
    collaborations: 0,
    totalCodeLines: 0,
    joinDate: null
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || '',
        bio: user.bio || '',
        company: user.company || '',
        location: user.location || '',
        website: user.website || '',
        preferences: {
          emailNotifications: user.preferences?.emailNotifications ?? true,
          collaborationNotifications: user.preferences?.collaborationNotifications ?? true,
          projectUpdates: user.preferences?.projectUpdates ?? true,
          theme: user.preferences?.theme || 'auto',
          defaultProjectVisibility: user.preferences?.defaultProjectVisibility || 'private',
          showOnlineStatus: user.preferences?.showOnlineStatus ?? true,
          allowDirectMessages: user.preferences?.allowDirectMessages ?? true,
          autoSaveInterval: user.preferences?.autoSaveInterval || 30
        },
        collaborationSettings: {
          defaultRole: user.collaborationSettings?.defaultRole || 'editor',
          allowGuestUsers: user.collaborationSettings?.allowGuestUsers ?? false,
          requireApprovalForJoining: user.collaborationSettings?.requireApprovalForJoining ?? true,
          maxCollaborators: user.collaborationSettings?.maxCollaborators || 10,
          sessionTimeout: user.collaborationSettings?.sessionTimeout || 60
        }
      });
      
      // Load user statistics
      loadUserStats();
    }
  }, [user]);

  const loadUserStats = async () => {
    if (!user?.id) return;
    
    try {
      // Get user projects
      const projects = await databaseService.getUserProjects(user.id);
      
      // Calculate stats (in a real app, these would come from the database)
      const stats = {
        projectsCreated: projects?.filter(p => p.ownerId === user.id)?.length || 0,
        collaborations: projects?.length || 0,
        totalCodeLines: Math.floor(Math.random() * 10000), // Mock data
        joinDate: user.createdAt ? new Date(user.createdAt) : new Date()
      };
      
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'Please select an image file' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setErrors(prev => ({ ...prev, avatar: 'Image must be less than 5MB' }));
      return;
    }

    try {
      setIsSaving(true);
      const avatarUrl = await databaseService.uploadFile(file, `avatars/${user.id}/${file.name}`);
      setFormData(prev => ({ ...prev, avatar: avatarUrl }));
      setErrors(prev => ({ ...prev, avatar: '' }));
    } catch (error) {
      setErrors(prev => ({ ...prev, avatar: 'Failed to upload avatar' }));
    } finally {
      setIsSaving(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'Website must start with http:// or https://';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsSaving(true);
    setSuccessMessage('');
    
    try {
      const result = await updateProfile(formData);
      if (result.success) {
        setIsEditing(false);
        setSuccessMessage('Profile updated successfully!');
        
        // Save collaboration settings separately
        await databaseService.saveCollaborationSettings(user.id, formData.collaborationSettings);
        
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      setErrors({ general: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
    setSuccessMessage('');
    // Reset form data to user data
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || '',
        bio: user.bio || '',
        company: user.company || '',
        location: user.location || '',
        website: user.website || '',
        preferences: {
          emailNotifications: user.preferences?.emailNotifications ?? true,
          collaborationNotifications: user.preferences?.collaborationNotifications ?? true,
          projectUpdates: user.preferences?.projectUpdates ?? true,
          theme: user.preferences?.theme || 'auto',
          defaultProjectVisibility: user.preferences?.defaultProjectVisibility || 'private',
          showOnlineStatus: user.preferences?.showOnlineStatus ?? true,
          allowDirectMessages: user.preferences?.allowDirectMessages ?? true,
          autoSaveInterval: user.preferences?.autoSaveInterval || 30
        },
        collaborationSettings: {
          defaultRole: user.collaborationSettings?.defaultRole || 'editor',
          allowGuestUsers: user.collaborationSettings?.allowGuestUsers ?? false,
          requireApprovalForJoining: user.collaborationSettings?.requireApprovalForJoining ?? true,
          maxCollaborators: user.collaborationSettings?.maxCollaborators || 10,
          sessionTimeout: user.collaborationSettings?.sessionTimeout || 60
        }
      });
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#dc2626';
      case 'moderator': return '#d97706';
      case 'user':
      default: return '#16a34a';
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="user-profile-modal" onClick={onClose}>
      <div className="user-profile-content" onClick={(e) => e.stopPropagation()}>
        {isSaving && (
          <div className="user-profile-loading">
            <div className="user-profile-spinner"></div>
          </div>
        )}
        
        <div className="user-profile-header">
          <h2>User Profile</h2>
          <button className="user-profile-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="user-profile-body">
          {/* Success Message */}
          {successMessage && (
            <div className="user-profile-success">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {errors.general && (
            <div className="user-profile-error">
              {errors.general}
            </div>
          )}

          {/* Avatar and Basic Info Section */}
          <div className="user-profile-avatar-section">
            <div className="user-profile-avatar-container">
              <div className="user-profile-avatar">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="Profile" />
                ) : (
                  getInitials(formData.name)
                )}
              </div>
              {isEditing && (
                <label className="user-profile-avatar-upload">
                  <Camera size={12} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="user-profile-avatar-input"
                  />
                </label>
              )}
            </div>
            <div className="user-profile-avatar-info">
              <h3>{formData.name}</h3>
              <p>{formData.email}</p>
              <div 
                className={`user-profile-role-badge ${user.role}`}
                style={{ backgroundColor: `${getRoleColor(user.role)}20`, color: getRoleColor(user.role) }}
              >
                {user.role || 'user'}
              </div>
            </div>
          </div>

          {/* User Statistics */}
          <div className="user-profile-stats">
            <div className="user-profile-stat-card">
              <div className="user-profile-stat-value">{userStats.projectsCreated}</div>
              <div className="user-profile-stat-label">Projects Created</div>
            </div>
            <div className="user-profile-stat-card">
              <div className="user-profile-stat-value">{userStats.collaborations}</div>
              <div className="user-profile-stat-label">Collaborations</div>
            </div>
            <div className="user-profile-stat-card">
              <div className="user-profile-stat-value">{userStats.totalCodeLines.toLocaleString()}</div>
              <div className="user-profile-stat-label">Lines of Code</div>
            </div>
            <div className="user-profile-stat-card">
              <div className="user-profile-stat-value">
                {userStats.joinDate ? Math.floor((Date.now() - userStats.joinDate.getTime()) / (1000 * 60 * 60 * 24)) : 0}
              </div>
              <div className="user-profile-stat-label">Days Active</div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="user-profile-section">
            <div className="user-profile-section-title">
              <User size={18} />
              Basic Information
            </div>
            
            <div className="user-profile-form-grid">
              <div className="user-profile-form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="company">
                  <Building size={14} />
                  Company
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="Your company"
                />
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="location">
                  <MapPin size={14} />
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="Your location"
                />
              </div>

              <div className="user-profile-form-group full-width">
                <label htmlFor="website">
                  <Globe size={14} />
                  Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="https://your-website.com"
                />
                {errors.website && <span className="error-text">{errors.website}</span>}
              </div>

              <div className="user-profile-form-group full-width">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="Tell us about yourself..."
                  rows="3"
                />
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="user-profile-section">
            <div className="user-profile-section-title">
              <Bell size={18} />
              Notification Preferences
            </div>
            
            <div className="user-profile-preferences">
              <div className="user-profile-preference-item">
                <div className="user-profile-preference-info">
                  <h4>Email Notifications</h4>
                  <p>Receive notifications via email</p>
                </div>
                <div 
                  className={`user-profile-toggle ${formData.preferences.emailNotifications ? 'enabled' : ''}`}
                  onClick={() => isEditing && handleInputChange({ 
                    target: { 
                      name: 'preferences.emailNotifications', 
                      type: 'checkbox', 
                      checked: !formData.preferences.emailNotifications 
                    }
                  })}
                />
              </div>

              <div className="user-profile-preference-item">
                <div className="user-profile-preference-info">
                  <h4>Collaboration Notifications</h4>
                  <p>Get notified when someone joins your projects</p>
                </div>
                <div 
                  className={`user-profile-toggle ${formData.preferences.collaborationNotifications ? 'enabled' : ''}`}
                  onClick={() => isEditing && handleInputChange({ 
                    target: { 
                      name: 'preferences.collaborationNotifications', 
                      type: 'checkbox', 
                      checked: !formData.preferences.collaborationNotifications 
                    }
                  })}
                />
              </div>

              <div className="user-profile-preference-item">
                <div className="user-profile-preference-info">
                  <h4>Project Updates</h4>
                  <p>Receive updates about your projects</p>
                </div>
                <div 
                  className={`user-profile-toggle ${formData.preferences.projectUpdates ? 'enabled' : ''}`}
                  onClick={() => isEditing && handleInputChange({ 
                    target: { 
                      name: 'preferences.projectUpdates', 
                      type: 'checkbox', 
                      checked: !formData.preferences.projectUpdates 
                    }
                  })}
                />
              </div>

              <div className="user-profile-preference-item">
                <div className="user-profile-preference-info">
                  <h4>Show Online Status</h4>
                  <p>Let others see when you're online</p>
                </div>
                <div 
                  className={`user-profile-toggle ${formData.preferences.showOnlineStatus ? 'enabled' : ''}`}
                  onClick={() => isEditing && handleInputChange({ 
                    target: { 
                      name: 'preferences.showOnlineStatus', 
                      type: 'checkbox', 
                      checked: !formData.preferences.showOnlineStatus 
                    }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Interface Preferences */}
          <div className="user-profile-section">
            <div className="user-profile-section-title">
              <Settings size={18} />
              Interface Preferences
            </div>
            
            <div className="user-profile-form-grid">
              <div className="user-profile-form-group">
                <label htmlFor="theme">Theme</label>
                <select
                  id="theme"
                  name="preferences.theme"
                  value={formData.preferences.theme}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="auto">Auto</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="defaultProjectVisibility">Default Project Visibility</label>
                <select
                  id="defaultProjectVisibility"
                  name="preferences.defaultProjectVisibility"
                  value={formData.preferences.defaultProjectVisibility}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="autoSaveInterval">Auto-save Interval (seconds)</label>
                <select
                  id="autoSaveInterval"
                  name="preferences.autoSaveInterval"
                  value={formData.preferences.autoSaveInterval}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Collaboration Settings */}
          <div className="user-profile-section">
            <div className="user-profile-section-title">
              <Users size={18} />
              Collaboration Settings
            </div>
            
            <div className="user-profile-form-grid">
              <div className="user-profile-form-group">
                <label htmlFor="defaultRole">Default Collaborator Role</label>
                <select
                  id="defaultRole"
                  name="collaborationSettings.defaultRole"
                  value={formData.collaborationSettings.defaultRole}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="maxCollaborators">Max Collaborators</label>
                <select
                  id="maxCollaborators"
                  name="collaborationSettings.maxCollaborators"
                  value={formData.collaborationSettings.maxCollaborators}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="5">5 collaborators</option>
                  <option value="10">10 collaborators</option>
                  <option value="25">25 collaborators</option>
                  <option value="50">50 collaborators</option>
                </select>
              </div>

              <div className="user-profile-form-group">
                <label htmlFor="sessionTimeout">Session Timeout (minutes)</label>
                <select
                  id="sessionTimeout"
                  name="collaborationSettings.sessionTimeout"
                  value={formData.collaborationSettings.sessionTimeout}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                </select>
              </div>
            </div>

            <div className="user-profile-preferences">
              <div className="user-profile-preference-item">
                <div className="user-profile-preference-info">
                  <h4>Allow Guest Users</h4>
                  <p>Let non-registered users join your projects</p>
                </div>
                <div 
                  className={`user-profile-toggle ${formData.collaborationSettings.allowGuestUsers ? 'enabled' : ''}`}
                  onClick={() => isEditing && handleInputChange({ 
                    target: { 
                      name: 'collaborationSettings.allowGuestUsers', 
                      type: 'checkbox', 
                      checked: !formData.collaborationSettings.allowGuestUsers 
                    }
                  })}
                />
              </div>

              <div className="user-profile-preference-item">
                <div className="user-profile-preference-info">
                  <h4>Require Approval for Joining</h4>
                  <p>Manual approval needed for new collaborators</p>
                </div>
                <div 
                  className={`user-profile-toggle ${formData.collaborationSettings.requireApprovalForJoining ? 'enabled' : ''}`}
                  onClick={() => isEditing && handleInputChange({ 
                    target: { 
                      name: 'collaborationSettings.requireApprovalForJoining', 
                      type: 'checkbox', 
                      checked: !formData.collaborationSettings.requireApprovalForJoining 
                    }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="user-profile-actions">
            {!isEditing ? (
              <button
                className="user-profile-btn user-profile-btn-primary"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={16} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  className="user-profile-btn user-profile-btn-secondary"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  className="user-profile-btn user-profile-btn-primary"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="user-profile-spinner" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
