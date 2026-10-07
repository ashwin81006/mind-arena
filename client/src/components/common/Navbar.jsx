import React, { useState } from 'react';
import { useArena } from '../../context/ArenaContext';
import HowToPlayModal from './HowToPlayModal';

export default function Navbar() {
  const { myPlayerName } = useArena();
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <>
      <header className="navbar">
        <div className="navbar-brand">
          <span className="brand-title">Mind Arena</span>
        </div>

        <div className="navbar-actions">
          <button
            type="button"
            className="btn btn-secondary btn-xs how-to-play-nav-btn"
            onClick={() => setShowHowToPlay(true)}
            title="Learn how to play"
          >
            <span>📖</span>
            <span className="how-to-play-text">How to Play</span>
          </button>

          {myPlayerName && (
            <div className="navbar-user">
              <span className="user-name">{myPlayerName}</span>
            </div>
          )}
        </div>
      </header>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
    </>
  );
}
