import React, { useState, useEffect } from 'react';
import { useArena } from '../../context/ArenaContext';

const GAME_PREVIEWS = {
  'reaction-rush': {
    id: 'reaction-rush',
    title: 'Reaction Rush',
    icon: '⚡',
    tagline: 'Click the instant it turns GREEN. Do NOT click RED.',
    category: 'Reflex Test',
    objective: 'Click immediately when green flashes',
    penalty: 'Clicking red = False Start (0 pts)',
    scoring: 'Faster reaction (ms) = higher rank',
    type: 'reaction'
  },
  'sequence-memory': {
    id: 'sequence-memory',
    title: 'Sequence Memory',
    icon: '🧠',
    tagline: 'Memorize the flashing tiles. Repeat the exact pattern.',
    category: 'Pattern Recall',
    objective: 'Repeat the 3×3 pattern in exact order',
    penalty: '1 wrong tile ends your round',
    scoring: '+1 tile added every level cleared',
    type: 'sequence'
  },
  'aim-trainer': {
    id: 'aim-trainer',
    title: 'Aim Trainer',
    icon: '🎯',
    tagline: 'Eliminate all 20 targets as fast as possible. Faster completion = higher score!',
    category: 'Speed & Precision',
    objective: 'Click 20 targets rapidly in succession',
    penalty: 'Stray clicks reduce your accuracy %',
    scoring: 'Faster completion time + accuracy %',
    type: 'aim'
  },
  'number-recall': {
    id: 'number-recall',
    title: 'Number Recall',
    icon: '🔢',
    tagline: 'Memorize the digits before they disappear. Type them back.',
    category: 'Working Memory',
    objective: 'Recall the full number & submit',
    penalty: '1 wrong digit ends your round',
    scoring: 'Digits increase with each level',
    type: 'number'
  },
  'visual-memory': {
    id: 'visual-memory',
    title: 'Visual Memory',
    icon: '👁️',
    tagline: 'Remember the lit tile positions. Recreate the pattern.',
    category: 'Spatial Logic',
    objective: 'Select all highlighted tile positions',
    penalty: '3 strikes allowed before round ends',
    scoring: 'Grid expands with higher levels',
    type: 'visual'
  }
};

export default function GamePreviewScreen() {
  const { gameState } = useArena();

  const rawId = (gameState?.gameId || 'reaction-rush').toLowerCase().replace(/_/g, '-');
  const game = GAME_PREVIEWS[rawId] || GAME_PREVIEWS['reaction-rush'];

  const gameIndex = gameState?.gameIndex || 1;
  const totalGames = gameState?.totalGames || 5;
  const initialDuration = gameState?.durationSeconds || 7;

  const [secondsLeft, setSecondsLeft] = useState(initialDuration);

  // Synchronized countdown
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

  // Render mechanic visual mock
  const renderVisualMock = () => {
    switch (game.type) {
      case 'reaction':
        return (
          <div className="mini-mechanic-box reaction-mechanic">
            <div className="mini-state-card state-red">
              <span className="state-indicator">🔴</span>
              <span className="state-label">WAIT...</span>
            </div>
            <div className="mini-arrow">➔</div>
            <div className="mini-state-card state-green">
              <span className="state-indicator">🟢</span>
              <span className="state-label">CLICK!</span>
            </div>
          </div>
        );

      case 'sequence':
        return (
          <div className="mini-mechanic-box sequence-mechanic">
            <div className="mini-grid-3x3">
              <div className="m-tile"></div>
              <div className="m-tile m-seq-1">1</div>
              <div className="m-tile"></div>
              <div className="m-tile m-seq-2">2</div>
              <div className="m-tile"></div>
              <div className="m-tile m-seq-3">3</div>
              <div className="m-tile"></div>
              <div className="m-tile"></div>
              <div className="m-tile"></div>
            </div>
          </div>
        );

      case 'aim':
        return (
          <div className="mini-mechanic-box aim-mechanic">
            <div className="mini-target-field">
              <div className="m-crosshair"></div>
              <div className="m-target m-target-1">🎯</div>
              <div className="m-target m-target-2">🎯</div>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="mini-mechanic-box number-mechanic">
            <div className="mini-digit-display">
              <span className="m-digit">7</span>
              <span className="m-digit">4</span>
              <span className="m-digit">9</span>
              <span className="m-digit">2</span>
              <span className="m-digit">6</span>
            </div>
          </div>
        );

      case 'visual':
      default:
        return (
          <div className="mini-mechanic-box visual-mechanic">
            <div className="mini-grid-3x3">
              <div className="m-tile m-lit"></div>
              <div className="m-tile"></div>
              <div className="m-tile m-lit"></div>
              <div className="m-tile"></div>
              <div className="m-tile m-lit"></div>
              <div className="m-tile"></div>
              <div className="m-tile"></div>
              <div className="m-tile m-lit"></div>
              <div className="m-tile"></div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="game-preview-container">
      <div className="game-preview-card preview-arcade-theme">
        {/* Tournament Stage Indicator */}
        <div className="preview-top-tracker">
          <div className="preview-upnext-badge">
            <span className="pulse-dot-orange"></span>
            <span>UP NEXT • GAME {gameIndex} OF {totalGames}</span>
          </div>
          <div className="preview-dots-row">
            {Array.from({ length: totalGames }).map((_, idx) => (
              <span
                key={idx}
                className={`preview-progress-dot ${idx + 1 === gameIndex ? 'dot-active' : idx + 1 < gameIndex ? 'dot-passed' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Hero Title & Tagline */}
        <div className="preview-arcade-hero">
          <div className="preview-icon-badge">{game.icon}</div>
          <div className="preview-hero-info">
            <div className="preview-category-chip">{game.category}</div>
            <h1 className="preview-arcade-title">{game.title}</h1>
            <p className="preview-tagline">{game.tagline}</p>
          </div>
        </div>

        {/* Quick Visual Graphic */}
        <div className="preview-visual-stage">
          {renderVisualMock()}
        </div>

        {/* 3 Quick Game Rules Strip */}
        <div className="preview-rules-strip">
          <div className="rule-chip">
            <span className="rule-chip-icon">🎯</span>
            <div className="rule-chip-text">
              <span className="rule-chip-label">OBJECTIVE</span>
              <span className="rule-chip-val">{game.objective}</span>
            </div>
          </div>
          <div className="rule-chip">
            <span className="rule-chip-icon">⚠️</span>
            <div className="rule-chip-text">
              <span className="rule-chip-label">WATCH OUT</span>
              <span className="rule-chip-val">{game.penalty}</span>
            </div>
          </div>
          <div className="rule-chip">
            <span className="rule-chip-icon">⚡</span>
            <div className="rule-chip-text">
              <span className="rule-chip-label">SCORING</span>
              <span className="rule-chip-val">{game.scoring}</span>
            </div>
          </div>
        </div>

        {/* Arcade Live Countdown */}
        <div className="preview-arcade-countdown">
          <div className="countdown-center-row">
            <div className="countdown-number-ring">
              <span className="countdown-num-text">
                {secondsLeft > 0 ? secondsLeft : 'GO!'}
              </span>
            </div>
            <div className="countdown-info-text">
              <span className="countdown-title">GET READY!</span>
              <span className="countdown-sub">
                {secondsLeft > 0 ? `Game starts in ${secondsLeft}s` : 'Launching now...'}
              </span>
            </div>
          </div>
          <div className="countdown-progress-bar">
            <div
              className="countdown-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
