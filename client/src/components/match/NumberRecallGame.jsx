import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useArena } from '../../context/ArenaContext';

/**
 * Isolated scoring calculation for Number Recall.
 */
export function calculateNumberRecallScore(completedLevels, digitsRecalled = 0) {
  if (completedLevels <= 0) return 0;
  // 100 pts per completed level + 25 pts per digit recalled
  return (completedLevels * 100) + (Math.max(0, digitsRecalled - 2) * 25);
}

/**
 * Generates a random number strictly as a STRING to preserve leading zeroes.
 */
export function generateNumberString(length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += Math.floor(Math.random() * 10).toString();
  }
  return str;
}

export default function NumberRecallGame({ onComplete, isPractice = false, onBackToHome }) {
  const arenaContext = useArena();
  const gameState = arenaContext?.gameState;
  const myPlayerId = arenaContext?.myPlayerId;
  const submitScore = arenaContext?.submitScore;
  const isHost = arenaContext?.isHost;
  const returnToLobby = arenaContext?.returnToLobby;
  const leaveRoom = arenaContext?.leaveRoom;

  // Phase: 'MEMORIZING' | 'INPUT' | 'FEEDBACK_SUCCESS' | 'GAME_OVER'
  const [phase, setPhase] = useState('MEMORIZING');
  const [level, setLevel] = useState(1);
  const [targetNumber, setTargetNumber] = useState(''); // Stored strictly as a string
  const [playerInput, setPlayerInput] = useState('');   // Stored strictly as a string
  const [score, setScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [totalDisplayTimeMs, setTotalDisplayTimeMs] = useState(0);

  const inputRef = useRef(null);
  const timerIdsRef = useRef([]);
  const countdownIntervalRef = useRef(null);
  const targetNumberRef = useRef('');
  const levelRef = useRef(1);

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

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Start a specific level
  const startLevel = useCallback((lvl) => {
    clearAllTimers();
    setLevel(lvl);
    levelRef.current = lvl;
    setPlayerInput('');

    // Level 1: 3 digits. Level 2: 4 digits, Level 3: 5 digits...
    const digitCount = lvl + 2;
    const numStr = generateNumberString(digitCount);
    setTargetNumber(numStr);
    targetNumberRef.current = numStr;

    // Display duration scales with digits (e.g. 3 digits = 2400ms, 4 digits = 2800ms)
    const duration = 1200 + (digitCount * 400);
    setTotalDisplayTimeMs(duration);
    setTimeLeftMs(duration);
    setPhase('MEMORIZING');

    const startTime = performance.now();
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 50);

    // Hide number and switch to input phase
    addTimer(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setPhase('INPUT');
      setTimeLeftMs(0);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }, duration);
  }, [addTimer, clearAllTimers]);

  const handleSkipMemorize = () => {
    if (phase !== 'MEMORIZING') return;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    clearAllTimers();
    setPhase('INPUT');
    setTimeLeftMs(0);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const startGame = useCallback(() => {
    clearAllTimers();
    setScore(0);
    setScoreSubmitted(false);
    startLevel(1);
  }, [clearAllTimers, startLevel]);

  useEffect(() => {
    startGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (phase !== 'INPUT') return;

    const trimmedInput = playerInput.trim();
    const correctString = targetNumberRef.current;

    if (trimmedInput === correctString) {
      // CORRECT ANSWER!
      const completedLevel = levelRef.current;
      const digitsRecalled = correctString.length;
      const newScore = calculateNumberRecallScore(completedLevel, digitsRecalled);
      setScore(newScore);
      setPhase('FEEDBACK_SUCCESS');

      addTimer(() => {
        startLevel(completedLevel + 1);
      }, 1200);
    } else {
      // INCORRECT ANSWER -> GAME OVER
      setPhase('GAME_OVER');
      const finalCompletedLevels = Math.max(0, levelRef.current - 1);
      const digitsRecalled = Math.max(0, finalCompletedLevels + 2);
      const finalScore = calculateNumberRecallScore(finalCompletedLevels, digitsRecalled);
      setScore(finalScore);

      const result = {
        game: 'NUMBER_RECALL',
        score: finalScore,
        highestLevel: finalCompletedLevels,
        digitsRecalled
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
          <p>Number Recall Standings</p>
        </div>
        <div className="leaderboard-table">
          <div className="leaderboard-row header-row">
            <span>Player</span>
            <span style={{ textAlign: 'center' }}>Digits</span>
            <span style={{ textAlign: 'right' }}>Score</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {results.map((entry) => {
            const isMe = entry.id === myPlayerId;
            return (
              <div key={entry.id} className={`leaderboard-row ${isMe ? 'is-me-row' : ''}`}>
                <span className="name-col">{entry.name} {isMe && <span className="badge-you">You</span>}</span>
                <span className="time-col text-good">{entry.reaction > 0 ? Math.round(entry.reaction / 100) + 2 : 0} digits</span>
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
    const maxDigits = highestLevel > 0 ? highestLevel + 2 : 0;

    return (
      <div className="match-results-card number-game-over-card">
        <div className="results-header">
          <span className="game-over-icon">🔢</span>
          <h2 style={{ color: '#ef4444' }}>WRONG ANSWER</h2>
          <p>Game Over — Number Recall</p>
        </div>

        <div className="comparison-card">
          <div className="comparison-row">
            <span className="comp-label">Correct Number:</span>
            <span className="comp-value correct-value">{targetNumber}</span>
          </div>
          <div className="comparison-row">
            <span className="comp-label">Your Input:</span>
            <span className="comp-value wrong-value">{playerInput || '(empty)'}</span>
          </div>
        </div>

        <div className="stats-summary-grid">
          <div className="stat-summary-box">
            <span className="stat-label">Level Reached</span>
            <span className="stat-value">{highestLevel}</span>
          </div>
          <div className="stat-summary-box">
            <span className="stat-label">Digits Recalled</span>
            <span className="stat-value">{maxDigits}</span>
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

  const progressPercent = totalDisplayTimeMs > 0 ? (timeLeftMs / totalDisplayTimeMs) * 100 : 0;

  return (
    <div className="game-arena-wrapper">
      <div className="arena-top-info">
        <span className="game-badge">🔢 Number Recall</span>
        <span className="round-badge">
          Level {level} • {level + 2} Digits
        </span>
        <span className="score-chip">Score: {score}</span>
      </div>

      <div className="number-arena-panel">
        {/* Phase 1: Memorization Display */}
        {phase === 'MEMORIZING' && (
          <div className="number-memorize-view">
            <p className="number-instruction">Memorize this number:</p>
            <div className="number-display-box" aria-live="polite">
              {targetNumber.split('').map((char, index) => (
                <span key={index} className="number-char">{char}</span>
              ))}
            </div>
            <div className="number-progress-container">
              <div
                className="number-progress-bar"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem' }}>
              <span className="number-time-text">Disappearing soon...</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                onClick={handleSkipMemorize}
              >
                ⚡ Ready (Type Now)
              </button>
            </div>
          </div>
        )}

        {/* Phase 2: Player Input */}
        {phase === 'INPUT' && (
          <div className="number-input-view">
            <p className="number-instruction">Enter the number you just saw:</p>
            <form onSubmit={handleSubmit} className="number-input-form">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="form-input number-field-input"
                placeholder="Enter numbers..."
                value={playerInput}
                onChange={(e) => {
                  // Only allow numeric input
                  const numericOnly = e.target.value.replace(/\D/g, '');
                  setPlayerInput(numericOnly);
                }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-submit-number"
                disabled={!playerInput.length}
              >
                SUBMIT
              </button>
            </form>
          </div>
        )}

        {/* Phase 3: Correct Level Feedback */}
        {phase === 'FEEDBACK_SUCCESS' && (
          <div className="number-feedback-view">
            <div className="feedback-banner success-banner">
              <span className="feedback-icon">✅</span>
              <h2>CORRECT!</h2>
              <p>Preparing {level + 3} digits for Level {level + 1}...</p>
            </div>
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
