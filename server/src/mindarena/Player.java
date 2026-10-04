package mindarena;

import java.net.Socket;

public class Player {

    private final int id;
    private final String name;
    private final Socket socket;
    private boolean ready;
    private Room room;

    public Player(int id, String name, Socket socket) {
        this.id = id;
        this.name = name;
        this.socket = socket;
        this.ready = false;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Socket getSocket() {
        return socket;
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }
}