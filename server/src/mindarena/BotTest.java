package mindarena;

import java.io.*;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicBoolean;

public class BotTest {

    private static final String HOST = "localhost";
    private static final int PORT = 5050;

    public static void main(String[] args) {

        BotClient ashwin = null;
        BotClient rahul = null;
        BotClient karthik = null;

        try {

            System.out.println("=================================");
            System.out.println("      MIND ARENA BOT TEST");
            System.out.println("=================================");

            ashwin = new BotClient("Ashwin");
            rahul = new BotClient("Rahul");
            karthik = new BotClient("Karthik");

            System.out.println("\n[1] Connecting players...");

            ashwin.connect();
            rahul.connect();
            karthik.connect();

            pass("All players connected");

            System.out.println("\n[2] Creating room...");

            ashwin.send(Protocol.CREATE_ROOM);

            String response = ashwin.waitFor(Protocol.ROOM_CREATED);

            if (response == null) {
                fail("Room creation failed");
                return;
            }

            String roomId = response.split("\\|")[1];

            System.out.println("Room: " + roomId);

            pass("Room created");

            System.out.println("\n[3] Joining players...");

            rahul.send(
                    Protocol.JOIN_ROOM +
                            "|" +
                            roomId);

            karthik.send(
                    Protocol.JOIN_ROOM +
                            "|" +
                            roomId);

            if (rahul.waitFor(Protocol.ROOM_JOINED) == null) {
                fail("Rahul failed to join");
                return;
            }

            if (karthik.waitFor(Protocol.ROOM_JOINED) == null) {
                fail("Karthik failed to join");
                return;
            }

            pass("All players joined room");

            System.out.println("\n[4] Testing non-host start...");

            rahul.send(
                    Protocol.START_MATCH);

            String response1 = rahul.waitFor(Protocol.ERROR);

            if (response1 != null &&
                    response1.contains("Only host can start")) {

                pass("Non-host correctly rejected");

            } else {

                fail("Non-host was allowed to start");
            }

            System.out.println("\n[5] Testing host start before ready...");

            ashwin.send(
                    Protocol.START_MATCH);

            String response2 = ashwin.waitFor(Protocol.ERROR);

            if (response2 != null &&
                    response2.contains("Not all players are ready")) {

                pass("Start correctly blocked");

            } else {

                fail("Match started before everyone was ready");
            }

            System.out.println("\n[6] Making all players ready...");

            ashwin.send(
                    Protocol.TOGGLE_READY);

            rahul.send(
                    Protocol.TOGGLE_READY);

            karthik.send(
                    Protocol.TOGGLE_READY);

            if (ashwin.waitFor(Protocol.READY_STATUS) == null) {
                fail("Ashwin ready failed");
                return;
            }

            if (rahul.waitFor(Protocol.READY_STATUS) == null) {
                fail("Rahul ready failed");
                return;
            }

            if (karthik.waitFor(Protocol.READY_STATUS) == null) {
                fail("Karthik ready failed");
                return;
            }

            pass("All players ready");

            System.out.println("\n[7] Starting match...");

            ashwin.send(
                    Protocol.START_MATCH);

            if (ashwin.waitFor(Protocol.MATCH_STARTED) == null) {
                fail("Ashwin did not receive MATCH_STARTED");
                return;
            }

            if (rahul.waitFor(Protocol.MATCH_STARTED) == null) {
                fail("Rahul did not receive MATCH_STARTED");
                return;
            }

            if (karthik.waitFor(Protocol.MATCH_STARTED) == null) {
                fail("Karthik did not receive MATCH_STARTED");
                return;
            }

            pass("All players received MATCH_STARTED");

            System.out.println("\n[8] Disconnecting...");

            ashwin.close();
            rahul.close();
            karthik.close();

            pass("Players disconnected");

            System.out.println("\n=================================");
            System.out.println("       ALL TESTS PASSED");
            System.out.println("=================================");

        } catch (Exception e) {

            System.out.println("\nTEST FAILED");
            System.out.println(
                    "Error: " +
                            e.getMessage());

            e.printStackTrace();

            if (ashwin != null) {
                ashwin.close();
            }

            if (rahul != null) {
                rahul.close();
            }

            if (karthik != null) {
                karthik.close();
            }
        }
    }

    private static void pass(String message) {

        System.out.println(
                "[PASS] " +
                        message);
    }

    private static void fail(String message) {

        System.out.println(
                "[FAIL] " +
                        message);
    }

    static class BotClient {

        private final String name;

        private Socket socket;
        private BufferedReader in;
        private PrintWriter out;

        public BotClient(String name) {
            this.name = name;
        }

        public void connect()
                throws IOException, InterruptedException {

            socket = new Socket(
                    HOST,
                    PORT);

            in = new BufferedReader(
                    new InputStreamReader(
                            socket.getInputStream()));

            out = new PrintWriter(
                    socket.getOutputStream(),
                    true);

            String welcome = waitFor(
                    Protocol.WELCOME);

            if (welcome == null) {
                throw new IOException(
                        "No welcome received");
            }

            send(
                    Protocol.NAME +
                            "|" +
                            name);

            String info = waitFor(
                    Protocol.PLAYER_INFO);

            if (info == null) {
                throw new IOException(
                        "No player info received");
            }
        }

        public synchronized void send(
                String message) {

            System.out.println(
                    "[" +
                            name +
                            " SEND] " +
                            message);

            out.println(message);
        }

        public String waitFor(
                String type) throws IOException {

            long end = System.currentTimeMillis() +
                    5000;

            while (System.currentTimeMillis() < end) {

                String message = in.readLine();

                if (message == null) {
                    return null;
                }

                System.out.println(
                        "[" +
                                name +
                                " RECEIVED] " +
                                message);

                if (message.equals(type) ||
                        message.startsWith(
                                type + "|")) {

                    return message;
                }
            }

            return null;
        }

        public void close() {

            try {

                if (out != null) {

                    out.println(
                            Protocol.DISCONNECT);
                }

                if (socket != null) {
                    socket.close();
                }

            } catch (IOException ignored) {
            }
        }
    }
}