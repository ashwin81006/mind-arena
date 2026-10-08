import React, { useState, useRef } from 'react';
import { useArena } from '../context/ArenaContext';
import { useToast } from '../context/ToastContext';
import NameSetupCard from '../components/home/NameSetupCard';
import HomeActionCards from '../components/home/HomeActionCards';
import GamesShowcase from '../components/common/GamesShowcase';
import HowToPlayModal from '../components/common/HowToPlayModal';
import ReactionRushGame from '../components/match/ReactionRushGame';
import SequenceMemoryGame from '../components/match/SequenceMemoryGame';
import NumberRecallGame from '../components/match/NumberRecallGame';
import VisualMemoryGame from '../components/match/VisualMemoryGame';
import AimTrainerGame from '../components/match/AimTrainerGame';

export default function HomeScreen() {
  const { playerName, connecting, pendingAction, createRoom, joinRoom } = useArena();
  const { notify } = useToast();

  const [joinCode, setJoinCode] = useState('');
  const [nameError, setNameError] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [practiceGameId, setPracticeGameId] = useState(null);
  const nameInputRef = useRef(null);

  const validateName = () => {
    const trimmed = playerName.trim();
    if (!trimmed) {
      setNameError(true);
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
      notify('Please enter your name first', 'warning');
      return null;
    }
    setNameError(false);
    localStorage.setItem('mind_arena_player_name', trimmed);
    return trimmed;
  };

  const handleCreateRoom = () => {
    const name = validateName();
    if (name) {
      createRoom(name);
    }
  };

  const handleJoinRoom = (e) => {
    if (e) e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      notify('Please enter a 6-letter room code', 'warning');
      return;
    }
    const name = validateName();
    if (name) {
      joinRoom(name, code);
    }
  };

  // Solo Practice view when a mini-game is selected directly
  if (practiceGameId) {
    const rawId = practiceGameId.toLowerCase().replace(/_/g, '-');
    let GameComponent = ReactionRushGame;
    if (rawId === 'sequence-memory') GameComponent = SequenceMemoryGame;
    else if (rawId === 'number-recall') GameComponent = NumberRecallGame;
    else if (rawId === 'visual-memory') GameComponent = VisualMemoryGame;
    else if (rawId === 'aim-trainer') GameComponent = AimTrainerGame;

    return (
      <div className="home-view">
        <div className="solo-mode-bar">
          <span>🎯 Solo Practice Mode</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPracticeGameId(null)}
          >
            ← Back to Home
          </button>
        </div>
        <GameComponent
          isPractice={true}
          onBackToHome={() => setPracticeGameId(null)}
          onComplete={(result) => {
            console.log('Game completed with result:', result);
          }}
        />
      </div>
    );
  }

  return (
    <div className="home-view">
      <div className="home-header">
        <h1>Mind Arena</h1>
        <p>A multiplayer collection of memory, reflex, and logic games.</p>
      </div>

      <NameSetupCard
        inputRef={nameInputRef}
        nameError={nameError}
        onClearError={() => setNameError(false)}
      />

      <HomeActionCards
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        connecting={connecting}
        pendingAction={pendingAction}
      />

      <div className="home-help-row">
        <button
          type="button"
          className="btn-help-link"
          onClick={() => setShowHowToPlay(true)}
        >
          📖 New to Mind Arena? <u>Read How to Play & Game Rules</u>
        </button>
      </div>

      <GamesShowcase onSelectGame={(gameId) => setPracticeGameId(gameId)} />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
    </div>
  );
}

