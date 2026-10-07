import React from 'react';

export default function HowToPlayModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card how-to-play-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="title-with-icon">
            <span className="how-icon">📖</span>
            <div>
              <h3>How to Play Mind Arena</h3>
              <p>Multiplayer reflex, memory, and cognitive challenges</p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="how-to-play-body">
          {/* Section 1: Room & Match Flow */}
          <div className="guide-section">
            <div className="guide-badge">Step 1</div>
            <div className="guide-text">
              <h4>Lobby & Match Setup</h4>
              <p>
                Enter your nickname on the home screen. Either <strong>Create a Room</strong> to become the host or <strong>Join Room</strong> using a friend's 6-letter room code.
              </p>
              <p className="guide-subtext">
                Every player clicks <strong>Ready</strong>. Once all players are ready, the host clicks <strong>Start Match</strong>.
              </p>
            </div>
          </div>

          {/* Section 2: Reaction Rush Game Rules */}
          <div className="guide-section">
            <div className="guide-badge highlight">Game 1</div>
            <div className="guide-text">
              <h4>⚡ Reaction Rush (Reflex)</h4>
              <ul className="rules-list">
                <li>
                  <span className="rule-dot red"></span>
                  <div>
                    <strong>🔴 Red Screen (Wait):</strong> Keep your finger or mouse poised. Do NOT click or tap yet!
                  </div>
                </li>
                <li>
                  <span className="rule-dot yellow"></span>
                  <div>
                    <strong>⚠️ False Start:</strong> If you tap while the screen is red, you receive a false start penalty (<strong>0 points</strong> for that round).
                  </div>
                </li>
                <li>
                  <span className="rule-dot green"></span>
                  <div>
                    <strong>🟢 Green Screen (Click Now!):</strong> The millisecond it turns green, tap or press down immediately (or hit <kbd>Space</kbd> / <kbd>Enter</kbd>).
                  </div>
                </li>
                <li>
                  <span className="rule-dot purple"></span>
                  <div>
                    <strong>🏆 Scoring:</strong> Faster reaction = higher score! Up to <strong>1,000 points</strong> per round. The player with the highest total score after 3 rounds wins the match.
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 3: Pro Tips */}
          <div className="guide-section">
            <div className="guide-badge tips">Tips</div>
            <div className="guide-text">
              <h4>Pro Tips</h4>
              <p>
                • The delay before green is completely randomized (2.0s to 4.5s) to prevent guessing.
                <br />
                • On mobile, rest your thumb lightly near the center for the fastest tap.
                <br />
                • Reaction triggers on immediate touch-down rather than release.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Got It, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}
