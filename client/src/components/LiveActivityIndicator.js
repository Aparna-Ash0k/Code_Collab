import React from 'react';
import { useCollaboration } from '../contexts/CollaborationContext';
import './LiveActivityIndicator.css';

const LiveActivityIndicator = ({ filePath, compact = false }) => {
  const { getFileActivity, isFileBeingEdited, getCursorsForFile } = useCollaboration();
  
  const activity = getFileActivity(filePath);
  const isActive = isFileBeingEdited(filePath);
  const cursors = getCursorsForFile(filePath);

  if (!isActive && cursors.length === 0) {
    return null;
  }

  return (
    <div className={`live-activity-indicator ${compact ? 'compact' : ''}`}>
      {isActive && activity && (
        <div className="activity-badge">
          <div 
            className="activity-dot"
            style={{ backgroundColor: activity.userColor || '#007acc' }}
          />
          {!compact && (
            <span className="activity-text">
              {activity.userName} is editing
            </span>
          )}
        </div>
      )}
      
      {cursors.length > 0 && (
        <div className="cursors-indicator">
          {cursors.slice(0, 3).map((cursor, index) => (
            <div 
              key={cursor.userId}
              className="cursor-avatar"
              style={{ 
                backgroundColor: cursor.userColor || '#007acc',
                marginLeft: index > 0 ? '-4px' : '0'
              }}
              title={`${cursor.userName} is viewing this file`}
            >
              {cursor.userName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          ))}
          {cursors.length > 3 && (
            <div className="cursor-overflow">
              +{cursors.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveActivityIndicator;
