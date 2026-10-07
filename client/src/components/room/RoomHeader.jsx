import React, { useState } from 'react';
import { useArena } from '../../context/ArenaContext';
import { useToast } from '../../context/ToastContext';

export default function RoomHeader() {
  const { currentRoomId, isHost, leaveRoom } = useArena();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId);
      setCopied(true);
      notify('Room code copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="room-header-card">
      <div className="room-meta-group">
        <div className="room-code-display">
          <span className="label">Room Code:</span>
          <span className="code-text">{currentRoomId}</span>
          <button
            className="btn btn-secondary btn-xs"
            onClick={handleCopyCode}
            title="Copy room code to clipboard"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span className="role-tag">{isHost ? 'Host' : 'Player'}</span>
      </div>

      <button className="btn btn-outline-danger btn-sm" onClick={leaveRoom}>
        Leave Room
      </button>
    </div>
  );
}
