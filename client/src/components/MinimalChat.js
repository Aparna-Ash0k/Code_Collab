import React, { useState } from 'react';
import { Send } from 'lucide-react';

const MinimalChatMessage = ({ message, author, timestamp, isOwn }) => (
  <div className={`mb-3 ${isOwn ? 'text-right' : ''}`}>
    <div className="flex items-center gap-2 mb-1">
      {!isOwn && (
        <>
          <div className="w-4 h-4 rounded-full bg-bg-accent flex items-center justify-center text-white text-xs">
            {author?.charAt(0)?.toUpperCase()}
          </div>
          <span className="text-xs text-text-secondary">{author}</span>
        </>
      )}
      <span className="text-xs text-text-tertiary">{timestamp}</span>
    </div>
    <div className={`inline-block px-3 py-2 rounded text-sm max-w-xs ${
      isOwn 
        ? 'bg-bg-accent text-white' 
        : 'bg-surface-tertiary text-text-primary'
    }`}>
      {message}
    </div>
  </div>
);

const MinimalChat = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      message: "Welcome to CodeCollab!",
      author: "System",
      timestamp: "10:30",
      isOwn: false
    },
    {
      id: 2,
      message: "Ready to collaborate?",
      author: "Alice",
      timestamp: "10:32",
      isOwn: false
    },
    {
      id: 3,
      message: "Yes, let's do this!",
      author: "You",
      timestamp: "10:33",
      isOwn: true
    }
  ]);
  
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        message: newMessage,
        author: "You",
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: true
      }]);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <MinimalChatMessage 
            key={msg.id} 
            {...msg} 
          />
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border-primary">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 text-sm"
          />
          <button
            onClick={handleSendMessage}
            className="btn-primary p-2"
            disabled={!newMessage.trim()}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MinimalChat;
