package mindarena;

import java.io.*;
import java.net.Socket;

public class ClientHandler implements Runnable {

    private final Socket socket;
    private final int playerId;
    private final PlayerManager playerManager;
    private final RoomManager roomManager;

    public ClientHandler(
            Socket socket,
            int playerId,
            PlayerManager playerManager,
            RoomManager roomManager) {
        this.socket = socket;
        this.playerId = playerId;
        this.playerManager = playerManager;
        this.roomManager = roomManager;
    }

    @Override
    public void run() {

        Player player = null;

        try (
                BufferedReader in = new BufferedReader(
                        new InputStreamReader(socket.getInputStream()));

                PrintWriter out = new PrintWriter(
                        socket.getOutputStream(), true)) {

            out.println(
                    Protocol.WELCOME +
                            "|Enter your name");

            String message = in.readLine();

            if (message == null) {
                return;
            }

            String[] parts = message.split("\\|", 2);

            if (!parts[0].equals(Protocol.NAME)) {

                out.println(
                        Protocol.ERROR +
                                "|Name required");

                return;
            }

            String name = "";

            if (parts.length > 1) {
                name = parts[1];
            }

            player = new Player(
                    playerId,
                    name,
                    socket);

            playerManager.addPlayer(player);

            System.out.println(
                    "Player joined: " +
                            player.getName() +
                            " [" +
                            player.getId() +
                            "]");

            out.println(
                    Protocol.PLAYER_INFO +
                            "|" +
                            player.getId() +
                            "|" +
                            player.getName());

            String request;

            while ((request = in.readLine()) != null) {

                handleRequest(
                        request,
                        player,
                        out);

                if (request.equals(Protocol.DISCONNECT)) {
                    break;
                }
            }

        } catch (IOException e) {

            System.out.println(
                    "Player disconnected.");

        } finally {

            if (player != null) {

                Room room = player.getRoom();

                if (room != null) {

                    String roomId = room.getId();
                    int oldHostId = room.getHostId();

                    room.removePlayer(
                            player.getId());

                    if (room.getMatchSession() != null) {
                        room.getMatchSession().onPlayerLeft(player.getId());
                    }

                    if (room.getPlayerCount() > 0) {
                        room.broadcast(
                                Protocol.PLAYER_LEFT +
                                        "|" +
                                        player.getId() +
                                        "|" +
                                        player.getName());

                        if (oldHostId == player.getId()) {
                            room.broadcast(
                                    Protocol.HOST_CHANGED +
                                            "|" +
                                            room.getHostId());
                        }
                        room.broadcastState();
                    }

                    if (room.getPlayerCount() == 0) {
                        if (room.getMatchSession() != null) {
                            room.getMatchSession().stop();
                        }
                        roomManager.removeRoom(roomId);
                    }
                }

                playerManager.removePlayer(
                        player.getId());

                System.out.println(
                        "Player removed: " +
                                player.getName());
            }

            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }

    private void handleRequest(
            String request,
            Player player,
            PrintWriter out) {

        if (request.equals(Protocol.TOGGLE_READY)) {

            Room room = player.getRoom();

            if (room == null) {

                out.println(
                        Protocol.ERROR +
                                "|Join a room first");

                return;
            }

            player.setReady(!player.isReady());

            room.broadcast(
                    Protocol.READY_STATUS +
                            "|" +
                            player.getId() +
                            "|" +
                            player.getName() +
                            "|" +
                            player.isReady());
            room.broadcastState();

            System.out.println(
                    player.getName() +
                            " ready: " +
                            player.isReady());

        } else if (request.equals(Protocol.CREATE_ROOM)) {

            if (player.getRoom() != null) {

                out.println(
                        Protocol.ERROR +
                                "|Already in a room");

                return;
            }

            Room room = roomManager.createRoom(player);

            player.setRoom(room);

            out.println(
                    Protocol.ROOM_CREATED +
                            "|" +
                            room.getId());

            System.out.println(
                    player.getName() +
                            " created " +
                            room.getId());
        } else if (request.startsWith(Protocol.JOIN_ROOM + "|")) {

            if (player.getRoom() != null) {

                out.println(
                        Protocol.ERROR +
                                "|Already in a room");

                return;
            }

            String[] parts = request.split("\\|", 2);

            String roomId = parts.length > 1 ? parts[1].trim().toUpperCase() : "";

            Room room = roomManager.getRoom(roomId);

            if (room == null) {

                out.println(
                        Protocol.ERROR +
                                "|Room not found");

            } else {

                room.addPlayer(player);

                player.setRoom(room);

                out.println(
                        Protocol.ROOM_JOINED +
                                "|" +
                                room.getId());

                room.broadcastState();

                System.out.println(
                        player.getName() +
                                " joined " +
                                room.getId());
            }
        } else if (request.equals(Protocol.PLAYER_LIST)) {

            out.println(
                    Protocol.PLAYER_COUNT +
                            "|" +
                            playerManager.getPlayerCount());

            playerManager.printPlayers();

        } else if (request.equals(Protocol.DISCONNECT)) {

            System.out.println(
                    player.getName() +
                            " requested disconnect.");

        } else if (request.equals(Protocol.LEAVE_ROOM)) {

            Room room = player.getRoom();

            if (room == null) {

                out.println(
                        Protocol.NOT_IN_ROOM);

            } else {

                String roomId = room.getId();

                int oldHostId = room.getHostId();

                room.removePlayer(
                        player.getId());

                if (room.getMatchSession() != null) {
                    room.getMatchSession().onPlayerLeft(player.getId());
                }

                player.setRoom(null);
                player.setReady(false);
                if (room.getPlayerCount() > 0) {

                    room.broadcast(
                            Protocol.PLAYER_LEFT +
                                    "|" +
                                    player.getId() +
                                    "|" +
                                    player.getName());

                    if (oldHostId == player.getId()) {

                        room.broadcast(
                                Protocol.HOST_CHANGED +
                                        "|" +
                                        room.getHostId());
                    }

                    room.broadcastState();
                }
                if (room.getPlayerCount() == 0) {
                    if (room.getMatchSession() != null) {
                        room.getMatchSession().stop();
                    }
                    roomManager.removeRoom(roomId);

                    System.out.println(
                            roomId +
                                    " removed.");

                } else {

                    System.out.println(
                            player.getName() +
                                    " left " +
                                    roomId);
                }

                out.println(
                        Protocol.ROOM_LEFT +
                                "|" +
                                roomId);
            }
        }

        else if (request.startsWith(Protocol.SET_GAMES + "|")) {

            Room room = player.getRoom();

            if (room != null && room.isHost(player.getId())) {
                String[] parts = request.split("\\|", 2);
                if (parts.length > 1) {
                    String[] raw = parts[1].split(",");
                    java.util.List<String> list = new java.util.ArrayList<>();
                    for (String g : raw) {
                        String trimmed = g.trim();
                        if (!trimmed.isEmpty()) {
                            list.add(trimmed);
                        }
                    }
                    if (!list.isEmpty()) {
                        room.setSelectedGames(list);
                    }
                }
            }

        } else if (request.startsWith(Protocol.START_MATCH)) {

            Room room = player.getRoom();

            if (room == null) {

                out.println(
                        Protocol.ERROR +
                                "|Join a room first");

                return;
            }

            if (!room.isHost(player.getId())) {

                out.println(
                        Protocol.ERROR +
                                "|Only host can start");

                return;
            }

            if (room.getPlayerCount() < 2) {
                out.println(
                        Protocol.ERROR +
                                "|At least 2 players are required to start a match");
                return;
            }

            if (!room.allPlayersReady()) {

                out.println(
                        Protocol.ERROR +
                                "|Not all players are ready");

                return;
            }

            synchronized (room) {
                if (room.getMatchSession() != null) {
                    System.out.println("[Match] Start match ignored - match already in progress in room " + room.getId());
                    return;
                }

                java.util.List<String> gamesToPlay = room.getSelectedGames();
                String[] parts = request.split("\\|", 2);
                if (parts.length > 1 && !parts[1].trim().isEmpty()) {
                    String[] raw = parts[1].split(",");
                    java.util.List<String> customList = new java.util.ArrayList<>();
                    for (String g : raw) {
                        String trimmed = g.trim();
                        if (!trimmed.isEmpty()) {
                            customList.add(trimmed);
                        }
                    }
                    if (!customList.isEmpty()) {
                        gamesToPlay = customList;
                        room.setSelectedGames(customList);
                    }
                }

                MatchSession session = new MatchSession(room, gamesToPlay);
                room.setMatchSession(session);
                session.start();
            }

        } else if (request.startsWith(Protocol.SUBMIT_SCORE + "|")) {

            Room room = player.getRoom();

            if (room != null && room.getMatchSession() != null) {
                String[] parts = request.split("\\|", 2);
                long scoreOrTime = 0;
                try {
                    scoreOrTime = Long.parseLong(parts[1].trim());
                } catch (NumberFormatException ignored) {
                }
                room.getMatchSession().handlePlayerScore(player, scoreOrTime);
            }

        } else if (request.equals(Protocol.RETURN_TO_LOBBY)) {

            Room room = player.getRoom();

            if (room != null && room.isHost(player.getId()) && room.getMatchSession() != null) {
                room.getMatchSession().returnToLobby();
            }
        } else {

            out.println(
                    Protocol.ERROR +
                            "|Unknown command");
        }
    }
}