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

          {/* Section 2: Mini-Games Rules */}
          <div className="guide-section">
            <div className="guide-badge highlight">Game 1</div>
            <div className="guide-text">
              <h4>⚡ Reaction Rush (Reflex)</h4>
              <ul className="rules-list">
                <li>
                  <span className="rule-dot red"></span>
                  <div><strong>🔴 Red Screen (Wait):</strong> Wait for green! Do NOT click yet.</div>
                </li>
                <li>
                  <span className="rule-dot yellow"></span>
                  <div><strong>⚠️ False Start:</strong> Clicking while red gives 0 points.</div>
                </li>
                <li>
                  <span className="rule-dot green"></span>
                  <div><strong>🟢 Green Screen (Click Now!):</strong> Click as fast as humanly possible!</div>
                </li>
              </ul>
            </div>
          </div>

          <div className="guide-section">
            <div className="guide-badge highlight">Game 2</div>
            <div className="guide-text">
              <h4>🧠 Sequence Memory (Memory)</h4>
              <p>Watch highlighted tiles flash one by one in the 3×3 grid. Once the sequence ends, reproduce the exact pattern in the same order. Each level adds +1 tile to the sequence!</p>
            </div>
          </div>

          <div className="guide-section">
            <div className="guide-badge highlight">Game 3</div>
            <div className="guide-text">
              <h4>🎯 Aim Trainer (Reflex & Precision)</h4>
              <p>Targets appear across the arena. Click all 20 targets as quickly as possible. Clicks outside the target count as misses and lower your accuracy.</p>
            </div>
          </div>

          <div className="guide-section">
            <div className="guide-badge highlight">Game 4</div>
            <div className="guide-text">
              <h4>🔢 Number Recall (Working Memory)</h4>
              <p>Memorize the disappearing number before the timer expires. Enter the exact number string (including any leading zeroes) to advance to longer digits.</p>
            </div>
          </div>

          <div className="guide-section">
            <div className="guide-badge highlight">Game 5</div>
            <div className="guide-text">
              <h4>👁️ Visual Memory (Spatial Logic)</h4>
              <p>A pattern of tiles illuminates simultaneously. Memorize their positions (order does not matter!). When hidden, select all target tiles and hit Submit.</p>
            </div>
          </div>

          {/* Section 3: Pro Tips */}
          <div className="guide-section">
            <div className="guide-badge tips">Tips</div>
            <div className="guide-text">
              <h4>Pro Tips</h4>
              <p>
                • You can practice every mini-game solo right from the Home Screen.
                <br />
                • In Sequence Memory, clicks are locked while the pattern plays to prevent mistakes.
                <br />
                • In Aim Trainer, speed and accuracy are multiplied to compute your final score.
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
