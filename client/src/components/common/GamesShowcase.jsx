import React from 'react';
import { ARENA_GAMES } from '../../constants/games';

export default function GamesShowcase() {
  return (
    <div className="games-showcase-bar">
      <span className="showcase-title">5 Challenge Games Included:</span>
      <div className="showcase-items">
        {ARENA_GAMES.map((game, index) => (
          <React.Fragment key={game.id}>
            <span>{game.name}</span>
            {index < ARENA_GAMES.length - 1 && <span>•</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
