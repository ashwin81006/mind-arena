import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useArena } from '../../context/ArenaContext';

/**
 * Isolated scoring calculation for Visual Memory.
 */
export function calculateVisualMemoryScore(completedLevels, correctTiles = 0) {
  if (completedLevels <= 0) return 0;
  return (completedLevels * 100) + (correctTiles * 15);
}

/**
 * Get grid dimension (e.g. 3 for 3x3, 4 for 4x4) and target tile count based on level.
 */
export function getVisualMemoryConfig(level) {
  // Level 1: 3x3, 3 tiles
  // Level 2: 3x3, 4 tiles
  // Level 3: 4x4, 5 tiles
  // Level 4: 4x4, 6 tiles
  // Level 5: 5x5, 7 tiles
  // Level 6: 5x5, 8 tiles
  // Level 7+: 6x6, 9+ tiles
  let gridSize = 3;
  if (level >= 7) gridSize = 6;
  else if (level >= 5) gridSize = 5;
  else if (level >= 3) gridSize = 4;

  const tileCount = level + 2;
  return { gridSize, tileCount };
}

export default function VisualMemoryGame({ onComplete, isPractice = false, onBackToHome }) {
  const arenaContext = useArena();
  const gameState = arenaContext?.gameState;
  const myPlayerId = arenaContext?.myPlayerId;
  const submitScore = arenaContext?.submitScore;
  const isHost = arenaContext?.isHost;
  const returnToLobby = arenaContext?.returnToLobby;
  const currentRoomId = arenaContext?.currentRoomId;

  // Phase: 'SHOWING' | 'SELECTING' | 'VALIDATING' | 'GAME_OVER'
  const [phase, setPhase] = useState('SHOWING');
  const [level, setLevel] = useState(1);
  const [gridSize, setGridSize] = useState(3);
  const [targetTiles, setTargetTiles] = useState(new Set());     // Positions that were highlighted
  const [selectedTiles, setSelectedTiles] = useState(new Set()); // Positions selected by player
  const [validationResult, setValidationResult] = useState(null); // Comparison after submit
  const [score, setScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [totalCorrectAccumulated, setTotalCorrectAccumulated] = useState(0);
  const [totalIncorrectAccumulated, setTotalIncorrectAccumulated] = useState(0);

  const timerIdsRef = useRef([]);
  const targetTilesRef = useRef(new Set());
  const selectedTilesRef = useRef(new Set());
  const levelRef = useRef(1);
  const phaseRef = useRef('SHOWING');
  const totalCorrectRef = useRef(0);
  const totalIncorrectRef = useRef(0);
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

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

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

  // Start a specific level
  const startLevel = useCallback((lvl) => {
    clearAllTimers();
    setLevel(lvl);
    levelRef.current = lvl;

    const { gridSize: size, tileCount } = getVisualMemoryConfig(lvl);
    setGridSize(size);

    // Pick deterministic random unique tile indices using room-seeded PRNG
    const rand = prngRef.current || Math.random;
    const totalCells = size * size;
    const targetSet = new Set();
    while (targetSet.size < tileCount) {
      targetSet.add(Math.floor(rand() * totalCells));
    }

    setTargetTiles(targetSet);
    targetTilesRef.current = targetSet;
    setSelectedTiles(new Set());
    selectedTilesRef.current = new Set();
    setValidationResult(null);
    setPhase('SHOWING');
    phaseRef.current = 'SHOWING';

    // Memorization duration: e.g. 1300ms + (tileCount * 50ms)
    const memorizationTime = 1300 + (tileCount * 50);
    addTimer(() => {
      setPhase('SELECTING');
      phaseRef.current = 'SELECTING';
    }, memorizationTime);
  }, [addTimer, clearAllTimers]);

  const startGame = useCallback(() => {
    clearAllTimers();
    setScore(0);
    setScoreSubmitted(false);
    setTotalCorrectAccumulated(0);
    setTotalIncorrectAccumulated(0);
    totalCorrectRef.current = 0;
    totalIncorrectRef.current = 0;
    scoreSubmittedRef.current = false;
    phaseRef.current = 'SHOWING';

    // Seeded PRNG for multiplayer competitive equality
    const seed = (!isPractice && currentRoomId)
      ? `${currentRoomId}_vm_round_${gameState?.currentRound || 1}`
      : `vm_${Date.now()}_${Math.random()}`;

    prngRef.current = createSeededPRNG(seed);
    startLevel(1);
  }, [clearAllTimers, isPractice, currentRoomId, gameState?.currentRound, startLevel]);

  useEffect(() => {
    startGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Player clicks/deselects a tile during SELECTING phase
  const handleTileClick = (index) => {
    if (phaseRef.current !== 'SELECTING') return;

    setSelectedTiles((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      selectedTilesRef.current = next;
      return next;
    });
  };

  // Submit player's selection
  const handleSubmit = () => {
    if (phaseRef.current !== 'SELECTING') return;
    phaseRef.current = 'VALIDATING';
    setPhase('VALIDATING');

    const targets = targetTilesRef.current;
    const selected = selectedTilesRef.current;

    // Check set equality: every target must be selected, and no non-targets selected
    let correctCount = 0;
    let incorrectCount = 0;

    selected.forEach((idx) => {
      if (targets.has(idx)) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const missingCount = targets.size - correctCount;
    const isCorrect = (correctCount === targets.size && incorrectCount === 0);

    setValidationResult({
      isCorrect,
      correctIndices: [...selected].filter((idx) => targets.has(idx)),
      wrongIndices: [...selected].filter((idx) => !targets.has(idx)),
      missedIndices: [...targets].filter((idx) => !selected.has(idx))
    });

    if (isCorrect) {
      // SUCCESS!
      const completedLevel = levelRef.current;
      const newCorrectTotal = totalCorrectRef.current + correctCount;
      totalCorrectRef.current = newCorrectTotal;
      setTotalCorrectAccumulated(newCorrectTotal);

      const newScore = calculateVisualMemoryScore(completedLevel, newCorrectTotal);
      setScore(newScore);

      addTimer(() => {
        startLevel(completedLevel + 1);
      }, 1000);
    } else {
      // WRONG -> GAME OVER
      const newIncorrectTotal = totalIncorrectRef.current + incorrectCount + missingCount;
      totalIncorrectRef.current = newIncorrectTotal;
      setTotalIncorrectAccumulated(newIncorrectTotal);

      const finalCompletedLevels = Math.max(0, levelRef.current - 1);
      const finalScore = calculateVisualMemoryScore(finalCompletedLevels, totalCorrectRef.current);
      setScore(finalScore);

      addTimer(() => {
        phaseRef.current = 'GAME_OVER';
        setPhase('GAME_OVER');
        const result = {
          game: 'VISUAL_MEMORY',
          score: finalScore,
          highestLevel: finalCompletedLevels,
          correctTiles: totalCorrectRef.current,
          incorrectTiles: newIncorrectTotal
        };

        if (!scoreSubmittedRef.current) {
          scoreSubmittedRef.current = true;
          setScoreSubmitted(true);
          if (submitScore) {
            submitScore(finalScore);
          }
          if (onComplete) {
            onComplete(result);
          }
        }
      }, 1500); // Give player 1.5s to see what was right/wrong on grid
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
            Game {gameState.gameIndex || 5} of {gameState.totalGames || 5}
          </span>
          <h2>👁️ Visual Memory Results</h2>
          <p>Tournament Standings after Visual Memory</p>
        </div>
        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Player</span>
            <span style={{ textAlign: 'center' }}>Level</span>
            <span style={{ textAlign: 'right' }}>Score</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {results.map((entry) => {
            const isMe = entry.id === myPlayerId;
            return (
              <div key={entry.id} className={`leaderboard-row ${isMe ? 'is-me-row' : ''}`}>
                <span className="name-col">{entry.name} {isMe && <span className="badge-you">You</span>}</span>
                <span className="time-col text-good">Lvl {entry.reaction > 0 ? Math.round(entry.reaction / 100) : 0}</span>
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

  // GAME OVER / ROUND FINISHED SCREEN
  if (phase === 'GAME_OVER') {
    const highestLevel = Math.max(0, level - 1);

    return (
      <div className="match-results-card visual-game-over-card">
        <div className="results-header">
          <span className="game-over-icon">👁️</span>
          <h2 style={{ color: '#ef4444' }}>Round Finished</h2>
          <p>Strikes exhausted for this round.</p>
        </div>

        <div className="stats-summary-grid">
          <div className="stat-summary-box">
            <span className="stat-label">Level Reached</span>
            <span className="stat-value">{highestLevel}</span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Correct Tiles</span>
            <span className="stat-value text-good">{totalCorrectAccumulated}</span>
          </div>
          <div className="stat-summary-box highlight-box">
            <span className="stat-label">Final Score</span>
            <span className="stat-value">{score} pts</span>
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

  const totalCells = gridSize * gridSize;

  return (
    <div className="game-arena-wrapper">
      <div className="arena-top-info">
        <span className="game-badge">👁️ Visual Memory</span>
        <span className="round-badge">
          Level {level} • {gridSize}×{gridSize} Grid ({targetTiles.size} Tiles)
        </span>
        <span className="score-chip">Score: {score}</span>
      </div>

      <div className="visual-arena-panel">
        <div className="visual-status-banner">
          {phase === 'SHOWING' && (
            <div className="banner-memorize">
              <span className="pulsing-dot"></span>
              <span>Memorize the highlighted tile positions!</span>
            </div>
          )}
          {phase === 'SELECTING' && (
            <div className="banner-selecting">
              <span>Select the {targetTiles.size} tiles ({selectedTiles.size} / {targetTiles.size} selected)</span>
            </div>
          )}
          {phase === 'VALIDATING' && (
            <div className={`banner-validating ${validationResult?.isCorrect ? 'text-good' : 'text-danger'}`}>
              <span>{validationResult?.isCorrect ? '✅ PERFECT MATCH!' : '❌ INCORRECT TILES!'}</span>
            </div>
          )}
        </div>

        {/* Dynamic N x N Grid */}
        <div
          className="visual-memory-grid"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            maxWidth: `${Math.min(420, gridSize * 85)}px`
          }}
          role="grid"
          aria-label={`${gridSize} by ${gridSize} visual memory grid`}
        >
          {Array.from({ length: totalCells }).map((_, index) => {
            const isTarget = targetTiles.has(index);
            const isSelected = selectedTiles.has(index);

            let tileClass = 'visual-tile';

            if (phase === 'SHOWING') {
              if (isTarget) tileClass += ' visual-tile-highlight';
              tileClass += ' visual-tile-disabled';
            } else if (phase === 'SELECTING') {
              if (isSelected) tileClass += ' visual-tile-selected';
            } else if (phase === 'VALIDATING') {
              if (isSelected && isTarget) {
                tileClass += ' visual-tile-correct';
              } else if (isSelected && !isTarget) {
                tileClass += ' visual-tile-wrong';
              } else if (!isSelected && isTarget) {
                tileClass += ' visual-tile-missed';
              }
            }

            return (
              <button
                key={index}
                className={tileClass}
                disabled={phase !== 'SELECTING'}
                onClick={() => handleTileClick(index)}
                aria-label={`Tile ${index + 1}`}
                type="button"
              />
            );
          })}
        </div>

        {/* Submit Button in Selection Phase */}
        {phase === 'SELECTING' && (
          <div className="visual-controls-bar">
            <button
              className="btn btn-primary btn-lg btn-submit-visual"
              onClick={handleSubmit}
            >
              SUBMIT ({selectedTiles.size} / {targetTiles.size})
            </button>
          </div>
        )}
      </div>

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
