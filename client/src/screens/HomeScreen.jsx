import React, { useState, useRef } from 'react';
import { useArena } from '../context/ArenaContext';
import { useToast } from '../context/ToastContext';
import NameSetupCard from '../components/home/NameSetupCard';
import HomeActionCards from '../components/home/HomeActionCards';
import GamesShowcase from '../components/common/GamesShowcase';

export default function HomeScreen() {
  const { playerName, connecting, pendingAction, createRoom, joinRoom } = useArena();
  const { notify } = useToast();

  const [joinCode, setJoinCode] = useState('');
  const [nameError, setNameError] = useState(false);
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

      <GamesShowcase />
    </div>
  );
}
