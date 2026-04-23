import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { X, Users, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const JoinSessionModal = ({ isOpen, onClose, onSessionJoined }) => {
  const { joinSession, isLoading, error, clearError } = useSession();
  const [inviteKey, setInviteKey] = useState('');

  // Clear errors when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      clearError();
      setInviteKey('');
    }
  }, [isOpen, clearError]);

  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!inviteKey.trim()) {
      toast.error('Please enter an invite key');
      return;
    }

    const result = await joinSession(inviteKey.trim().toUpperCase());
    if (result.success) {
      toast.success(`Joined session "${result.session.name}" successfully!`);
      setInviteKey('');
      onClose();
      if (onSessionJoined) {
        onSessionJoined(result.session);
      }
    } else {
      toast.error(result.message || 'Failed to join session');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 1001 }} onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Join Private Session</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          <div className="mb-4">
            <p className="text-gray-600 text-sm">
              Enter an invite key to join a collaborative coding session. The invite key is provided by the session creator.
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center tracking-wider"
                maxLength={12}
                autoFocus
              />
              <div className="mt-1 text-xs text-gray-500">
                Invite keys are 12 characters long and case-insensitive
              </div>
            </div>
            
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !inviteKey.trim()}
                className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Joining...' : 'Join Session'}
              </button>
            </div>
          </form>

          {/* Additional info */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Lock className="w-4 h-4" />
              <span>Private sessions are secure and require an invite key to join</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinSessionModal;
