import React, { useRef, useEffect, useContext } from 'react';
import MonacoEditor from 'react-monaco-editor';
import EditorLiveCursors from './EditorLiveCursors';
import { CollaborationContext } from '../contexts/CollaborationContext';
import { ProjectSystemContext } from '../contexts/ProjectSystemContext';
import { monacoYjsIntegration } from '../services/MonacoYjsIntegration';
import { realTimeCodeSync } from '../services/RealTimeCodeSync';
import { useAuth } from '../contexts/AuthContext';
import { useProjectSystem } from '../contexts/FileSystemContext';
import { useSession } from '../contexts/SessionContext';

const Editor = ({ 
  code, 
  onChange, 
  language = 'javascript', 
  theme = 'vs-dark', 
  fontSize = 16,
  readOnly = false,
  showMinimap = true
}) => {
  const editorRef = useRef(null);
  const disconnectYjsRef = useRef(null);
  const realTimeSyncRef = useRef(null);
  const { updateCursor, updateFileActivity } = useContext(CollaborationContext);
  const { getCurrentTab } = useContext(ProjectSystemContext);
  const { user } = useAuth();
  const { workspaceSync } = useProjectSystem();
  const { socket } = useSession();

  // Helper function to get current room ID (if in collaboration mode)
  const getRoomId = () => {
    // Check localStorage for active room
    const activeRoom = localStorage.getItem('activeCollaborationRoom');
    if (activeRoom) {
      try {
        const roomData = JSON.parse(activeRoom);
        return roomData.roomId;
      } catch (e) {
        console.warn('Failed to parse active room data');
      }
    }
    return null;
  };

  const editorOptions = {
    fontSize,
    fontFamily: '"Cascadia Code", "Fira Code", Monaco, Menlo, "Ubuntu Mono", monospace',
    lineNumbers: 'on',
    minimap: { enabled: showMinimap },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    readOnly: readOnly,
    wordWrap: 'off',
    folding: true,
    lineNumbersMinChars: 3,
    glyphMargin: true,
    renderWhitespace: 'boundary',
    cursorBlinking: 'blink',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    mouseWheelZoom: true,
    renderLineHighlight: 'line',
    selectionHighlight: true,
    occurrencesHighlight: true,
    codeLens: true,
    colorDecorators: true,
    links: true,
    contextmenu: true,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'on',
    parameterHints: { enabled: true },
    autoIndent: 'advanced',
    formatOnPaste: true,
    formatOnType: true,
    dragAndDrop: true,
    showFoldingControls: 'always',
    matchBrackets: 'always',
    bracketPairColorization: { enabled: true },
    selectOnLineNumbers: true,
    roundedSelection: false,
    overviewRulerLanes: 3,
    hideCursorInOverviewRuler: false,
    cursorStyle: 'line',
    cursorWidth: 2,
    cursorColor: '#ffffff',
    multiCursorModifier: 'alt',
    multiCursorMergeOverlapping: false,
    multiCursorPaste: 'spread',
    // Enhanced selection and cursor settings
    fontSize: fontSize,
    fontLigatures: true,
    fontWeight: 'normal',
    letterSpacing: 0,
    lineHeight: 1.5,
    // Ensure proper text selection highlighting
    theme: theme,
    selectOnLineNumbers: true,
    selectionHighlight: true,
    renderFinalNewline: 'on'
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    const currentTab = getCurrentTab();
    
    // Initialize real-time code sync if socket and user available
    if (socket && user && currentTab && currentTab.filePath) {
      // Check if we're in a collaboration room
      const roomId = getRoomId(); // We'll need to get this from context
      if (roomId) {
        // Initialize real-time sync if not already done
        if (!realTimeCodeSync.isInitialized) {
          realTimeCodeSync.initialize(
            socket, 
            roomId, 
            user.id || user.uid, 
            user.name || user.displayName || 'User'
          );
        }

        // Register this editor for real-time sync
        realTimeCodeSync.registerEditor(currentTab.filePath, editor, code);
        realTimeSyncRef.current = currentTab.filePath;
        
        console.log('🔗 Editor connected to real-time sync for file:', currentTab.filePath);
      }
    }
    
    // Initialize Yjs integration if workspace sync is available (fallback/alternative)
    if (workspaceSync && currentTab && currentTab.filePath && user) {
      // Initialize Monaco Yjs integration
      if (!monacoYjsIntegration.workspaceSync) {
        monacoYjsIntegration.initialize(workspaceSync, user);
      }

      // Connect this editor to Yjs
      disconnectYjsRef.current = monacoYjsIntegration.connectEditor(
        currentTab.filePath,
        editor
      );
      
      console.log('🔗 Editor connected to Yjs for file:', currentTab.filePath);
    }
    
    // Enhanced cursor and selection setup
    editor.focus();
    
    // Set custom theme with better selection colors
    monaco.editor.defineTheme('enhanced-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editor.selectionBackground': '#264f78',
        'editor.selectionForeground': '#ffffff',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editor.selectionHighlightBackground': '#264f7850',
        'editorCursor.foreground': '#ffffff',
        'editorCursor.background': '#1e1e1e'
      }
    });
    
    // Apply the enhanced theme
    monaco.editor.setTheme('enhanced-dark');
    
    // Set cursor position at the end of the content
    const model = editor.getModel();
    if (model) {
      const lineCount = model.getLineCount();
      const lastLineLength = model.getLineLength(lineCount);
      editor.setPosition({ lineNumber: lineCount, column: lastLineLength + 1 });
    }

    // Enhanced cursor visibility options
    editor.updateOptions({
      cursorColor: '#ffffff',
      cursorWidth: 2,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'on'
    });

    // Track cursor position changes with enhanced frequency
    const cursorListener = editor.onDidChangeCursorPosition((e) => {
      if (!readOnly) {
        const position = e.position;
        const selection = editor.getSelection();
        updateCursor(position, selection);
        
        // Update Yjs awareness with cursor info
        const currentTab = getCurrentTab();
        if (currentTab && currentTab.filePath) {
          monacoYjsIntegration.handleCursorChange(currentTab.filePath, editor);
        }
      }
    });

    // Track cursor selection changes with enhanced frequency
    const selectionListener = editor.onDidChangeCursorSelection((e) => {
      if (!readOnly) {
        const position = editor.getPosition();
        const selection = e.selection;
        updateCursor(position, selection);
      }
    });

    // Track content changes for typing detection
    const contentChangeListener = editor.onDidChangeModelContent((e) => {
      if (!readOnly && e.changes.length > 0) {
        const position = editor.getPosition();
        const selection = editor.getSelection();
        updateCursor(position, selection);
      }
    });

    // Update file activity when editor gets focus
    const focusListener = editor.onDidFocusEditorText(() => {
      const currentTab = getCurrentTab();
      if (currentTab && currentTab.filePath) {
        updateFileActivity(currentTab.filePath, currentTab.fileName);
      }
    });

    // Clean up listeners when editor is destroyed
    return () => {
      cursorListener.dispose();
      selectionListener.dispose();
      contentChangeListener.dispose();
      focusListener.dispose();
      
      // Disconnect real-time sync
      if (realTimeSyncRef.current) {
        realTimeCodeSync.unregisterEditor(realTimeSyncRef.current);
        realTimeSyncRef.current = null;
      }
      
      // Disconnect Yjs integration
      if (disconnectYjsRef.current) {
        disconnectYjsRef.current();
        disconnectYjsRef.current = null;
      }
    };
  };

  // Update file activity when tab changes
  useEffect(() => {
    const currentTab = getCurrentTab();
    if (currentTab && currentTab.filePath && editorRef.current) {
      updateFileActivity(currentTab.filePath, currentTab.fileName);
    }
  }, [getCurrentTab, updateFileActivity]);

  useEffect(() => {
    // Ensure editor is focused when component mounts
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  // Update minimap when showMinimap prop changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        minimap: { enabled: showMinimap }
      });
    }
  }, [showMinimap]);

  return (
    <div className="h-full w-full monaco-editor-container relative">
      <MonacoEditor
        width="100%"
        height="100%"
        language={language}
        theme={theme}
        value={code}
        onChange={onChange}
        options={editorOptions}
        editorDidMount={handleEditorDidMount}
      />
      <EditorLiveCursors editorRef={editorRef} />
    </div>
  );
};

export default Editor;
