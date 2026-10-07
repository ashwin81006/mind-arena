package mindarena;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

public class MatchSession {

    private final Room room;
    private final int totalRounds = 3;
    private int currentRound = 0;

    private volatile boolean roundActive = false;
    private volatile boolean waitingForTrigger = false;
    private volatile long roundTriggerTime = 0;

    private final ConcurrentHashMap<Integer, Integer> totalScores = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Integer, Long> roundReactionTimes = new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> timeoutFuture = null;
    private final SecureRandom random = new SecureRandom();

    public MatchSession(Room room) {
        this.room = room;
        for (Player p : room.getPlayers()) {
            totalScores.put(p.getId(), 0);
        }
    }

    public void start() {
        System.out.println("[Match] Starting match in " + room.getId());
        room.broadcast(Protocol.MATCH_STARTED + "|" + room.getId());

        // Wait 2 seconds before starting round 1
        scheduler.schedule(this::startNextRound, 2, TimeUnit.SECONDS);
    }

    private void startNextRound() {
        if (room.getPlayerCount() == 0) {
            stop();
            return;
        }

        currentRound++;
        if (currentRound > totalRounds) {
            finishMatch();
            return;
        }

        roundReactionTimes.clear();
        roundActive = false;
        waitingForTrigger = false;

        System.out.println("[Match " + room.getId() + "] Starting Round " + currentRound + "/" + totalRounds);

        // Notify clients: Game is Reaction Rush, Round X of Y
        room.broadcast(Protocol.GAME_START + "|reaction-rush|Reaction Rush|" + currentRound + "|" + totalRounds);

        // Give players 2.5 seconds countdown before waiting phase
        scheduler.schedule(this::prepareRound, 2500, TimeUnit.MILLISECONDS);
    }

    private void prepareRound() {
        if (room.getPlayerCount() == 0) {
            stop();
            return;
        }

        waitingForTrigger = true;
        roundActive = false;

        // Tell clients to wait for green (screen turns red/wait state)
        room.broadcast(Protocol.ROUND_PREPARE + "|" + currentRound + "|Wait for green...");

        // Randomized delay between 2000ms and 4500ms
        int randomDelayMs = 2000 + random.nextInt(2500);

        scheduler.schedule(this::triggerRound, randomDelayMs, TimeUnit.MILLISECONDS);
    }

    private void triggerRound() {
        if (!waitingForTrigger || room.getPlayerCount() == 0) {
            return;
        }

        waitingForTrigger = false;
        roundActive = true;
        roundTriggerTime = System.currentTimeMillis();

        System.out.println("[Match " + room.getId() + "] TRIGGER fired for Round " + currentRound);

        // Tell clients to click NOW!
        room.broadcast(Protocol.ROUND_TRIGGER + "|" + roundTriggerTime);

        // Schedule timeout after 4 seconds for slow or non-responsive players
        timeoutFuture = scheduler.schedule(this::endRound, 4000, TimeUnit.MILLISECONDS);
    }

    public synchronized void handlePlayerScore(Player player, long clientReportedTime) {
        if (player == null) return;
        int pId = player.getId();

        // Already submitted this round
        if (roundReactionTimes.containsKey(pId)) {
            return;
        }

        if (waitingForTrigger) {
            // Clicked too early before trigger -> FALSE START
            roundReactionTimes.put(pId, -1L);
            System.out.println("[Match " + room.getId() + "] " + player.getName() + " FALSE START!");
            room.broadcast(Protocol.PLAYER_SCORED + "|" + pId + "|" + player.getName());
        } else if (roundActive) {
            long serverDelta = System.currentTimeMillis() - roundTriggerTime;
            // The client measures local high-precision time from trigger render to pointer down.
            // serverDelta covers (network down + client reaction + network up).
            long reaction;
            if (clientReportedTime >= 80 && clientReportedTime <= serverDelta + 300) {
                // Legitimate human reaction within network tolerance
                reaction = clientReportedTime;
            } else if (clientReportedTime > 0) {
                // If client somehow reported anomalous or late, clamp to sensible bound
                reaction = Math.min(clientReportedTime, Math.max(80, serverDelta));
            } else {
                reaction = Math.max(80, serverDelta);
            }
            roundReactionTimes.put(pId, reaction);
            System.out.println("[Match " + room.getId() + "] " + player.getName() + " scored: " + reaction + "ms (client=" + clientReportedTime + ", serverDelta=" + serverDelta + "ms)");
            room.broadcast(Protocol.PLAYER_SCORED + "|" + pId + "|" + player.getName());
        }

        // If all active players in the room have clicked, end round immediately
        if (roundReactionTimes.size() >= room.getPlayerCount()) {
            if (timeoutFuture != null && !timeoutFuture.isDone()) {
                timeoutFuture.cancel(false);
            }
            scheduler.schedule(this::endRound, 300, TimeUnit.MILLISECONDS);
        }
    }

    private synchronized void endRound() {
        if (!roundActive && !waitingForTrigger) {
            return;
        }

        roundActive = false;
        waitingForTrigger = false;

        StringBuilder sb = new StringBuilder();
        sb.append(Protocol.ROUND_RESULTS).append("|").append(currentRound);

        for (Player p : room.getPlayers()) {
            Long reaction = roundReactionTimes.getOrDefault(p.getId(), -2L);
            int points = 0;

            if (reaction > 0) {
                // Higher score for faster reaction: e.g. 150ms -> 850 pts, 300ms -> 700 pts
                points = (int) Math.max(100, 1000 - reaction);
            } else if (reaction == -1L) {
                points = 0; // False start
            } else {
                points = 0; // Timeout
            }

            final int pts = points;
            int newTotal = totalScores.compute(p.getId(), (k, v) -> (v == null ? 0 : v) + pts);

            // Entry format: playerId,playerName,reactionMs,roundPoints,totalPoints
            sb.append("|")
              .append(p.getId()).append(",")
              .append(p.getName()).append(",")
              .append(reaction).append(",")
              .append(points).append(",")
              .append(newTotal);
        }

        System.out.println("[Match " + room.getId() + "] Round " + currentRound + " Results: " + sb);
        room.broadcast(sb.toString());

        // Wait 5 seconds to view results before moving to next round
        scheduler.schedule(this::startNextRound, 5, TimeUnit.SECONDS);
    }

    private void finishMatch() {
        System.out.println("[Match " + room.getId() + "] Match finished!");

        // Sort by total score descending
        List<PlayerScore> leaderboard = new ArrayList<>();
        for (Player p : room.getPlayers()) {
            int score = totalScores.getOrDefault(p.getId(), 0);
            leaderboard.add(new PlayerScore(p.getId(), p.getName(), score));
        }
        leaderboard.sort((a, b) -> Integer.compare(b.score, a.score));

        StringBuilder sb = new StringBuilder();
        sb.append(Protocol.MATCH_OVER);

        int rank = 1;
        for (PlayerScore ps : leaderboard) {
            sb.append("|")
              .append(rank++).append(",")
              .append(ps.id).append(",")
              .append(ps.name).append(",")
              .append(ps.score);
        }

        room.broadcast(sb.toString());
    }

    public void returnToLobby() {
        stop();
        for (Player p : room.getPlayers()) {
            p.setReady(false);
        }
        room.setMatchSession(null);
        room.broadcast(Protocol.LOBBY_RETURNED);
        room.broadcastState();
    }

    public void stop() {
        roundActive = false;
        waitingForTrigger = false;
        if (timeoutFuture != null) {
            timeoutFuture.cancel(true);
        }
        scheduler.shutdownNow();
    }

    private static class PlayerScore {
        final int id;
        final String name;
        final int score;

        PlayerScore(int id, String name, int score) {
            this.id = id;
            this.name = name;
            this.score = score;
        }
    }
}
