import React, { useState, useEffect } from 'react';
import { useArena } from '../../context/ArenaContext';

export default function RoomControls() {
  const { isHost, isReady, players, toggleReady, startMatch } = useArena();
  const [isStarting, setIsStarting] = useState(false);

  const hasEnoughPlayers = players.length >= 2;
  const allReady = hasEnoughPlayers && players.every((p) => p.ready);
  const canStartMatch = isHost && allReady && !isStarting;

  useEffect(() => {
    if (!allReady) {
      setIsStarting(false);
    }
  }, [allReady]);

  const handleStartMatch = () => {
    if (!canStartMatch || isStarting) return;
    setIsStarting(true);
    startMatch();
  };

  return (
    <div className="room-controls-group">
      <div className="room-actions-bar">
        <button
          className={`btn ${isReady ? 'btn-secondary' : 'btn-success'} btn-lg`}
          onClick={toggleReady}
        >
          {isReady ? 'Cancel Ready' : 'Ready Up'}
        </button>

        {isHost ? (
          <button
            className="btn btn-primary btn-lg"
            disabled={!canStartMatch || isStarting}
            onClick={handleStartMatch}
          >
            {isStarting ? 'Launching Match...' : 'Start Match'}
          </button>
        ) : (
          <div className="waiting-host-text">
            Waiting for host to start match...
          </div>
        )}
      </div>

      <div className="action-hint">
        {isHost ? (
          !hasEnoughPlayers ? (
            <span className="text-warning">At least 2 players are required to start a match. Waiting for more players to join...</span>
          ) : canStartMatch ? (
            <span className="text-success">Everyone is ready! Click Start Match to begin.</span>
          ) : (
            <span>Waiting for all players to click 'Ready Up' before you can start.</span>
          )
        ) : (
          !hasEnoughPlayers ? (
            <span>Waiting for at least 2 players to join the room...</span>
          ) : (
            <span>
              {allReady
                ? 'Everyone is ready! Waiting for the host to launch...'
                : 'Click Ready Up when you are ready to play.'}
            </span>
          )
        )}
      </div>
    </div>
  );
}
