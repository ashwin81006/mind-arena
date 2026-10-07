import React from 'react';

export default function HomeActionCards({
  onCreateRoom,
  onJoinRoom,
  joinCode,
  setJoinCode,
  connecting,
  pendingAction
}) {
  const isCreating = connecting && pendingAction?.type === 'CREATE';
  const isJoining = connecting && pendingAction?.type === 'JOIN';

  return (
    <div className="home-cards-grid">
      {/* Card 1: Create Room */}
      <div className="home-action-card">
        <div className="card-top">
          <h2>Create a Room</h2>
          <p>Start a new private match room and share the room code with your friends.</p>
        </div>
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={connecting}
          onClick={onCreateRoom}
        >
          {isCreating ? 'Creating Room...' : 'Create Room'}
        </button>
      </div>

      {/* Card 2: Join Room */}
      <div className="home-action-card">
        <div className="card-top">
          <h2>Join a Room</h2>
          <p>Have a 6-letter room code from a friend? Enter it below to join their game.</p>
        </div>
        <form onSubmit={onJoinRoom} className="join-form">
          <input
            type="text"
            className="form-input code-input"
            placeholder="Room Code"
            value={joinCode}
            maxLength={8}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
          />
          <button
            type="submit"
            className="btn btn-secondary btn-block btn-lg"
            disabled={connecting}
          >
            {isJoining ? 'Joining Room...' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
