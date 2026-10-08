import React from 'react';
import { useArena } from '../context/ArenaContext';
import ReactionRushGame from '../components/match/ReactionRushGame';
import SequenceMemoryGame from '../components/match/SequenceMemoryGame';
import NumberRecallGame from '../components/match/NumberRecallGame';
import VisualMemoryGame from '../components/match/VisualMemoryGame';
import AimTrainerGame from '../components/match/AimTrainerGame';

export default function MatchScreen() {
  const { gameState, myPlayerId, isHost, returnToLobby, leaveRoom } = useArena();

  // Final Match Podium & Winner Ceremony
  if (gameState && gameState.phase === 'MATCH_OVER') {
    const leaderboard = gameState.leaderboard || [];
    const winner = leaderboard[0];

    return (
      <div className="match-results-card final-podium-card">
        <div className="results-header">
          <span className="game-over-icon">🏆</span>
          <h2>Tournament Completed!</h2>
          <p>Final Standings Across All Games Played</p>
          {winner && (
            <div className="winner-announcement-banner">
              👑 Champion: <strong>{winner.name}</strong> with {winner.score.toLocaleString()} total pts!
            </div>
          )}
        </div>

        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Rank</span>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Total Score</span>
          </div>

          {leaderboard.map((player) => {
            const isMe = player.id === myPlayerId;
            let rankBadge = `#${player.rank}`;
            if (player.rank === 1) rankBadge = '🥇 1st';
            else if (player.rank === 2) rankBadge = '🥈 2nd';
            else if (player.rank === 3) rankBadge = '🥉 3rd';

            return (
              <div
                key={player.id}
                className={`leaderboard-row ${isMe ? 'is-me-row' : ''} rank-${player.rank}`}
              >
                <span className="rank-col">{rankBadge}</span>
                <span className="name-col">
                  {player.name} {isMe && <span className="badge-you">You</span>}
                </span>
                <span className="score-col">{player.score.toLocaleString()} pts</span>
              </div>
            );
          })}
        </div>

        <div className="match-over-actions">
          {isHost ? (
            <button className="btn btn-primary btn-lg" onClick={returnToLobby}>
              Return to Lobby
            </button>
          ) : (
            <div className="waiting-host-text">
              Waiting for host to return to lobby...
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={leaveRoom}>
            Exit Match
          </button>
        </div>
      </div>
    );
  }

  // Active mini-game or round results
  if (gameState && gameState.phase !== 'MATCH_INTRO') {
    const rawId = (gameState.gameId || '').toLowerCase().replace(/_/g, '-');
    switch (rawId) {
      case 'sequence-memory':
        return <SequenceMemoryGame />;
      case 'number-recall':
        return <NumberRecallGame />;
      case 'visual-memory':
        return <VisualMemoryGame />;
      case 'aim-trainer':
        return <AimTrainerGame />;
      case 'reaction-rush':
      default:
        return <ReactionRushGame />;
    }
  }

  // Pre-game intro countdown
  const currentGameName = gameState?.gameName || 'Reaction Rush';
  return (
    <div className="match-view">
      <div className="match-card">
        <h2>⚡ Match Starting</h2>
        <p>First Game: <strong>{currentGameName}</strong></p>
        <div className="next-round-bar" style={{ marginTop: '1rem' }}>
          <span className="pulsing-dot"></span>
          <span>Preparing match session...</span>
        </div>
      </div>
    </div>
  );
}
