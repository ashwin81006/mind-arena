import React from 'react';
import { ToastProvider, ToastContainer } from './context/ToastContext';
import { ArenaProvider, useArena } from './context/ArenaContext';
import Navbar from './components/common/Navbar';
import HomeScreen from './screens/HomeScreen';
import RoomScreen from './screens/RoomScreen';
import MatchScreen from './screens/MatchScreen';
import './App.css';

function ArenaApp() {
  const { screen } = useArena();

  return (
    <div className="app-shell">
      <ToastContainer />
      <div className="app-container">
        {screen !== 'HOME' && <Navbar />}
        {screen === 'HOME' && <HomeScreen />}
        {screen === 'ROOM' && <RoomScreen />}
        {screen === 'MATCH' && <MatchScreen />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ArenaProvider>
        <ArenaApp />
      </ArenaProvider>
    </ToastProvider>
  );
}
