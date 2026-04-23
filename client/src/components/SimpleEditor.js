import React, { useState, useEffect, useRef } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useSession } from '../contexts/SessionContext';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';
import LiveColoredCursors from './LiveColoredCursors';

const SimpleEditor = ({ code, onChange, fontSize: initialFontSize = 14, theme = 'dark', language = 'javascript', fileName = '', onFontSizeChange }) => {
  const [content, setContent] = useState(code);
  const [lineCount, setLineCount] = useState(1);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showOutline, setShowOutline] = useState(false);
  const [foldedLines, setFoldedLines] = useState(new Set());
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  
  const { getCurrentTab } = useFileSystem();
  const { session } = useSession();
  
  // Y.js Collaboration Integration
  const { 
    content: yjsContent, 
    updateContent: updateYjsContent, 
    updateCursor: updateYjsCursor,
    isConnected: isYjsConnected,
    isCollaborative,
    collaborators: yjsCollaborators
  } = useYjsCollaboration(fileName, code);
  
  // Use Y.js content if in collaborative mode, otherwise use local content
  const displayContent = isCollaborative ? yjsContent : content;
  
  // Safely try to get collaboration context for cursor updates
  let updateCursor = null;
  try {
    updateCursor = window.updateCursor; // Will be set by collaboration context if available
  } catch (error) {
    // No collaboration context available
  }

  // Update internal state when code prop changes (from Socket.io)
  useEffect(() => {
    if (!isCollaborative) {
      setContent(code);
      updateLineCount(code);
    }
  }, [code, isCollaborative]);

  // Update content when Y.js content changes
  useEffect(() => {
    if (isCollaborative && yjsContent !== content) {
      setContent(yjsContent);
      updateLineCount(yjsContent);
      
      // Notify parent component of content change
      if (onChange && yjsContent !== code) {
        onChange(yjsContent);
      }
    }
  }, [yjsContent, isCollaborative, content, onChange, code]);

  // Update internal fontSize when prop changes
  useEffect(() => {
    setFontSize(initialFontSize);
  }, [initialFontSize]);

  // Sync scrolling between textarea and line numbers
  const handleScroll = (e) => {
    if (lineNumbersRef.current && e.target === textareaRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const updateLineCount = (text) => {
    const lines = text.split('\n').length;
    setLineCount(lines);
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setContent(newValue);
    updateLineCount(newValue);
    
    // Update Y.js collaborative document if in collaborative mode
    if (isCollaborative) {
      updateYjsContent(newValue);
    } else if (onChange) {
      onChange(newValue);
    }
    
    // Update cursor position and send to collaboration contexts
    updateCursorPosition(e.target);
    
    // Ensure cursor remains visible after changes
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  const updateCursorPosition = (textarea) => {
    if (!textarea) return;
    
    const { selectionStart } = textarea;
    const textBeforeCursor = textarea.value.substring(0, selectionStart);
    const lines = textBeforeCursor.split('\n');
    const lineNumber = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    const position = { lineNumber, column };
    setCursorPosition({ line: lineNumber, column });
    
    // Send cursor position to Y.js collaboration if available
    if (isCollaborative && updateYjsCursor) {
      try {
        updateYjsCursor(position, null);
      } catch (error) {
        console.warn('Y.js cursor update failed:', error);
      }
    }
    
    // Send cursor position to legacy collaboration context if available
    if (updateCursor && getCurrentTab()?.filePath) {
      try {
        updateCursor(position, null, getCurrentTab().filePath);
      } catch (error) {
        // Ignore collaboration errors
      }
    }
  };

  const handleCursorMove = (e) => {
    updateCursorPosition(e.target);
  };

  const handleKeyDown = (e) => {
    // Tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newValue = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newValue);
      if (onChange) {
        onChange(newValue);
      }
      // Set cursor position after the inserted tab
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
        e.target.focus(); // Ensure cursor remains visible
      }, 0);
    }
  };

  const handleFocus = (e) => {
    // Ensure cursor is visible when textarea gains focus
    e.target.style.caretColor = '#ffffff';
  };

  const handleBlur = (e) => {
    // Maintain cursor color even when blurred for better UX
    e.target.style.caretColor = '#ffffff';
  };

  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 2, 24);
    setFontSize(newSize);
    if (onFontSizeChange) {
      onFontSizeChange(newSize);
    }
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 2, 10);
    setFontSize(newSize);
    if (onFontSizeChange) {
      onFontSizeChange(newSize);
    }
  };

  const resetFontSize = () => {
    setFontSize(initialFontSize);
    if (onFontSizeChange) {
      onFontSizeChange(initialFontSize);
    }
  };

  const isDark = theme === 'dark';

  // Detect language from filename extension
  const detectLanguageFromFilename = (filename) => {
    if (!filename) return language;
    
    const extension = filename.split('.').pop()?.toLowerCase();
    const extensionMap = {
      'js': 'javascript',
      'jsx': 'javascript', 
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    
    return extensionMap[extension] || language;
  };

  const detectedLanguage = detectLanguageFromFilename(fileName);

  // Parse code structure for outline
  const parseCodeStructure = (code, lang) => {
    const lines = code.split('\n');
    const structure = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // JavaScript/TypeScript patterns
      if (lang === 'javascript' || lang === 'typescript') {
        if (trimmed.match(/^(function|const|let|var|class|interface|type|enum)/)) {
          const match = trimmed.match(/^(?:export\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
          if (match) {
            structure.push({
              name: match[1],
              line: index + 1,
              type: trimmed.includes('function') ? 'function' : 
                    trimmed.includes('class') ? 'class' : 
                    trimmed.includes('interface') ? 'interface' : 'variable',
              level: 0
            });
          }
        }
      }
      
      // Markdown headers
      if (lang === 'markdown') {
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
        if (headerMatch) {
          structure.push({
            name: headerMatch[2],
            line: index + 1,
            type: 'header',
            level: headerMatch[1].length - 1
          });
        }
      }
    });
    
    return structure;
  };

  const codeStructure = parseCodeStructure(content, detectedLanguage);
  
  return (
    <div className={`ide-editor ${isDark ? 'dark' : 'light'}`}>
      {/* Editor Header */}
      <div className="editor-header">
        <div className="editor-info">
          <span className="language-indicator">{language.toUpperCase()}</span>
          <span className="line-count">{lineCount} lines</span>
          <span className="font-size-indicator">Font: {fontSize}px</span>
        </div>
        <div className="editor-controls">
          <button 
            className="editor-btn" 
            title="Decrease Font Size"
            onClick={decreaseFontSize}
            disabled={fontSize <= 10}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 12v2H5v-2h14z"/>
            </svg>
          </button>
          <button 
            className="editor-btn" 
            title="Reset Font Size"
            onClick={resetFontSize}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 17h3l2-4V7H5v6h2v4zm8 0h3l1-8V7h-4v2h1v8zm-4-8V7H7v2h2z"/>
            </svg>
          </button>
          <button 
            className="editor-btn" 
            title="Increase Font Size"
            onClick={increaseFontSize}
            disabled={fontSize >= 24}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 12h-2V7h-3v5H9v2h5v5h3v-5h2v-2z"/>
            </svg>
          </button>
          <button 
            className={`editor-btn ${showLineNumbers ? 'active' : ''}`} 
            title="Toggle Line Numbers"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
            </svg>
          </button>
          <button className="editor-btn" title="Word Wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2.25c2.3 0 4.25-2.15 4.25-4.5S19.55 11 17.25 11z"/>
            </svg>
          </button>
          <button 
            className={`editor-btn ${showMinimap ? 'active' : ''}`} 
            onClick={() => setShowMinimap(!showMinimap)}
            title={`${showMinimap ? 'Hide' : 'Show'} Minimap`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/>
            </svg>
          </button>
          <button 
            className={`editor-btn ${showOutline ? 'active' : ''}`} 
            onClick={() => setShowOutline(!showOutline)}
            title={`${showOutline ? 'Hide' : 'Show'} Outline`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h2v2H3V3zm4 0h14v2H7V3zm-4 4h2v2H3V7zm4 0h14v2H7V7zm-4 4h2v2H3v-2zm4 0h14v2H7v-2zm-4 4h2v2H3v-2zm4 0h14v2H7v-2zm-4 4h2v2H3v-2zm4 0h14v2H7v-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        {/* Line Numbers */}
        {showLineNumbers && (
          <div 
            className="line-numbers"
            ref={lineNumbersRef}
          >
            {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
              <div key={i + 1} className="line-number">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code Area */}
        <div className="code-area" style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onScroll={handleScroll}
            onSelect={handleCursorMove}
            onClick={handleCursorMove}
            onKeyUp={handleCursorMove}
            className={`code-textarea ${!showLineNumbers ? 'no-line-numbers' : ''}`}
            placeholder="// Start coding here... 
// Use Tab for indentation
// Supports syntax highlighting simulation"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style={{ 
              fontSize: `${fontSize}px`,
              caretColor: '#ffffff'
            }}
          />
          
          {/* Live Colored Cursors Overlay - only render during active collaboration sessions */}
          {session && getCurrentTab()?.filePath && (
            <LiveColoredCursors 
              editorRef={textareaRef}
              currentFilePath={getCurrentTab()?.filePath}
            />
          )}
        </div>

        {/* Minimap */}
        {showMinimap && (
          <div className="minimap">
            <div className="minimap-content">
              {content.split('\n').map((line, index) => (
                <div 
                  key={index} 
                  className="minimap-line"
                  onClick={() => {
                    // Navigate to clicked line
                    if (textareaRef.current) {
                      const lines = content.split('\n');
                      const position = lines.slice(0, index).join('\n').length + (index > 0 ? 1 : 0);
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(position, position);
                    }
                  }}
                >
                  <span className="minimap-line-number">{index + 1}</span>
                  <span className="minimap-code">{line || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Outline Panel */}
      {showOutline && (
        <div className="outline-panel">
          <div className="outline-header">
            <h4>Outline</h4>
            <span className="outline-count">{codeStructure.length} items</span>
          </div>
          <div className="outline-content">
            {codeStructure.length === 0 ? (
              <div className="outline-empty">
                <span>No symbols found</span>
              </div>
            ) : (
              codeStructure.map((item, index) => (
                <div 
                  key={index}
                  className={`outline-item outline-${item.type}`}
                  style={{ paddingLeft: `${item.level * 12 + 8}px` }}
                  onClick={() => {
                    // Navigate to clicked symbol
                    if (textareaRef.current) {
                      const lines = content.split('\n');
                      const targetLine = item.line - 1; // Convert to 0-based index
                      const position = lines.slice(0, targetLine).join('\n').length + (targetLine > 0 ? 1 : 0);
                      
                      // Focus and set cursor position
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(position, position);
                      
                      // Scroll to the line
                      const lineHeight = 20; // Approximate line height
                      const scrollTop = targetLine * lineHeight;
                      textareaRef.current.scrollTop = scrollTop;
                    }
                  }}
                >
                  <span className="outline-icon">
                    {item.type === 'function' ? '𝒇' : 
                     item.type === 'class' ? '◉' : 
                     item.type === 'variable' ? '⚡' : 
                     item.type === 'header' ? '#' : '•'}
                  </span>
                  <span className="outline-name">{item.name}</span>
                  <span className="outline-line">:{item.line}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Editor Footer */}
      <div className="editor-footer">
        <div className="cursor-info">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </div>
        
        {/* Y.js Collaboration Status */}
        {isCollaborative && (
          <div className="collaboration-status">
            <span className={`collaboration-indicator ${isYjsConnected ? 'connected' : 'disconnected'}`}>
              {isYjsConnected ? '🟢' : '🔴'} Y.js
            </span>
            {yjsCollaborators.length > 0 && (
              <span className="collaborator-count">
                👥 {yjsCollaborators.length}
              </span>
            )}
          </div>
        )}
        
        <div className="editor-status">
          <span>UTF-8</span>
          <span>LF</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleEditor;
