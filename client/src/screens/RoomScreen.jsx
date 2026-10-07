import React from 'react';
import RoomHeader from '../components/room/RoomHeader';
import PlayerRoster from '../components/room/PlayerRoster';
import GamesSequencePreview from '../components/room/GamesSequencePreview';
import RoomControls from '../components/room/RoomControls';

export default function RoomScreen() {
  return (
    <div className="room-view">
      <RoomHeader />
      <PlayerRoster />
      <GamesSequencePreview />
      <RoomControls />
    </div>
  );
}
