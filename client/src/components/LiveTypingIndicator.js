import React from 'react';
import { useCollaboration } from '../contexts/CollaborationContext';
import { useFileSystem } from '../contexts/FileSystemContext';

const LiveTypingIndicator = () => {
  const { getCursorsForFile } = useCollaboration();
  const { getCurrentTab } = useFileSystem();

  const currentTab = getCurrentTab();
  const activeFilePath = currentTab?.filePath;

  if (!activeFilePath) return null;

  const cursors = getCursorsForFile(activeFilePath);
  const now = Date.now();
  const TYPING_THRESHOLD = 2000; // 2 seconds

  // Filter to only show users who are actively typing
  const typingUsers = cursors.filter(cursor => {
    return (now - cursor.timestamp) < TYPING_THRESHOLD;
  });

  if (typingUsers.length === 0) return null;

  return (
    <div className="live-typing-indicator">
      <div className="typing-container">
        <div className="typing-users">
          {typingUsers.map((user, index) => (
            <div key={user.userId} className="typing-user">
              <div 
                className="user-avatar"
                style={{ backgroundColor: user.userColor }}
              >
                {user.userName.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{user.userName}</span>
              {index < typingUsers.length - 1 && <span className="separator">,</span>}
            </div>
          ))}
        </div>
        <div className="typing-text">
          {typingUsers.length === 1 ? 'is' : 'are'} typing
        </div>
        <div className="typing-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>

      <style jsx>{`
        .live-typing-indicator {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 9999;
          pointer-events: none;
        }

        .typing-container {
          background: linear-gradient(135deg, #2D2D2D, #1E1E1E);
          border: 1px solid #3C3C3C;
          border-radius: 20px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          animation: slideInUp 0.3s ease-out;
          max-width: 300px;
        }

        .typing-users {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }

        .typing-user {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .user-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .user-name {
          color: #CCCCCC;
          font-size: 12px;
          font-weight: 500;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .separator {
          color: #888888;
          margin: 0 2px;
        }

        .typing-text {
          color: #888888;
          font-size: 12px;
          white-space: nowrap;
        }

        .typing-dots {
          display: flex;
          gap: 3px;
          align-items: center;
        }

        .dot {
          width: 4px;
          height: 4px;
          background: #007ACC;
          border-radius: 50%;
          animation: typingDots 1.4s infinite ease-in-out;
        }

        .dot:nth-child(1) {
          animation-delay: 0s;
        }

        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes slideInUp {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes typingDots {
          0%, 60%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          30% {
            transform: scale(1.3);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveTypingIndicator;
