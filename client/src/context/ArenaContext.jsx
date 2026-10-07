import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { PROTOCOL } from '../constants/protocol';
import { useToast } from './ToastContext';

const ArenaContext = createContext(null);

export function ArenaProvider({ children }) {
  const { notify } = useToast();

  // Navigation: 'HOME' | 'ROOM' | 'MATCH'
  const [screen, setScreen] = useState('HOME');

  // Player state
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('mind_arena_player_name') || '';
  });
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [myPlayerName, setMyPlayerName] = useState('');

  // Room state
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [players, setPlayers] = useState([]);
  const [connecting, setConnecting] = useState(false);

  // Gameplay state
  const [gameState, setGameState] = useState(null);

  // Synchronization refs to avoid stale closures
  const wsRef = useRef(null);
  const myPlayerIdRef = useRef(null);
  const myPlayerNameRef = useRef('');
  const isHostRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingActionRef = useRef(null);
  const messageHandlerRef = useRef(null);

  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg);
    }
  }, []);

  const disconnectSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(PROTOCOL.DISCONNECT);
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(PROTOCOL.DISCONNECT);
        wsRef.current.close();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const executePendingAction = useCallback((action) => {
    if (!action) return;
    if (action.type === 'CREATE') {
      send(PROTOCOL.CREATE_ROOM);
    } else if (action.type === 'JOIN') {
      send(`${PROTOCOL.JOIN_ROOM}|${action.code}`);
    }
  }, [send]);

  const handleServerMessage = useCallback((rawMessage) => {
    const parts = rawMessage.split('|');
    const command = parts[0];
    const data = parts.slice(1).join('|');

    switch (command) {
      case PROTOCOL.WELCOME:
        send(`${PROTOCOL.NAME}|${myPlayerNameRef.current || playerName.trim() || 'Player'}`);
        break;

      case PROTOCOL.PLAYER_INFO: {
        const [id, pName] = data.split('|');
        const numId = parseInt(id, 10);
        myPlayerIdRef.current = numId;
        myPlayerNameRef.current = pName;
        setMyPlayerId(numId);
        setMyPlayerName(pName);
        setConnecting(false);

        if (pendingActionRef.current) {
          executePendingAction(pendingActionRef.current);
          pendingActionRef.current = null;
        }
        break;
      }

      case PROTOCOL.ROOM_CREATED: {
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
        setGameState(null);
        notify(`Room ${roomId} created`, 'success');
        break;
      }

      case PROTOCOL.ROOM_JOINED: {
        const roomId = data;
        setCurrentRoomId(roomId);
        isHostRef.current = false;
        setIsHost(false);
        isReadyRef.current = false;
        setIsReady(false);
        setScreen('ROOM');
        setGameState(null);
        notify(`Joined room ${roomId}`, 'success');
        break;
      }

      case PROTOCOL.ROOM_STATE: {
        if (!data) return;
        const playerEntries = data.split('|');
        const myId = myPlayerIdRef.current;
        const myName = myPlayerNameRef.current;
        let currentHost = isHostRef.current;
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

      case PROTOCOL.READY_STATUS:
        break;

      case PROTOCOL.PLAYER_JOINED: {
        const [, , pName] = parts;
        if (pName) {
          notify(`${pName} joined the room`, 'info');
        }
        break;
      }

      case PROTOCOL.PLAYER_LEFT: {
        const [, pIdStr, pName] = parts;
        const leftId = parseInt(pIdStr, 10);
        if (pName) {
          notify(`${pName} left the room`, 'info');
        }
        if (!isNaN(leftId)) {
          setPlayers((prev) => prev.filter((p) => p.id !== leftId));
        }
        break;
      }

      case PROTOCOL.HOST_CHANGED: {
        const newHostId = parseInt(data, 10);
        const amIHost = (newHostId === myPlayerIdRef.current);
        isHostRef.current = amIHost;
        setIsHost(amIHost);
        if (amIHost) {
          notify('You are now the room host', 'info');
        } else {
          notify('Room host changed', 'info');
        }
        break;
      }

      case PROTOCOL.ROOM_LEFT:
      case PROTOCOL.NOT_IN_ROOM:
        setCurrentRoomId(null);
        isHostRef.current = false;
        setIsHost(false);
        isReadyRef.current = false;
        setIsReady(false);
        setPlayers([]);
        setGameState(null);
        setScreen('HOME');
        break;

      case PROTOCOL.MATCH_STARTED:
        setScreen('MATCH');
        setGameState({ phase: 'MATCH_INTRO', roomId: data });
        notify('Match started! Get ready...', 'success');
        break;

      case PROTOCOL.GAME_START: {
        // GAME_START|reaction-rush|Reaction Rush|currentRound|totalRounds
        const [, gameId, gameName, currentRound, totalRounds] = parts;
        setScreen('MATCH');
        setGameState({
          gameId,
          gameName,
          currentRound: parseInt(currentRound, 10),
          totalRounds: parseInt(totalRounds, 10),
          phase: 'STARTING',
          scoredPlayers: []
        });
        break;
      }

      case PROTOCOL.ROUND_PREPARE: {
        // ROUND_PREPARE|roundNum|message
        const [, roundNum, message] = parts;
        setGameState((prev) => ({
          ...prev,
          currentRound: parseInt(roundNum, 10),
          message,
          phase: 'WAITING',
          scoredPlayers: []
        }));
        break;
      }

      case PROTOCOL.ROUND_TRIGGER: {
        // ROUND_TRIGGER|timestamp
        const [, timestampStr] = parts;
        setGameState((prev) => ({
          ...prev,
          phase: 'TRIGGERED',
          triggerTime: parseInt(timestampStr, 10),
          localTriggerTime: performance.now()
        }));
        break;
      }

      case PROTOCOL.PLAYER_SCORED: {
        // PLAYER_SCORED|playerId|playerName
        const [, pId, pName] = parts;
        setGameState((prev) => {
          if (!prev) return prev;
          const scored = prev.scoredPlayers || [];
          return {
            ...prev,
            scoredPlayers: [...scored, { id: parseInt(pId, 10), name: pName }]
          };
        });
        break;
      }

      case PROTOCOL.ROUND_RESULTS: {
        // ROUND_RESULTS|roundNum|pId,name,reaction,points,total|...
        const [, roundNumStr, ...entries] = parts;
        const results = entries.map((entry) => {
          const [idStr, name, reactionStr, pointsStr, totalStr] = entry.split(',');
          return {
            id: parseInt(idStr, 10),
            name,
            reaction: parseInt(reactionStr, 10),
            points: parseInt(pointsStr, 10),
            total: parseInt(totalStr, 10)
          };
        }).sort((a, b) => b.points - a.points);

        setGameState((prev) => ({
          ...prev,
          phase: 'ROUND_RESULTS',
          roundNumber: parseInt(roundNumStr, 10),
          results
        }));
        break;
      }

      case PROTOCOL.MATCH_OVER: {
        // MATCH_OVER|rank,pId,name,score|...
        const [, ...entries] = parts;
        const leaderboard = entries.map((entry) => {
          const [rankStr, idStr, name, scoreStr] = entry.split(',');
          return {
            rank: parseInt(rankStr, 10),
            id: parseInt(idStr, 10),
            name,
            score: parseInt(scoreStr, 10)
          };
        });

        setGameState((prev) => ({
          ...prev,
          phase: 'MATCH_OVER',
          leaderboard
        }));
        notify('Match completed! View the final rankings.', 'success');
        break;
      }

      case PROTOCOL.LOBBY_RETURNED:
        setGameState(null);
        setScreen('ROOM');
        notify('Returned to room lobby', 'info');
        break;

      case PROTOCOL.ERROR:
        notify(data, 'error');
        setConnecting(false);
        break;

      default:
        break;
    }
  }, [executePendingAction, notify, playerName, send]);

  messageHandlerRef.current = handleServerMessage;

  const connectAndExecute = useCallback((validName, action) => {
    myPlayerNameRef.current = validName;
    pendingActionRef.current = action;
    setConnecting(true);

    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      myPlayerName === validName
    ) {
      executePendingAction(action);
      setConnecting(false);
      return;
    }

    disconnectSocket();

    const wsUrl = `ws://${window.location.hostname || 'localhost'}:5051`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const line = event.data.trim();
      if (messageHandlerRef.current) {
        messageHandlerRef.current(line);
      }
    };

    ws.onerror = (err) => {
      console.error('[Bridge] WebSocket error:', err);
      notify('Could not connect to the server. Please verify the server is running.', 'error');
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnecting(false);
      setScreen('HOME');
      setCurrentRoomId(null);
      setMyPlayerId(null);
      setIsHost(false);
      setIsReady(false);
      myPlayerIdRef.current = null;
      isHostRef.current = false;
      isReadyRef.current = false;
      setPlayers([]);
      setGameState(null);
      pendingActionRef.current = null;
    };
  }, [disconnectSocket, executePendingAction, myPlayerName, notify]);

  const createRoom = useCallback((validName) => {
    connectAndExecute(validName, { type: 'CREATE' });
  }, [connectAndExecute]);

  const joinRoom = useCallback((validName, code) => {
    connectAndExecute(validName, { type: 'JOIN', code });
  }, [connectAndExecute]);

  const toggleReady = useCallback(() => {
    send(PROTOCOL.TOGGLE_READY);
  }, [send]);

  const startMatch = useCallback(() => {
    send(PROTOCOL.START_MATCH);
  }, [send]);

  const leaveRoom = useCallback(() => {
    send(PROTOCOL.LEAVE_ROOM);
  }, [send]);

  const submitScore = useCallback((scoreOrTime) => {
    send(`${PROTOCOL.SUBMIT_SCORE}|${scoreOrTime}`);
  }, [send]);

  const returnToLobby = useCallback(() => {
    send(PROTOCOL.RETURN_TO_LOBBY);
  }, [send]);

  const value = {
    screen,
    playerName,
    setPlayerName,
    myPlayerId,
    myPlayerName,
    currentRoomId,
    isHost,
    isReady,
    players,
    connecting,
    pendingAction: pendingActionRef.current,
    gameState,
    createRoom,
    joinRoom,
    toggleReady,
    startMatch,
    leaveRoom,
    submitScore,
    returnToLobby
  };

  return (
    <ArenaContext.Provider value={value}>
      {children}
    </ArenaContext.Provider>
  );
}

export function useArena() {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error('useArena must be used within an ArenaProvider');
  }
  return context;
}
