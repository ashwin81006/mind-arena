import React from 'react';
import { useArena } from '../../context/ArenaContext';

export default function RoomControls() {
  const { isHost, isReady, players, toggleReady, startMatch } = useArena();

  const allReady = players.length > 0 && players.every((p) => p.ready);
  const canStartMatch = isHost && allReady && players.length > 0;

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
            disabled={!canStartMatch}
            onClick={startMatch}
          >
            Start Match
          </button>
        ) : (
          <div className="waiting-host-text">
            Waiting for host to start match...
          </div>
        )}
      </div>

      <div className="action-hint">
        {isHost ? (
          canStartMatch ? (
            <span className="text-success">Everyone is ready! Click Start Match to begin.</span>
          ) : (
            <span>Waiting for all players to click 'Ready Up' before you can start.</span>
          )
        ) : (
          <span>
            {allReady
              ? 'Everyone is ready! Waiting for the host to launch...'
              : 'Click Ready Up when you are ready to play.'}
          </span>
        )}
      </div>
    </div>
  );
}
