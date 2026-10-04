package mindarena;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class Server {

    private static final int PORT = 5050;
    private static int nextPlayerId = 1;

    public static void main(String[] args) {

        ExecutorService pool = Executors.newCachedThreadPool();

        PlayerManager playerManager = new PlayerManager();
        RoomManager roomManager = new RoomManager();

        try (ServerSocket serverSocket = new ServerSocket(PORT)) {

            System.out.println("Mind Arena Server");
            System.out.println("Listening on port " + PORT);

            while (true) {

                Socket socket = serverSocket.accept();

                int playerId = nextPlayerId++;

                System.out.println(
                    "Client connected. Assigned ID: " + playerId
                );

                pool.execute(
                    new ClientHandler(
                        socket,
                        playerId,
                        playerManager,
                        roomManager
                    )
                );
            }

        } catch (IOException e) {

            System.out.println(
                "Server error: " + e.getMessage()
            );
        }
    }
}