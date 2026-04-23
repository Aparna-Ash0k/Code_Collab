import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  Maximize2,
  Copy,
  Download,
  Upload
} from 'lucide-react';

const RealTerminal = ({ socket, sessionId }) => {
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState('~/workspace');
  const [terminalTheme, setTerminalTheme] = useState('dark');
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (socket) {
      socket.on('terminal_output', (data) => {
        setCommandHistory(prev => [...prev, {
          id: Date.now(),
          type: 'output',
          content: data.output,
          timestamp: new Date().toLocaleTimeString(),
          directory: data.directory || currentDirectory
        }]);
      });

      socket.on('terminal_error', (data) => {
        setCommandHistory(prev => [...prev, {
          id: Date.now(),
          type: 'error',
          content: data.error,
          timestamp: new Date().toLocaleTimeString(),
          directory: currentDirectory
        }]);
      });

      socket.on('directory_changed', (data) => {
        setCurrentDirectory(data.directory);
      });

      setIsConnected(true);

      return () => {
        socket.off('terminal_output');
        socket.off('terminal_error');
        socket.off('directory_changed');
      };
    }
  }, [socket, currentDirectory]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandHistory]);

  const executeCommand = (command) => {
    if (!command.trim()) return;

    // Add command to history
    setCommandHistory(prev => [...prev, {
      id: Date.now(),
      type: 'command',
      content: command,
      timestamp: new Date().toLocaleTimeString(),
      directory: currentDirectory
    }]);

    // Send command to backend for execution
    if (socket) {
      socket.emit('execute_terminal_command', {
        command: command.trim(),
        sessionId,
        directory: currentDirectory
      });
    }

    setCurrentCommand('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(currentCommand);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Auto-complete functionality
      handleAutoComplete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Command history navigation
      handleHistoryNavigation('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleHistoryNavigation('down');
    }
  };

  const handleAutoComplete = () => {
    const commonCommands = ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'find', 'ps', 'kill', 'top', 'df', 'free'];
    const currentInput = currentCommand.toLowerCase();
    const matches = commonCommands.filter(cmd => cmd.startsWith(currentInput));
    
    if (matches.length === 1) {
      setCurrentCommand(matches[0] + ' ');
    } else if (matches.length > 1) {
      setCommandHistory(prev => [...prev, {
        id: Date.now(),
        type: 'info',
        content: `Available commands: ${matches.join(', ')}`,
        timestamp: new Date().toLocaleTimeString(),
        directory: currentDirectory
      }]);
    }
  };

  const handleHistoryNavigation = (direction) => {
    const commands = commandHistory.filter(item => item.type === 'command');
    if (commands.length === 0) return;

    // Simple implementation - can be enhanced with proper navigation
    if (direction === 'up' && commands.length > 0) {
      setCurrentCommand(commands[commands.length - 1].content);
    }
  };

  const clearTerminal = () => {
    setCommandHistory([]);
  };

  const copyOutput = () => {
    const output = commandHistory.map(item => 
      `[${item.timestamp}] ${item.directory}$ ${item.content}`
    ).join('\n');
    navigator.clipboard.writeText(output);
  };

  const renderHistoryItem = (item) => {
    const baseClasses = "flex items-start gap-3 text-sm font-mono";
    
    switch (item.type) {
      case 'command':
        return (
          <div key={item.id} className={`${baseClasses} text-green-400`}>
            <span className="text-blue-400 shrink-0">{item.directory}$</span>
            <span>{item.content}</span>
          </div>
        );
      case 'output':
        return (
          <div key={item.id} className={`${baseClasses} text-gray-300 ml-6`}>
            <pre className="whitespace-pre-wrap">{item.content}</pre>
          </div>
        );
      case 'error':
        return (
          <div key={item.id} className={`${baseClasses} text-red-400 ml-6`}>
            <pre className="whitespace-pre-wrap">{item.content}</pre>
          </div>
        );
      case 'info':
        return (
          <div key={item.id} className={`${baseClasses} text-yellow-400 ml-6`}>
            <span>{item.content}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-green-400" />
          <span className="text-sm font-medium">Terminal</span>
          <span className="text-xs text-gray-400">{currentDirectory}</span>
          {isConnected && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={clearTerminal}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Clear Terminal"
          >
            <RotateCcw size={12} />
          </button>
          <button 
            onClick={copyOutput}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Copy Output"
          >
            <Copy size={12} />
          </button>
          <button className="p-1 hover:bg-gray-700 rounded transition-colors">
            <Settings size={12} />
          </button>
          <button className="p-1 hover:bg-gray-700 rounded transition-colors">
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {commandHistory.length === 0 ? (
          <div className="text-gray-500 text-sm">
            <p>Welcome to CodeCollab Terminal</p>
            <p>Type commands to execute them on the server.</p>
            <p>Use Tab for auto-completion, ↑/↓ for command history.</p>
          </div>
        ) : (
          commandHistory.map(renderHistoryItem)
        )}
        
        {/* Current Input Line */}
        <div className="flex items-center gap-3 text-sm font-mono text-green-400">
          <span className="text-blue-400 shrink-0">{currentDirectory}$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 bg-transparent border-none outline-none text-green-400"
            placeholder="Enter command..."
            autoFocus
          />
          <span className="text-green-400 animate-pulse">|</span>
        </div>
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-2 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>Commands: {commandHistory.filter(item => item.type === 'command').length}</span>
            <span>Theme: {terminalTheme}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Press Tab for completion</span>
            <span>•</span>
            <span>↑/↓ for history</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTerminal;
