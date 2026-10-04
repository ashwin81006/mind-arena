package mindarena;

import java.util.concurrent.ConcurrentHashMap;

public class PlayerManager {

    private final ConcurrentHashMap<Integer, Player> players =
        new ConcurrentHashMap<>();

    public void addPlayer(Player player) {
        players.put(player.getId(), player);
    }

    public void removePlayer(int playerId) {
        players.remove(playerId);
    }

    public Player getPlayer(int playerId) {
        return players.get(playerId);
    }

    public int getPlayerCount() {
        return players.size();
    }

    public void printPlayers() {

        System.out.println("Connected players:");

        for (Player player : players.values()) {

            System.out.println(
                player.getId() +
                " - " +
                player.getName()
            );
        }
    }
}