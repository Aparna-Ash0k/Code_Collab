import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Activity, 
  Users, 
  FileText, 
  Clock, 
  User, 
  Edit3, 
  MessageSquare,
  GitBranch,
  Eye,
  Download,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import './ActivityLog.css';

const ActivityLog = ({ isOpen, onClose, projectId = null }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [dateRange, setDateRange] = useState('week'); // today, week, month, all
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Mock activity data - replace with actual API calls
  useEffect(() => {
    const mockActivities = [
      {
        id: '1',
        type: 'file_edit',
        action: 'modified',
        target: 'App.js',
        user: { id: user.id, name: user.name, avatar: user.avatar },
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        details: {
          linesAdded: 15,
          linesRemoved: 3,
          changes: [
            { line: 23, type: 'added', content: 'const [isLoading, setIsLoading] = useState(false);' },
            { line: 45, type: 'modified', content: 'return loading ? <Spinner /> : <Component />;' }
          ]
        },
        projectId: '1'
      },
      {
        id: '2',
        type: 'user_join',
        action: 'joined',
        target: 'React Todo App',
        user: { id: '2', name: 'John Doe', avatar: 'JD' },
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        details: {
          role: 'editor',
          invitedBy: user.name
        },
        projectId: '1'
      },
      {
        id: '3',
        type: 'chat_message',
        action: 'sent message',
        target: 'project chat',
        user: { id: '2', name: 'John Doe', avatar: 'JD' },
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        details: {
          message: 'Hey team, I just pushed some updates to the login component',
          messageLength: 65
        },
        projectId: '1'
      },
      {
        id: '4',
        type: 'file_create',
        action: 'created',
        target: 'components/LoginForm.js',
        user: { id: '2', name: 'John Doe', avatar: 'JD' },
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        details: {
          fileSize: '2.4 KB',
          fileType: 'javascript'
        },
        projectId: '1'
      },
      {
        id: '5',
        type: 'code_execution',
        action: 'executed',
        target: 'main.py',
        user: { id: user.id, name: user.name, avatar: user.avatar },
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        details: {
          language: 'python',
          executionTime: '1.23s',
          status: 'success',
          output: 'Hello, World!\nExecution completed successfully.'
        },
        projectId: '2'
      },
      {
        id: '6',
        type: 'collaboration_invite',
        action: 'invited',
        target: 'jane@example.com',
        user: { id: user.id, name: user.name, avatar: user.avatar },
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        details: {
          role: 'viewer',
          projectName: 'Python ML Project'
        },
        projectId: '2'
      }
    ];

    // Filter by project if specified
    const filtered = projectId 
      ? mockActivities.filter(activity => activity.projectId === projectId)
      : mockActivities;

    setActivities(filtered);
    setIsLoading(false);
  }, [user, projectId]);

  // Apply filters
  useEffect(() => {
    let filtered = [...activities];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(activity => activity.type === filterType);
    }

    // Filter by user
    if (filterUser !== 'all') {
      filtered = filtered.filter(activity => activity.user.id === filterUser);
    }

    // Filter by date range
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (dateRange) {
      case 'today':
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      default:
        cutoffDate.setFullYear(1970);
    }

    filtered = filtered.filter(activity => 
      new Date(activity.timestamp) >= cutoffDate
    );

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    setFilteredActivities(filtered);
  }, [activities, filterType, filterUser, dateRange]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'file_edit':
      case 'file_create':
      case 'file_delete':
        return <FileText size={16} />;
      case 'user_join':
      case 'user_leave':
        return <Users size={16} />;
      case 'chat_message':
        return <MessageSquare size={16} />;
      case 'code_execution':
        return <GitBranch size={16} />;
      case 'collaboration_invite':
        return <User size={16} />;
      default:
        return <Activity size={16} />;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'file_create':
        return '#22c55e';
      case 'file_edit':
        return '#3b82f6';
      case 'file_delete':
        return '#ef4444';
      case 'user_join':
        return '#8b5cf6';
      case 'user_leave':
        return '#f59e0b';
      case 'chat_message':
        return '#06b6d4';
      case 'code_execution':
        return '#10b981';
      case 'collaboration_invite':
        return '#f97316';
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)}d ago`;
    
    return date.toLocaleDateString();
  };

  const toggleExpanded = (activityId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedItems(newExpanded);
  };

  const getUniqueUsers = () => {
    const users = new Set();
    activities.forEach(activity => {
      users.add(JSON.stringify({ id: activity.user.id, name: activity.user.name }));
    });
    return Array.from(users).map(userStr => JSON.parse(userStr));
  };

  const exportActivityLog = () => {
    const data = filteredActivities.map(activity => ({
      timestamp: activity.timestamp,
      user: activity.user.name,
      action: `${activity.action} ${activity.target}`,
      type: activity.type,
      details: JSON.stringify(activity.details)
    }));

    const csv = [
      'Timestamp,User,Action,Type,Details',
      ...data.map(row => 
        `${row.timestamp},${row.user},"${row.action}",${row.type},"${row.details}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="activity-log-overlay" onClick={onClose}>
      <div className="activity-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="activity-log-header">
          <h2>
            <Activity size={20} />
            Activity Log
            {projectId && <span className="project-filter">- Project Activity</span>}
          </h2>
          <div className="header-actions">
            <button className="export-btn" onClick={exportActivityLog}>
              <Download size={16} />
              Export
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="activity-log-content">
          {/* Filters */}
          <div className="activity-filters">
            <div className="filter-group">
              <label>Activity Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Activities</option>
                <option value="file_edit">File Edits</option>
                <option value="file_create">File Creation</option>
                <option value="user_join">User Actions</option>
                <option value="chat_message">Chat Messages</option>
                <option value="code_execution">Code Execution</option>
                <option value="collaboration_invite">Invitations</option>
              </select>
            </div>

            <div className="filter-group">
              <label>User</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              >
                <option value="all">All Users</option>
                {getUniqueUsers().map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Time Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>

          {/* Activity List */}
          <div className="activity-list">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading activity log...</p>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="empty-state">
                <Activity size={48} />
                <h3>No activities found</h3>
                <p>Try adjusting your filters to see more activities</p>
              </div>
            ) : (
              filteredActivities.map(activity => {
                const isExpanded = expandedItems.has(activity.id);
                const hasDetails = activity.details && Object.keys(activity.details).length > 0;

                return (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-main" onClick={() => hasDetails && toggleExpanded(activity.id)}>
                      <div className="activity-indicator">
                        <div 
                          className="activity-icon"
                          style={{ backgroundColor: getActivityColor(activity.type) }}
                        >
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="activity-line"></div>
                      </div>

                      <div className="activity-content">
                        <div className="activity-header">
                          <div className="activity-info">
                            <div className="user-info">
                              <div className="user-avatar">
                                {activity.user.avatar}
                              </div>
                              <span className="user-name">{activity.user.name}</span>
                            </div>
                            <span className="activity-action">
                              {activity.action} <strong>{activity.target}</strong>
                            </span>
                          </div>
                          <div className="activity-meta">
                            <span className="timestamp">
                              <Clock size={12} />
                              {formatTimestamp(activity.timestamp)}
                            </span>
                            {hasDetails && (
                              <button className="expand-btn">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && hasDetails && (
                          <div className="activity-details">
                            {activity.type === 'file_edit' && activity.details.changes && (
                              <div className="file-changes">
                                <div className="changes-summary">
                                  <span className="added">+{activity.details.linesAdded} lines</span>
                                  <span className="removed">-{activity.details.linesRemoved} lines</span>
                                </div>
                                <div className="code-changes">
                                  {activity.details.changes.map((change, index) => (
                                    <div key={index} className={`code-line ${change.type}`}>
                                      <span className="line-number">{change.line}</span>
                                      <span className="line-content">{change.content}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {activity.type === 'user_join' && (
                              <div className="join-details">
                                <p>Role: <strong>{activity.details.role}</strong></p>
                                <p>Invited by: <strong>{activity.details.invitedBy}</strong></p>
                              </div>
                            )}

                            {activity.type === 'chat_message' && (
                              <div className="message-details">
                                <p className="message-content">"{activity.details.message}"</p>
                                <span className="message-length">{activity.details.messageLength} characters</span>
                              </div>
                            )}

                            {activity.type === 'code_execution' && (
                              <div className="execution-details">
                                <p>Language: <strong>{activity.details.language}</strong></p>
                                <p>Execution time: <strong>{activity.details.executionTime}</strong></p>
                                <p>Status: <span className={`status ${activity.details.status}`}>{activity.details.status}</span></p>
                                {activity.details.output && (
                                  <pre className="execution-output">{activity.details.output}</pre>
                                )}
                              </div>
                            )}

                            {activity.type === 'file_create' && (
                              <div className="file-details">
                                <p>File size: <strong>{activity.details.fileSize}</strong></p>
                                <p>Type: <strong>{activity.details.fileType}</strong></p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
