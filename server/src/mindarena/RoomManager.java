package mindarena;

import java.util.concurrent.ConcurrentHashMap;

public class RoomManager {

    private final ConcurrentHashMap<String, Room> rooms =
        new ConcurrentHashMap<>();

    private int nextRoomId = 1000;

    public synchronized Room createRoom(Player host) {

        String roomId = "ROOM" + nextRoomId++;

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

        return rooms.get(roomId);
    }

    public void removeRoom(String roomId) {

        rooms.remove(roomId);
    }

    public int getRoomCount() {

        return rooms.size();
    }
}