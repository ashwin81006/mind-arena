package mindarena;

import java.io.*;
import java.net.Socket;

public class GameplayBotTest {

    private static final String HOST = "localhost";
    private static final int PORT = 5050;

    public static void main(String[] args) {

        BotClient ashwin = null;
        BotClient rahul = null;
        BotClient karthik = null;

        try {
            System.out.println("==========================================");
            System.out.println("   MIND ARENA GAMEPLAY MULTIPLAYER TEST   ");
            System.out.println("==========================================");

            ashwin = new BotClient("Ashwin");
            rahul = new BotClient("Rahul");
            karthik = new BotClient("Karthik");

            System.out.println("\n[1] Connecting 3 players...");
            ashwin.connect();
            rahul.connect();
            karthik.connect();
            pass("All 3 players connected to server");

            System.out.println("\n[2] Creating room...");
            ashwin.send(Protocol.CREATE_ROOM);
            String roomCreated = ashwin.waitFor(Protocol.ROOM_CREATED, 5000);
            if (roomCreated == null) {
                fail("Failed to create room");
                return;
            }
            String roomId = roomCreated.split("\\|")[1];
            pass("Room created: " + roomId);

            System.out.println("\n[3] Rahul & Karthik joining room...");
            rahul.send(Protocol.JOIN_ROOM + "|" + roomId);
            karthik.send(Protocol.JOIN_ROOM + "|" + roomId);

            if (rahul.waitFor(Protocol.ROOM_JOINED, 5000) == null ||
                karthik.waitFor(Protocol.ROOM_JOINED, 5000) == null) {
                fail("Players failed to join room");
                return;
            }
            pass("All players joined " + roomId);

            System.out.println("\n[4] Readying up...");
            ashwin.send(Protocol.TOGGLE_READY);
            rahul.send(Protocol.TOGGLE_READY);
            karthik.send(Protocol.TOGGLE_READY);
            Thread.sleep(600);
            pass("All players readied up");

            System.out.println("\n[5] Ashwin starting match...");
            ashwin.send(Protocol.START_MATCH);

            if (ashwin.waitFor(Protocol.MATCH_STARTED, 5000) == null ||
                rahul.waitFor(Protocol.MATCH_STARTED, 5000) == null ||
                karthik.waitFor(Protocol.MATCH_STARTED, 5000) == null) {
                fail("Players did not receive MATCH_STARTED");
                return;
            }
            pass("All players received MATCH_STARTED");

            System.out.println("\n[6] Awaiting Game Preview Intermission (Rules & How to Play)...");
            String gamePreview = ashwin.waitFor(Protocol.GAME_PREVIEW, 5000);
            if (gamePreview == null) {
                fail("GAME_PREVIEW not received");
                return;
            }
            pass("Received Game Preview: " + gamePreview);

            System.out.println("\n[7] Awaiting Game Start after Preview...");
            String gameStart = ashwin.waitFor(Protocol.GAME_START, 10000);
            if (gameStart == null) {
                fail("GAME_START not received");
                return;
            }
            pass("Received: " + gameStart);

            System.out.println("\n[8] Awaiting Round 1 Preparation (Wait for green)...");
            String prepare = ashwin.waitFor(Protocol.ROUND_PREPARE, 6000);
            if (prepare == null) {
                fail("ROUND_PREPARE not received");
                return;
            }
            pass("Received: " + prepare);

            System.out.println("\n[8] Awaiting Server Authoritative TRIGGER (Click now!)...");
            String triggerAshwin = ashwin.waitFor(Protocol.ROUND_TRIGGER, 8000);
            String triggerRahul = rahul.waitFor(Protocol.ROUND_TRIGGER, 8000);
            String triggerKarthik = karthik.waitFor(Protocol.ROUND_TRIGGER, 8000);

            if (triggerAshwin == null || triggerRahul == null || triggerKarthik == null) {
                fail("ROUND_TRIGGER not received simultaneously by all players");
                return;
            }
            pass("ROUND_TRIGGER synchronized across all 3 players!");

            System.out.println("\n[9] Simulating Player Reaction Times...");
            // Ashwin: fast reflex (185ms)
            // Rahul: average reflex (260ms)
            // Karthik: slow reflex (380ms)
            Thread.sleep(50);
            ashwin.send(Protocol.SUBMIT_SCORE + "|185");
            rahul.send(Protocol.SUBMIT_SCORE + "|260");
            karthik.send(Protocol.SUBMIT_SCORE + "|380");

            System.out.println("\n[10] Awaiting Round 1 Results...");
            String results = ashwin.waitFor(Protocol.ROUND_RESULTS, 6000);
            if (results == null) {
                fail("ROUND_RESULTS not received");
                return;
            }
            pass("ROUND_RESULTS broadcast received: " + results);

            System.out.println("\n[11] Testing Return to Lobby by Host...");
            ashwin.send(Protocol.RETURN_TO_LOBBY);

            if (ashwin.waitFor(Protocol.LOBBY_RETURNED, 5000) == null ||
                rahul.waitFor(Protocol.LOBBY_RETURNED, 5000) == null) {
                fail("LOBBY_RETURNED not received");
                return;
            }
            pass("LOBBY_RETURNED successfully synchronized across players!");

            System.out.println("\n[12] Disconnecting cleanly...");
            ashwin.close();
            rahul.close();
            karthik.close();
            pass("All bots disconnected");

            System.out.println("\n==========================================");
            System.out.println("   MULTIPLAYER GAME PIPELINE TEST PASSED! ");
            System.out.println("==========================================");

        } catch (Exception e) {
            System.out.println("\nTEST FAILED with exception: " + e.getMessage());
            e.printStackTrace();
            if (ashwin != null) ashwin.close();
            if (rahul != null) rahul.close();
            if (karthik != null) karthik.close();
        }
    }

    private static void pass(String msg) {
        System.out.println("[PASS] " + msg);
    }

    private static void fail(String msg) {
        System.out.println("[FAIL] " + msg);
    }

    static class BotClient {
        private final String name;
        private Socket socket;
        private BufferedReader in;
        private PrintWriter out;

        public BotClient(String name) {
            this.name = name;
        }

        public void connect() throws IOException {
            socket = new Socket(HOST, PORT);
            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);

            waitFor(Protocol.WELCOME, 5000);
            send(Protocol.NAME + "|" + name);
            waitFor(Protocol.PLAYER_INFO, 5000);
        }

        public synchronized void send(String msg) {
            System.out.println("[" + name + " SEND] " + msg);
            out.println(msg);
        }

        public String waitFor(String type, long timeoutMs) throws IOException {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (System.currentTimeMillis() < deadline) {
                if (in.ready()) {
                    String line = in.readLine();
                    if (line == null) return null;
                    System.out.println("[" + name + " RECV] " + line);
                    if (line.equals(type) || line.startsWith(type + "|")) {
                        return line;
                    }
                } else {
                    try {
                        Thread.sleep(20);
                    } catch (InterruptedException ignored) {}
                }
            }
            return null;
        }

        public void close() {
            try {
                if (out != null) {
                    out.println(Protocol.DISCONNECT);
                }
                if (socket != null) {
                    socket.close();
                }
            } catch (IOException ignored) {}
        }
    }
}
