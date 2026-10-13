import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useArena } from '../../context/ArenaContext';

/**
 * Isolated scoring calculation for Sequence Memory.
 * Can easily be adjusted or replaced independently.
 */
export function calculateSequenceMemoryScore(completedLevels, sequenceLength = 0) {
  if (completedLevels <= 0) return 0;
  // Base 100 points per level completed + 20 points per tile in highest sequence
  return (completedLevels * 100) + (Math.max(0, sequenceLength - 3) * 20);
}

export default function SequenceMemoryGame({ onComplete, isPractice = false, onBackToHome }) {
  const arenaContext = useArena();
  const gameState = arenaContext?.gameState;
  const myPlayerId = arenaContext?.myPlayerId;
  const submitScore = arenaContext?.submitScore;
  const isHost = arenaContext?.isHost;
  const returnToLobby = arenaContext?.returnToLobby;

  const currentRoomId = arenaContext?.currentRoomId;

  // Phase: 'IDLE' | 'SHOWING' | 'INPUT' | 'LEVEL_SUCCESS' | 'GAME_OVER'
  const [phase, setPhase] = useState('IDLE');
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState([]);
  const [activeTile, setActiveTile] = useState(null); // Tile currently lit
  const [wrongTile, setWrongTile] = useState(null);   // Tile clicked incorrectly
  const [playerStep, setPlayerStep] = useState(0);    // Current index in player's reproduction
  const [score, setScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [inputTimeLeftMs, setInputTimeLeftMs] = useState(0);
  const [inputTotalTimeMs, setInputTotalTimeMs] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Refs for timers and memory state to prevent stale closures and memory leaks
  const sequenceRef = useRef([]);
  const playerStepRef = useRef(0);
  const levelRef = useRef(1);
  const phaseRef = useRef('IDLE');
  const timerIdsRef = useRef([]);
  const countdownIntervalRef = useRef(null);
  const scoreSubmittedRef = useRef(false);
  const prngRef = useRef(null);
  const isInputLockedRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    timerIdsRef.current.forEach((id) => clearTimeout(id));
    timerIdsRef.current = [];
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const addTimer = useCallback((fn, delayMs) => {
    const id = setTimeout(fn, delayMs);
    timerIdsRef.current.push(id);
    return id;
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Seeded PRNG generator (Mulberry32)
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

  // Generate a random tile (0-8) that is never identical to the immediately preceding tile
  const getNextTile = (prng, lastTile) => {
    const rand = prng || Math.random;
    let next = Math.floor(rand() * 9);
    if (lastTile !== null && lastTile !== undefined) {
      while (next === lastTile) {
        next = Math.floor(rand() * 9);
      }
    }
    return next;
  };

  // Handle timeout when player takes too long to reproduce sequence
  const handleInputTimeout = useCallback(() => {
    if (phaseRef.current !== 'INPUT') return;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setPhase('GAME_OVER');
    phaseRef.current = 'GAME_OVER';
    setIsTimedOut(true);

    const currentSeq = sequenceRef.current;
    const finalCompletedLevels = Math.max(0, levelRef.current - 1);
    const finalSequenceLength = currentSeq.length;
    const finalScore = calculateSequenceMemoryScore(finalCompletedLevels, finalSequenceLength);
    setScore(finalScore);

    const result = {
      game: 'SEQUENCE_MEMORY',
      score: finalScore,
      highestLevel: finalCompletedLevels,
      sequenceLength: finalSequenceLength,
      timedOut: true
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
  }, [submitScore, onComplete]);

  // Play the sequence by highlighting tiles one by one
  const playSequence = useCallback((seqToPlay) => {
    clearAllTimers();
    setPhase('SHOWING');
    phaseRef.current = 'SHOWING';
    setActiveTile(null);
    setWrongTile(null);
    setInputTimeLeftMs(0);
    setInputTotalTimeMs(0);

    const stepDuration = 380; // ms tile stays lit
    const gapDuration = 140;  // ms between tiles
    const totalStepTime = stepDuration + gapDuration;

    seqToPlay.forEach((tileIndex, i) => {
      // Turn tile ON
      addTimer(() => {
        setActiveTile(tileIndex);
      }, i * totalStepTime + 150);

      // Turn tile OFF
      addTimer(() => {
        setActiveTile(null);
      }, i * totalStepTime + 150 + stepDuration);
    });

    // When sequence finishes showing, allow player input with strict thinking timeout
    const finishTime = seqToPlay.length * totalStepTime + 200;
    addTimer(() => {
      setActiveTile(null);
      setPhase('INPUT');
      phaseRef.current = 'INPUT';
      setPlayerStep(0);
      playerStepRef.current = 0;
      isInputLockedRef.current = false;

      // Thinking timeout: e.g. 3s per tile with a 9s baseline
      const turnDuration = Math.max(9000, seqToPlay.length * 2800);
      setInputTotalTimeMs(turnDuration);
      setInputTimeLeftMs(turnDuration);

      const startTime = performance.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const rem = Math.max(0, turnDuration - elapsed);
        setInputTimeLeftMs(rem);
        if (rem <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          handleInputTimeout();
        }
      }, 50);
    }, finishTime);
  }, [addTimer, clearAllTimers, handleInputTimeout]);

  // Advance to next level: keep existing sequence and append exactly ONE new tile
  const advanceToNextLevel = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const nextLvl = levelRef.current + 1;
    setLevel(nextLvl);
    levelRef.current = nextLvl;

    const currentSeq = sequenceRef.current;
    const lastTile = currentSeq[currentSeq.length - 1];
    const newTile = getNextTile(prngRef.current, lastTile);
    const nextSeq = [...currentSeq, newTile];

    setSequence(nextSeq);
    sequenceRef.current = nextSeq;
    setPlayerStep(0);
    playerStepRef.current = 0;
    playSequence(nextSeq);
  }, [playSequence]);

  // Start game from beginning
  const startGame = useCallback(() => {
    clearAllTimers();
    setScore(0);
    setScoreSubmitted(false);
    scoreSubmittedRef.current = false;
    setIsTimedOut(false);
    setWrongTile(null);
    setActiveTile(null);
    isInputLockedRef.current = false;

    // Distinct unique randomization per player & match so different players get different sequences
    const seed = `seq_${myPlayerId || 'p'}_${Date.now()}_${Math.random()}`;

    const prng = createSeededPRNG(seed);
    prngRef.current = prng;

    // Level 1 starts with 3 tiles (no consecutive duplicates)
    const t0 = getNextTile(prng, null);
    const t1 = getNextTile(prng, t0);
    const t2 = getNextTile(prng, t1);
    const initialSeq = [t0, t1, t2];

    setLevel(1);
    levelRef.current = 1;
    setSequence(initialSeq);
    sequenceRef.current = initialSeq;
    setPlayerStep(0);
    playerStepRef.current = 0;

    playSequence(initialSeq);
  }, [clearAllTimers, myPlayerId, playSequence]);

  // Auto-start when mounted
  useEffect(() => {
    startGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle player tile click
  const handleTileClick = (tileIndex) => {
    // Guard: ignore clicks during display phase or game over
    if (phaseRef.current !== 'INPUT') return;

    // Input debounce guard: prevent rapid-tap/touch double fire
    if (isInputLockedRef.current) return;
    isInputLockedRef.current = true;
    addTimer(() => {
      isInputLockedRef.current = false;
    }, 120);

    const currentSeq = sequenceRef.current;
    const currentStep = playerStepRef.current;
    const expectedTile = currentSeq[currentStep];

    if (tileIndex === expectedTile) {
      // CORRECT TILE
      setActiveTile(tileIndex);
      addTimer(() => setActiveTile(null), 180);

      const nextStep = currentStep + 1;
      setPlayerStep(nextStep);
      playerStepRef.current = nextStep;

      // Completed full sequence for this level!
      if (nextStep >= currentSeq.length) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        const completedLevel = levelRef.current;
        const newScore = calculateSequenceMemoryScore(completedLevel, currentSeq.length);
        setScore(newScore);
        setPhase('LEVEL_SUCCESS');
        phaseRef.current = 'LEVEL_SUCCESS';

        // Brief celebration then move to next level (appending +1 tile)
        addTimer(() => {
          advanceToNextLevel();
        }, 800);
      }
    } else {
      // INCORRECT TILE -> GAME OVER
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setWrongTile(tileIndex);
      setPhase('GAME_OVER');
      phaseRef.current = 'GAME_OVER';

      const finalCompletedLevels = Math.max(0, levelRef.current - 1);
      const finalSequenceLength = currentSeq.length;
      const finalScore = calculateSequenceMemoryScore(finalCompletedLevels, finalSequenceLength);
      setScore(finalScore);

      const result = {
        game: 'SEQUENCE_MEMORY',
        score: finalScore,
        highestLevel: finalCompletedLevels,
        sequenceLength: finalSequenceLength,
        timedOut: false
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
    }
  };

  // If in match and phase is ROUND_RESULTS or MATCH_OVER, show shared match UI
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
            Game {gameState.gameIndex || 2} of {gameState.totalGames || 5}
          </span>
          <h2>🧠 Sequence Memory Results</h2>
          <p>Tournament Standings after Sequence Memory</p>
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

  // GAME OVER SCREEN
  if (phase === 'GAME_OVER') {
    const highestLevel = Math.max(0, level - 1);
    const maxSequence = sequence.length;

    return (
      <div className="match-results-card sequence-game-over-card">
        <div className="results-header">
          <span className="game-over-icon">{isTimedOut ? '⏳' : '🧠'}</span>
          <h2 style={{ color: '#ef4444' }}>{isTimedOut ? "Time's Up!" : 'Round Finished'}</h2>
          <p>{isTimedOut ? 'You ran out of time to reproduce the sequence.' : 'You made an incorrect move in the sequence.'}</p>
        </div>

        <div className="stats-summary-grid">
          <div className="stat-summary-box">
            <span className="stat-label">Level Reached</span>
            <span className="stat-value">{highestLevel}</span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Max Sequence</span>
            <span className="stat-value">{maxSequence} tiles</span>
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

  // Active Gameplay UI
  let promptText = 'Watch the sequence closely...';
  let promptClass = 'prompt-showing';
  if (phase === 'INPUT') {
    promptText = `Reproduce sequence (${playerStep} / ${sequence.length})`;
    promptClass = 'prompt-input';
  } else if (phase === 'LEVEL_SUCCESS') {
    promptText = 'Level Complete! Excellent recall!';
    promptClass = 'prompt-success';
  }

  return (
    <div className="game-arena-wrapper">
      <div className="arena-top-info">
        <span className="game-badge">🧠 Sequence Memory</span>
        <span className="round-badge">
          Level {level} • {sequence.length} Tiles
        </span>
        {phase === 'INPUT' && inputTotalTimeMs > 0 && (
          <span className={`round-badge ${inputTimeLeftMs <= 3000 ? 'text-danger' : ''}`} style={{ fontWeight: 'bold' }}>
            ⏱️ {(inputTimeLeftMs / 1000).toFixed(1)}s
          </span>
        )}
        <span className="score-chip">Score: {score}</span>
      </div>

      <div className="sequence-arena-panel">
        <div className={`sequence-prompt-banner ${promptClass}`}>
          {phase === 'SHOWING' && <span className="pulsing-eye">👀</span>}
          {phase === 'INPUT' && <span className="pulsing-tap">👆</span>}
          {phase === 'LEVEL_SUCCESS' && <span className="celebration-star">✨</span>}
          <span>{promptText}</span>
        </div>

        {phase === 'INPUT' && inputTotalTimeMs > 0 && (
          <div className="number-progress-container" style={{ width: '100%', maxWidth: '380px', margin: '0 auto 0.75rem auto' }}>
            <div
              className="number-progress-bar"
              style={{
                width: `${(inputTimeLeftMs / inputTotalTimeMs) * 100}%`,
                backgroundColor: inputTimeLeftMs <= 3000 ? '#ef4444' : '#6366f1',
                transition: 'width 0.05s linear'
              }}
            />
          </div>
        )}

        {/* 3x3 Interactive Memory Grid */}
        <div className="sequence-grid-3x3" role="grid" aria-label="3 by 3 sequence grid">
          {Array.from({ length: 9 }).map((_, index) => {
            const isLit = activeTile === index;
            const isError = wrongTile === index;
            const isInputAllowed = phase === 'INPUT';

            let tileClass = 'sequence-tile';
            if (isLit) tileClass += ' tile-active';
            if (isError) tileClass += ' tile-error';
            if (!isInputAllowed) tileClass += ' tile-disabled';

            return (
              <button
                key={index}
                className={tileClass}
                disabled={!isInputAllowed}
                onClick={() => handleTileClick(index)}
                aria-label={`Tile ${index + 1}`}
                type="button"
              />
            );
          })}
        </div>

        {/* Live Step Progress Indicators */}
        <div className="sequence-dots-bar">
          {sequence.map((_, i) => (
            <span
              key={i}
              className={`seq-dot ${i < playerStep ? 'dot-completed' : ''} ${i === playerStep && phase === 'INPUT' ? 'dot-current' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Live Players Scored Counter in multiplayer */}
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
