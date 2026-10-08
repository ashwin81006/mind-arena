import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useArena } from '../../context/ArenaContext';

const TOTAL_TARGETS = 20;
const TARGET_SIZE_PX = 56;

/**
 * Isolated scoring formula for Aim Trainer.
 * Rewards both fast reaction time and high accuracy.
 */
export function calculateAimTrainerScore(hits, misses, avgReactionMs) {
  if (hits === 0) return 0;
  const totalClicks = hits + misses;
  const accuracy = hits / Math.max(1, totalClicks);

  // Speed points: up to 1000 points. 150ms or faster gives full speed points, 900ms or slower gives 0
  const clampedReaction = Math.min(900, Math.max(150, avgReactionMs));
  const speedRatio = (900 - clampedReaction) / (900 - 150);
  const speedBonus = Math.round(speedRatio * 1000);

  // Target points: 50 pts per target hit (up to 1000 pts for 20 hits)
  const targetBonus = hits * 50;

  // Final score weighted by accuracy
  const totalScore = Math.round((targetBonus + speedBonus) * Math.pow(accuracy, 1.4));
  return Math.max(0, totalScore);
}

export default function AimTrainerGame({ onComplete, isPractice = false, onBackToHome }) {
  const arenaContext = useArena();
  const gameState = arenaContext?.gameState;
  const myPlayerId = arenaContext?.myPlayerId;
  const submitScore = arenaContext?.submitScore;
  const isHost = arenaContext?.isHost;
  const returnToLobby = arenaContext?.returnToLobby;
  const leaveRoom = arenaContext?.leaveRoom;

  // Phase: 'PREPARE' | 'ACTIVE' | 'GAME_OVER'
  const [phase, setPhase] = useState('PREPARE');
  const [targetCount, setTargetCount] = useState(0); // 0 to 20
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 }); // percentages
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [recentReaction, setRecentReaction] = useState(null);
  const [avgReaction, setAvgReaction] = useState(null);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [missAnimation, setMissAnimation] = useState(null); // click coordinate for miss splash

  const containerRef = useRef(null);
  const spawnTimeRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const reactionTimesRef = useRef([]);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const timerIdsRef = useRef([]);

  const clearAllTimers = useCallback(() => {
    timerIdsRef.current.forEach((id) => clearTimeout(id));
    timerIdsRef.current = [];
  }, []);

  const addTimer = useCallback((fn, delayMs) => {
    const id = setTimeout(fn, delayMs);
    timerIdsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Compute next random target coordinate avoiding margins
  const spawnNextTarget = useCallback(() => {
    // Generate safe percentage coordinates between 8% and 92%
    const minPct = 10;
    const maxPct = 90;
    const nextX = Math.floor(minPct + Math.random() * (maxPct - minPct));
    const nextY = Math.floor(minPct + Math.random() * (maxPct - minPct));

    setTargetPos({ x: nextX, y: nextY });
    spawnTimeRef.current = performance.now();
  }, []);

  // Start the 20-target game session
  const startGame = useCallback(() => {
    clearAllTimers();
    setHits(0);
    setMisses(0);
    setTargetCount(0);
    setRecentReaction(null);
    setAvgReaction(null);
    setFinalScore(0);
    setScoreSubmitted(false);
    setMissAnimation(null);
    hitsRef.current = 0;
    missesRef.current = 0;
    reactionTimesRef.current = [];

    setPhase('ACTIVE');
    gameStartTimeRef.current = performance.now();
    spawnNextTarget();
  }, [clearAllTimers, spawnNextTarget]);

  useEffect(() => {
    startGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle successful hit on target
  const handleTargetClick = (e) => {
    if (e) {
      e.stopPropagation(); // Prevent container miss event
    }
    if (phase !== 'ACTIVE') return;

    const hitTime = performance.now();
    const spawnTime = spawnTimeRef.current || hitTime;
    const reactionMs = Math.max(60, Math.round(hitTime - spawnTime));

    reactionTimesRef.current.push(reactionMs);
    setRecentReaction(reactionMs);

    const nextHits = hitsRef.current + 1;
    hitsRef.current = nextHits;
    setHits(nextHits);
    setTargetCount(nextHits);

    // Calculate running average reaction
    const sum = reactionTimesRef.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / reactionTimesRef.current.length);
    setAvgReaction(avg);

    if (nextHits >= TOTAL_TARGETS) {
      // Completed all 20 targets -> GAME OVER!
      const totalTime = Math.round(performance.now() - gameStartTimeRef.current);
      const totalMisses = missesRef.current;
      const totalClicks = nextHits + totalMisses;
      const accuracy = Math.round((nextHits / Math.max(1, totalClicks)) * 100) / 100;

      const calculatedScore = calculateAimTrainerScore(nextHits, totalMisses, avg);
      setFinalScore(calculatedScore);
      setPhase('GAME_OVER');

      const result = {
        game: 'AIM_TRAINER',
        score: calculatedScore,
        accuracy,
        totalHits: nextHits,
        totalMisses,
        averageReactionTime: avg,
        totalTime
      };

      if (!scoreSubmitted) {
        setScoreSubmitted(true);
        if (submitScore) {
          submitScore(calculatedScore);
        }
        if (onComplete) {
          onComplete(result);
        }
      }
    } else {
      // Spawn next target
      spawnNextTarget();
    }
  };

  // Handle click on container (outside target) -> Miss!
  const handleArenaClick = (e) => {
    if (phase !== 'ACTIVE') return;

    const nextMisses = missesRef.current + 1;
    missesRef.current = nextMisses;
    setMisses(nextMisses);

    // Show temporary ripple / miss marker where clicked
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      setMissAnimation({ x: clickX, y: clickY, id: Date.now() });
      addTimer(() => setMissAnimation(null), 400);
    }
  };

  // Match final / round results screens
  if (gameState && gameState.phase === 'MATCH_OVER') {
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
              <div key={player.id} className={`leaderboard-row ${isMe ? 'is-me-row' : ''} rank-${player.rank}`}>
                <span className="rank-col">{rankBadge}</span>
                <span className="name-col">{player.name} {isMe && <span className="badge-you">You</span>}</span>
                <span className="score-col">{player.score.toLocaleString()} pts</span>
              </div>
            );
          })}
        </div>
        <div className="match-over-actions">
          {isHost ? (
            <button className="btn btn-primary btn-lg" onClick={returnToLobby}>Return to Lobby</button>
          ) : (
            <div className="waiting-host-text">Waiting for host to return to lobby...</div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={leaveRoom}>Exit Match</button>
        </div>
      </div>
    );
  }

  if (gameState && gameState.phase === 'ROUND_RESULTS') {
    const results = gameState.results || [];
    return (
      <div className="match-results-card">
        <div className="results-header">
          <h2>Round {gameState.roundNumber} Results</h2>
          <p>Aim Trainer Standings</p>
        </div>
        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Player</span>
            <span style={{ textAlign: 'center' }}>Avg Reaction</span>
            <span style={{ textAlign: 'right' }}>Score</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {results.map((entry) => {
            const isMe = entry.id === myPlayerId;
            return (
              <div key={entry.id} className={`leaderboard-row ${isMe ? 'is-me-row' : ''}`}>
                <span className="name-col">{entry.name} {isMe && <span className="badge-you">You</span>}</span>
                <span className="time-col text-good">{entry.reaction > 0 ? `${entry.reaction} ms` : 'Missed'}</span>
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

  // GAME OVER SCREEN
  if (phase === 'GAME_OVER') {
    const totalClicks = hits + misses;
    const accuracyPct = Math.round((hits / Math.max(1, totalClicks)) * 100);

    return (
      <div className="match-results-card aim-game-over-card">
        <div className="results-header">
          <span className="game-over-icon">🎯</span>
          <h2>Target Course Finished!</h2>
          <p>All {TOTAL_TARGETS} targets completed.</p>
        </div>

        <div className="stats-summary-grid">
          <div className="stat-summary-box">
            <span className="stat-label">Avg Reaction</span>
            <span className="stat-value text-good">{avgReaction || 0} ms</span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{accuracyPct}%</span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Hits / Misses</span>
            <span className="stat-value">{hits} / {misses}</span>
          </div>
          <div className="stat-summary-box highlight-box">
            <span className="stat-label">Final Score</span>
            <span className="stat-value">{finalScore} pts</span>
          </div>
        </div>

        <div className="match-over-actions">
          <button className="btn btn-primary btn-lg" onClick={startGame}>
            🔄 Play Again
          </button>
          {onBackToHome && (
            <button className="btn btn-secondary btn-sm" onClick={onBackToHome}>
              ← Back to Menu
            </button>
          )}
          {leaveRoom && !isPractice && (
            <button className="btn btn-secondary btn-sm" onClick={leaveRoom}>
              Exit Match
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalClicksSoFar = hits + misses;
  const currentAccuracy = totalClicksSoFar > 0 ? Math.round((hits / totalClicksSoFar) * 100) : 100;

  return (
    <div className="game-arena-wrapper">
      <div className="arena-top-info">
        <span className="game-badge">🎯 Aim Trainer</span>
        <span className="round-badge">
          Target {targetCount + 1} / {TOTAL_TARGETS}
        </span>
        <span className="accuracy-chip">Accuracy: {currentAccuracy}%</span>
      </div>

      {phase === 'PREPARE' ? (
        <div className="aim-start-card">
          <h2>Ready to Test Your Aim?</h2>
          <p>Click 20 appearing targets as quickly and accurately as possible.</p>
          <button className="btn btn-primary btn-lg" onClick={startGame}>
            START AIM TRAINER
          </button>
        </div>
      ) : (
        <div className="aim-arena-panel">
          {/* Live HUD Bar */}
          <div className="aim-hud-bar">
            <div className="hud-metric">
              <span className="hud-metric-label">Remaining:</span>
              <span className="hud-metric-value">{TOTAL_TARGETS - targetCount}</span>
            </div>
            <div className="hud-metric">
              <span className="hud-metric-label">Last Hit:</span>
              <span className="hud-metric-value">{recentReaction ? `${recentReaction}ms` : '--'}</span>
            </div>
            <div className="hud-metric">
              <span className="hud-metric-label">Misses:</span>
              <span className="hud-metric-value text-danger">{misses}</span>
            </div>
          </div>

          {/* Interactive Aim Arena Target Canvas */}
          <div
            ref={containerRef}
            className="aim-arena-canvas"
            onPointerDown={handleArenaClick}
            role="region"
            aria-label="Aim trainer click area"
          >
            {/* The Clickable Target */}
            <div
              className="aim-target-circle"
              style={{
                left: `${targetPos.x}%`,
                top: `${targetPos.y}%`,
                width: `${TARGET_SIZE_PX}px`,
                height: `${TARGET_SIZE_PX}px`
              }}
              onPointerDown={handleTargetClick}
              role="button"
              tabIndex={0}
              aria-label="Target"
            >
              <div className="target-outer-ring" />
              <div className="target-inner-ring" />
              <div className="target-bullseye" />
            </div>

            {/* Click miss visual marker */}
            {missAnimation && (
              <div
                className="aim-miss-ripple"
                style={{
                  left: `${missAnimation.x}px`,
                  top: `${missAnimation.y}px`
                }}
              />
            )}
          </div>
        </div>
      )}

      {gameState?.scoredPlayers && gameState.scoredPlayers.length > 0 && (
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
