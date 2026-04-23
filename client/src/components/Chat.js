import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, MoreVertical, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ChatMessage = ({ message, isOwn, timestamp, author, avatar }) => (
  <div className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
    <div className="w-6 h-6 rounded-full bg-vscode-accent flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
      {avatar || author?.charAt(0)?.toUpperCase()}
    </div>
    <div className={`max-w-xs ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-vscode-text-muted">{author}</span>
        <span className="text-xs text-vscode-text-secondary">{timestamp}</span>
      </div>
      <div className={`px-3 py-2 rounded-lg text-sm ${
        isOwn 
          ? 'bg-vscode-accent text-white' 
          : 'bg-vscode-hover text-vscode-text'
      }`}>
        {message}
      </div>
    </div>
  </div>
);

const Chat = ({ isInBottomPanel = false }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      message: "Welcome to CodeCollab! Start collaborating on your project.",
      author: "System",
      timestamp: "10:30 AM",
      isOwn: false
    },
    {
      id: 2,
      message: "Hey everyone! Ready to start coding together?",
      author: "John Doe",
      timestamp: "10:32 AM",
      isOwn: false
    },
    {
      id: 3,
      message: "Absolutely! Let's build something amazing.",
      author: "You",
      timestamp: "10:33 AM",
      isOwn: true
    }
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      message: newMessage,
      author: "You",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const collaborators = [
    { name: "John Doe", status: "online", avatar: "JD", role: "Editor" },
    { name: "Jane Smith", status: "typing", avatar: "JS", role: "Viewer" },
    { name: "Mike Johnson", status: "away", avatar: "MJ", role: "Editor" }
  ];

  if (isInBottomPanel) {
    return (
      <div className="h-full flex flex-col bg-vscode-bg">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} {...msg} />
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-vscode-text-muted text-sm">
              <div className="w-2 h-2 bg-vscode-accent rounded-full animate-pulse"></div>
              Jane is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="border-t border-vscode-border p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-vscode-panel border border-vscode-border rounded text-vscode-text text-sm focus:outline-none focus:border-vscode-accent"
            />
            <button
              type="button"
              className="p-2 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text"
              title="Add Emoji"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              className="p-2 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text"
              title="Attach File"
            >
              <Paperclip size={16} />
            </button>
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="p-2 bg-vscode-accent hover:bg-vscode-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
              title="Send Message"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-vscode-panel h-full flex flex-col">
      {/* Chat Header */}
      <div className="p-3 border-b border-vscode-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-vscode-text uppercase tracking-wide">
            Team Chat
          </h3>
          <button className="p-1 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text">
            <MoreVertical size={12} />
          </button>
        </div>
        <div className="text-xs text-vscode-text-muted mt-1">
          {collaborators.length} collaborators online
        </div>
      </div>

      {/* Online Collaborators */}
      <div className="p-3 border-b border-vscode-border">
        <div className="text-xs text-vscode-text-muted uppercase tracking-wide mb-2">
          Online Now
        </div>
        <div className="space-y-1">
          {collaborators.map((collaborator, index) => (
            <div key={index} className="flex items-center gap-2 py-1">
              <div className="w-4 h-4 rounded-full bg-vscode-accent flex items-center justify-center text-white text-xs">
                {collaborator.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-vscode-text truncate">{collaborator.name}</div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    collaborator.status === 'online' ? 'bg-vscode-success' :
                    collaborator.status === 'typing' ? 'bg-vscode-warning' :
                    'bg-vscode-text-muted'
                  }`}></div>
                  <span className="text-xs text-vscode-text-muted capitalize">
                    {collaborator.status}
                  </span>
                </div>
              </div>
              <span className="text-xs text-vscode-text-secondary">{collaborator.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} {...msg} />
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-vscode-text-muted text-sm">
            <div className="w-2 h-2 bg-vscode-accent rounded-full animate-pulse"></div>
            Jane is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSendMessage} className="border-t border-vscode-border p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-vscode-bg border border-vscode-border rounded text-vscode-text text-sm focus:outline-none focus:border-vscode-accent"
          />
          <button
            type="button"
            className="p-2 hover:bg-vscode-hover rounded text-vscode-text-secondary hover:text-vscode-text"
            title="Add Emoji"
          >
            <Smile size={16} />
          </button>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-vscode-accent hover:bg-vscode-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
            title="Send Message"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
