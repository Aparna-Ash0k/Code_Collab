import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  X, 
  Maximize2, 
  Minimize2, 
  MessageCircle, 
  AlertTriangle, 
  FileText, 
  Play,
  Square,
  RotateCcw,
  Filter,
  Search,
  Settings,
  Monitor,
  Cpu,
  HardDrive,
  Wifi,
  Activity,
  Zap,
  Database,
  Cloud,
  GitBranch,
  Bug,
  Code
} from 'lucide-react';
import Chat from './Chat';
import ModernCodeRunner from './ModernCodeRunner';
import RealTerminal from './RealTerminal';
import '../styles/terminal-panel.css';

const BottomPanel = ({ 
  isOpen, 
  setIsOpen, 
  logs, 
  currentCode = '', 
  currentLanguage = 'javascript',
  onLanguageChange,
  socket,
  sessionId,
  isVerticalLayout = false,
  hideChat = false  // New prop to hide chat functionality
}) => {
  const [activeTab, setActiveTab] = useState('terminal'); // Default to terminal for better UX
  const [isMaximized, setIsMaximized] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([
    {
      timestamp: new Date().toLocaleTimeString(),
      message: 'Terminal ready. Type commands and press Enter.',
      type: 'info'
    }
  ]);

  // Handle case where chat tab is hidden but was active
  useEffect(() => {
    if (hideChat && activeTab === 'chat') {
      setActiveTab('terminal');
    }
  }, [hideChat, activeTab]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [problems, setProblems] = useState([
    {
      id: 1,
      type: 'warning',
      message: 'Unused variable: userName',
      file: 'src/App.js',
      line: 42,
      column: 10,
      timestamp: Date.now() - 30000
    },
    {
      id: 2,
      type: 'error',
      message: 'Cannot read property of undefined',
      file: 'src/utils/helper.js',
      line: 15,
      column: 20,
      timestamp: Date.now() - 60000
    }
  ]);
  const [outputLogs, setOutputLogs] = useState([
    { id: 1, type: 'log', message: 'Application started successfully', timestamp: Date.now() - 120000 },
    { id: 2, type: 'warn', message: 'Development server is running', timestamp: Date.now() - 90000 },
    { id: 3, type: 'info', message: 'Compiled successfully', timestamp: Date.now() - 60000 }
  ]);
  
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  const tabs = [
    { 
      id: 'terminal', 
      name: 'Terminal', 
      icon: Terminal, 
      badge: null,
      color: 'text-green-400'
    },
    { 
      id: 'runner', 
      name: 'Code Runner', 
      icon: Code, 
      badge: null,
      color: 'text-emerald-400'
    },
    { 
      id: 'output', 
      name: 'Output', 
      icon: FileText, 
      badge: outputLogs.length,
      color: 'text-blue-400'
    },
    { 
      id: 'problems', 
      name: 'Problems', 
      icon: AlertTriangle, 
      badge: problems.length,
      color: 'text-orange-400'
    },
    ...(hideChat ? [] : [{ 
      id: 'chat', 
      name: 'Chat', 
      icon: MessageCircle, 
      badge: null,
      color: 'text-purple-400'
    }]),
    {
      id: 'performance',
      name: 'Performance',
      icon: Activity,
      badge: null,
      color: 'text-pink-400'
    }
  ];

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current && activeTab === 'terminal') {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  // Focus terminal input when switching to terminal tab
  useEffect(() => {
    if (activeTab === 'terminal' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTab]);

  // Socket event handlers for terminal
  useEffect(() => {
    if (!socket) return;

    const handleTerminalOutput = (data) => {
      console.log('📥 Terminal output received:', data);
      const outputLog = {
        timestamp: new Date().toLocaleTimeString(),
        message: data.output,
        type: 'output'
      };
      
      setTerminalLogs(prev => [...prev, outputLog]);
    };

    const handleTerminalError = (data) => {
      console.log('❌ Terminal error received:', data);
      const errorLog = {
        timestamp: new Date().toLocaleTimeString(),
        message: `Error: ${data.error}`,
        type: 'error'
      };
      
      setTerminalLogs(prev => [...prev, errorLog]);
    };

    socket.on('terminal_output', handleTerminalOutput);
    socket.on('terminal_error', handleTerminalError);

    return () => {
      socket.off('terminal_output', handleTerminalOutput);
      socket.off('terminal_error', handleTerminalError);
    };
  }, [socket]);

  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    // Add to history
    setTerminalHistory(prev => [...prev, terminalInput]);
    setHistoryIndex(-1);

    // Add command to terminal logs
    const commandLog = {
      timestamp: new Date().toLocaleTimeString(),
      message: `$ ${terminalInput}`,
      type: 'command'
    };
    
    setTerminalLogs(prev => [...prev, commandLog]);

    console.log('🖥️ Terminal command submitted:', terminalInput);

    // Execute command via Socket.IO if available
    if (socket && socket.connected) {
      console.log('📡 Sending terminal command via socket to server');
      socket.emit('execute_terminal_command', {
        command: terminalInput.trim(),
        sessionId,
        directory: '~' // Default directory
      });
    } else {
      console.error('❌ No socket connection for terminal command');
      // Add error message to terminal display
      const errorResponse = {
        timestamp: new Date().toLocaleTimeString(),
        message: 'Error: No connection to server. Terminal commands require an active connection.',
        type: 'error'
      };
      setTerminalLogs(prev => [...prev, errorResponse]);
    }

    setTerminalInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < terminalHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setTerminalInput('');
      }
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const getProblemIcon = (type) => {
    switch (type) {
      case 'error': return <AlertTriangle size={14} className="text-text-error" />;
      case 'warning': return <AlertTriangle size={14} className="text-text-warning" />;
      case 'info': return <FileText size={14} className="text-text-accent" />;
      default: return <FileText size={14} className="text-text-tertiary" />;
    }
  };

  const getOutputIcon = (type) => {
    switch (type) {
      case 'error': return <X size={12} className="text-text-error" />;
      case 'warn': return <AlertTriangle size={12} className="text-text-warning" />;
      case 'info': return <FileText size={12} className="text-text-accent" />;
      default: return <Terminal size={12} className="text-text-tertiary" />;
    }
  };

  if (!isOpen && !isVerticalLayout) return null;

  const containerClasses = isVerticalLayout 
    ? "flex flex-col h-full bg-surface-primary"
    : `modern-bottom-panel bg-surface-primary border-t border-border-primary transition-all duration-300 ${
        isMaximized ? 'h-96' : 'h-60'
      }`;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'terminal':
        return (
          <RealTerminal 
            socket={socket} 
            sessionId={sessionId}
          />
        );

      case 'runner':
        return (
          <ModernCodeRunner
            code={currentCode}
            language={currentLanguage}
            onLanguageChange={onLanguageChange}
            socket={socket}
            sessionId={sessionId}
          />
        );

      case 'output':
        return (
          <div className="h-full flex flex-col">
            {/* Output Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-surface-secondary">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                <span className="text-sm font-medium text-text-primary">Output</span>
                <select 
                  className="input text-xs py-1 px-2"
                  onChange={(e) => {
                    // Filter output logs by type
                    const filterType = e.target.value;
                    if (filterType === 'All Outputs') {
                      // Show all logs - no filtering needed
                    } else if (filterType === 'Errors') {
                      // Could filter to show only error logs
                      console.log('Filter to errors only');
                    } else if (filterType === 'Warnings') {
                      // Could filter to show only warning logs
                      console.log('Filter to warnings only');
                    }
                  }}
                >
                  <option>All Outputs</option>
                  <option>Errors</option>
                  <option>Warnings</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  className="btn-ghost btn-sm p-1"
                  onClick={() => {
                    // Filter functionality for output logs
                    console.log('Filter output logs');
                  }}
                  title="Filter output"
                >
                  <Filter size={12} />
                </button>
                <button 
                  className="btn-ghost btn-sm p-1"
                  onClick={() => {
                    // Clear output logs
                    setOutputLogs([]);
                  }}
                  title="Clear output"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Output Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {outputLogs.length > 0 ? (
                <div className="space-y-2">
                  {outputLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-hover-primary transition-colors">
                      {getOutputIcon(log.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary">{log.message}</div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-text-secondary">
                  <FileText size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No output to show</p>
                  <p className="text-xs mt-1">Output will appear here when running code</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'problems':
        return (
          <div className="h-full flex flex-col">
            {/* Problems Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-surface-secondary">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-orange-400" />
                <span className="text-sm font-medium text-text-primary">Problems</span>
                <span className="text-xs text-text-tertiary">({problems.length})</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  className="btn-ghost btn-sm p-1"
                  onClick={() => {
                    // Filter problems by type
                    console.log('Filter problems');
                  }}
                  title="Filter problems"
                >
                  <Filter size={12} />
                </button>
                <button 
                  className="btn-ghost btn-sm p-1"
                  onClick={() => {
                    // Open settings for problems panel
                    console.log('Problems settings');
                  }}
                  title="Problem settings"
                >
                  <Settings size={12} />
                </button>
              </div>
            </div>

            {/* Problems Content */}
            <div className="flex-1 overflow-y-auto">
              {problems.length > 0 ? (
                <div className="divide-y divide-border-primary">
                  {problems.map((problem) => (
                    <div 
                      key={problem.id} 
                      className="p-4 hover:bg-hover-primary transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        {getProblemIcon(problem.type)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary font-medium">
                            {problem.message}
                          </div>
                          <div className="text-xs text-text-secondary mt-1 flex items-center gap-2">
                            <span>{problem.file}</span>
                            <span>·</span>
                            <span>Line {problem.line}, Column {problem.column}</span>
                            <span>·</span>
                            <span>{formatTimestamp(problem.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-text-success">
                  <div className="w-12 h-12 rounded-full bg-text-success bg-opacity-10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="font-medium">No problems detected</p>
                  <p className="text-xs mt-1 text-text-tertiary">Your code looks clean!</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'chat':
        return hideChat ? null : <Chat />;

      case 'performance':
        return (
          <div className="h-full flex flex-col">
            {/* Performance Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-surface-secondary">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-pink-400" />
                <span className="text-sm font-medium text-text-primary">Performance</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-ghost btn-sm p-1">
                  <Monitor size={12} />
                </button>
                <button className="btn-ghost btn-sm p-1">
                  <Settings size={12} />
                </button>
              </div>
            </div>

            {/* Performance Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-surface-secondary p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu size={14} className="text-blue-400" />
                    <span className="text-xs text-text-tertiary">CPU</span>
                  </div>
                  <div className="text-lg font-semibold text-text-primary">12%</div>
                </div>
                <div className="bg-surface-secondary p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive size={14} className="text-green-400" />
                    <span className="text-xs text-text-tertiary">Memory</span>
                  </div>
                  <div className="text-lg font-semibold text-text-primary">2.1GB</div>
                </div>
                <div className="bg-surface-secondary p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi size={14} className="text-yellow-400" />
                    <span className="text-xs text-text-tertiary">Network</span>
                  </div>
                  <div className="text-lg font-semibold text-text-primary">1.2MB/s</div>
                </div>
                <div className="bg-surface-secondary p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-purple-400" />
                    <span className="text-xs text-text-tertiary">Build Time</span>
                  </div>
                  <div className="text-lg font-semibold text-text-primary">2.3s</div>
                </div>
              </div>
              
              <div className="text-center text-text-tertiary">
                <Activity size={24} className="mx-auto mb-2 opacity-50" />
                <p>Performance monitoring</p>
                <p className="text-xs mt-1">Real-time system metrics</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`${containerClasses} modern-bottom-panel`}>
      {/* Enhanced Tab Bar */}
      <div className="modern-tab-bar flex items-center justify-between bg-surface-secondary border-b border-border-primary">
        <div className="flex">
          {tabs.map(({ id, name, icon: Icon, badge, color }) => (
            <button
              key={id}
              className={`modern-tab flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                activeTab === id
                  ? 'active-tab text-text-primary bg-surface-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-hover-primary'
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} className={`${activeTab === id ? color : 'text-text-tertiary'} transition-colors`} />
              <span className="tab-name">{name}</span>
              {badge !== null && badge > 0 && (
                <span className="tab-badge bg-text-error text-white text-xs rounded-full px-2 py-0.5 min-w-5 text-center leading-none font-semibold">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {activeTab === id && (
                <div className="tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
              )}
            </button>
          ))}
        </div>
        
        <div className="panel-controls flex items-center gap-2 px-3">
          <button 
            className="panel-control-btn"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore panel' : 'Maximize panel'}
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {!isVerticalLayout && (
            <button 
              className="panel-control-btn"
              onClick={() => setIsOpen(false)}
              title="Close panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default BottomPanel;
