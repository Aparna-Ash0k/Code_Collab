import { useState, useRef, useEffect, useMemo } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Project } from '../hooks/useProject';
import { useProject } from '../hooks/useProject';
import { UserPresence } from '../hooks/usePresence';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { ExecutionResults } from './ExecutionResults';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { Play, Square, FileCode, Zap, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

interface CodeEditorProps {
  project: Project;
  selectedFile: string | null;
  activeUsers: UserPresence[];
  onPresenceUpdate: (file: string | null, cursor?: { line: number; column: number }) => void;
}

export function CodeEditor({ project, selectedFile, activeUsers, onPresenceUpdate }: CodeEditorProps) {
  const { files, updateFile } = useProject();
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logging
  console.log('CodeEditor: Received project with userRole:', project.userRole);
  console.log('CodeEditor: Project object:', project);

  // Check if user is a viewer (read-only mode)
  const isViewer = project.userRole === 'viewer';

  // Code execution functionality
  const {
    currentLanguage,
    availableLanguages,
    isExecuting,
    executionResults,
    setCurrentLanguage,
    executeCode,
    clearResults,
    detectLanguageFromFile,
    getLanguageTemplate,
  } = useCodeExecution();

  const currentFile = useMemo(() => {
    return files.find(f => f.path === selectedFile);
  }, [files, selectedFile]);

  useEffect(() => {
    if (currentFile) {
      setCode(currentFile.content);
      setHasUnsavedChanges(false);
    } else if (selectedFile) {
      setCode('// File not found or loading...');
    } else {
      setCode('// Select a file to start editing');
    }

    // Auto-detect language from file extension
    if (selectedFile) {
      const detectedLanguage = detectLanguageFromFile(selectedFile);
      if (detectedLanguage.id !== currentLanguage.id) {
        setCurrentLanguage(detectedLanguage);
      }
    }
  }, [currentFile, selectedFile, detectLanguageFromFile, currentLanguage.id, setCurrentLanguage]);

  // Monitor for external changes to the current file content
  useEffect(() => {
    if (currentFile && !hasUnsavedChanges && currentFile.content !== code) {
      console.log('External code changes detected, updating editor');
      setCode(currentFile.content);
    }
  }, [currentFile?.content, hasUnsavedChanges]);

  const handleCodeChange = (newCode: string) => {
    // Prevent editing if user is a viewer
    if (isViewer) {
      toast.error('You have view-only access. Cannot edit files.');
      return;
    }
    
    setCode(newCode);
    setHasUnsavedChanges(true);

    // Auto-save after 2 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newCode);
    }, 2000);
  };

  const handleSave = async (codeToSave?: string) => {
    if (!selectedFile || !project) return;

    try {
      await updateFile(project.id, selectedFile, codeToSave || code);
      setHasUnsavedChanges(false);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      toast.success('File saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save file');
    }
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      toast.error('Please enter some code to execute');
      return;
    }

    // Auto-save before execution
    if (hasUnsavedChanges && selectedFile) {
      await handleSave();
    }

    // Process stdin: convert comma-separated values to newline-separated
    let processedStdin = stdin;
    if (stdin && stdin.includes(',')) {
      // Split by comma, trim each value, and join with newlines
      // Add extra newline at the end to ensure all inputs are consumed
      processedStdin = stdin
        .split(',')
        .map(val => val.trim())
        .filter(val => val !== '') // Remove empty values
        .join('\n') + '\n';
      
      console.log('Processed stdin:', JSON.stringify(processedStdin));
    } else if (stdin && !stdin.endsWith('\n')) {
      // If single value without comma, ensure it ends with newline
      processedStdin = stdin + '\n';
    }

    setShowExecutionPanel(true);
    await executeCode(code, { stdin: processedStdin || undefined });
  };

  const handleUseTemplate = () => {
    const template = getLanguageTemplate(currentLanguage);
    setCode(template);
    setHasUnsavedChanges(true);
    toast.success(`Loaded ${currentLanguage.name} template`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Ctrl+S for manual save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleCursorPositionChange = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const lines = textarea.value.substring(0, textarea.selectionStart).split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      setCursorPosition({ line, column });
      
      // Update presence with cursor position
      if (selectedFile) {
        onPresenceUpdate(selectedFile, { line, column });
      }
    }
  };

  // Get collaborative cursors from active users
  const collaborativeCursors = activeUsers
    .filter(user => user.file === selectedFile && user.cursor)
    .map(user => ({
      user,
      line: user.cursor!.line,
      column: user.cursor!.column
    }));

  const getRandomColor = (userId: string) => {
    const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Calculate precise character width for cursor positioning
  const getCharacterWidth = () => {
    // For Monaco/Menlo at 14px, measured character width
    // This is more accurate for cursor positioning
    return 7.665; // Fine-tuned based on actual measurements
  };

  const getCursorPosition = (line: number, column: number) => {
    const charWidth = getCharacterWidth();
    const padding = 16; // p-4 = 16px
    const lineHeight = 24; // 24px line height
    
    return {
      left: padding + (column - 1) * charWidth,
      top: padding + (line - 1) * lineHeight
    };
  };

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div>
          <h3 className="text-lg font-medium mb-2">No file selected</h3>
          <p className="text-muted-foreground">Select a file from the explorer to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-3 bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="font-medium flex items-center gap-2">
              {selectedFile}
              {hasUnsavedChanges && <span className="text-orange-500 ml-1">•</span>}
              {isViewer && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Read Only
                </Badge>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {collaborativeCursors.map(cursor => (
                <Badge 
                  key={cursor.user.user_id}
                  variant="outline" 
                  className="text-xs"
                  style={{ 
                    borderColor: getRandomColor(cursor.user.user_id), 
                    color: getRandomColor(cursor.user.user_id)
                  }}
                >
                  {cursor.user.user_name} • {cursor.line}:{cursor.column}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            <span>•</span>
            <span>UTF-8</span>
            <span>•</span>
            <span>{currentLanguage.name}</span>
            {hasUnsavedChanges && (
              <>
                <span>•</span>
                <span className="text-orange-500">Unsaved</span>
                <span>•</span>
                <span className="text-blue-500">Ctrl+S to save</span>
              </>
            )}
          </div>
        </div>

        {/* Language and execution controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              <Select 
                value={currentLanguage.id} 
                onValueChange={(value: string) => {
                  const language = availableLanguages.find(lang => lang.id === value);
                  if (language) {
                    setCurrentLanguage(language);
                  }
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <span>{currentLanguage.icon}</span>
                      <span>{currentLanguage.name}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border-border shadow-lg backdrop-blur-none">
                  {availableLanguages.map((language) => (
                    <SelectItem key={language.id} value={language.id}>
                      <div className="flex items-center gap-2">
                        <span>{language.icon}</span>
                        <span>{language.name}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {language.version}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleUseTemplate}
              className="flex items-center gap-1"
              disabled={isViewer}
              title={isViewer ? 'View-only access' : 'Load template'}
            >
              <Zap className="h-4 w-4" />
              Template
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border rounded-md px-3 py-1 bg-muted/30">
              <Keyboard className="h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Input: val1, val2, ..."
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                className="h-7 px-2 text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 w-44"
                title="Provide input to your program (stdin). Use commas for multiple values (e.g., 'John, 25, NYC' becomes separate lines)"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExecutionPanel(!showExecutionPanel)}
              className={showExecutionPanel ? 'bg-primary/10' : ''}
            >
              Results {executionResults.length > 0 && `(${executionResults.length})`}
            </Button>
            
            <Button
              onClick={handleRunCode}
              disabled={isExecuting || !code.trim()}
              className="flex items-center gap-1"
              size="sm"
            >
              {isExecuting ? (
                <>
                  <Square className="h-4 w-4" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Code
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1">
        {showExecutionPanel ? (
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={60} minSize={30}>
              <div className="h-full flex code-editor-container">
                {/* Line numbers */}
                <div className="w-12 bg-muted/50 border-r text-right text-sm text-muted-foreground select-none line-numbers font-mono" style={{ 
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  padding: '16px 8px',
                  fontSize: '14px',
                  lineHeight: '24px'
                }}>
                  {code.split('\n').map((_, index) => (
                    <div key={index} style={{ lineHeight: '24px', height: '24px' }}>
                      {index + 1}
                    </div>
                  ))}
                </div>

                {/* Code editor */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onSelect={handleCursorPositionChange}
                    onKeyUp={handleCursorPositionChange}
                    onKeyDown={handleKeyDown}
                    className="absolute inset-0 w-full h-full bg-transparent border-none outline-none resize-none font-mono"
                    style={{ 
                      tabSize: 2,
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '14px',
                      lineHeight: '24px',
                      padding: '16px',
                      cursor: isViewer ? 'not-allowed' : 'text',
                      opacity: isViewer ? 0.7 : 1
                    }}
                    spellCheck={false}
                    readOnly={isViewer}
                    title={isViewer ? 'Read-only access' : ''}
                  />
                  
                  {/* Collaborative cursors overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {collaborativeCursors.map(cursor => {
                      const position = getCursorPosition(cursor.line, cursor.column);
                      return (
                        <div
                          key={cursor.user.user_id}
                          className="absolute w-0.5 h-6 animate-pulse"
                          style={{
                            backgroundColor: getRandomColor(cursor.user.user_id),
                            left: `${position.left}px`,
                            top: `${position.top}px`
                          }}
                        >
                          <div 
                            className="absolute -top-6 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                            style={{ backgroundColor: getRandomColor(cursor.user.user_id) }}
                          >
                            {cursor.user.user_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ResizablePanel>
            
            <ResizableHandle />
            
            <ResizablePanel defaultSize={40} minSize={20}>
              <ExecutionResults
                results={executionResults}
                isExecuting={isExecuting}
                onClearResults={clearResults}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full flex code-editor-container">
            {/* Line numbers */}
            <div className="w-12 bg-muted/50 border-r text-right text-sm text-muted-foreground select-none line-numbers font-mono" style={{ 
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              padding: '16px 8px',
              fontSize: '14px',
              lineHeight: '24px'
            }}>
              {code.split('\n').map((_, index) => (
                <div key={index} style={{ lineHeight: '24px', height: '24px' }}>
                  {index + 1}
                </div>
              ))}
            </div>

            {/* Code editor */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onSelect={handleCursorPositionChange}
                onKeyUp={handleCursorPositionChange}
                onKeyDown={handleKeyDown}
                className="absolute inset-0 w-full h-full bg-transparent border-none outline-none resize-none font-mono"
                style={{ 
                  tabSize: 2,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  lineHeight: '24px',
                  padding: '16px'
                }}
                spellCheck={false}
              />
              
              {/* Collaborative cursors overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {collaborativeCursors.map(cursor => {
                  const position = getCursorPosition(cursor.line, cursor.column);
                  return (
                    <div
                      key={cursor.user.user_id}
                      className="absolute w-0.5 h-6 animate-pulse"
                      style={{
                        backgroundColor: getRandomColor(cursor.user.user_id),
                        left: `${position.left}px`,
                        top: `${position.top}px`
                      }}
                    >
                      <div 
                        className="absolute -top-6 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                        style={{ backgroundColor: getRandomColor(cursor.user.user_id) }}
                      >
                        {cursor.user.user_name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}