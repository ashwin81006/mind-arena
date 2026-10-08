import React from 'react';
import { useArena } from '../../context/ArenaContext';
import { ARENA_GAMES } from '../../constants/games';

export default function GamesSequencePreview() {
  const { isHost, selectedGames = [], updateSelectedGames } = useArena();

  const handleToggleGame = (gameId) => {
    if (!isHost) return;

    if (selectedGames.includes(gameId)) {
      if (selectedGames.length === 1) {
        return; // Keep at least one game selected
      }
      const filtered = selectedGames.filter((id) => id !== gameId);
      updateSelectedGames(filtered);
    } else {
      // Maintain consistent order matching ARENA_GAMES
      const allIds = ARENA_GAMES.map((g) => g.id);
      const nextList = allIds.filter((id) => selectedGames.includes(id) || id === gameId);
      updateSelectedGames(nextList);
    }
  };

  const handleSelectAll = () => {
    if (!isHost) return;
    updateSelectedGames(ARENA_GAMES.map((g) => g.id));
  };

  const handleSelectPreset = (presetType) => {
    if (!isHost) return;
    if (presetType === 'REFLEX') {
      updateSelectedGames(['reaction-rush', 'aim-trainer']);
    } else if (presetType === 'MEMORY') {
      updateSelectedGames(['sequence-memory', 'number-recall', 'visual-memory']);
    }
  };

  const activeGames = ARENA_GAMES.filter((g) => selectedGames.includes(g.id));

  return (
    <div className="room-games-selection-card">
      <div className="selection-header">
        <div className="header-titles">
          <h3>🎮 Match Games Playlist</h3>
          <p>
            {isHost
              ? 'Select which games will be played in this match (click to toggle):'
              : 'Games selected by host for this match:'}
          </p>
        </div>

        {isHost && (
          <div className="preset-buttons-row">
            <button
              type="button"
              className="btn-preset"
              onClick={handleSelectAll}
            >
              All 5 Games
            </button>
            <button
              type="button"
              className="btn-preset"
              onClick={() => handleSelectPreset('REFLEX')}
            >
              ⚡ Reflex
            </button>
            <button
              type="button"
              className="btn-preset"
              onClick={() => handleSelectPreset('MEMORY')}
            >
              🧠 Memory
            </button>
          </div>
        )}
      </div>

      {/* Grid of game options */}
      <div className="games-selector-grid">
        {ARENA_GAMES.map((game) => {
          const isSelected = selectedGames.includes(game.id);

          return (
            <button
              key={game.id}
              type="button"
              disabled={!isHost}
              className={`game-selector-chip ${isSelected ? 'is-selected' : 'is-unselected'} ${!isHost ? 'read-only' : ''}`}
              onClick={() => handleToggleGame(game.id)}
            >
              <div className="chip-left">
                <span className="game-icon">{game.icon}</span>
                <div className="chip-info">
                  <span className="game-name">{game.name}</span>
                  <span className="game-category">{game.category}</span>
                </div>
              </div>

              <div className="chip-checkbox">
                {isSelected ? '✓' : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live planned match order preview */}
      <div className="games-preview-box" style={{ marginTop: '0.85rem' }}>
        <span className="preview-label">Planned Match Order ({activeGames.length} {activeGames.length === 1 ? 'Game' : 'Games'}):</span>
        <div className="games-sequence">
          {activeGames.map((game, index) => (
            <React.Fragment key={game.id}>
              <span className="seq-game-badge">
                {index + 1}. {game.name}
              </span>
              {index < activeGames.length - 1 && <span className="arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
