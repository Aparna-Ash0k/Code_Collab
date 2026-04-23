import React, { useState, useEffect, useRef } from 'react';
import { useCollaboration } from '../contexts/CollaborationContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { useFileSystem } from '../contexts/FileSystemContext';

const LiveColoredCursors = ({ editorRef, currentFilePath }) => {
  // Safely get collaboration context
  let collaboration = null;
  try {
    collaboration = useCollaboration();
  } catch (error) {
    console.debug('Collaboration context not available in LiveColoredCursors');
    return null; // Don't render if collaboration context is not available
  }
  
  const { cursors, getCursorsForFile } = collaboration || {};
  const { session } = useSession();
  const { user } = useAuth();
  const [activeCursors, setActiveCursors] = useState([]);
  const cursorsRef = useRef({});
  const fadeTimeouts = useRef({});

  useEffect(() => {
    // Don't proceed if collaboration context is not available
    if (!getCursorsForFile) return;
    
    // Get cursors for the current file only
    const currentFileCursors = currentFilePath ? getCursorsForFile(currentFilePath) : [];
    // Filter out current user's cursor and add fade tracking
    const otherUserCursors = currentFileCursors.filter(cursor => 
      cursor.userId !== (user?.uid || user?.id)
    );

    // Update active cursors with fade state
    const updatedCursors = otherUserCursors.map(cursor => {
      const existingCursor = cursorsRef.current[cursor.userId];
      const now = Date.now();
      const timeSinceUpdate = now - cursor.timestamp;
      
      // Clear existing fade timeout
      if (fadeTimeouts.current[cursor.userId]) {
        clearTimeout(fadeTimeouts.current[cursor.userId]);
      }

      // Set up fade timeout (hide after 3 seconds of inactivity)
      fadeTimeouts.current[cursor.userId] = setTimeout(() => {
        setActiveCursors(prev => prev.filter(c => c.userId !== cursor.userId));
        delete cursorsRef.current[cursor.userId];
      }, 3000);

      // Return cursor with opacity based on activity
      const opacity = timeSinceUpdate > 1000 ? 0.7 : 1; // Start fading after 1 second
      
      return {
        ...cursor,
        opacity,
        isNew: !existingCursor || existingCursor.timestamp !== cursor.timestamp
      };
    });

    cursorsRef.current = updatedCursors.reduce((acc, cursor) => {
      acc[cursor.userId] = cursor;
      return acc;
    }, {});

    setActiveCursors(updatedCursors);

    // Cleanup timeouts on unmount
    return () => {
      Object.values(fadeTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, [currentFilePath, getCursorsForFile, user?.uid, user?.id]); // Fixed dependencies

  // Convert text position to screen coordinates for textarea-based editor
  const getScreenPosition = (position) => {
    if (!editorRef?.current || !position) return null;

    try {
      const textarea = editorRef.current;
      
      // Calculate approximate pixel position based on line and column
      // This is a simplified calculation for textarea-based editors
      const lineHeight = 18; // Approximate line height
      const charWidth = 7.5; // Approximate character width
      
      const x = (position.column - 1) * charWidth;
      const y = (position.lineNumber - 1) * lineHeight;

      return { x, y };
    } catch (error) {
      console.warn('Error calculating cursor position:', error);
      return null;
    }
  };

  // Render a single cursor
  const renderCursor = (cursor) => {
    const screenPosition = getScreenPosition(cursor.position);
    
    if (!screenPosition) return null;

    return (
      <div
        key={cursor.userId}
        className="live-cursor-pointer"
        style={{
          position: 'absolute',
          left: `${screenPosition.x}px`,
          top: `${screenPosition.y}px`,
          zIndex: 1000,
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease-out, transform 0.1s ease-out',
          opacity: cursor.opacity || 1,
          transform: cursor.isNew ? 'scale(1.2)' : 'scale(1)'
        }}
      >
        {/* Cursor pointer - simple arrow/line */}
        <svg
          width="12"
          height="20"
          viewBox="0 0 12 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
          }}
        >
          {/* Cursor line */}
          <line
            x1="2"
            y1="0"
            x2="2"
            y2="18"
            stroke={cursor.userColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Cursor pointer */}
          <path
            d="M1 0 L8 7 L5 7 L5 10 L1 10 Z"
            fill={cursor.userColor}
            stroke="white"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    );
  };

  // Don't render anything if not in a session or no cursors
  if (!session || activeCursors.length === 0) {
    return null;
  }

  return (
    <div className="live-cursors-overlay">
      {activeCursors.map(renderCursor)}
    </div>
  );
};

export default LiveColoredCursors;
