import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { Copy, Users, Plus, Trash2, RefreshCw, Lock, Share, ArrowLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';

const SessionManager = ({ onSessionJoined, onClose }) => {
  const { 
    createSession, 
    joinSession, 
    getUserSessions, 
    regenerateInviteKey, 
    deleteSession, 
    session, 
    isLoading, 
    error, 
    clearError 
  } = useSession();
  
  const { isAuthenticated, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('join');
  const [inviteKey, setInviteKey] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [userSessions, setUserSessions] = useState([]);
  const [sessionSettings, setSessionSettings] = useState({
    maxUsers: 5,
    allowGuests: false,
    permissions: {
      canEdit: true,
      canExecute: true,
      canChat: true,
      canInvite: false
    }
  });

  // Load user sessions on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadUserSessions();
    }
  }, [isAuthenticated]);

  // Clear errors when tab changes
  useEffect(() => {
    clearError();
  }, [activeTab, clearError]);

  const loadUserSessions = async () => {
    const result = await getUserSessions();
    if (result.success) {
      setUserSessions(result.sessions);
    }
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!inviteKey.trim()) {
      toast.error('Please enter an invite key');
      return;
    }

    const result = await joinSession(inviteKey.trim().toUpperCase());
    if (result.success) {
      toast.success(`Joined session successfully!`);
      setInviteKey('');
      if (onSessionJoined) {
        onSessionJoined(result.session);
      }
    } else {
      toast.error(result.message || 'Failed to join session');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      toast.error('Please enter a session name');
      return;
    }

    const result = await createSession(sessionName.trim(), sessionSettings);
    if (result.success) {
      toast.success(`Session "${sessionName}" created successfully!`);
      setSessionName('');
      await loadUserSessions(); // Refresh the list
      
      // Show invite key
      toast((t) => (
        <div className="flex flex-col space-y-2">
          <div className="font-medium">Session Created!</div>
          <div className="text-sm text-gray-600">
            Invite Key: <span className="font-mono font-bold text-blue-600">{result.inviteKey}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(result.inviteKey);
              toast.dismiss(t.id);
              toast.success('Invite key copied to clipboard!');
            }}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Copy to clipboard
          </button>
        </div>
      ), {
        duration: 8000,
        style: {
          maxWidth: '400px',
        },
      });
    } else {
      toast.error(result.message || 'Failed to create session');
    }
  };

  const handleCopyInviteKey = async (sessionId, currentKey) => {
    try {
      await navigator.clipboard.writeText(currentKey);
      toast.success('Invite key copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy invite key');
    }
  };

  const handleRegenerateKey = async (sessionId) => {
    const result = await regenerateInviteKey(sessionId);
    if (result.success) {
      toast.success('New invite key generated!');
      await loadUserSessions();
      
      // Show new key
      toast((t) => (
        <div className="flex flex-col space-y-2">
          <div className="font-medium">New Invite Key</div>
          <div className="text-sm text-gray-600">
            <span className="font-mono font-bold text-blue-600">{result.inviteKey}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(result.inviteKey);
              toast.dismiss(t.id);
              toast.success('New invite key copied!');
            }}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Copy to clipboard
          </button>
        </div>
      ), {
        duration: 6000,
      });
    } else {
      toast.error(result.message || 'Failed to regenerate invite key');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    const result = await deleteSession(sessionId);
    if (result.success) {
      toast.success('Session deleted successfully');
      await loadUserSessions();
    } else {
      toast.error(result.message || 'Failed to delete session');
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (session) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-green-800">
          <Lock className="w-5 h-5" />
          <span className="font-medium">Connected to "{session.name}"</span>
        </div>
        <div className="mt-2 text-sm text-green-600">
          {session.userCount || 1} user{(session.userCount || 1) !== 1 ? 's' : ''} connected
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header with back button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                title="Back to main interface"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
            <h1 className="text-lg font-semibold text-gray-900">Session Manager</h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 pt-6">
            <button
              onClick={() => setActiveTab('join')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'join'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Join Session
            </button>
            {isAuthenticated && (
              <>
                <button
                  onClick={() => setActiveTab('create')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'create'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Create Session
                </button>
                <button
                  onClick={() => setActiveTab('manage')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'manage'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  My Sessions
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-800">{error}</div>
            </div>
          )}

          {activeTab === 'join' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Join a Private Session</h2>
                <p className="text-gray-600 mb-4">
                  Enter an invite key to join a collaborative coding session.
                </p>
              </div>

              <form onSubmit={handleJoinSession} className="space-y-4">
                <div>
                  <label htmlFor="inviteKey" className="block text-sm font-medium text-gray-700 mb-2">
                    Invite Key
                  </label>
                  <input
                    type="text"
                    id="inviteKey"
                    value={inviteKey}
                    onChange={(e) => setInviteKey(e.target.value.toUpperCase())}
                    placeholder="Enter invite key (e.g., ABC123XYZ456)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono"
                    maxLength={12}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || !inviteKey.trim()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Joining...' : 'Join Session'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'create' && isAuthenticated && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Create New Session</h2>
                <p className="text-gray-600 mb-4">
                  Create a private collaborative coding session with custom settings.
                </p>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-6">
                <div>
                  <label htmlFor="sessionName" className="block text-sm font-medium text-gray-700 mb-2">
                    Session Name
                  </label>
                  <input
                    type="text"
                    id="sessionName"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Enter session name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    maxLength={50}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="maxUsers" className="block text-sm font-medium text-gray-700 mb-2">
                      Max Users
                    </label>
                    <select
                      id="maxUsers"
                      value={sessionSettings.maxUsers}
                      onChange={(e) => setSessionSettings(prev => ({ 
                        ...prev, 
                        maxUsers: parseInt(e.target.value) 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={2}>2 users</option>
                      <option value={5}>5 users</option>
                      <option value={10}>10 users</option>
                      <option value={20}>20 users</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="allowGuests"
                      checked={sessionSettings.allowGuests}
                      onChange={(e) => setSessionSettings(prev => ({ 
                        ...prev, 
                        allowGuests: e.target.checked 
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="allowGuests" className="text-sm font-medium text-gray-700">
                      Allow guest users
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Default Permissions</h3>
                  <div className="space-y-3">
                    {Object.entries(sessionSettings.permissions).map(([permission, enabled]) => (
                      <div key={permission} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={permission}
                          checked={enabled}
                          onChange={(e) => setSessionSettings(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [permission]: e.target.checked
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={permission} className="text-sm text-gray-700 capitalize">
                          {permission.replace('can', 'Can ').replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || !sessionName.trim()}
                  className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isLoading ? 'Creating...' : 'Create Session'}</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'manage' && isAuthenticated && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">My Sessions</h2>
                  <p className="text-gray-600">
                    Manage your created and joined sessions.
                  </p>
                </div>
                <button
                  onClick={loadUserSessions}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>

              {userSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No sessions found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Create a new session or join one using an invite key
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userSessions.map((session) => (
                    <div key={session.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{session.name}</h3>
                          <div className="mt-1 text-sm text-gray-600">
                            <div>Created: {formatDate(session.createdAt)}</div>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="flex items-center space-x-1">
                                <Users className="w-4 h-4" />
                                <span>{session.userCount || 0} user{(session.userCount || 0) !== 1 ? 's' : ''}</span>
                              </span>
                              {session.isCreator && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Creator
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {session.isCreator && session.inviteKey && (
                            <>
                              <button
                                onClick={() => handleCopyInviteKey(session.id, session.inviteKey)}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                                title="Copy invite key"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy Key</span>
                              </button>
                              
                              <button
                                onClick={() => handleRegenerateKey(session.id)}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-orange-600 hover:text-orange-800"
                                title="Regenerate invite key"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>New Key</span>
                              </button>
                              
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 hover:text-red-800"
                                title="Delete session"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {session.isCreator && session.inviteKey && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <div className="text-blue-800 font-medium">Invite Key:</div>
                          <div className="font-mono text-blue-900 mt-1">{session.inviteKey}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isAuthenticated && activeTab !== 'join' && (
            <div className="text-center py-8">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Authentication required</p>
              <p className="text-sm text-gray-400 mt-1">
                Please sign in to create and manage sessions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
