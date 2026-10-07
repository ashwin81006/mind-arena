import React from 'react';
import { useArena } from '../context/ArenaContext';
import ReactionRushGame from '../components/match/ReactionRushGame';

export default function MatchScreen() {
  const { gameState } = useArena();

  // If in active gameplay (Reaction Rush or results)
  if (gameState && gameState.phase !== 'MATCH_INTRO') {
    return <ReactionRushGame />;
  }

  // Pre-game intro countdown
  return (
    <div className="match-view">
      <div className="match-card">
        <h2>⚡ Match Starting</h2>
        <p>Game 1: <strong>Reaction Rush</strong></p>
        <div className="next-round-bar" style={{ marginTop: '1rem' }}>
          <span className="pulsing-dot"></span>
          <span>Preparing round 1...</span>
        </div>
      </div>
    </div>
  );
}
