import React from 'react';
import { useArena } from '../../context/ArenaContext';

export default function Navbar() {
  const { myPlayerName } = useArena();

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-title">Mind Arena</span>
      </div>

      <div className="navbar-user">
        <span className="user-name">{myPlayerName}</span>
      </div>
    </header>
  );
}
