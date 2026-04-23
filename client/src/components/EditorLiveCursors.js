import React, { useEffect, useRef, useState, useContext } from 'react';
import { CollaborationContext } from '../contexts/CollaborationContext';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';

const EditorLiveCursors = ({ editorRef }) => {
  const { getCursorsForFile } = useContext(CollaborationContext);
  const { getCurrentTab } = useContext(ProjectSystemContext);
  const decorationsRef = useRef(new Map());
  const styleElementRef = useRef(null);
  const typingIndicatorsRef = useRef(new Map()); // Track typing indicators
  const [typingUsers, setTypingUsers] = useState(new Set()); // Users currently typing

  const currentTab = getCurrentTab();
  const activeFilePath = currentTab?.filePath;

  useEffect(() => {
    if (!editorRef.current || !activeFilePath || !window.monaco) return;

    const editor = editorRef.current;
    const cursors = getCursorsForFile(activeFilePath);

    // Clear old decorations
    decorationsRef.current.forEach((decorationIds, userId) => {
      try {
        editor.deltaDecorations(decorationIds, []);
      } catch (error) {
        console.warn('Error removing decoration:', error);
      }
    });
    decorationsRef.current.clear();

    // Update typing indicators
    updateTypingIndicators(cursors);

    // Create CSS for cursor styles
    updateCursorStyles(cursors);

    // Add new cursors
    cursors.forEach((cursorData) => {
      const { userId, userName, userColor, position, selection } = cursorData;

      try {
        if (!position || !position.lineNumber || !position.column) return;

        const decorations = [];

        // Create selection decoration if selection exists
        if (selection && (
          selection.startLineNumber !== selection.endLineNumber ||
          selection.startColumn !== selection.endColumn
        )) {
          decorations.push({
            range: new window.monaco.Range(
              selection.startLineNumber,
              selection.startColumn,
              selection.endLineNumber,
              selection.endColumn
            ),
            options: {
              className: `live-selection-${userId}`,
              stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
          });
        }

        // Create cursor decoration with enhanced styling
        const isTyping = typingUsers.has(userId);
        decorations.push({
          range: new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: `live-cursor-${userId} ${isTyping ? 'typing' : ''}`,
            afterContentClassName: `live-cursor-label-${userId} ${isTyping ? 'typing' : ''}`,
            stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });

        // Apply decorations
        const decorationIds = editor.deltaDecorations([], decorations);
        decorationsRef.current.set(userId, decorationIds);

      } catch (error) {
        console.warn('Error creating cursor decoration:', error);
      }
    });

  }, [editorRef, activeFilePath, getCursorsForFile, typingUsers]);

  // Update typing indicators based on cursor activity
  const updateTypingIndicators = (cursors) => {
    const now = Date.now();
    const TYPING_TIMEOUT = 2000; // 2 seconds
    const currentlyTyping = new Set();

    cursors.forEach(({ userId, timestamp }) => {
      // Clear existing timeout for this user
      if (typingIndicatorsRef.current.has(userId)) {
        clearTimeout(typingIndicatorsRef.current.get(userId));
      }

      // Check if user was recently active (typing)
      if (now - timestamp < TYPING_TIMEOUT) {
        currentlyTyping.add(userId);
        
        // Set timeout to remove typing indicator
        const timeoutId = setTimeout(() => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
          typingIndicatorsRef.current.delete(userId);
        }, TYPING_TIMEOUT);
        
        typingIndicatorsRef.current.set(userId, timeoutId);
      }
    });

    setTypingUsers(currentlyTyping);
  };

  // Update CSS styles for cursors with enhanced animations
  const updateCursorStyles = (cursors) => {
    if (!styleElementRef.current) {
      styleElementRef.current = document.createElement('style');
      styleElementRef.current.id = 'editor-live-cursors-styles';
      document.head.appendChild(styleElementRef.current);
    }

    let css = `
      /* Base cursor animations */
      @keyframes cursorBlink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
      
      @keyframes typingPulse {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(1.2); }
      }
      
      @keyframes labelSlideIn {
        0% { transform: translateY(-10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
    `;
    
    cursors.forEach(({ userId, userColor, userName }) => {
      // Escape user name for CSS
      const escapedUserName = userName.replace(/"/g, '\\"');
      
      css += `
        .live-cursor-${userId} {
          border-left: 2px solid ${userColor} !important;
          position: relative;
          z-index: 1000;
          animation: cursorBlink 1.5s infinite;
          transition: all 0.15s ease;
        }
        
        .live-cursor-${userId}.typing {
          animation: typingPulse 0.6s infinite;
          border-left-width: 3px !important;
          box-shadow: 0 0 8px ${userColor}40;
        }
        
        .live-cursor-label-${userId}::after {
          content: "${escapedUserName}";
          position: absolute;
          top: -26px;
          left: -4px;
          background: ${userColor};
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          z-index: 1001;
          font-family: 'Segoe UI', system-ui, sans-serif;
          pointer-events: none;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
          min-width: max-content;
          animation: labelSlideIn 0.3s ease-out;
          border: 1px solid rgba(255,255,255,0.2);
        }
        
        .live-cursor-label-${userId}.typing::after {
          background: linear-gradient(135deg, ${userColor}, ${userColor}CC);
          animation: labelSlideIn 0.3s ease-out, typingPulse 0.6s infinite;
        }
        
        .live-cursor-label-${userId}.typing::before {
          content: "✏️ ";
          position: absolute;
          top: -26px;
          left: -20px;
          font-size: 10px;
          z-index: 1002;
          animation: typingPulse 0.6s infinite;
        }
        
        .live-selection-${userId} {
          background: ${userColor}20 !important;
          border: 1px solid ${userColor}60;
          border-radius: 3px;
          transition: all 0.2s ease;
          box-shadow: inset 0 0 4px ${userColor}30;
        }
        
        .live-selection-${userId}:hover {
          background: ${userColor}30 !important;
          border-color: ${userColor}80;
        }
      `;
    });

    styleElementRef.current.textContent = css;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        decorationsRef.current.forEach((decorationIds) => {
          try {
            editorRef.current.deltaDecorations(decorationIds, []);
          } catch (error) {
            console.warn('Error cleaning up decorations:', error);
          }
        });
      }
      
      // Clear all typing timeouts
      typingIndicatorsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      typingIndicatorsRef.current.clear();
      
      if (styleElementRef.current) {
        styleElementRef.current.remove();
      }
    };
  }, []);

  return null; // This component doesn't render anything visible
};

export default EditorLiveCursors;
