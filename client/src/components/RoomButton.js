/**
 * Room Button Component
 * 
 * Button to open the room manager modal
 */

import React, { useState } from 'react';
import './RoomButton.css';
import RoomManager from './RoomManager';
import { useAuth } from '../contexts/AuthContext';

const RoomButton = ({ socket }) => {
  const { user } = useAuth();
  const [isRoomManagerOpen, setIsRoomManagerOpen] = useState(false);
  const [connectedRoom, setConnectedRoom] = useState(null);

  const handleRoomCreated = (roomData) => {
    setConnectedRoom(roomData);
    setIsRoomManagerOpen(false);
  };

  const handleRoomJoined = (roomData) => {
    setConnectedRoom(roomData.roomInfo);
    setIsRoomManagerOpen(false);
  };

  const handleLeaveRoom = () => {
    setConnectedRoom(null);
  };

  const getButtonText = () => {
    if (!user) return '🔐 Sign In for Rooms';
    if (connectedRoom) return `🏠 ${connectedRoom.roomName || 'Room'}`;
    return '🏠 Collaboration Rooms';
  };

  const getButtonClass = () => {
    let baseClass = 'room-button';
    if (!user) baseClass += ' disabled';
    if (connectedRoom) baseClass += ' connected';
    return baseClass;
  };

  return (
    <>
      <button
        className={getButtonClass()}
        onClick={() => setIsRoomManagerOpen(true)}
        disabled={!user}
        title={connectedRoom ? `Connected to: ${connectedRoom.roomName}` : 'Create or join collaboration rooms'}
      >
        {getButtonText()}
        {connectedRoom && <span className="connection-indicator">●</span>}
      </button>

      {isRoomManagerOpen && (
        <RoomManager
          socket={socket}
          onRoomCreated={handleRoomCreated}
          onRoomJoined={handleRoomJoined}
          onClose={() => setIsRoomManagerOpen(false)}
        />
      )}
    </>
  );
};

export default RoomButton;