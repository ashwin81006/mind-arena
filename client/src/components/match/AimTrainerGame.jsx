import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useArena } from '../../context/ArenaContext';

const TOTAL_TARGETS = 20;
const TARGET_SIZE_PX = 56;

/**
 * Isolated scoring formula for Aim Trainer.
 * Primary driver: Shorter completion time = significantly higher score.
 * Accuracy acts as a precision multiplier to prevent spam-clicking.
 */
export function calculateAimTrainerScore(hits, misses, totalTimeMsOrAvg, legacyAvg) {
  if (hits === 0) return 0;
  const totalClicks = hits + misses;
  const accuracy = hits / Math.max(1, totalClicks);

  // Resolve total completion time in milliseconds
  let timeMs = totalTimeMsOrAvg;
  if (!timeMs || (timeMs < 2000 && !legacyAvg)) {
    // If called with average reaction time instead of total time, extrapolate
    timeMs = (totalTimeMsOrAvg || legacyAvg || 400) * hits;
  }

  // Shorter completion time => More points
  // 4,000ms or faster: ~2000+ points (pro esports benchmark ~200ms/target)
  // 6,000ms: ~1877 points (~300ms/target)
  // 8,000ms: ~1738 points (~400ms/target)
  // 10,000ms: ~1600 points (~500ms/target)
  // 14,000ms: ~1323 points (~700ms/target)
  // 20,000ms: ~908 points (~1000ms/target)
  // 30,000ms: ~200 points (~1500ms/target)
  // > 30,000ms: scales down to min 50 points
  const minTime = 4000;  // 4.0 seconds
  const maxTime = 30000; // 30.0 seconds

  let timeScore;
  if (timeMs <= minTime) {
    timeScore = 2000 + Math.min(250, Math.round((minTime - timeMs) / 4));
  } else if (timeMs <= maxTime) {
    const ratio = (maxTime - timeMs) / (maxTime - minTime);
    timeScore = 200 + Math.round(ratio * 1800);
  } else {
    timeScore = Math.max(50, Math.round(200 - (timeMs - maxTime) / 100));
  }

  // Target completion ratio
  const completionRatio = hits / TOTAL_TARGETS;

  // Precision multiplier: penalizes random stray clicks
  const accuracyMultiplier = Math.pow(accuracy, 1.2);

  const finalScore = Math.round(timeScore * completionRatio * accuracyMultiplier);
  return Math.max(0, finalScore);
}

export default function AimTrainerGame({ onComplete, isPractice = false, onBackToHome }) {
  const arenaContext = useArena();
  const gameState = arenaContext?.gameState;
  const myPlayerId = arenaContext?.myPlayerId;
  const submitScore = arenaContext?.submitScore;
  const isHost = arenaContext?.isHost;
  const returnToLobby = arenaContext?.returnToLobby;
  const currentRoomId = arenaContext?.currentRoomId;

  // Phase: 'PREPARE' | 'ACTIVE' | 'GAME_OVER'
  const [phase, setPhase] = useState('PREPARE');
  const [targetCount, setTargetCount] = useState(0); // 0 to 20
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 }); // percentages
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [recentReaction, setRecentReaction] = useState(null);
  const [avgReaction, setAvgReaction] = useState(null);
  const [completionTime, setCompletionTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState('0.0');
  const [finalScore, setFinalScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [missAnimation, setMissAnimation] = useState(null); // click coordinate for miss splash

  const containerRef = useRef(null);
  const spawnTimeRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const clockIntervalRef = useRef(null);
  const reactionTimesRef = useRef([]);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const timerIdsRef = useRef([]);
  const phaseRef = useRef('PREPARE');
  const scoreSubmittedRef = useRef(false);
  const prngRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    timerIdsRef.current.forEach((id) => clearTimeout(id));
    timerIdsRef.current = [];
  }, []);

  const addTimer = useCallback((fn, delayMs) => {
    const id = setTimeout(fn, delayMs);
    timerIdsRef.current.push(id);
    return id;
  }, []);

  // Seeded PRNG generator (Mulberry32) for multiplayer room parity
  const createSeededPRNG = (seedString) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedString.length; i++) {
      h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
    }
    let s = h >>> 0;
    return function() {
      s |= 0;
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [clearAllTimers]);

  // Compute next target coordinate avoiding margins (room-seeded for multiplayer parity)
  const spawnNextTarget = useCallback(() => {
    const minPct = 12;
    const maxPct = 88;
    const rand = prngRef.current || Math.random;
    const nextX = Math.floor(minPct + rand() * (maxPct - minPct));
    const nextY = Math.floor(minPct + rand() * (maxPct - minPct));

    setTargetPos({ x: nextX, y: nextY });
    spawnTimeRef.current = performance.now();
  }, []);

  // Start the 20-target game session
  const startGame = useCallback(() => {
    clearAllTimers();
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    setHits(0);
    setMisses(0);
    setTargetCount(0);
    setRecentReaction(null);
    setAvgReaction(null);
    setCompletionTime(null);
    setElapsedSeconds('0.0');
    setFinalScore(0);
    setScoreSubmitted(false);
    scoreSubmittedRef.current = false;
    setMissAnimation(null);
    hitsRef.current = 0;
    missesRef.current = 0;
    reactionTimesRef.current = [];

    // Seeded PRNG for multiplayer competitive equality
    const seed = (!isPractice && currentRoomId)
      ? `${currentRoomId}_aim_round_${gameState?.currentRound || 1}`
      : `aim_${Date.now()}_${Math.random()}`;

    prngRef.current = createSeededPRNG(seed);
    phaseRef.current = 'ACTIVE';
    setPhase('ACTIVE');
    const startNow = performance.now();
    gameStartTimeRef.current = startNow;
    clockIntervalRef.current = setInterval(() => {
      const elapsed = (performance.now() - gameStartTimeRef.current) / 1000;
      setElapsedSeconds(elapsed.toFixed(1));
    }, 100);
    spawnNextTarget();
  }, [clearAllTimers, isPractice, currentRoomId, gameState?.currentRound, spawnNextTarget]);

  useEffect(() => {
    startGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle successful hit on target
  const handleTargetClick = (e) => {
    if (e) {
      e.stopPropagation(); // Prevent container miss event
    }
    if (phaseRef.current !== 'ACTIVE') return;

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
      phaseRef.current = 'GAME_OVER';
      setPhase('GAME_OVER');
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      const totalTime = Math.round(performance.now() - gameStartTimeRef.current);
      setCompletionTime(totalTime);
      setElapsedSeconds((totalTime / 1000).toFixed(2));
      const totalMisses = missesRef.current;
      const totalClicks = nextHits + totalMisses;
      const accuracy = Math.round((nextHits / Math.max(1, totalClicks)) * 100) / 100;

      // Primary score driver: shorter completion time = higher score
      const calculatedScore = calculateAimTrainerScore(nextHits, totalMisses, totalTime, avg);
      setFinalScore(calculatedScore);

      const result = {
        game: 'AIM_TRAINER',
        score: calculatedScore,
        accuracy,
        totalHits: nextHits,
        totalMisses,
        averageReactionTime: avg,
        totalTime
      };

      if (!scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true;
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
    if (phaseRef.current !== 'ACTIVE') return;

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
        </div>
      </div>
    );
  }

  if (gameState && gameState.phase === 'ROUND_RESULTS') {
    const results = gameState.results || [];
    return (
      <div className="match-results-card">
        <div className="results-header">
          <span className="game-badge" style={{ marginBottom: '0.4rem', display: 'inline-block' }}>
            Game {gameState.gameIndex || 3} of {gameState.totalGames || 5}
          </span>
          <h2>🎯 Aim Trainer Results</h2>
          <p>Tournament Standings after Aim Trainer</p>
        </div>
        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Player</span>
            <span style={{ textAlign: 'center' }}>Score</span>
            <span style={{ textAlign: 'right' }}>Points</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {results.map((entry) => {
            const isMe = entry.id === myPlayerId;
            return (
              <div key={entry.id} className={`leaderboard-row ${isMe ? 'is-me-row' : ''}`}>
                <span className="name-col">{entry.name} {isMe && <span className="badge-you">You</span>}</span>
                <span className="time-col text-good">{entry.points} pts</span>
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
            <span className="stat-label">Completion Time</span>
            <span className="stat-value text-good">
              {completionTime ? `${(completionTime / 1000).toFixed(2)}s` : `${elapsedSeconds}s`}
            </span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Avg / Target</span>
            <span className="stat-value">{avgReaction || 0} ms</span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{accuracyPct}%</span>
          </div>
          <div className="stat-summary-box highlight-box">
            <span className="stat-label">Final Score</span>
            <span className="stat-value">{finalScore} pts</span>
          </div>
        </div>

        {!isPractice && (
          <div className="round-finished-banner">
            <span className="pulsing-dot"></span>
            <span>Score submitted! Waiting for other players to finish...</span>
          </div>
        )}

        {!isPractice && gameState?.scoredPlayers && gameState.scoredPlayers.length > 0 && (
          <div className="arena-live-roster" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
            <span>Finished: </span>
            {gameState.scoredPlayers.map((p) => (
              <span key={p.id} className="scored-chip">
                ✓ {p.name}
              </span>
            ))}
          </div>
        )}

        <div className="match-over-actions">
          {isPractice && (
            <button className="btn btn-primary btn-lg" onClick={startGame}>
              🔄 Practice Again
            </button>
          )}
          {onBackToHome && (
            <button className="btn btn-secondary btn-sm" onClick={onBackToHome}>
              ← Back to Menu
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
          <p>Click 20 appearing targets as quickly and accurately as possible. Faster completion = higher score!</p>
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
              <span className="hud-metric-label">Time:</span>
              <span className="hud-metric-value text-good">{elapsedSeconds}s</span>
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
