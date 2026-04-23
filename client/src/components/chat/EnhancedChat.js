import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Code, 
  Image,
  Download,
  Users,
  Search,
  MoreVertical,
  Reply,
  Edit3,
  Copy,
  Trash2,
  Heart,
  Smile,
  X,
  Phone,
  Video,
  Settings
} from 'lucide-react';
import './EnhancedChat.css';

const EnhancedChat = ({ isOpen, onClose, projectId = null }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState({ language: 'javascript', code: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeChannel, setActiveChannel] = useState('general');
  const [channels, setChannels] = useState(['general', 'code-review', 'random']);
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState({ type: 'channel', id: 'general' });
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Mock messages data - replace with actual socket integration
  useEffect(() => {
    const mockMessages = [
      {
        id: '1',
        type: 'message',
        content: 'Hey everyone! Just pushed the latest changes to the main branch.',
        user: { id: user.id, name: user.name, avatar: user.avatar },
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        channel: 'general',
        reactions: [
          { emoji: '👍', users: ['user2', 'user3'], count: 2 },
          { emoji: '🎉', users: ['user2'], count: 1 }
        ]
      },
      {
        id: '2',
        type: 'code',
        content: 'Check out this new function I wrote:',
        user: { id: 'user2', name: 'John Doe', avatar: 'JD' },
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        channel: 'code-review',
        codeSnippet: {
          language: 'javascript',
          code: `function calculateSum(arr) {
  return arr.reduce((sum, num) => sum + num, 0);
}

// Usage example
const numbers = [1, 2, 3, 4, 5];
console.log(calculateSum(numbers)); // Output: 15`
        }
      },
      {
        id: '3',
        type: 'file',
        content: 'Here\'s the updated design mockup',
        user: { id: 'user3', name: 'Sarah Miller', avatar: 'SM' },
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        channel: 'general',
        file: {
          name: 'design-mockup-v2.png',
          size: '2.4 MB',
          type: 'image',
          url: '/api/files/mockup.png'
        }
      },
      {
        id: '4',
        type: 'reply',
        content: 'Great work! The loading states look much better now.',
        user: { id: 'user4', name: 'Mike Johnson', avatar: 'MJ' },
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        channel: 'general',
        replyTo: {
          id: '1',
          user: user.name,
          content: 'Hey everyone! Just pushed the latest changes...'
        }
      },
      {
        id: '5',
        type: 'system',
        content: 'Sarah Miller joined the project',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        channel: 'general'
      }
    ];

    setMessages(mockMessages);
    setOnlineUsers([
      { id: user.id, name: user.name, avatar: user.avatar, status: 'online' },
      { id: 'user2', name: 'John Doe', avatar: 'JD', status: 'online' },
      { id: 'user3', name: 'Sarah Miller', avatar: 'SM', status: 'away' },
      { id: 'user4', name: 'Mike Johnson', avatar: 'MJ', status: 'online' }
    ]);
  }, [user]);

  // Filter messages based on selected chat and search query
  useEffect(() => {
    let filtered = messages;

    // Filter by channel/DM
    if (selectedChat.type === 'channel') {
      filtered = filtered.filter(msg => msg.channel === selectedChat.id);
    } else {
      // Filter for direct messages
      filtered = filtered.filter(msg => 
        msg.isDM && 
        ((msg.user.id === user.id && msg.recipient === selectedChat.id) ||
         (msg.user.id === selectedChat.id && msg.recipient === user.id))
      );
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(msg =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.user.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredMessages(filtered);
  }, [messages, selectedChat, searchQuery, user.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() && !selectedFile && !showCodeSnippet) return;

    const message = {
      id: Date.now().toString(),
      type: showCodeSnippet ? 'code' : selectedFile ? 'file' : 'message',
      content: newMessage.trim(),
      user: { id: user.id, name: user.name, avatar: user.avatar },
      timestamp: new Date().toISOString(),
      channel: selectedChat.type === 'channel' ? selectedChat.id : null,
      isDM: selectedChat.type === 'dm',
      recipient: selectedChat.type === 'dm' ? selectedChat.id : null,
      reactions: []
    };

    if (replyingTo) {
      message.type = 'reply';
      message.replyTo = {
        id: replyingTo.id,
        user: replyingTo.user.name,
        content: replyingTo.content.substring(0, 50) + '...'
      };
    }

    if (showCodeSnippet) {
      message.codeSnippet = { ...codeSnippet };
    }

    if (selectedFile) {
      message.file = {
        name: selectedFile.name,
        size: (selectedFile.size / 1024 / 1024).toFixed(1) + ' MB',
        type: selectedFile.type.startsWith('image/') ? 'image' : 'document',
        url: URL.createObjectURL(selectedFile)
      };
    }

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    setSelectedFile(null);
    setShowCodeSnippet(false);
    setCodeSnippet({ language: 'javascript', code: '' });
    setReplyingTo(null);
    
    // In real implementation, emit socket event here
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      // Emit typing start event
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Emit typing stop event
    }, 2000);
  };

  const handleReaction = (messageId, emoji) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          if (existingReaction.users.includes(user.id)) {
            // Remove user's reaction
            existingReaction.users = existingReaction.users.filter(id => id !== user.id);
            existingReaction.count--;
            if (existingReaction.count === 0) {
              msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
            }
          } else {
            // Add user's reaction
            existingReaction.users.push(user.id);
            existingReaction.count++;
          }
        } else {
          // Create new reaction
          msg.reactions.push({
            emoji,
            users: [user.id],
            count: 1
          });
        }
      }
      return msg;
    }));
  };

  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Show toast notification
  };

  if (!isOpen) return null;

  return (
    <div className="enhanced-chat-overlay" onClick={onClose}>
      <div className="enhanced-chat-container" onClick={(e) => e.stopPropagation()}>
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-title">
            <MessageSquare size={20} />
            <span>
              {selectedChat.type === 'channel' 
                ? `#${selectedChat.id}`
                : `@${onlineUsers.find(u => u.id === selectedChat.id)?.name || 'Unknown'}`
              }
            </span>
            <span className="member-count">
              {onlineUsers.length} members
            </span>
          </div>
          
          <div className="chat-controls">
            <button className="control-btn" title="Voice Call">
              <Phone size={16} />
            </button>
            <button className="control-btn" title="Video Call">
              <Video size={16} />
            </button>
            <button className="control-btn" title="Chat Settings">
              <Settings size={16} />
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="chat-body">
          {/* Sidebar */}
          <div className="chat-sidebar">
            {/* Search */}
            <div className="chat-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Channels */}
            <div className="chat-section">
              <h4>Channels</h4>
              {channels.map(channel => (
                <button
                  key={channel}
                  className={`chat-item ${selectedChat.type === 'channel' && selectedChat.id === channel ? 'active' : ''}`}
                  onClick={() => setSelectedChat({ type: 'channel', id: channel })}
                >
                  <span className="channel-name"># {channel}</span>
                </button>
              ))}
            </div>

            {/* Direct Messages */}
            <div className="chat-section">
              <h4>Direct Messages</h4>
              {onlineUsers.filter(u => u.id !== user.id).map(u => (
                <button
                  key={u.id}
                  className={`chat-item ${selectedChat.type === 'dm' && selectedChat.id === u.id ? 'active' : ''}`}
                  onClick={() => setSelectedChat({ type: 'dm', id: u.id })}
                >
                  <div className="user-avatar small">{u.avatar}</div>
                  <span className="user-name">{u.name}</span>
                  <div className={`status-indicator ${u.status}`} />
                </button>
              ))}
            </div>

            {/* Online Users */}
            <div className="chat-section">
              <h4>Online Now ({onlineUsers.filter(u => u.status === 'online').length})</h4>
              {onlineUsers.filter(u => u.status === 'online').map(u => (
                <div key={u.id} className="user-item">
                  <div className="user-avatar small">{u.avatar}</div>
                  <span className="user-name">{u.name}</span>
                  {u.id === user.id && <span className="you-label">(you)</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Messages Area */}
          <div className="messages-area">
            <div className="messages-container">
              {filteredMessages.map(message => (
                <div key={message.id} className={`message ${message.type}`}>
                  {message.type === 'system' ? (
                    <div className="system-message">
                      <span>{message.content}</span>
                      <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                    </div>
                  ) : (
                    <div className="message-content">
                      <div className="user-avatar">{message.user.avatar}</div>
                      
                      <div className="message-body">
                        <div className="message-header">
                          <span className="user-name">{message.user.name}</span>
                          <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                          
                          <div className="message-actions">
                            <button
                              className="action-btn"
                              onClick={() => handleReaction(message.id, '👍')}
                              title="React"
                            >
                              <Heart size={14} />
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => setReplyingTo(message)}
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => copyToClipboard(message.content)}
                              title="Copy"
                            >
                              <Copy size={14} />
                            </button>
                            {message.user.id === user.id && (
                              <>
                                <button
                                  className="action-btn"
                                  onClick={() => setEditingMessage(message)}
                                  title="Edit"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  className="action-btn danger"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {message.replyTo && (
                          <div className="reply-reference">
                            <Reply size={12} />
                            <span>Replying to <strong>{message.replyTo.user}</strong>: {message.replyTo.content}</span>
                          </div>
                        )}

                        <div className="message-text">{message.content}</div>

                        {message.codeSnippet && (
                          <div className="code-snippet">
                            <div className="code-header">
                              <span className="language">{message.codeSnippet.language}</span>
                              <button
                                className="copy-code-btn"
                                onClick={() => copyToClipboard(message.codeSnippet.code)}
                              >
                                <Copy size={14} />
                                Copy
                              </button>
                            </div>
                            <pre className="code-content">
                              <code>{message.codeSnippet.code}</code>
                            </pre>
                          </div>
                        )}

                        {message.file && (
                          <div className="file-attachment">
                            <div className="file-info">
                              {message.file.type === 'image' ? (
                                <Image size={20} />
                              ) : (
                                <Paperclip size={20} />
                              )}
                              <div className="file-details">
                                <span className="file-name">{message.file.name}</span>
                                <span className="file-size">{message.file.size}</span>
                              </div>
                              <button className="download-btn">
                                <Download size={16} />
                              </button>
                            </div>
                            {message.file.type === 'image' && (
                              <div className="image-preview">
                                <img src={message.file.url} alt={message.file.name} />
                              </div>
                            )}
                          </div>
                        )}

                        {message.reactions && message.reactions.length > 0 && (
                          <div className="message-reactions">
                            {message.reactions.map(reaction => (
                              <button
                                key={reaction.emoji}
                                className={`reaction ${reaction.users.includes(user.id) ? 'active' : ''}`}
                                onClick={() => handleReaction(message.id, reaction.emoji)}
                              >
                                <span className="emoji">{reaction.emoji}</span>
                                <span className="count">{reaction.count}</span>
                              </button>
                            ))}
                            <button
                              className="add-reaction"
                              onClick={() => {
                                // Show emoji picker
                                const emoji = prompt('Enter emoji:');
                                if (emoji) handleReaction(message.id, emoji);
                              }}
                            >
                              <Smile size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  <div className="typing-animation">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} is typing...`
                      : `${typingUsers.length} people are typing...`
                    }
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="message-input-container">
              {replyingTo && (
                <div className="reply-preview">
                  <Reply size={14} />
                  <span>Replying to <strong>{replyingTo.user.name}</strong>: {replyingTo.content.substring(0, 50)}...</span>
                  <button onClick={() => setReplyingTo(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {selectedFile && (
                <div className="file-preview">
                  <Paperclip size={14} />
                  <span>{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <button onClick={() => setSelectedFile(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {showCodeSnippet && (
                <div className="code-input">
                  <div className="code-input-header">
                    <select
                      value={codeSnippet.language}
                      onChange={(e) => setCodeSnippet(prev => ({ ...prev, language: e.target.value }))}
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="html">HTML</option>
                      <option value="css">CSS</option>
                      <option value="sql">SQL</option>
                    </select>
                    <button onClick={() => setShowCodeSnippet(false)}>
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    value={codeSnippet.code}
                    onChange={(e) => setCodeSnippet(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="Paste your code here..."
                    rows="6"
                  />
                </div>
              )}

              <div className="input-controls">
                <button
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File"
                >
                  <Paperclip size={18} />
                </button>
                
                <button
                  className="code-btn"
                  onClick={() => setShowCodeSnippet(!showCodeSnippet)}
                  title="Code Snippet"
                >
                  <Code size={18} />
                </button>

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    selectedChat.type === 'channel' 
                      ? `Message #${selectedChat.id}`
                      : `Message @${onlineUsers.find(u => u.id === selectedChat.id)?.name || 'Unknown'}`
                  }
                  className="message-input"
                />

                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() && !selectedFile && !showCodeSnippet}
                >
                  <Send size={18} />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.txt,.js,.py,.java,.cpp,.html,.css"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChat;
