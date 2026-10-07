import React from 'react';
import { ARENA_GAMES } from '../../constants/games';

export default function GamesSequencePreview() {
  return (
    <div className="games-preview-box">
      <span className="preview-label">Games Order:</span>
      <div className="games-sequence">
        {ARENA_GAMES.map((game, index) => (
          <React.Fragment key={game.id}>
            <span>{game.order}. {game.name}</span>
            {index < ARENA_GAMES.length - 1 && <span className="arrow">→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
