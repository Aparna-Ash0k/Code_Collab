import React, { useState, useEffect, useContext } from 'react';
import { CollaborationContext } from '../contexts/CollaborationContext';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';

const EditConflictIndicator = () => {
  const { getEditConflicts, hasEditConflicts } = useContext(CollaborationContext);
  const { getCurrentTab } = useContext(ProjectSystemContext);
  const [isVisible, setIsVisible] = useState(false);

  const currentTab = getCurrentTab();
  const activeFilePath = currentTab?.filePath;
  const conflicts = activeFilePath ? getEditConflicts(activeFilePath) : null;

  useEffect(() => {
    if (conflicts) {
      setIsVisible(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [conflicts]);

  if (!conflicts || !isVisible) return null;

  const conflictUsers = conflicts.users || [];
  const currentUser = conflicts.currentUser;

  return (
    <div className="edit-conflict-indicator">
      <div className="conflict-alert">
        <div className="conflict-icon">⚠️</div>
        <div className="conflict-content">
          <div className="conflict-title">Potential Edit Conflict</div>
          <div className="conflict-details">
            You and {conflictUsers.map(u => u.userName).join(', ')} are editing nearby lines
          </div>
          <div className="conflict-positions">
            <div className="your-position">
              Your cursor: Line {currentUser.position.lineNumber}
            </div>
            {conflictUsers.map((user, index) => (
              <div key={user.userId} className="other-position" style={{ color: user.userColor }}>
                {user.userName}: Line {user.position.lineNumber}
              </div>
            ))}
          </div>
        </div>
        <button 
          className="conflict-close"
          onClick={() => setIsVisible(false)}
        >
          ×
        </button>
      </div>

      <style jsx>{`
        .edit-conflict-indicator {
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 10000;
          max-width: 350px;
        }

        .conflict-alert {
          background: linear-gradient(135deg, #2D2D2D, #3C3C3C);
          border: 2px solid #FFA500;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 8px 32px rgba(255, 165, 0, 0.3);
          animation: slideInRight 0.3s ease-out;
          backdrop-filter: blur(10px);
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .conflict-icon {
          font-size: 20px;
          flex-shrink: 0;
          animation: pulse 1.5s infinite;
        }

        .conflict-content {
          flex: 1;
          min-width: 0;
        }

        .conflict-title {
          color: #FFA500;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .conflict-details {
          color: #CCCCCC;
          font-size: 12px;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .conflict-positions {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .your-position, .other-position {
          font-size: 11px;
          font-family: 'Cascadia Code', monospace;
          padding: 2px 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
        }

        .your-position {
          color: #007ACC;
          border-left: 3px solid #007ACC;
        }

        .other-position {
          border-left: 3px solid currentColor;
        }

        .conflict-close {
          background: none;
          border: none;
          color: #CCCCCC;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .conflict-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
        }

        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
};

export default EditConflictIndicator;
