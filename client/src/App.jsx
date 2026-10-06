import React, { useState, useEffect, useRef } from 'react';
import './App.css';

export default function App() {
  // Navigation & Core States
  const [screen, setScreen] = useState('CONNECT'); // 'CONNECT' | 'LOBBY' | 'ROOM' | 'MATCH'
  const [playerName, setPlayerName] = useState('Player');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5050');
  const [connecting, setConnecting] = useState(false);
  const [errorToast, setErrorToast] = useState(null);

  // Player & Room States
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [myPlayerName, setMyPlayerName] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [players, setPlayers] = useState([]);
  const [onlineCount, setOnlineCount] = useState('?');
  const [joinCode, setJoinCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Activity Logs
  const [logs, setLogs] = useState([]);
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);

  // Synchronization Refs to prevent React stale closures in WebSocket callbacks
  const myPlayerIdRef = useRef(null);
  const myPlayerNameRef = useRef('');
  const isHostRef = useRef(false);
  const isReadyRef = useRef(false);
  const messageHandlerRef = useRef(null);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev.slice(-40), { id: Date.now() + Math.random(), time, text }]);
  };

  const showError = (msg) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast((current) => (current === msg ? null : current));
    }, 4500);
  };

  // Scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [logs]);

  // Clean disconnect on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('DISCONNECT');
        wsRef.current.close();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Send message over WebSocket
  const send = (msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg);
    }
  };

  // Connect to WebSocket Bridge
  const handleConnect = (e) => {
    if (e) e.preventDefault();
    const name = playerName.trim();
    if (!name) {
      showError('Please enter a player name.');
      return;
    }

    setConnecting(true);
    addLog(`Connecting to bridge and arena at ${host}:${port}...`);
    myPlayerNameRef.current = name;

    // Connect to WebSocket Bridge on port 5051
    const wsUrl = `ws://${window.location.hostname || 'localhost'}:5051`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket bridge established. Awaiting server handshake...');
    };

    ws.onmessage = (event) => {
      const line = event.data.trim();
      if (messageHandlerRef.current) {
        messageHandlerRef.current(line);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      showError('Cannot connect to WebSocket bridge on port 5051. Ensure Vite / bridge is running.');
      setConnecting(false);
    };

    ws.onclose = () => {
      addLog('Disconnected from server.');
      setConnecting(false);
      setScreen('CONNECT');
      setCurrentRoomId(null);
      setMyPlayerId(null);
      setIsHost(false);
      setIsReady(false);
      myPlayerIdRef.current = null;
      isHostRef.current = false;
      isReadyRef.current = false;
      setPlayers([]);
    };
  };

  // Parse incoming server protocol messages
  const handleServerMessage = (rawMessage) => {
    const parts = rawMessage.split('|');
    const command = parts[0];
    const data = parts.slice(1).join('|');

    switch (command) {
      case 'WELCOME':
        // Server asks for NAME
        send(`NAME|${myPlayerNameRef.current || playerName.trim() || 'Player'}`);
        break;

      case 'PLAYER_INFO': {
        // PLAYER_INFO|<id>|<name>
        const [id, pName] = data.split('|');
        const numId = parseInt(id, 10);
        myPlayerIdRef.current = numId;
        myPlayerNameRef.current = pName;
        setMyPlayerId(numId);
        setMyPlayerName(pName);
        setConnecting(false);
        setScreen('LOBBY');
        addLog(`Connected as ${pName} [ID: #${numId}]`);
        send('PLAYER_LIST');
        break;
      }

      case 'PLAYER_COUNT':
        setOnlineCount(data);
        break;

      case 'ROOM_CREATED': {
        const roomId = data;
        setCurrentRoomId(roomId);
        isHostRef.current = true;
        setIsHost(true);
        isReadyRef.current = false;
        setIsReady(false);
        setPlayers([
          { id: myPlayerIdRef.current, name: myPlayerNameRef.current, ready: false, isHost: true, isMe: true }
        ]);
        setScreen('ROOM');
        addLog(`Room ${roomId} created. You are Host.`);
        break;
      }

      case 'ROOM_JOINED': {
        const roomId = data;
        setCurrentRoomId(roomId);
        isHostRef.current = false;
        setIsHost(false);
        isReadyRef.current = false;
        setIsReady(false);
        setScreen('ROOM');
        addLog(`Joined Room ${roomId}. Waiting for roster sync...`);
        break;
      }

      case 'ROOM_STATE': {
        // ROOM_STATE|id,name,ready,isHost|id,name,ready,isHost|...
        if (!data) return;
        const playerEntries = data.split('|');
        const myId = myPlayerIdRef.current;
        const myName = myPlayerNameRef.current;
        let currentHost = isHostRef.current; // Keep existing host status unless explicitly updated
        let currentReady = isReadyRef.current;

        const parsed = playerEntries
          .map((entry) => {
            const [idStr, name, readyStr, hostStr] = entry.split(',');
            if (!idStr || !name) return null;
            const id = parseInt(idStr, 10);
            const ready = readyStr === 'true';
            const hostRole = hostStr === 'true';
            const isMe = (myId !== null && id === myId) || (myName && name === myName);

            if (isMe) {
              currentHost = hostRole;
              currentReady = ready;
            }

            return { id, name, ready, isHost: hostRole, isMe };
          })
          .filter(Boolean);

        isHostRef.current = currentHost;
        isReadyRef.current = currentReady;
        setIsHost(currentHost);
        setIsReady(currentReady);
        setPlayers(parsed);
        break;
      }

      case 'READY_STATUS': {
        // READY_STATUS|<id>|<name>|<isReady>
        const [, pName, rState] = parts;
        addLog(`${pName} is ${rState === 'true' ? 'READY' : 'NOT READY'}`);
        break;
      }

      case 'PLAYER_LEFT': {
        // PLAYER_LEFT|<id>|<name>
        const [, , pName] = parts;
        addLog(`${pName || 'A player'} left the room.`);
        break;
      }

      case 'HOST_CHANGED': {
        // HOST_CHANGED|<newHostId>
        const newHostId = parseInt(data, 10);
        addLog(`Host changed to player #${newHostId}`);
        const amIHost = (newHostId === myPlayerIdRef.current);
        isHostRef.current = amIHost;
        setIsHost(amIHost);
        if (amIHost) {
          addLog(`You are now the Room Host!`);
        }
        break;
      }

      case 'ROOM_LEFT':
      case 'NOT_IN_ROOM':
        setCurrentRoomId(null);
        isHostRef.current = false;
        setIsHost(false);
        isReadyRef.current = false;
        setIsReady(false);
        setPlayers([]);
        setScreen('LOBBY');
        addLog('Left room. Returned to lobby.');
        send('PLAYER_LIST');
        break;

      case 'MATCH_STARTED':
        setScreen('MATCH');
        addLog(`Match started in Room ${data}! Arena is live.`);
        break;

      case 'ERROR':
        showError(data);
        addLog(`[Error] ${data}`);
        break;

      default:
        addLog(`[Server] ${rawMessage}`);
        break;
    }
  };

  // Keep ref pointing to the latest version of handleServerMessage
  messageHandlerRef.current = handleServerMessage;

  const handleDisconnect = () => {
    send('DISCONNECT');
    if (wsRef.current) wsRef.current.close();
  };

  const handleCreateRoom = () => {
    send('CREATE_ROOM');
  };

  const handleJoinRoom = (e) => {
    if (e) e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      showError('Please enter a room code.');
      return;
    }
    send(`JOIN_ROOM|${code}`);
    setJoinCode('');
  };

  const handleToggleReady = () => {
    send('TOGGLE_READY');
  };

  const handleStartMatch = () => {
    send('START_MATCH');
  };

  const handleLeaveRoom = () => {
    send('LEAVE_ROOM');
  };

  const handleCopyCode = () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Calculations
  const allReady = players.length > 0 && players.every((p) => p.ready);
  const canStartMatch = isHost && allReady && players.length > 0;

  return (
    <div className="app-container">
      {/* GLOBAL TOAST ERROR */}
      {errorToast && (
        <div className="toast-alert error">
          <span>⚠️ {errorToast}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setErrorToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* TOP HEADER BAR (Only visible once connected) */}
      {screen !== 'CONNECT' && (
        <header className="app-header">
          <div className="header-left">
            <div className="logo-badge">⚔ MIND ARENA</div>
            <div className="user-badge">
              <span>👤 {myPlayerName}</span>
              <span className="user-id-pill">#{myPlayerId}</span>
            </div>
          </div>
          <div className="header-right">
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span>Connected</span>
            </div>
            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </header>
      )}

      {/* ======================================================== */}
      {/* SCREEN 1: CONNECT SCREEN                                 */}
      {/* ======================================================== */}
      {screen === 'CONNECT' && (
        <div className="connect-container">
          <div className="connect-card">
            <div className="connect-title">
              <h1>MIND ARENA</h1>
              <p>Multiplayer TCP Socket Arena (React Frontend)</p>
            </div>

            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label>Player Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Host</label>
                  <input
                    type="text"
                    className="input-field"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="text"
                    className="input-field"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="bridge-hint">
                💡 Connects via WebSocket bridge to Java Server on port <strong>{port}</strong>.
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={connecting}>
                {connecting ? 'Connecting to Arena...' : '⚔ Enter Arena'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 2: LOBBY SCREEN                                   */}
      {/* ======================================================== */}
      {screen === 'LOBBY' && (
        <div className="lobby-container">
          <div className="lobby-banner">
            <div className="banner-title">
              <h2>Battle Lobby</h2>
              <p>Create a custom match room or join your peers with a room code.</p>
            </div>
            <div className="banner-stats">
              <span className="online-pill">👥 {onlineCount} Online</span>
              <button className="btn btn-sm btn-secondary" onClick={() => send('PLAYER_LIST')}>
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="lobby-grid">
            {/* Action 1: Create Room */}
            <div className="lobby-card">
              <div className="card-header">
                <h3>👑 Host an Arena</h3>
                <p>Create a new match room and become the host. Share the generated code with other players.</p>
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleCreateRoom}>
                ➕ Create Room
              </button>
            </div>

            {/* Action 2: Join Room */}
            <div className="lobby-card">
              <div className="card-header">
                <h3>➔ Join an Arena</h3>
                <p>Have a room code from a friend? Enter it below to join the match.</p>
              </div>
              <form onSubmit={handleJoinRoom} className="join-form">
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. ROOM1000"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <button type="submit" className="btn btn-success">
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="activity-box">
            <div className="activity-header">Live Server Feed</div>
            <div className="activity-list" ref={logsEndRef}>
              {logs.map((log) => (
                <div key={log.id} className="activity-item">
                  <span className="activity-time">[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 3: ROOM SCREEN                                    */}
      {/* ======================================================== */}
      {screen === 'ROOM' && (
        <div className="room-container">
          <div className="room-header">
            <div className="room-info">
              <span className="room-code-tag">{currentRoomId}</span>
              <button className="btn btn-sm btn-secondary" onClick={handleCopyCode}>
                {copySuccess ? '✓ Copied!' : '📋 Copy Code'}
              </button>
              <span className={`role-pill ${isHost ? 'host' : 'member'}`}>
                {isHost ? '👑 Room Host' : 'Player'}
              </span>
            </div>
            <button className="btn btn-danger" onClick={handleLeaveRoom}>
              Leave Room
            </button>
          </div>

          <div className="roster-card">
            <div className="roster-header">
              <h3>Arena Roster ({players.length})</h3>
              <span className="activity-time">
                {players.filter((p) => p.ready).length} / {players.length} Ready
              </span>
            </div>

            <div className="roster-grid">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`player-card ${p.isMe ? 'is-me' : ''} ${
                    p.ready ? 'is-ready' : 'not-ready'
                  }`}
                >
                  <div className="player-card-top">
                    <div className="player-name">
                      {p.name}
                      {p.isMe && <span className="you-tag">YOU</span>}
                    </div>
                    <span className="player-id">#{p.id}</span>
                  </div>
                  <div className="player-card-bottom">
                    <span className="activity-time">{p.isHost ? '👑 Host' : 'Player'}</span>
                    <span className={`status-badge ${p.ready ? 'ready' : 'waiting'}`}>
                      {p.ready ? '✓ Ready' : '⏳ Waiting'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="room-actions">
              <div className="action-buttons">
                <button
                  className={`btn btn-lg ${isReady ? 'btn-warning' : 'btn-success'}`}
                  onClick={handleToggleReady}
                >
                  {isReady ? '✕ Cancel Ready' : '✓ Ready Up'}
                </button>

                {isHost ? (
                  <button
                    className="btn btn-lg btn-primary"
                    disabled={!canStartMatch}
                    onClick={handleStartMatch}
                  >
                    ⚡ Start Match
                  </button>
                ) : (
                  <button
                    className="btn btn-lg btn-secondary"
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  >
                    Waiting for Host...
                  </button>
                )}
              </div>

              <div className="room-status-hint">
                {isHost ? (
                  canStartMatch ? (
                    <span style={{ color: 'var(--success)' }}>All players ready! Click Start Match to begin.</span>
                  ) : (
                    <span>Waiting for all players to click 'Ready Up' before you can start.</span>
                  )
                ) : (
                  <span>
                    {allReady
                      ? 'All players ready! Waiting for the host to launch match...'
                      : 'Make sure to ready up so the host can start.'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="activity-box">
            <div className="activity-header">Room Activity</div>
            <div className="activity-list" ref={logsEndRef}>
              {logs.map((log) => (
                <div key={log.id} className="activity-item">
                  <span className="activity-time">[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 4: ACTIVE MATCH SCREEN                            */}
      {/* ======================================================== */}
      {screen === 'MATCH' && (
        <div className="match-container">
          <div className="match-card">
            <div className="match-icon">⚔️</div>
            <h1>MATCH IN PROGRESS</h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Arena room <strong>{currentRoomId}</strong> is officially underway!
            </p>

            <div
              style={{
                background: 'var(--bg-input)',
                borderRadius: '12px',
                padding: '1rem',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              {players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                >
                  {p.isHost ? '👑 ' : '👤 '}
                  <strong>{p.name}</strong>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              The match broadcast signal was received from the server. You are ready to integrate quiz rounds,
              real-time puzzles, or arena challenges here!
            </p>

            <button className="btn btn-danger btn-lg" onClick={handleLeaveRoom}>
              Exit Match to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
