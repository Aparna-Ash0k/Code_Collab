import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { getServerUrl } from '../utils/serverConfig';
import { FileSystemProvider, useFileSystem } from '../contexts/FileSystemContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import FigmaHeader from './FigmaHeader';
import FigmaFileExplorer from './FigmaFileExplorer';
import FigmaTabBar from './FigmaTabBar';
import FigmaChatPanel from './FigmaChatPanel';
import SimpleEditor from './SimpleEditor';
import AuthModal from './AuthModal';
import '../styles/vscode-theme.css';

function FigmaAppContent() {
  const socketRef = useRef(null);
  const isTyping = useRef(false);

  // Authentication context
  const { user, isAuthenticated, isLoading } = useAuth();

  // File system context
  const { 
    tabs, 
    activeTab, 
    getCurrentTab, 
    updateTabContent, 
    closeTab, 
    setActiveTab, 
    openNewTab,
    saveFile
  } = useFileSystem();

  // UI state
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([
    { id: 1, name: 'Sarah Chen', status: 'Editing' },
    { id: 2, name: 'Mike Johnson', status: 'Viewing' }
  ]);
  const [chatMessages, setChatMessages] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [currentFile, setCurrentFile] = useState('src/App.tsx');

  // Sample tabs data to match the Figma design
  const [figmaTabs, setFigmaTabs] = useState([
    { 
      id: 'app', 
      fileName: 'App.tsx', 
      isDirty: false, 
      user: { name: 'Sarah Chen', index: 0 },
      content: `import React from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

export default function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar isOpen={isOpen} onToggle={setIsOpen} />
        <main className="flex-1 p-6">
          <h1>Welcome to the collaborative editor!</h1>
          <p>Start coding together in real-time.</p>
        </main>
      </div>
    </div>
  );
}`
    },
    { 
      id: 'button', 
      fileName: 'Button.tsx', 
      isDirty: true, 
      user: { name: 'Mike Johnson', index: 1 },
      content: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false
}) => {
  const handleClick = () => {
    console.log('Button clicked!');
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={\`px-4 py-2 rounded-lg font-medium transition-colors
        \${variant === 'primary' 
          ? 'bg-blue-500 text-white hover:bg-blue-600' 
          : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
        }
        \${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      \`}
    >
      {children}
    </button>
  );
};`
    }
  ]);

  const [activeFigmaTab, setActiveFigmaTab] = useState('app');

  // Socket connection
  useEffect(() => {
    let socket;
    
    const connectSocket = () => {
      if (!isAuthenticated || !user?.token) {
        setIsConnected(false);
        return;
      }

      try {
        socket = io(getServerUrl(), {
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionAttempts: 3,
          transports: ['polling', 'websocket'],
          upgrade: true,
          auth: {
            token: user.token
          }
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('✅ Connected to socket server');
          setIsConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('❌ Disconnected from socket server');
          setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
          console.warn('⚠️ Connection failed:', error.message);
          setIsConnected(false);
        });

        socket.on('code_update', (data) => {
          if (!isTyping.current) {
            const newCode = typeof data === 'string' ? data : data.code;
            // Update the active tab content
            setFigmaTabs(prevTabs => 
              prevTabs.map(tab => 
                tab.id === activeFigmaTab 
                  ? { ...tab, content: newCode }
                  : tab
              )
            );
          }
        });

        socket.on('chat_message', (message) => {
          setChatMessages(prev => [...prev, message]);
        });

      } catch (error) {
        console.warn('⚠️ Could not connect to server:', error);
        setIsConnected(false);
      }
    };

    if (isAuthenticated && user?.token) {
      fetch(`${getServerUrl()}/health`)
        .then(() => connectSocket())
        .catch(() => {
          console.warn('⚠️ Server not running - working offline');
          setIsConnected(false);
        });
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated, user, activeFigmaTab]);

  const handleCodeChange = (newCode) => {
    setFigmaTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === activeFigmaTab 
          ? { ...tab, content: newCode, isDirty: true }
          : tab
      )
    );

    isTyping.current = true;

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('code_change', newCode);
    }
    
    setTimeout(() => {
      isTyping.current = false;
    }, 100);
  };

  const handleFileSelect = (file) => {
    setCurrentFile(file.path);
    // If it's not already a tab, create one
    const existingTab = figmaTabs.find(tab => tab.fileName === file.name);
    if (!existingTab) {
      const newTab = {
        id: file.path,
        fileName: file.name,
        isDirty: false,
        user: null,
        content: `// ${file.name}\n// Start editing...`
      };
      setFigmaTabs(prev => [...prev, newTab]);
    }
    setActiveFigmaTab(existingTab?.id || file.path);
  };

  const handleTabClose = (tabId) => {
    setFigmaTabs(prev => prev.filter(tab => tab.id !== tabId));
    if (activeFigmaTab === tabId) {
      const remainingTabs = figmaTabs.filter(tab => tab.id !== tabId);
      setActiveFigmaTab(remainingTabs[0]?.id || '');
    }
  };

  const handleSendMessage = (message) => {
    const newMessage = {
      id: Date.now(),
      author: user?.name || 'You',
      authorIndex: 2,
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: true
    };

    setChatMessages(prev => [...prev, newMessage]);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat_message', newMessage);
    }
  };

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleSettings = () => {
    console.log('Settings clicked');
  };

  const getCurrentTabContent = () => {
    const currentTab = figmaTabs.find(tab => tab.id === activeFigmaTab);
    return currentTab?.content || '';
  };

  return (
    <div className="figma-app">
      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />

      {/* Header */}
      <FigmaHeader
        projectName="My Awesome Project"
        isConnected={isConnected}
        collaborators={collaborators}
        user={user}
        isAuthenticated={isAuthenticated}
        onLogin={handleLogin}
        onSettings={handleSettings}
      />

      {/* Main Content */}
      <div className="figma-main">
        {/* File Explorer Sidebar */}
        <FigmaFileExplorer
          onFileSelect={handleFileSelect}
          currentFile={currentFile}
        />

        {/* Editor Area */}
        <div className="figma-editor-area">
          {/* Tab Bar */}
          <FigmaTabBar
            tabs={figmaTabs}
            activeTab={activeFigmaTab}
            onTabSelect={setActiveFigmaTab}
            onTabClose={handleTabClose}
            collaborators={collaborators}
          />

          {/* Editor Content */}
          <div className="figma-editor-content">
            <div className="figma-editor">
              <SimpleEditor
                code={getCurrentTabContent()}
                onChange={handleCodeChange}
                language="typescript"
                theme="light"
                fontSize={14}
              />
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <FigmaChatPanel
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          currentUser={user}
          collaborators={collaborators}
          isConnected={isConnected}
        />
      </div>
    </div>
  );
}

// Main Figma App component - standalone
function FigmaApp() {
  return (
    <AuthProvider>
      <FileSystemProvider>
        <FigmaAppContent />
      </FileSystemProvider>
    </AuthProvider>
  );
}

export default FigmaApp;
