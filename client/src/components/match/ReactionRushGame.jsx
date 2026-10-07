import React, { useState, useEffect, useRef } from 'react';
import { useArena } from '../../context/ArenaContext';

export default function ReactionRushGame() {
  const { gameState, myPlayerId, submitScore, isHost, returnToLobby, leaveRoom } = useArena();
  const [clickedThisRound, setClickedThisRound] = useState(false);
  const [myReactionTime, setMyReactionTime] = useState(null);
  const [falseStart, setFalseStart] = useState(false);

  const clickedThisRoundRef = useRef(false);
  const localTriggerRef = useRef(null);

  // Reset player click state when a new round starts or prepares
  useEffect(() => {
    if (gameState?.phase === 'STARTING' || gameState?.phase === 'WAITING') {
      clickedThisRoundRef.current = false;
      localTriggerRef.current = null;
      setClickedThisRound(false);
      setMyReactionTime(null);
      setFalseStart(false);
    } else if (gameState?.phase === 'TRIGGERED') {
      if (!localTriggerRef.current) {
        localTriggerRef.current = gameState.localTriggerTime || performance.now();
      }
    }
  }, [gameState?.phase, gameState?.currentRound, gameState?.localTriggerTime]);

  const handleBoxClick = (e) => {
    if (e && e.cancelable) {
      e.preventDefault();
    }
    if (clickedThisRoundRef.current || clickedThisRound) return;

    if (gameState?.phase === 'WAITING') {
      // Clicked too early while screen is red!
      clickedThisRoundRef.current = true;
      setClickedThisRound(true);
      setFalseStart(true);
      submitScore(-1);
    } else if (gameState?.phase === 'TRIGGERED') {
      // Clicked / pressed on green instantly!
      clickedThisRoundRef.current = true;
      setClickedThisRound(true);

      const now = performance.now();
      const trigger = localTriggerRef.current || gameState.localTriggerTime || now;
      // High-precision local elapsed time: immune to device-to-device clock skew
      const reactionMs = Math.max(80, Math.round(now - trigger));

      setMyReactionTime(reactionMs);
      submitScore(reactionMs);
    }
  };

  const handleKeyDown = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      handleBoxClick(e);
    }
  };

  if (!gameState) {
    return (
      <div className="game-loading-box">
        <p>Connecting to match session...</p>
      </div>
    );
  }

  // Final Match Podium
  if (gameState.phase === 'MATCH_OVER') {
    const leaderboard = gameState.leaderboard || [];

    return (
      <div className="match-results-card">
        <div className="results-header">
          <h2>🏆 Match Completed</h2>
          <p>Final Standings across all rounds</p>
        </div>

        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Rank</span>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Score</span>
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

  // Round Results Screen
  if (gameState.phase === 'ROUND_RESULTS') {
    const results = gameState.results || [];

    return (
      <div className="match-results-card">
        <div className="results-header">
          <h2>Round {gameState.roundNumber} Results</h2>
          <p>Reaction Rush Standings</p>
        </div>

        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Player</span>
            <span style={{ textAlign: 'center' }}>Reaction</span>
            <span style={{ textAlign: 'right' }}>Round Pts</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>

          {results.map((entry) => {
            const isMe = entry.id === myPlayerId;
            let reactionText = `${entry.reaction} ms`;
            let reactionClass = 'text-good';

            if (entry.reaction === -1) {
              reactionText = 'False Start';
              reactionClass = 'text-danger';
            } else if (entry.reaction <= -2) {
              reactionText = 'Missed';
              reactionClass = 'text-muted';
            } else if (entry.reaction > 400) {
              reactionClass = 'text-warning';
            }

            return (
              <div key={entry.id} className={`leaderboard-row ${isMe ? 'is-me-row' : ''}`}>
                <span className="name-col">
                  {entry.name} {isMe && <span className="badge-you">You</span>}
                </span>
                <span className={`time-col ${reactionClass}`}>{reactionText}</span>
                <span className="pts-col">+{entry.points}</span>
                <span className="total-col">{entry.total}</span>
              </div>
            );
          })}
        </div>

        <div className="next-round-bar">
          <span className="pulsing-dot"></span>
          <span>Next round starting soon...</span>
        </div>
      </div>
    );
  }

  // Determine Interactive Arena Surface State
  let surfaceClass = 'surface-prepare';
  let titleText = 'Get Ready...';
  let subtitleText = `Round ${gameState.currentRound || 1} of ${gameState.totalRounds || 3}`;

  if (gameState.phase === 'WAITING') {
    if (falseStart) {
      surfaceClass = 'surface-false-start';
      titleText = 'TOO EARLY!';
      subtitleText = 'False start! 0 points for this round.';
    } else {
      surfaceClass = 'surface-waiting';
      titleText = 'WAIT FOR GREEN...';
      subtitleText = 'Do not click yet!';
    }
  } else if (gameState.phase === 'TRIGGERED') {
    if (clickedThisRound) {
      surfaceClass = 'surface-clicked';
      titleText = `${myReactionTime} ms`;
      subtitleText = 'Nice reaction! Waiting for all players to finish...';
    } else {
      surfaceClass = 'surface-triggered';
      titleText = 'CLICK NOW!';
      subtitleText = 'Click as fast as you can!';
    }
  }

  return (
    <div className="game-arena-wrapper">
      <div className="arena-top-info">
        <span className="game-badge">⚡ Reaction Rush</span>
        <span className="round-badge">
          Round {gameState.currentRound || 1} / {gameState.totalRounds || 3}
        </span>
      </div>

      {/* Main Interactive Click Area */}
      <div
        className={`reaction-click-area ${surfaceClass}`}
        onPointerDown={handleBoxClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <div className="click-content">
          <h1 className="reaction-title">{titleText}</h1>
          <p className="reaction-subtitle">{subtitleText}</p>
        </div>
      </div>

      {/* Live Players Scored Counter */}
      {gameState.scoredPlayers && gameState.scoredPlayers.length > 0 && (
        <div className="arena-live-roster">
          <span>Players finished: </span>
          {gameState.scoredPlayers.map((p) => (
            <span key={p.id} className="scored-chip">
              ✓ {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
