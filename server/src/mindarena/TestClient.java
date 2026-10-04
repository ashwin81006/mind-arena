package mindarena;

import java.io.*;
import java.net.Socket;

public class TestClient {

    public static void main(String[] args) {

        try (
                Socket socket = new Socket("localhost", 5050);

                BufferedReader in = new BufferedReader(
                        new InputStreamReader(socket.getInputStream()));

                PrintWriter out = new PrintWriter(
                        socket.getOutputStream(), true);

                BufferedReader console = new BufferedReader(
                        new InputStreamReader(System.in))) {

            System.out.println(in.readLine());

            System.out.print("Name: ");

            String name = console.readLine();

            out.println(
                    Protocol.NAME +
                            "|" +
                            name);

            System.out.println(in.readLine());

            while (true) {

                System.out.println();
                System.out.println("1. Toggle ready");
                System.out.println("2. Player list");
                System.out.println("3. Create room");
                System.out.println("4. Join room");
                System.out.println("5. Leave room");
                System.out.println("6. Start match");
                System.out.println("7. Disconnect");
                System.out.print("> ");

                String choice = console.readLine();

                if (choice.equals("1")) {

                    out.println(Protocol.TOGGLE_READY);

                } else if (choice.equals("2")) {

                    out.println(Protocol.PLAYER_LIST);

                } else if (choice.equals("3")) {

                    out.println(Protocol.CREATE_ROOM);

                }

                else if (choice.equals("4")) {

                    System.out.print("Room ID: ");

                    String roomId = console.readLine();

                    out.println(
                            Protocol.JOIN_ROOM +
                                    "|" +
                                    roomId);

                } else if (choice.equals("6")) {

                    out.println(
                            Protocol.START_MATCH);

                } else if (choice.equals("7")) {

                    out.println(
                            Protocol.DISCONNECT);

                    break;
                } else {

                    System.out.println(
                            "Invalid choice.");

                    continue;
                }

                String response = in.readLine();

                if (response != null) {
                    System.out.println(
                            "Server: " + response);
                }
            }

        } catch (

        IOException e) {

            System.out.println(
                    "Connection error: " +
                            e.getMessage());
        }
    }
}