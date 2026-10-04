package mindarena;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.concurrent.ConcurrentHashMap;

public class Room {

    private final String id;
    private int hostId;

    private final ConcurrentHashMap<Integer, Player> players = new ConcurrentHashMap<>();

    public Room(String id, Player host) {

        this.id = id;
        this.hostId = host.getId();

        players.put(
                host.getId(),
                host);
    }

    public String getId() {
        return id;
    }

    public int getHostId() {
        return hostId;
    }

    public void setHostId(int hostId) {
        this.hostId = hostId;
    }

    public void addPlayer(Player player) {

        players.put(
                player.getId(),
                player);
    }

    public boolean isHost(int playerId) {

        return hostId == playerId;
    }

    public String getState() {

        StringBuilder state = new StringBuilder();

        state.append(
                Protocol.ROOM_STATE);

        for (Player player : players.values()) {

            state.append("|");

            state.append(
                    player.getId());

            state.append(",");

            state.append(
                    player.getName());

            state.append(",");

            state.append(
                    player.isReady());

            state.append(",");

            state.append(
                    player.getId() == hostId);
        }

        return state.toString();
    }

    public void broadcastState() {

        broadcast(
                getState());
    }

    public void printPlayers() {

        for (Player player : players.values()) {

            System.out.println(
                    player.getId() +
                            " - " +
                            player.getName() +
                            " - Ready: " +
                            player.isReady());
        }
    }

    public void broadcast(String message) {

        for (Player player : players.values()) {

            try {

                PrintWriter out = new PrintWriter(
                        player.getSocket().getOutputStream(),
                        true);

                out.println(message);

            } catch (IOException ignored) {
            }
        }
    }

    public void removePlayer(int playerId) {

        players.remove(playerId);

        if (playerId == hostId && !players.isEmpty()) {

            hostId = players.values()
                    .iterator()
                    .next()
                    .getId();
        }
    }

    public Player getPlayer(int playerId) {

        return players.get(playerId);
    }

    public int getPlayerCount() {

        return players.size();
    }

    public boolean containsPlayer(int playerId) {

        return players.containsKey(playerId);
    }

    public boolean allPlayersReady() {

        if (players.isEmpty()) {
            return false;
        }

        for (Player player : players.values()) {

            if (!player.isReady()) {
                return false;
            }
        }

        return true;
    }
}