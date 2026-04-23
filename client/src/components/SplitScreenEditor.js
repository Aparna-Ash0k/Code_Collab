import React, { useState, useRef, useEffect } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useCollaboration } from '../contexts/CollaborationContext';
import SimpleEditor from './SimpleEditor';
import Editor from './Editor';
import { ChevronRight, X, RotateCcw, Maximize2, Minimize2, Copy } from 'lucide-react';

const SplitScreenEditor = ({ 
  primaryTab, 
  onClose, 
  theme = 'dark',
  fontSize = 14,
  onFontSizeChange,
  useMonacoEditor = false 
}) => {
  const { tabs, updateTabContent, openFile, closeTab } = useFileSystem();
  const { isFileBeingEdited } = useCollaboration();
  
  const [splitLayout, setSplitLayout] = useState('horizontal'); // 'horizontal' | 'vertical'
  const [leftPaneWidth, setLeftPaneWidth] = useState(50); // percentage
  const [selectedSecondaryTab, setSelectedSecondaryTab] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  
  const resizeRef = useRef(null);
  const containerRef = useRef(null);

  // Filter available tabs (exclude the primary tab)
  const availableTabs = tabs.filter(tab => tab.id !== primaryTab?.id);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      
      if (splitLayout === 'horizontal') {
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        setLeftPaneWidth(Math.max(20, Math.min(80, newWidth)));
      } else {
        const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        setLeftPaneWidth(Math.max(20, Math.min(80, newHeight)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, splitLayout]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleTabSelect = (tab) => {
    setSelectedSecondaryTab(tab);
  };

  const handlePrimaryContentChange = (newContent) => {
    updateTabContent(primaryTab.id, newContent);
  };

  const handleSecondaryContentChange = (newContent) => {
    if (selectedSecondaryTab) {
      updateTabContent(selectedSecondaryTab.id, newContent);
    }
  };

  const toggleLayout = () => {
    setSplitLayout(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
  };

  const resetLayout = () => {
    setLeftPaneWidth(50);
  };

  const copyFromPrimary = () => {
    if (selectedSecondaryTab && primaryTab) {
      const primaryContent = primaryTab.content || '';
      updateTabContent(selectedSecondaryTab.id, primaryContent);
    }
  };

  const copyFromSecondary = () => {
    if (selectedSecondaryTab && primaryTab) {
      const secondaryContent = selectedSecondaryTab.content || '';
      updateTabContent(primaryTab.id, secondaryContent);
    }
  };

  const renderEditor = (tab, onChange, isSecondary = false) => {
    const content = tab.content || '';
    const isBeingEdited = isFileBeingEdited && isFileBeingEdited(tab.filePath);
    
    if (useMonacoEditor) {
      return (
        <Editor
          code={content}
          onChange={onChange}
          language={tab.language || 'javascript'}
          theme={theme}
          fontSize={fontSize}
          readOnly={false}
          showMinimap={showMinimap}
        />
      );
    }
    
    return (
      <SimpleEditor
        code={content}
        onChange={onChange}
        fontSize={fontSize}
        theme={theme}
        language={tab.language || 'javascript'}
        placeholder={`Start editing ${tab.fileName}...`}
        onFontSizeChange={onFontSizeChange}
      />
    );
  };

  const paneStyle = splitLayout === 'horizontal' 
    ? { width: `${leftPaneWidth}%`, height: '100%' }
    : { width: '100%', height: `${leftPaneWidth}%` };

  const secondaryPaneStyle = splitLayout === 'horizontal'
    ? { width: `${100 - leftPaneWidth}%`, height: '100%' }
    : { width: '100%', height: `${100 - leftPaneWidth}%` };

  return (
    <div className="split-screen-editor" ref={containerRef}>
      {/* Header Controls */}
      <div className="split-header">
        <div className="split-title">
          <Maximize2 size={16} />
          <span>Split Screen Editor</span>
        </div>
        <div className="split-controls">
          <button
            className="split-control-btn"
            onClick={toggleLayout}
            title={`Switch to ${splitLayout === 'horizontal' ? 'vertical' : 'horizontal'} split`}
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="split-control-btn"
            onClick={resetLayout}
            title="Reset layout"
          >
            <Minimize2 size={14} />
          </button>
          <button
            className="split-control-btn close"
            onClick={onClose}
            title="Close split screen"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Split Panes Container */}
      <div className={`split-container ${splitLayout}`}>
        {/* Primary Pane */}
        <div className="split-pane primary" style={paneStyle}>
          <div className="pane-header">
            <div className="pane-title">
              <span className="file-icon">📄</span>
              <span>{primaryTab.fileName}</span>
              {isFileBeingEdited(primaryTab.filePath) && (
                <span className="edit-indicator" title="Being edited by collaborators">
                  ⚡
                </span>
              )}
            </div>
            <div className="pane-actions">
              {selectedSecondaryTab && (
                <button
                  className="copy-btn"
                  onClick={copyFromSecondary}
                  title="Copy content from right pane"
                >
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="pane-content">
            {renderEditor(primaryTab, handlePrimaryContentChange)}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className={`resize-handle ${splitLayout}`}
          onMouseDown={handleResizeStart}
          ref={resizeRef}
        >
          <div className="resize-indicator" />
        </div>

        {/* Secondary Pane */}
        <div className="split-pane secondary" style={secondaryPaneStyle}>
          <div className="pane-header">
            <div className="pane-title">
              {selectedSecondaryTab ? (
                <>
                  <span className="file-icon">📄</span>
                  <span>{selectedSecondaryTab.fileName}</span>
                  {isFileBeingEdited(selectedSecondaryTab.filePath) && (
                    <span className="edit-indicator" title="Being edited by collaborators">
                      ⚡
                    </span>
                  )}
                </>
              ) : (
                <span className="placeholder">Select a file to compare</span>
              )}
            </div>
            <div className="pane-actions">
              {selectedSecondaryTab && (
                <>
                  <button
                    className="copy-btn"
                    onClick={copyFromPrimary}
                    title="Copy content from left pane"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    className="close-btn"
                    onClick={() => setSelectedSecondaryTab(null)}
                    title="Close this pane"
                  >
                    <X size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {selectedSecondaryTab ? (
            <div className="pane-content">
              {renderEditor(selectedSecondaryTab, handleSecondaryContentChange, true)}
            </div>
          ) : (
            <div className="tab-selector">
              <div className="selector-header">
                <h4>Select a file to compare:</h4>
              </div>
              <div className="tab-list">
                {availableTabs.length > 0 ? (
                  availableTabs.map(tab => (
                    <div
                      key={tab.id}
                      className="tab-item"
                      onClick={() => handleTabSelect(tab)}
                    >
                      <span className="tab-icon">📄</span>
                      <span className="tab-name">{tab.fileName}</span>
                      <span className="tab-path">{tab.filePath}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-tabs">
                    <p>No other files are open</p>
                    <p>Open more files to use split screen</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .split-screen-editor {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: ${theme === 'dark' ? '#1E1E1E' : '#FFFFFF'};
          border: 1px solid ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
          border-radius: 8px;
          overflow: hidden;
        }

        .split-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: ${theme === 'dark' ? '#2D2D30' : '#F6F8FA'};
          border-bottom: 1px solid ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
        }

        .split-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${theme === 'dark' ? '#CCCCCC' : '#24292E'};
          font-size: 13px;
          font-weight: 600;
        }

        .split-controls {
          display: flex;
          gap: 4px;
        }

        .split-control-btn {
          padding: 4px 6px;
          background: transparent;
          border: 1px solid ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
          border-radius: 4px;
          color: ${theme === 'dark' ? '#CCCCCC' : '#586069'};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .split-control-btn:hover {
          background: ${theme === 'dark' ? '#3C3C3C' : '#F6F8FA'};
          border-color: ${theme === 'dark' ? '#007ACC' : '#0366D6'};
        }

        .split-control-btn.close:hover {
          background: #DC3545;
          border-color: #DC3545;
          color: white;
        }

        .split-container {
          flex: 1;
          display: flex;
          position: relative;
          min-height: 0;
        }

        .split-container.horizontal {
          flex-direction: row;
        }

        .split-container.vertical {
          flex-direction: column;
        }

        .split-pane {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .pane-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: ${theme === 'dark' ? '#252526' : '#F8F9FA'};
          border-bottom: 1px solid ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
          min-height: 36px;
        }

        .pane-title {
          display: flex;
          align-items: center;
          gap: 6px;
          color: ${theme === 'dark' ? '#CCCCCC' : '#24292E'};
          font-size: 12px;
          font-weight: 500;
        }

        .pane-title .placeholder {
          color: ${theme === 'dark' ? '#858585' : '#6A737D'};
          font-style: italic;
        }

        .edit-indicator {
          color: #FFA500;
          font-size: 11px;
        }

        .pane-actions {
          display: flex;
          gap: 4px;
        }

        .copy-btn, .close-btn {
          padding: 2px 4px;
          background: transparent;
          border: 1px solid ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
          border-radius: 3px;
          color: ${theme === 'dark' ? '#CCCCCC' : '#586069'};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .copy-btn:hover {
          background: ${theme === 'dark' ? '#007ACC' : '#0366D6'};
          border-color: ${theme === 'dark' ? '#007ACC' : '#0366D6'};
          color: white;
        }

        .close-btn:hover {
          background: #DC3545;
          border-color: #DC3545;
          color: white;
        }

        .pane-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .resize-handle {
          background: ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
          cursor: ${splitLayout === 'horizontal' ? 'col-resize' : 'row-resize'};
          position: relative;
          transition: background-color 0.2s ease;
        }

        .resize-handle:hover {
          background: ${theme === 'dark' ? '#007ACC' : '#0366D6'};
        }

        .resize-handle.horizontal {
          width: 4px;
          min-width: 4px;
        }

        .resize-handle.vertical {
          height: 4px;
          min-height: 4px;
        }

        .resize-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: ${theme === 'dark' ? '#CCCCCC' : '#586069'};
          border-radius: 2px;
        }

        .resize-handle.horizontal .resize-indicator {
          width: 2px;
          height: 20px;
        }

        .resize-handle.vertical .resize-indicator {
          width: 20px;
          height: 2px;
        }

        .tab-selector {
          height: 100%;
          padding: 16px;
          overflow-y: auto;
        }

        .selector-header h4 {
          margin: 0 0 12px 0;
          color: ${theme === 'dark' ? '#CCCCCC' : '#24292E'};
          font-size: 14px;
          font-weight: 600;
        }

        .tab-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tab-item {
          padding: 12px;
          border: 1px solid ${theme === 'dark' ? '#3C3C3C' : '#E1E4E8'};
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: ${theme === 'dark' ? '#2D2D30' : '#FFFFFF'};
        }

        .tab-item:hover {
          border-color: ${theme === 'dark' ? '#007ACC' : '#0366D6'};
          background: ${theme === 'dark' ? '#3C3C3C' : '#F6F8FA'};
        }

        .tab-icon {
          margin-right: 8px;
        }

        .tab-name {
          color: ${theme === 'dark' ? '#CCCCCC' : '#24292E'};
          font-weight: 500;
          font-size: 13px;
        }

        .tab-path {
          display: block;
          color: ${theme === 'dark' ? '#858585' : '#6A737D'};
          font-size: 11px;
          margin-top: 2px;
        }

        .no-tabs {
          text-align: center;
          color: ${theme === 'dark' ? '#858585' : '#6A737D'};
          font-size: 13px;
          padding: 40px 20px;
        }

        .no-tabs p {
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
};

export default SplitScreenEditor;
