import React, { useState, useEffect } from 'react';
import { useArena } from '../../context/ArenaContext';

const GAME_INFO_MAP = {
  'reaction-rush': {
    id: 'reaction-rush',
    name: 'Reaction Rush',
    icon: '⚡',
    category: 'Reflex & Speed',
    summary: 'Test your raw neurological reaction speed when the screen turns green.',
    instructions: [
      {
        icon: '🔴',
        title: 'Wait for Green',
        text: 'Do NOT click or tap while the screen is red. Stay focused!'
      },
      {
        icon: '⚠️',
        title: 'Avoid False Starts',
        text: 'Clicking early while red gives an immediate False Start (0 points).'
      },
      {
        icon: '🟢',
        title: 'Click Instantly',
        text: 'The millisecond the screen turns green, click or tap immediately!'
      }
    ],
    scoringTip: 'Faster reactions earn higher points (up to 1,000 pts per round).'
  },
  'sequence-memory': {
    id: 'sequence-memory',
    name: 'Sequence Memory',
    icon: '🧠',
    category: 'Pattern & Memory',
    summary: 'Memorize and reproduce increasingly long sequences of flashing tiles in a 3×3 grid.',
    instructions: [
      {
        icon: '👀',
        title: 'Watch the Sequence',
        text: 'Observe the 3×3 grid closely as tiles light up in order.'
      },
      {
        icon: '👆',
        title: 'Repeat the Pattern',
        text: 'When input unlocks, tap the exact same tiles in the identical sequence.'
      },
      {
        icon: '❌',
        title: 'One Strike & Out',
        text: 'Each level adds +1 tile. A single wrong tap ends your round immediately!'
      }
    ],
    scoringTip: 'Each completed level awards exponentially higher tournament points.'
  },
  'aim-trainer': {
    id: 'aim-trainer',
    name: 'Aim Trainer',
    icon: '🎯',
    category: 'Precision & Reflex',
    summary: 'Click 20 moving targets across the arena with lightning speed and pinpoint accuracy.',
    instructions: [
      {
        icon: '🎯',
        title: 'Hit the Targets',
        text: 'Targets appear randomly across the screen. Click them as quickly as possible.'
      },
      {
        icon: '⚡',
        title: '20 Total Targets',
        text: 'Eliminate all 20 targets in rapid succession to complete your run.'
      },
      {
        icon: '📉',
        title: 'Precision Counts',
        text: 'Clicks outside target circles reduce your accuracy percentage and final score.'
      }
    ],
    scoringTip: 'Final score is calculated from speed per target multiplied by accuracy.'
  },
  'number-recall': {
    id: 'number-recall',
    name: 'Number Recall',
    icon: '🔢',
    category: 'Working Memory',
    summary: 'Memorize disappearing numbers of increasing length and type them back accurately.',
    instructions: [
      {
        icon: '👁️',
        title: 'Memorize the Number',
        text: 'A number appears on screen. Memorize it before the progress bar runs out.'
      },
      {
        icon: '⌨️',
        title: 'Type & Submit',
        text: 'Type the exact digits into the input box and press Enter or Submit.'
      },
      {
        icon: '🔥',
        title: 'Growing Digits',
        text: 'Each round the number grows by 1 digit. One wrong digit ends your round!'
      }
    ],
    scoringTip: 'Longer numbers remembered yield massive score multipliers.'
  },
  'visual-memory': {
    id: 'visual-memory',
    name: 'Visual Memory',
    icon: '👁️',
    category: 'Spatial Recall',
    summary: 'Memorize patterns of highlighted tiles and recall their positions on the grid.',
    instructions: [
      {
        icon: '💡',
        title: 'Memorize Pattern',
        text: 'Multiple tiles light up simultaneously. You have 2.2 seconds to memorize them.'
      },
      {
        icon: '🧩',
        title: 'Select Tiles',
        text: 'Click all the tiles you remember (order does not matter) and hit Submit.'
      },
      {
        icon: '❤️',
        title: '3 Strikes Allowed',
        text: 'You have 3 strikes. Missing tiles or picking wrong tiles costs a strike.'
      }
    ],
    scoringTip: 'Higher levels feature expanding grid sizes and award the most points.'
  }
};

export default function GamePreviewScreen() {
  const { gameState } = useArena();

  const rawId = (gameState?.gameId || 'reaction-rush').toLowerCase().replace(/_/g, '-');
  const gameInfo = GAME_INFO_MAP[rawId] || GAME_INFO_MAP['reaction-rush'];

  const gameIndex = gameState?.gameIndex || 1;
  const totalGames = gameState?.totalGames || 5;
  const initialDuration = gameState?.durationSeconds || 7;

  const [secondsLeft, setSecondsLeft] = useState(initialDuration);

  // Synchronized countdown timer
  useEffect(() => {
    setSecondsLeft(initialDuration);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialDuration, rawId]);

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / initialDuration) * 100));

  return (
    <div className="game-preview-container">
      <div className="game-preview-card">
        {/* Tournament Stage Indicator */}
        <div className="preview-top-tracker">
          <span className="preview-stage-pill">
            🏆 Tournament Game {gameIndex} of {totalGames}
          </span>
          <div className="preview-dots-row">
            {Array.from({ length: totalGames }).map((_, idx) => (
              <span
                key={idx}
                className={`preview-progress-dot ${idx + 1 === gameIndex ? 'dot-active' : idx + 1 < gameIndex ? 'dot-passed' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Hero Banner with Game Title & Category */}
        <div className="preview-hero">
          <div className="preview-hero-icon-bubble">
            <span className="preview-large-icon">{gameInfo.icon}</span>
          </div>
          <div className="preview-hero-text">
            <div className="preview-category-badge">{gameInfo.category}</div>
            <h1 className="preview-game-title">{gameInfo.name}</h1>
            <p className="preview-summary">{gameInfo.summary}</p>
          </div>
        </div>

        {/* How to Play Instructions Section */}
        <div className="preview-guide-panel">
          <h3 className="preview-guide-heading">
            <span>📖</span> How to Play & Win
          </h3>
          <div className="preview-steps-grid">
            {gameInfo.instructions.map((step, index) => (
              <div key={index} className="preview-step-card">
                <div className="step-card-header">
                  <span className="step-badge-number">Step {index + 1}</span>
                  <span className="step-badge-icon">{step.icon}</span>
                </div>
                <h4 className="step-card-title">{step.title}</h4>
                <p className="step-card-text">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring Pro-Tip Banner */}
        <div className="preview-scoring-tip">
          <span className="tip-star">💡</span>
          <div className="tip-content">
            <strong>Scoring:</strong> {gameInfo.scoringTip}
          </div>
        </div>

        {/* Dynamic Countdown Section */}
        <div className="preview-countdown-section">
          <div className="preview-countdown-header">
            <span className="countdown-label">Next Game Starting In:</span>
            <span className="countdown-number">
              {secondsLeft > 0 ? `${secondsLeft}s` : 'Starting now...'}
            </span>
          </div>
          <div className="preview-progress-track">
            <div
              className="preview-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="preview-countdown-hint">
            Get your hands ready on your screen or mouse!
          </p>
        </div>
      </div>
    </div>
  );
}
