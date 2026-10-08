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
  const leaveRoom = arenaContext?.leaveRoom;

  // Phase: 'IDLE' | 'SHOWING' | 'INPUT' | 'LEVEL_SUCCESS' | 'GAME_OVER'
  const [phase, setPhase] = useState('IDLE');
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState([]);
  const [activeTile, setActiveTile] = useState(null); // Tile currently lit
  const [wrongTile, setWrongTile] = useState(null);   // Tile clicked incorrectly
  const [playerStep, setPlayerStep] = useState(0);    // Current index in player's reproduction
  const [score, setScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  // Refs for timers and memory state to prevent stale closures and memory leaks
  const sequenceRef = useRef([]);
  const playerStepRef = useRef(0);
  const levelRef = useRef(1);
  const phaseRef = useRef('IDLE');
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

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Generate random sequence of tiles (3x3 grid, tiles 0-8)
  const generateSequence = (length) => {
    const seq = [];
    for (let i = 0; i < length; i++) {
      seq.push(Math.floor(Math.random() * 9));
    }
    return seq;
  };

  // Play the sequence by highlighting tiles one by one
  const playSequence = useCallback((seqToPlay) => {
    clearAllTimers();
    setPhase('SHOWING');
    phaseRef.current = 'SHOWING';
    setActiveTile(null);
    setWrongTile(null);

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

    // When sequence finishes showing, allow player input
    const finishTime = seqToPlay.length * totalStepTime + 200;
    addTimer(() => {
      setActiveTile(null);
      setPhase('INPUT');
      phaseRef.current = 'INPUT';
      setPlayerStep(0);
      playerStepRef.current = 0;
    }, finishTime);
  }, [addTimer, clearAllTimers]);

  // Start new game or level
  const startLevel = useCallback((lvl) => {
    setLevel(lvl);
    levelRef.current = lvl;
    // Initial Level: 3 tiles. Level 2 -> 4 tiles, Level 3 -> 5 tiles...
    const seqLength = lvl + 2;
    const newSeq = generateSequence(seqLength);
    setSequence(newSeq);
    sequenceRef.current = newSeq;
    setPlayerStep(0);
    playerStepRef.current = 0;
    playSequence(newSeq);
  }, [playSequence]);

  // Start game from beginning
  const startGame = useCallback(() => {
    clearAllTimers();
    setScore(0);
    setScoreSubmitted(false);
    setWrongTile(null);
    setActiveTile(null);
    startLevel(1);
  }, [clearAllTimers, startLevel]);

  // Auto-start when mounted or round starts
  useEffect(() => {
    startGame();
  }, [gameState?.currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle player tile click
  const handleTileClick = (tileIndex) => {
    // Guard: ignore clicks during display phase or game over
    if (phaseRef.current !== 'INPUT') return;

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
        const completedLevel = levelRef.current;
        const newScore = calculateSequenceMemoryScore(completedLevel, currentSeq.length);
        setScore(newScore);
        setPhase('LEVEL_SUCCESS');
        phaseRef.current = 'LEVEL_SUCCESS';

        // Brief celebration then move to next level
        addTimer(() => {
          startLevel(completedLevel + 1);
        }, 900);
      }
    } else {
      // INCORRECT TILE -> GAME OVER
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
        sequenceLength: finalSequenceLength
      };

      if (!scoreSubmitted) {
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
          <p>Sequence Memory Standings</p>
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
          <span className="game-over-icon">🧠</span>
          <h2 style={{ color: '#ef4444' }}>Game Over</h2>
          <p>You clicked an incorrect tile in the sequence.</p>
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

        <div className="match-over-actions">
          <button className="btn btn-primary btn-lg" onClick={startGame}>
            🔄 Try Again
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
        <span className="score-chip">Score: {score}</span>
      </div>

      <div className="sequence-arena-panel">
        <div className={`sequence-prompt-banner ${promptClass}`}>
          {phase === 'SHOWING' && <span className="pulsing-eye">👀</span>}
          {phase === 'INPUT' && <span className="pulsing-tap">👆</span>}
          {phase === 'LEVEL_SUCCESS' && <span className="celebration-star">✨</span>}
          <span>{promptText}</span>
        </div>

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
