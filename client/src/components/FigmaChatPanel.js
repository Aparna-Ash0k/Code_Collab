import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, MoreVertical, Hash, Bell, Settings2 } from 'lucide-react';

const FigmaChatPanel = ({ 
  messages = [], 
  onSendMessage, 
  currentUser, 
  collaborators = [],
  isConnected = false,
  sessionInfo = null
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // User color assignment function
  const getUserColor = (userIndex) => {
    const colors = [
      'user-color-1', 'user-color-2', 'user-color-3', 
      'user-color-4', 'user-color-5', 'user-color-6'
    ];
    return colors[userIndex % colors.length];
  };

  // Get user initials
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Use only real messages
  const messagesToShow = messages;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesToShow]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && onSendMessage) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  // Use session user count if available, otherwise fallback to collaborators count
  const onlineCount = sessionInfo?.userCount || (isConnected && currentUser ? 1 + collaborators.length : 0);

  return (
    <div className="figma-chat-panel">
      {/* Chat Header */}
      <div className="figma-chat-header">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-gray-500" />
          <h3 className="figma-chat-title">Team Chat</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="figma-chat-online-count">
            {onlineCount} online
          </span>
          <button className="p-1 rounded hover:bg-gray-100 transition-colors">
            <Bell size={16} className="text-gray-500" />
          </button>
          <button className="p-1 rounded hover:bg-gray-100 transition-colors">
            <MoreVertical size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Collaborators Section */}
      <div className="figma-collaborators">
        <h4 className="figma-collaborators-title">Online Now</h4>
        <div className="figma-collaborator-list">
          {isConnected && currentUser && (
            <div className="figma-collaborator">
              <div className={`collaborator-avatar ${getUserColor(2)}`}>
                {getInitials(currentUser.name || currentUser.email)}
              </div>
              <div className="collaborator-info">
                <div className="collaborator-name">You</div>
                <div className="collaborator-status">Online</div>
              </div>
              <div className="collaborator-indicator"></div>
            </div>
          )}
          
          {collaborators.map((collaborator, index) => (
            <div key={collaborator.id || index} className="figma-collaborator">
              <div className={`collaborator-avatar ${getUserColor(index)}`}>
                {getInitials(collaborator.name)}
              </div>
              <div className="collaborator-info">
                <div className="collaborator-name">{collaborator.name}</div>
                <div className="collaborator-status">
                  {collaborator.status || 'Online'}
                </div>
              </div>
              <div className="collaborator-indicator"></div>
            </div>
          ))}

          {!isConnected && (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">Connect to see online collaborators</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="figma-chat-messages">
        {messagesToShow.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No messages yet.</p>
            <p className="text-sm">Start a conversation with your team!</p>
          </div>
        ) : (
          messagesToShow.map((message) => (
            <div key={message.id} className="figma-chat-message fade-in">
              <div className={`message-avatar ${getUserColor(message.authorIndex)}`}>
                {getInitials(message.author)}
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-author">{message.author}</span>
                  <span className="message-time">{message.timestamp}</span>
                </div>
                <div className="message-text">
                  {message.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="figma-chat-input">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="figma-chat-input-field pr-20"
              disabled={!isConnected}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Add emoji"
              >
                <Smile size={16} className="text-gray-500" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Attach file"
              >
                <Paperclip size={16} className="text-gray-500" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={16} />
          </button>
        </form>
        {!isConnected && (
          <p className="text-xs text-gray-500 mt-2">
            Connect to the server to send messages
          </p>
        )}
      </div>
    </div>
  );
};

export default FigmaChatPanel;
