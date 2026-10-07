import React from 'react';
import { useArena } from '../../context/ArenaContext';

export default function PlayerRoster() {
  const { players } = useArena();
  const readyCount = players.filter((p) => p.ready).length;

  return (
    <div className="roster-panel">
      <div className="roster-header">
        <h3>Players ({players.length})</h3>
        <span className="ready-summary">
          {readyCount} of {players.length} ready
        </span>
      </div>

      <div className="player-list">
        {players.map((p) => (
          <div key={p.id} className={`player-row ${p.isMe ? 'is-me' : ''}`}>
            <div className="player-meta">
              <span className="player-name">{p.name}</span>
              {p.isMe && <span className="badge-you">You</span>}
              {p.isHost && <span className="badge-host">Host</span>}
            </div>

            <span className={`status-pill ${p.ready ? 'ready' : 'waiting'}`}>
              {p.ready ? 'Ready' : 'Not Ready'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
