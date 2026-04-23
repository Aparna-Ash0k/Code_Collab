import React from 'react';
import { Terminal, X, Maximize2, Minimize2, MessageCircle, AlertTriangle, FileText } from 'lucide-react';
import Chat from './Chat';

const BottomPanel = ({ isOpen, setIsOpen, logs }) => {
  const [activeTab, setActiveTab] = React.useState('terminal');
  const [isMaximized, setIsMaximized] = React.useState(false);

  if (!isOpen) return null;

  const tabs = [
    { id: 'terminal', name: 'Terminal', icon: Terminal, badge: null },
    { id: 'output', name: 'Output', icon: FileText, badge: null },
    { id: 'problems', name: 'Problems', icon: AlertTriangle, badge: 0 },
    { id: 'chat', name: 'Chat', icon: MessageCircle, badge: null }
  ];

  return (
    <div className={`bg-vscode-panel border-t border-vscode-border transition-all duration-200 ${isMaximized ? 'h-96' : 'h-48'}`}>
      {/* Tab Bar */}
      <div className="flex items-center justify-between bg-vscode-sidebar border-b border-vscode-border h-10">
        <div className="flex">
          {tabs.map(({ id, name, icon: Icon, badge }) => (
            <button
              key={id}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium
                border-b-2 transition-all hover:bg-vscode-hover relative
                ${activeTab === id
                  ? 'border-vscode-accent text-vscode-text bg-vscode-panel'
                  : 'border-transparent text-vscode-text-secondary hover:text-vscode-text'
                }
              `}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              {name}
              {badge !== null && badge > 0 && (
                <span className="bg-vscode-error text-white text-xs rounded-full px-1.5 py-0.5 min-w-4 text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-1 px-2">
          <button 
            className="p-1.5 hover:bg-vscode-hover text-vscode-text-secondary hover:text-vscode-text transition-all rounded"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore Panel Size" : "Maximize Panel Size"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button 
            className="p-1.5 hover:bg-vscode-hover text-vscode-text-secondary hover:text-vscode-text transition-all rounded"
            onClick={() => setIsOpen(false)}
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="h-full overflow-y-auto bg-vscode-bg">
        {activeTab === 'terminal' && (
          <div className="p-4 font-mono text-sm text-vscode-text space-y-2">
            <div className="text-vscode-text-muted text-xs mb-4 pb-2 border-b border-vscode-border flex items-center gap-2">
              <Terminal size={12} />
              Terminal - CodeCollab Project
            </div>
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="flex items-start gap-3 py-1">
                  <span className="text-vscode-text-muted text-xs shrink-0 opacity-60">
                    [{log.timestamp}]
                  </span> 
                  <span className="text-vscode-text leading-relaxed">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-vscode-text-muted text-center py-8">
                No terminal output yet
              </div>
            )}
            <div className="flex items-center gap-2 mt-6 pt-2">
              <span className="text-vscode-accent font-semibold">$</span>
              <span className="text-vscode-text animate-pulse">_</span>
            </div>
          </div>
        )}
        
        {activeTab === 'output' && (
          <div className="p-4 font-mono text-sm">
            <div className="text-vscode-text-muted text-center py-12 flex flex-col items-center gap-2">
              <FileText size={24} className="opacity-50" />
              <span>No output to show</span>
              <span className="text-xs">Output will appear here when running code</span>
            </div>
          </div>
        )}
        
        {activeTab === 'problems' && (
          <div className="p-4 font-mono text-sm">
            <div className="text-vscode-success text-center py-12 flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-vscode-success bg-opacity-10 flex items-center justify-center">
                <span className="text-lg">✓</span>
              </div>
              <span className="font-medium">No problems detected</span>
              <span className="text-xs text-vscode-text-muted">Your code looks clean!</span>
            </div>
          </div>
        )}
        
        {activeTab === 'chat' && (
          <div className="h-full">
            <Chat isInBottomPanel={true} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
