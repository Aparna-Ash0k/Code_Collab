import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { ProjectSystemProvider } from './contexts/ProjectSystemContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { CollaborationProvider } from './contexts/CollaborationContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { SharedStateProvider } from './contexts/SharedStateManager';
import { FileSystemProvider } from './contexts/FileSystemContext';
import { useContext } from 'react';
import { ProjectSystemContext } from './contexts/ProjectSystemContext';
import { getFileSystemManager, initializeFileSystemManager } from './services/FileSystemManager';
import { yjsCollaborationProvider } from './services/YjsCollaborationProvider';
import './styles/editor-fixes.css';
import './styles/header-override.css';
// Testing with more complete interface
// import GuestBanner from './components/GuestBanner';
import AuthModal from './components/AuthModal';
import SessionModal from './components/SessionModal';
import SettingsModal from './components/SettingsModal';
import ProfileModal from './components/ProfileModal';
import TeamManagementModal from './components/TeamManagementModal';
import FigmaHeader from './components/FigmaHeader';
import SimpleEditor from './components/SimpleEditor';
import FigmaFileExplorer from './components/FigmaFileExplorer';
import FigmaTabBar from './components/FigmaTabBar';
import ModernBottomPanel from './components/ModernBottomPanel';
import RoomButton from './components/RoomButton';
import { Terminal } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './styles/vscode-theme.css';
import './styles/ui-fixes.css';
import './styles/collaboration-features.css';
import './styles/collaboration-enhancements.css';



function AppContent() {
  const socketRef = useRef(null);
  const isTyping = useRef(false);

  // Authentication context
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  
  // Session context
  const { session, socket } = useSession();

  // Project system context
  const { 
    tabs, 
    activeTab, 
    getCurrentTab, 
    updateTabContent, 
    closeTab, 
    setActiveTab, 
    openNewTab,
    saveFile,
    createFile,
    getDirtyTabs,
    currentProject
  } = useContext(ProjectSystemContext);

  // UI state - enhanced with Figma design
  const [theme, setTheme] = useState('dark'); // Default to dark theme
  const [collaborators, setCollaborators] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentLanguage, setCurrentLanguage] = useState('javascript');
  const [rightPanelOpen, setRightPanelOpen] = useState(true); // New state for right panel
  const [activeRightPanel, setActiveRightPanel] = useState('cursors'); // 'cursors' or 'chat'
  const [logs, setLogs] = useState([
    { timestamp: new Date().toLocaleTimeString(), message: 'CodeCollab initialized' }
  ]);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentFile, setCurrentFile] = useState('src/App.tsx');

  // Split screen state
  const [splitScreenMode, setSplitScreenMode] = useState(false);

  // Project state
  const [selectedProject, setSelectedProject] = useState(null);
  
  // FileSystemManager state for real-time collaboration
  const [fileSystemManager, setFileSystemManager] = useState(null);
  const [fsManagerStatus, setFsManagerStatus] = useState('Initializing...');
  const [realTimeEvents, setRealTimeEvents] = useState([]);

  // Y.js Collaboration state
  const [yjsProvider, setYjsProvider] = useState(null);
  const [yjsStatus, setYjsStatus] = useState('Initializing Y.js...');
  const [collaborativeFiles, setCollaborativeFiles] = useState([]);
  const [activeCursors, setActiveCursors] = useState([]);

  // Authentication modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  
  // Session management state - Don't automatically show session manager
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState('join');
  
  // Team management modal state
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  
  // New modern modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRecentFilesModal, setShowRecentFilesModal] = useState(false);
  
  // Project sharing modal state
  const [showProjectSharingModal, setShowProjectSharingModal] = useState(false);
  
  // Editor settings state
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('codecollab-fontSize');
    return saved ? parseInt(saved, 10) : 14;
  });

  // Initialize theme on component mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initialize Y.js Collaboration Provider
  useEffect(() => {
    const initializeYjsCollaboration = async () => {
      try {
        console.log('🔧 Initializing Y.js Collaboration Provider...');
        setYjsStatus('Initializing Y.js Collaboration...');

        // Initialize Y.js provider
        const token = user?.token || localStorage.getItem('codecollab-token');
        
        if (session?.id) {
          await yjsCollaborationProvider.initialize(user, token, session.id);
          
          // Set up event listeners
          const removeListener = yjsCollaborationProvider.addEventListener((event) => {
            const { event: eventType, data } = event;
            
            switch (eventType) {
              case 'socket_connected':
                setYjsStatus('✅ Y.js collaboration connected!');
                console.log('🎯 Y.js collaboration socket connected');
                break;
                
              case 'socket_disconnected':
                setYjsStatus('⚠️ Y.js collaboration disconnected');
                console.log('⚠️ Y.js collaboration socket disconnected:', data.reason);
                break;
                
              case 'initial_sync_complete':
                setYjsStatus('✅ Y.js sync complete - Ready for collaboration!');
                console.log('🔄 Y.js initial sync complete');
                break;
                
              case 'files_changed':
                setCollaborativeFiles(data);
                console.log('📁 Y.js files updated:', data.length);
                break;
                
              case 'cursors_changed':
                setActiveCursors(data);
                console.log('👆 Active cursors updated:', data.length);
                break;
                
              case 'file_content_changed':
                console.log('📝 Y.js file content changed:', data.path);
                setRealTimeEvents(prev => [...prev, {
                  timestamp: new Date().toLocaleTimeString(),
                  type: 'yjs',
                  message: `Y.js content updated: ${data.path} (${data.length} chars)`,
                  data: data
                }]);
                break;
                
              case 'collaboration_error':
                console.error('❌ Y.js collaboration error:', data.error);
                setYjsStatus(`❌ Y.js error: ${data.error}`);
                break;
                
              default:
                console.log('Y.js event:', eventType, data);
            }
          });

          setYjsProvider(yjsCollaborationProvider);
          
          // Cleanup function
          return () => {
            removeListener();
          };
          
        } else {
          setYjsStatus('⏳ Waiting for session...');
        }

      } catch (error) {
        console.error('❌ Y.js Collaboration Provider initialization failed:', error);
        setYjsStatus(`❌ Failed to initialize Y.js: ${error.message}`);
      }
    };

    // Only initialize if we have user context and session
    if (user && session?.id) {
      initializeYjsCollaboration();
    } else if (!session?.id) {
      setYjsStatus('⏳ Not in a collaboration session');
    }
  }, [user, session]);

  // Initialize FileSystemManager for real-time collaboration
  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        console.log('🎯 Initializing FileSystemManager...');
        setFsManagerStatus('Initializing FileSystemManager...');

        // Get the FileSystemManager instance
        const fsManager = getFileSystemManager();
        
        // Setup context for the FileSystemManager
        const adapterContext = {
          user,
          session,
          socket,
          firebase: null, // Will be initialized by FirebaseAdapter
        };

        console.log('🔄 Setting up FileSystemManager with context:', adapterContext);
        
        // Initialize the FileSystemManager
        await initializeFileSystemManager(adapterContext);
        
        // Set up real-time event listeners
        fsManager.on('operation_completed', (data) => {
          console.log('✅ FileSystemManager operation completed:', data);
          setRealTimeEvents(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            type: 'success',
            message: `${data.operation.type} operation completed: ${data.operation.path}`,
            data: data
          }]);
        });

        fsManager.on('remote-operation', (operation) => {
          console.log('📡 Received remote operation:', operation);
          setRealTimeEvents(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            type: 'remote',
            message: `Remote ${operation.type} from ${operation.metadata?.userName || 'Unknown'}: ${operation.path}`,
            data: operation
          }]);
        });

        fsManager.on('error', (error) => {
          console.error('❌ FileSystemManager error:', error);
          setRealTimeEvents(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            message: `Error: ${error.message}`,
            data: error
          }]);
        });

        setFileSystemManager(fsManager);
        setFsManagerStatus('✅ FileSystemManager ready for real-time collaboration!');
        
        console.log('🎯 FileSystemManager integration complete');

      } catch (error) {
        console.error('❌ FileSystemManager initialization failed:', error);
        setFsManagerStatus(`❌ Failed to initialize: ${error.message}`);
      }
    };

    // Only initialize if we have user context and socket
    if (user || socket) {
      initializeFileSystem();
    }
  }, [user, session, socket]);

  // Socket connection - use session socket if available
  useEffect(() => {
    if (socket) {
      socketRef.current = socket;
      setIsConnected(socket.connected);

      // Listen for session-specific events
      socket.on('connect', () => {
        console.log('✅ Connected to session');
        setIsConnected(true);
        
        const connectionLog = {
          timestamp: new Date().toLocaleTimeString(),
          message: session ? `Connected to session "${session.name}"` : 'Connected to CodeCollab'
        };
        setLogs(prev => [...prev, connectionLog]);
      });

      socket.on('disconnect', () => {
        console.log('❌ Disconnected from session');
        setIsConnected(false);
      });

      // Handle real-time code updates
      socket.on('realtime_code_update', (data) => {
        if (!isTyping.current && activeTab && data.sessionId === session?.id) {
          console.log('📝 Received real-time code update from', data.userName);
          updateTabContent(activeTab, data.content, false); // Don't broadcast back
          
          const updateLog = {
            timestamp: new Date().toLocaleTimeString(),
            message: `Code updated by ${data.userName}`
          };
          setLogs(prev => [...prev, updateLog]);
        }
      });

      // Handle session-based code updates (legacy support)
      socket.on('session_code_update', (data) => {
        if (!isTyping.current && activeTab && data.sessionId === session?.id) {
          updateTabContent(activeTab, data.code, false);
          
          if (data.updatedBy) {
            const updateLog = {
              timestamp: new Date().toLocaleTimeString(),
              message: `Code updated by ${data.updatedBy.userName}`
            };
            setLogs(prev => [...prev, updateLog]);
          }
        }
      });

      // Handle session joined event to initialize Y.js collaboration
      socket.on('session_joined', (data) => {
        console.log('🏠 Session joined event received:', data.session?.id);
        
        if (yjsProvider && data.session?.id) {
          const token = user?.token || localStorage.getItem('codecollab-token');
          yjsProvider.initialize(user, token, data.session.id)
            .then(() => {
              console.log('🎯 Y.js collaboration initialized via session_joined event');
              setYjsStatus('✅ Y.js collaboration active!');
            })
            .catch((error) => {
              console.error('❌ Failed to initialize Y.js via session_joined:', error);
            });
        }
      });

      socket.on('chat_message', (message) => {
        if (message.sessionId === session?.id) {
          // Mark received messages as not current user and convert server format to client format
          const clientMessage = {
            id: message.id,
            author: message.userName,
            authorIndex: Math.abs(message.userName.charCodeAt(0)) % 6, // Generate consistent color index
            content: message.content,
            timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isCurrentUser: message.userId === user?.uid,
            sessionId: message.sessionId
          };
          // Check for duplicates before adding
          setChatMessages(prev => {
            const exists = prev.find(msg => msg.id === clientMessage.id);
            if (exists) {
              return prev; // Don't add duplicate
            }
            return [...prev, clientMessage];
          });
        }
      });

      // Handle session collaborator events
      socket.on('session_user_joined', (data) => {
        if (data.sessionId === session?.id) {
          const joinLog = {
            timestamp: new Date().toLocaleTimeString(),
            message: `${data.user.userName} joined the session`
          };
          setLogs(prev => [...prev, joinLog]);
          
          setCollaborators(prev => {
            const exists = prev.find(c => c.id === data.user.id);
            if (!exists) {
              return [...prev, { 
                id: data.user.id, 
                name: data.user.userName, 
                status: 'Viewing',
                sessionRole: data.user.role || 'member'
              }];
            }
            return prev;
          });
        }
      });

      socket.on('session_user_left', (data) => {
        if (data.sessionId === session?.id) {
          const leaveLog = {
            timestamp: new Date().toLocaleTimeString(),
            message: `${data.user.userName} left the session`
          };
          setLogs(prev => [...prev, leaveLog]);
          
          setCollaborators(prev => prev.filter(c => c.id !== data.user.id));
        }
      });

      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('realtime_code_update');
        socket.off('session_code_update');
        socket.off('chat_message');
        socket.off('session_user_joined');
        socket.off('session_user_left');
      };
    } else {
      setIsConnected(false);
      socketRef.current = null;
    }
  }, [socket, session, activeTab, updateTabContent]);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCodeChange = async (newCode) => {
    if (activeTab) {
      const currentTab = getCurrentTab();
      
      // Update via existing ProjectSystem
      updateTabContent(activeTab, newCode); // This will handle broadcasting via FileSystemContext
      
      // Also update via Y.js Collaboration Provider for real-time sync
      if (yjsProvider && session && currentTab && currentTab.fileName) {
        try {
          // Update Y.js collaborative document
          yjsProvider.setFileContent(currentTab.fileName, newCode);
          console.log('📝 Content updated via Y.js:', currentTab.fileName);
        } catch (error) {
          console.warn('Y.js content update failed:', error);
        }
      }
      
      // Also update via FileSystemManager for enhanced real-time sync
      if (fileSystemManager && session && currentTab && currentTab.fileName) {
        try {
          await handleUpdateFileWithRealtime(currentTab.fileName, newCode);
        } catch (error) {
          console.warn('FileSystemManager update failed:', error);
        }
      }
    }

    isTyping.current = true;
    
    setTimeout(() => {
      isTyping.current = false;
    }, 100);
  };

  const handleFileSelect = (file) => {
    setCurrentFile(file.path);
    // Open the file in a new tab if it doesn't exist
    const existingTab = tabs.find(tab => tab.fileName === file.name);
    if (!existingTab) {
      openNewTab(file.name, `// ${file.name}\n// Start editing...`, file.path);
    } else {
      setActiveTab(existingTab.id);
    }
  };

  const handleSendMessage = (message) => {
    // Send session-based chat messages
    if (socketRef.current && socketRef.current.connected && session) {
      socketRef.current.emit('chat_message', {
        content: message,
        type: 'text'
      });
    }
  };

  const handleLanguageChange = (language) => {
    setCurrentLanguage(language);
    // Update current tab language if needed
    if (activeTab) {
      const currentTab = getCurrentTab();
      if (currentTab) {
        // Could update tab metadata with language info
      }
    }
    console.log('Language changed to:', language);
  };

  // Right panel handlers
  const toggleRightPanel = () => {
    setRightPanelOpen(!rightPanelOpen);
  };

  const switchRightPanel = (panelType) => {
    setActiveRightPanel(panelType);
    if (!rightPanelOpen) {
      setRightPanelOpen(true);
    }
  };

  const handleSaveFile = () => {
    const currentTab = getCurrentTab();
    if (currentTab) {
      if (currentTab.filePath) {
        // File already has a path, just save it
        saveFile(currentTab.id);
      } else {
        // For untitled files, just save with a default name
        console.log('Saving untitled file as default name');
        // Could implement auto-naming or simplified save logic here
      }
    }
  };

  // Enhanced file operations with FileSystemManager integration
  const handleCreateFileWithRealtime = async (fileName, content = '') => {
    try {
      // Use existing ProjectSystem createFile
      const newTab = await createFile(fileName, content);
      
      // Also create through FileSystemManager for real-time sync
      if (fileSystemManager && session) {
        console.log('📄 Creating file via FileSystemManager:', fileName);
        await fileSystemManager.processOperation({
          type: 'create',
          path: fileName,
          payload: {
            name: fileName,
            content: content
          },
          origin: 'user'
        });
      }
      
      return newTab;
    } catch (error) {
      console.error('Failed to create file with real-time sync:', error);
      throw error;
    }
  };

  const handleUpdateFileWithRealtime = async (filePath, content) => {
    try {
      // Update through existing ProjectSystem
      const tab = tabs.find(t => t.filePath === filePath);
      if (tab) {
        updateTabContent(tab.id, content);
      }
      
      // Also update through FileSystemManager for real-time sync
      if (fileSystemManager && session) {
        console.log('📝 Updating file via FileSystemManager:', filePath);
        await fileSystemManager.processOperation({
          type: 'update',
          path: filePath,
          payload: {
            content: content
          },
          origin: 'user'
        });
      }
    } catch (error) {
      console.error('Failed to update file with real-time sync:', error);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleFontSizeChange = (newSize) => {
    setFontSize(newSize);
    localStorage.setItem('codecollab-fontSize', newSize.toString());
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  const handleProfile = () => {
    setShowProfileModal(true);
  };

  const handleTeamManagement = () => {
    setShowTeamManagement(true);
  };

  // Authentication handlers
  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleRegister = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Clear session-related state but don't show session manager
      setChatMessages([]);
      setCollaborators([]);
      setLogs([
        { timestamp: new Date().toLocaleTimeString(), message: 'Logged out successfully' }
      ]);
      // Keep the VS Code interface available
      setShowSessionModal(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };

  const handleSessionJoined = (joinedSession) => {
    setShowSessionModal(false);
    // Clear previous session data
    setChatMessages([]);
    setCollaborators([]);
    setLogs([
      { timestamp: new Date().toLocaleTimeString(), message: `Joined session "${joinedSession.name}"` }
    ]);
    
    // Initialize Y.js collaboration for the new session
    if (yjsProvider && joinedSession.id) {
      yjsProvider.initialize(user, user?.token || localStorage.getItem('codecollab-token'), joinedSession.id)
        .then(() => {
          console.log('🎯 Y.js collaboration initialized for new session:', joinedSession.id);
          setYjsStatus('✅ Y.js collaboration ready for new session!');
        })
        .catch((error) => {
          console.error('❌ Failed to initialize Y.js for new session:', error);
          setYjsStatus(`❌ Y.js initialization failed: ${error.message}`);
        });
    }
  };

  const handleShowSessionManager = () => {
    if (session) {
      // If already in a session, show invite modal
      setSessionModalMode('invite');
    } else {
      // If not in a session, show session manager
      setSessionModalMode('sessions');
    }
    setShowSessionModal(true);
  };

  const handleJoinSession = () => {
    setSessionModalMode('join');
    setShowSessionModal(true);
  };

  const handleProjectSharing = () => {
    setShowProjectSharingModal(true);
  };

  const handleCloseSessionModal = () => {
    setShowSessionModal(false);
  };

  // Enhanced tab data with user indicators for Figma design
  const enhancedTabs = tabs.map((tab, index) => ({
    ...tab,
    user: index < collaborators.length ? { 
      name: collaborators[index].name, 
      index: index 
    } : null,
    isDirty: getDirtyTabs().includes(tab.id)
  }));

  const renderSidebarContent = () => {
    // This function is now replaced by the integrated FigmaFileExplorer
    return null;
  };

  const currentTab = getCurrentTab();
  const dirtyTabs = getDirtyTabs();

  // Keyboard shortcuts - must be declared before any conditional returns
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S or Cmd+S - Save file
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
      
      // Ctrl+N or Cmd+N - New file
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openNewTab();
      }
      
      // Ctrl+W or Cmd+W - Close tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTab && tabs.length > 1) {
          closeTab(activeTab);
        }
      }
      
      // Ctrl+\ or Cmd+\ - Toggle split screen
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        if (tabs.length >= 2) {
          setSplitScreenMode(!splitScreenMode);
        }
      }
      
      // Ctrl+Shift+N or Cmd+Shift+N - Create test file with FileSystemManager
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        if (fileSystemManager && session) {
          const fileName = `test-${Date.now()}.js`;
          const content = `// Test file created with FileSystemManager\n// Session: ${session.name || session.id}\n// Time: ${new Date().toLocaleString()}\n\nconsole.log("Hello from real-time collaboration!");`;
          handleCreateFileWithRealtime(fileName, content).catch(console.error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabs, handleSaveFile, openNewTab, closeTab, splitScreenMode]);

  // Show session modal only when user explicitly requests it and is authenticated
  if (showSessionModal && isAuthenticated && sessionModalMode === 'sessions' && !session) {
    return (
      <div className="figma-app">
        <AuthModal 
          isOpen={showAuthModal}
          onClose={handleCloseAuthModal}
          initialMode={authMode}
        />

        <SessionModal
          isOpen={showSessionModal}
          onClose={handleCloseSessionModal}
          initialMode={sessionModalMode}
          onSessionJoined={handleSessionJoined}
        />

        <FigmaHeader
          projectName="CodeCollab - Session Manager"
          isConnected={isConnected}
          collaborators={collaborators}
          user={user}
          isAuthenticated={isAuthenticated}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onSettings={handleSettings}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onSessionManager={handleShowSessionManager}
          onJoinSession={handleJoinSession}
          sessionInfo={session}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={toggleRightPanel}
          activeRightPanel={activeRightPanel}
          onSwitchRightPanel={switchRightPanel}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary, #888)' }}>
            <h3>Session Manager</h3>
            <p>The session modal is now open. Use it to manage your sessions.</p>
          </div>
        </div>
        
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
            },
            success: {
              duration: 3000,
              style: {
                background: '#10B981',
              },
            },
            error: {
              duration: 5000,
              style: {
                background: '#EF4444',
              },
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="figma-app">
      {/* Guest Banner */}
      {!isAuthenticated && (
        <div>Guest mode - Sign in to collaborate</div>
      )}

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={'login'}
      />

      {/* Session Modal */}
      <SessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        initialMode={'join'}
        onSessionJoined={() => setShowSessionModal(false)}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Team Management Modal */}
      <TeamManagementModal 
        isOpen={showTeamManagement}
        onClose={() => setShowTeamManagement(false)}
      />

      {/* Figma Header */}
      <FigmaHeader
        projectName={session ? `CodeCollab - ${session.name}` : "CodeCollab"}
        isConnected={isConnected}
        collaborators={collaborators}
        user={user}
        isAuthenticated={isAuthenticated}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onSettings={handleSettings}
        onProfile={handleProfile}
        theme={theme}
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSessionManager={() => setShowSessionModal(true)}
        onJoinSession={() => setShowSessionModal(true)}
        sessionInfo={session}
        splitScreenMode={splitScreenMode}
        onToggleSplitScreen={() => setSplitScreenMode(!splitScreenMode)}
        canUseSplitScreen={tabs.length >= 2}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={toggleRightPanel}
        activeRightPanel={activeRightPanel}
        onSwitchRightPanel={switchRightPanel}
        onTeamManagement={handleTeamManagement}
        socket={socket}
      />

      {/* Main Content */}
      <div className="figma-main">
        {/* File Explorer Sidebar */}
        <FigmaFileExplorer
          onFileSelect={(file) => {
            console.log('File selected:', file);
          }}
          currentFile="src/App.js"
        />

        {/* Editor Area */}
        <div className="figma-editor-area">
          {/* Tab Bar */}
          <FigmaTabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            collaborators={collaborators}
          />

          {/* Editor Content */}
          <div className="figma-editor-content">
            <div className="figma-editor">
              <SimpleEditor
                code={currentTab?.content || '// Welcome to CodeCollab!\n// Start coding here...\n\nfunction hello() {\n  console.log("Hello, collaborative coding!");\n}\n\nhello();'}
                onChange={(code) => {
                  if (currentTab) {
                    console.log('Code changed in', currentTab.fileName);
                    // Update the tab content so ModernCodeRunner gets the latest code
                    updateTabContent(currentTab.id, code);
                  }
                }}
                theme={theme}
                fontSize={fontSize}
                fileName={currentTab?.fileName || 'welcome.js'}
                onFontSizeChange={(size) => setFontSize(size)}
              />
            </div>
          </div>

          {/* Bottom Terminal Panel */}
          <div className="figma-bottom-panel">
            <ModernBottomPanel
              isOpen={true}
              setIsOpen={() => {}}
              logs={logs}
              currentCode={currentTab?.content || ''}
              currentLanguage={currentLanguage}
              onLanguageChange={(lang) => setCurrentLanguage(lang)}
              socket={socketRef.current}
              sessionId={session?.id || 'local'}
              isVerticalLayout={false}
              hideChat={!session} // Show chat only during sessions
            />
          </div>
        </div>
      </div>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#10B981',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#EF4444',
            },
          },
        }}
      />
    </div>
  );
}

// Main App component with providers
function App() {
  return (
    <AuthProvider>
      <SharedStateProvider>
        <SessionProvider>
          <CollaborationProvider>
            <ProjectSystemProvider>
              <PermissionsProvider>
                <FileSystemProvider>
                  <AppContent />
                </FileSystemProvider>
              </PermissionsProvider>
            </ProjectSystemProvider>
          </CollaborationProvider>
        </SessionProvider>
      </SharedStateProvider>
    </AuthProvider>
  );
}

export default App;
