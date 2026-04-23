/**
 * Yjs-Monaco Editor Integration
 * 
 * Replaces the current editor with collaborative editing using Yjs + Monaco
 * Features:
 * - Real-time collaborative editing
 * - Cursor awareness
 * - Conflict-free text merging
 * - Undo/redo synchronization
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';
import { yjsFileSystem } from '../services/YjsFileSystem';

// User colors for cursors and selections
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

const YjsMonacoEditor = ({ 
  filePath, 
  language = 'javascript',
  theme = 'vs-dark',
  options = {},
  onSave,
  className = ''
}) => {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const monacoBindingRef = useRef(null);
  const awarenessRef = useRef(null);
  
  const [isReady, setIsReady] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current || !filePath) return;

    const initializeEditor = async () => {
      try {
        // Get or create Y.Text document for this file
        let ytext = yjsFileSystem.getFile(filePath);
        if (!ytext) {
          // Create new file if it doesn't exist
          ytext = await yjsFileSystem.createFile(filePath, '', { type: 'file' });
        }

        // Configure Monaco editor
        const editorOptions = {
          value: '', // Will be populated by Yjs binding
          language,
          theme,
          automaticLayout: true,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          lineDecorationsWidth: 60,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'line',
          selectionHighlight: false,
          fontFamily: 'Fira Code, Monaco, Consolas, "Ubuntu Mono", monospace',
          fontSize: 14,
          tabSize: 2,
          insertSpaces: true,
          contextmenu: true,
          cursorBlinking: 'smooth',
          ...options
        };

        // Create Monaco editor
        const editor = monaco.editor.create(containerRef.current, editorOptions);
        editorRef.current = editor;

        // Create awareness for cursor tracking
        const awareness = new Awareness(yjsFileSystem.ydoc);
        awarenessRef.current = awareness;

        // Set local user info
        const user = yjsFileSystem.user;
        if (user) {
          setCurrentUser(user);
          awareness.setLocalStateField('user', {
            name: user.name || user.email,
            email: user.email,
            color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
            avatar: user.photoURL
          });
        }

        // Create Monaco-Yjs binding
        const binding = new MonacoBinding(
          ytext,
          editor.getModel(),
          new Set([editor]),
          awareness
        );
        monacoBindingRef.current = binding;

        // Setup awareness listeners for collaborator tracking
        awareness.on('change', () => {
          const collaboratorList = [];
          awareness.getStates().forEach((state, clientId) => {
            if (clientId !== awareness.clientID && state.user) {
              collaboratorList.push({
                clientId,
                user: state.user,
                cursor: state.cursor,
                selection: state.selection
              });
            }
          });
          setCollaborators(collaboratorList);
        });

        // Setup editor event listeners
        editor.onDidChangeCursorPosition((e) => {
          if (yjsFileSystem.currentRoom) {
            yjsFileSystem.socket?.emit('cursor_update', {
              filePath,
              cursorData: {
                position: e.position,
                selection: editor.getSelection()
              }
            });
          }
        });

        // Auto-save functionality
        let saveTimeout;
        editor.onDidChangeModelContent(() => {
          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(() => {
            if (onSave) {
              onSave(ytext.toString());
            }
          }, 1000); // Auto-save after 1 second of inactivity
        });

        // Keyboard shortcuts
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          if (onSave) {
            onSave(ytext.toString());
          }
        });

        // Focus editor
        editor.focus();
        setIsReady(true);

        console.log('✅ Yjs-Monaco editor initialized for:', filePath);

      } catch (error) {
        console.error('❌ Failed to initialize Yjs-Monaco editor:', error);
      }
    };

    initializeEditor();

    // Cleanup
    return () => {
      if (monacoBindingRef.current) {
        monacoBindingRef.current.destroy();
      }
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, [filePath, language, theme]);

  // Handle file content changes from outside
  const updateContent = useCallback((content) => {
    const ytext = yjsFileSystem.getFile(filePath);
    if (ytext && ytext.toString() !== content) {
      ytext.delete(0, ytext.length);
      ytext.insert(0, content);
    }
  }, [filePath]);

  // Get current content
  const getContent = useCallback(() => {
    const ytext = yjsFileSystem.getFile(filePath);
    return ytext ? ytext.toString() : '';
  }, [filePath]);

  // Insert text at cursor
  const insertText = useCallback((text) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      editorRef.current.executeEdits('insert-text', [{
        range: selection,
        text: text
      }]);
    }
  }, []);

  // Expose editor methods
  useEffect(() => {
    if (isReady && editorRef.current) {
      // Add custom commands or expose methods if needed
      window.yjsEditor = {
        getContent,
        updateContent,
        insertText,
        focus: () => editorRef.current?.focus(),
        getEditor: () => editorRef.current
      };
    }
  }, [isReady, getContent, updateContent, insertText]);

  return (
    <div className={`relative ${className}`}>
      {/* Collaborators indicator */}
      {collaborators.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-gray-800 bg-opacity-90 rounded-lg px-3 py-1">
          <span className="text-xs text-gray-300">
            {collaborators.length} collaborator{collaborators.length > 1 ? 's' : ''}
          </span>
          <div className="flex -space-x-2">
            {collaborators.slice(0, 5).map((collab) => (
              <div
                key={collab.clientId}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: collab.user.color }}
                title={collab.user.name}
              >
                {collab.user.avatar ? (
                  <img
                    src={collab.user.avatar}
                    alt={collab.user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  collab.user.name?.charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection status */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-20">
          <div className="text-center text-white">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <div>Connecting to collaborative editor...</div>
          </div>
        </div>
      )}

      {/* Monaco editor container */}
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default YjsMonacoEditor;

// Hook for using the editor in components
export const useYjsEditor = (filePath) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!filePath) return;

    const loadFile = async () => {
      try {
        setIsLoading(true);
        let ytext = yjsFileSystem.getFile(filePath);
        
        if (!ytext) {
          // Try to load from metadata or create new
          const metadata = yjsFileSystem.getFileMetadata(filePath);
          const initialContent = metadata?.contentText || '';
          ytext = await yjsFileSystem.createFile(filePath, initialContent);
        }

        setContent(ytext.toString());
        
        // Listen for changes
        const updateHandler = () => {
          setContent(ytext.toString());
        };
        
        ytext.observe(updateHandler);
        setIsLoading(false);

        return () => {
          ytext.unobserve(updateHandler);
        };
      } catch (error) {
        console.error('Failed to load file for editor:', error);
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  const updateFile = useCallback(async (newContent) => {
    if (!filePath) return;
    
    const ytext = yjsFileSystem.getFile(filePath);
    if (ytext && ytext.toString() !== newContent) {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newContent);
    }
  }, [filePath]);

  return {
    content,
    isLoading,
    updateFile
  };
};

// Higher-order component for adding collaborative editing to existing editors
export const withYjsCollaboration = (EditorComponent) => {
  return ({ filePath, ...props }) => {
    const { content, isLoading, updateFile } = useYjsEditor(filePath);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <div>Loading collaborative editor...</div>
          </div>
        </div>
      );
    }

    return (
      <EditorComponent
        {...props}
        filePath={filePath}
        value={content}
        onChange={updateFile}
      />
    );
  };
};
