import React from 'react';
import { useArena } from '../../context/ArenaContext';

export default function NameSetupCard({ inputRef, nameError, onClearError }) {
  const { playerName, setPlayerName } = useArena();

  const handleChange = (e) => {
    setPlayerName(e.target.value);
    if (nameError && onClearError) {
      onClearError();
    }
  };

  return (
    <div className="name-setup-card">
      <label htmlFor="playerNameInput" className="name-label">
        Your Name
      </label>
      <input
        id="playerNameInput"
        ref={inputRef}
        type="text"
        className={`form-input name-input ${nameError ? 'input-error' : ''}`}
        placeholder="Enter your name"
        value={playerName}
        onChange={handleChange}
        maxLength={20}
        autoFocus
      />
      {nameError && (
        <span className="name-error-text">Please enter a name before continuing</span>
      )}
    </div>
  );
}
