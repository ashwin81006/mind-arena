import React from 'react';
import { ARENA_GAMES } from '../../constants/games';

export default function GamesShowcase({ onSelectGame }) {
  return (
    <div className="games-showcase-bar">
      <span className="showcase-title">
        {onSelectGame ? '🎯 Practice Mini-Games Solo:' : '5 Challenge Games Included:'}
      </span>
      <div className="showcase-items" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        {ARENA_GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            className="btn-game-chip"
            onClick={() => onSelectGame?.(game.id)}
            title={`Practice ${game.name} solo`}
          >
            <span>{game.icon}</span>
            <span>{game.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

