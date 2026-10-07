package mindarena;

import java.security.SecureRandom;
import java.util.concurrent.ConcurrentHashMap;

public class RoomManager {

    private final ConcurrentHashMap<String, Room> rooms =
        new ConcurrentHashMap<>();

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private final SecureRandom random = new SecureRandom();

    public synchronized Room createRoom(Player host) {
        String roomId;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            roomId = sb.toString();
        } while (rooms.containsKey(roomId));

        Room room = new Room(
            roomId,
            host
        );

        rooms.put(
            roomId,
            room
        );

        return room;
    }

    public Room getRoom(String roomId) {
        if (roomId == null) return null;
        return rooms.get(roomId.trim().toUpperCase());
    }

    public void removeRoom(String roomId) {
        if (roomId != null) {
            rooms.remove(roomId.trim().toUpperCase());
        }
    }

    public int getRoomCount() {
        return rooms.size();
    }
}