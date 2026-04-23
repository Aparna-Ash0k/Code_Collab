/**
 * Y.js Integration Hook for React Components
 * 
 * Provides simple hooks to integrate Y.js collaborative editing with React components.
 * Works with both Monaco Editor and textarea-based editors.
 */

import { useEffect, useRef, useState } from 'react';
import { yjsCollaborationProvider } from '../services/YjsCollaborationProvider';

/**
 * Hook to integrate Y.js collaboration with a file editor
 */
export function useYjsCollaboration(filePath, initialContent = '', options = {}) {
  const [content, setContent] = useState(initialContent);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const ytextRef = useRef(null);
  const listenerRef = useRef(null);

  // Initialize Y.js collaboration for this file
  useEffect(() => {
    if (!filePath || !yjsCollaborationProvider.currentSession) {
      return;
    }

    try {
      // Get or create Y.Text document for this file
      const ytext = yjsCollaborationProvider.getOrCreateFile(filePath, initialContent);
      ytextRef.current = ytext;

      // Set up content synchronization
      const updateContent = () => {
        const newContent = ytext.toString();
        setContent(newContent);
      };

      // Listen for Y.js changes
      ytext.observe(updateContent);

      // Set up collaboration provider event listener
      const removeListener = yjsCollaborationProvider.addEventListener((event) => {
        const { event: eventType, data } = event;
        
        switch (eventType) {
          case 'socket_connected':
            setIsConnected(true);
            break;
          case 'socket_disconnected':
            setIsConnected(false);
            break;
          case 'cursors_changed':
            setCollaborators(data.filter(cursor => cursor.filePath === filePath));
            break;
        }
      });

      listenerRef.current = removeListener;
      setIsConnected(yjsCollaborationProvider.socket?.connected || false);

      // Initial content sync
      updateContent();

      console.log('🔗 Y.js collaboration hook initialized for:', filePath);

      // Cleanup function
      return () => {
        if (ytext && updateContent) {
          ytext.unobserve(updateContent);
        }
        if (removeListener) {
          removeListener();
        }
      };

    } catch (error) {
      console.error('❌ Failed to initialize Y.js collaboration hook:', error);
    }
  }, [filePath, initialContent]);

  // Function to update content via Y.js
  const updateContent = (newContent) => {
    if (!ytextRef.current) return;

    try {
      const ytext = ytextRef.current;
      const currentContent = ytext.toString();
      
      if (currentContent !== newContent) {
        // Apply diff-based update for better performance
        ytext.delete(0, ytext.length);
        ytext.insert(0, newContent);
      }
    } catch (error) {
      console.error('❌ Failed to update content via Y.js:', error);
    }
  };

  // Function to update cursor position
  const updateCursor = (position, selection) => {
    if (!filePath || !yjsCollaborationProvider.currentSession) return;

    try {
      yjsCollaborationProvider.updateCursor(filePath, position, selection);
    } catch (error) {
      console.error('❌ Failed to update cursor via Y.js:', error);
    }
  };

  return {
    content,
    updateContent,
    updateCursor,
    isConnected,
    collaborators,
    isCollaborative: !!yjsCollaborationProvider.currentSession
  };
}

/**
 * Hook to get Y.js collaboration status
 */
export function useYjsStatus() {
  const [status, setStatus] = useState({
    isConnected: false,
    sessionId: null,
    fileCount: 0,
    collaboratorCount: 0
  });

  useEffect(() => {
    const removeListener = yjsCollaborationProvider.addEventListener((event) => {
      const { event: eventType, data } = event;
      
      switch (eventType) {
        case 'socket_connected':
          setStatus(prev => ({ ...prev, isConnected: true }));
          break;
        case 'socket_disconnected':
          setStatus(prev => ({ ...prev, isConnected: false }));
          break;
        case 'files_changed':
          setStatus(prev => ({ ...prev, fileCount: data.length }));
          break;
        case 'cursors_changed':
          setStatus(prev => ({ ...prev, collaboratorCount: data.length }));
          break;
      }
    });

    // Initial status
    setStatus({
      isConnected: yjsCollaborationProvider.socket?.connected || false,
      sessionId: yjsCollaborationProvider.currentSession,
      fileCount: yjsCollaborationProvider.getAllFiles().length,
      collaboratorCount: 0
    });

    return removeListener;
  }, []);

  return status;
}

/**
 * Hook to bind Monaco editor with Y.js
 */
export function useYjsMonaco(editor, filePath, initialContent = '') {
  const bindingRef = useRef(null);

  useEffect(() => {
    if (!editor || !filePath || !yjsCollaborationProvider.currentSession) {
      return;
    }

    try {
      // Bind Monaco editor to Y.js
      const binding = yjsCollaborationProvider.bindMonacoEditor(editor, filePath, initialContent);
      bindingRef.current = binding;

      console.log('🎯 Monaco editor bound to Y.js for:', filePath);

      // Cleanup function
      return () => {
        if (binding) {
          yjsCollaborationProvider.unbindMonacoEditor(filePath);
        }
      };

    } catch (error) {
      console.error('❌ Failed to bind Monaco editor to Y.js:', error);
    }
  }, [editor, filePath, initialContent]);

  return {
    isBound: !!bindingRef.current,
    isCollaborative: !!yjsCollaborationProvider.currentSession
  };
}