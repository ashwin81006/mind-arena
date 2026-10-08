package mindarena;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

public class MatchSession {

    private final Room room;
    private final List<String> gameSequence;
    private int currentGameIndex = 0;
    private int currentRound = 0;
    private int totalRoundsForCurrentGame = 1;

    private volatile boolean roundActive = false;
    private volatile boolean waitingForTrigger = false;
    private volatile long roundTriggerTime = 0;

    private final ConcurrentHashMap<Integer, Integer> totalScores = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Integer, Long> roundScores = new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> timeoutFuture = null;
    private final SecureRandom random = new SecureRandom();

    public MatchSession(Room room) {
        this(room, Arrays.asList("reaction-rush", "sequence-memory", "aim-trainer", "number-recall", "visual-memory"));
    }

    public MatchSession(Room room, List<String> games) {
        this.room = room;
        if (games == null || games.isEmpty()) {
            this.gameSequence = Arrays.asList("reaction-rush", "sequence-memory", "aim-trainer", "number-recall", "visual-memory");
        } else {
            this.gameSequence = new ArrayList<>(games);
        }

        for (Player p : room.getPlayers()) {
            totalScores.put(p.getId(), 0);
        }
    }

    public void start() {
        System.out.println("[Match] Starting match in " + room.getId() + " with games: " + String.join(", ", gameSequence));
        room.broadcast(Protocol.MATCH_STARTED + "|" + room.getId());

        // Wait 1.5 seconds then show first game preview
        scheduler.schedule(this::startNextGame, 1500, TimeUnit.MILLISECONDS);
    }

    private String getCurrentGameId() {
        if (currentGameIndex >= 0 && currentGameIndex < gameSequence.size()) {
            return gameSequence.get(currentGameIndex).toLowerCase().trim();
        }
        return "reaction-rush";
    }

    private String getGameName(String gameId) {
        switch (gameId.toLowerCase()) {
            case "sequence-memory":
                return "Sequence Memory";
            case "aim-trainer":
                return "Aim Trainer";
            case "number-recall":
                return "Number Recall";
            case "visual-memory":
                return "Visual Memory";
            case "reaction-rush":
            default:
                return "Reaction Rush";
        }
    }

    private int getRoundsCountForGame(String gameId) {
        if ("reaction-rush".equalsIgnoreCase(gameId)) {
            return gameSequence.size() > 1 ? 2 : 3;
        }
        return 1;
    }

    private void startNextGame() {
        if (room.getPlayerCount() == 0) {
            stop();
            return;
        }

        if (currentGameIndex >= gameSequence.size()) {
            finishMatch();
            return;
        }

        String gameId = getCurrentGameId();
        String gameName = getGameName(gameId);
        currentRound = 0;
        totalRoundsForCurrentGame = getRoundsCountForGame(gameId);

        System.out.println("[Match " + room.getId() + "] Game Preview (" + (currentGameIndex + 1) + "/" + gameSequence.size() + "): " + gameName);

        // Gap between games: display preview with how-to-play & rules for 7 seconds
        int previewDurationSeconds = 7;
        room.broadcast(Protocol.GAME_PREVIEW + "|" + gameId + "|" + gameName + "|" + (currentGameIndex + 1) + "|" + gameSequence.size() + "|" + previewDurationSeconds);

        scheduler.schedule(this::startNextRound, previewDurationSeconds, TimeUnit.SECONDS);
    }

    private void startNextRound() {
        if (room.getPlayerCount() == 0) {
            stop();
            return;
        }

        currentRound++;
        if (currentRound > totalRoundsForCurrentGame) {
            // Move to next game in the sequence
            currentGameIndex++;
            startNextGame();
            return;
        }

        roundScores.clear();
        roundActive = false;
        waitingForTrigger = false;

        String gameId = getCurrentGameId();
        String gameName = getGameName(gameId);

        System.out.println("[Match " + room.getId() + "] Starting Round " + currentRound + "/" + totalRoundsForCurrentGame + " for " + gameName);

        // Notify clients about active game and round with tournament game index
        room.broadcast(Protocol.GAME_START + "|" + gameId + "|" + gameName + "|" + currentRound + "|" + totalRoundsForCurrentGame + "|" + (currentGameIndex + 1) + "|" + gameSequence.size());

        if ("reaction-rush".equalsIgnoreCase(gameId)) {
            // Reaction Rush has countdown then wait for green
            scheduler.schedule(this::prepareReactionRushRound, 2000, TimeUnit.MILLISECONDS);
        } else {
            // Sequence Memory, Number Recall, Visual Memory, Aim Trainer start immediately!
            roundActive = true;
            roundTriggerTime = System.currentTimeMillis();

            // Set generous 60-second round timeout in case player disconnects
            timeoutFuture = scheduler.schedule(this::endRound, 60, TimeUnit.SECONDS);
        }
    }

    private void prepareReactionRushRound() {
        if (room.getPlayerCount() == 0) {
            stop();
            return;
        }

        waitingForTrigger = true;
        roundActive = false;

        room.broadcast(Protocol.ROUND_PREPARE + "|" + currentRound + "|Wait for green...");

        int randomDelayMs = 2000 + random.nextInt(2500);
        scheduler.schedule(this::triggerReactionRushRound, randomDelayMs, TimeUnit.MILLISECONDS);
    }

    private void triggerReactionRushRound() {
        if (!waitingForTrigger || room.getPlayerCount() == 0) {
            return;
        }

        waitingForTrigger = false;
        roundActive = true;
        roundTriggerTime = System.currentTimeMillis();

        System.out.println("[Match " + room.getId() + "] TRIGGER fired for Reaction Rush Round " + currentRound);
        room.broadcast(Protocol.ROUND_TRIGGER + "|" + roundTriggerTime);

        timeoutFuture = scheduler.schedule(this::endRound, 4000, TimeUnit.MILLISECONDS);
    }

    public synchronized void handlePlayerScore(Player player, long clientReportedValue) {
        if (player == null) return;
        int pId = player.getId();

        if (roundScores.containsKey(pId)) {
            return; // Already submitted
        }

        String gameId = getCurrentGameId();

        if ("reaction-rush".equalsIgnoreCase(gameId)) {
            if (waitingForTrigger) {
                // False start
                roundScores.put(pId, -1L);
                System.out.println("[Match " + room.getId() + "] " + player.getName() + " FALSE START!");
                room.broadcast(Protocol.PLAYER_SCORED + "|" + pId + "|" + player.getName());
            } else if (roundActive) {
                long serverDelta = System.currentTimeMillis() - roundTriggerTime;
                long reaction;
                if (clientReportedValue >= 80 && clientReportedValue <= serverDelta + 300) {
                    reaction = clientReportedValue;
                } else if (clientReportedValue > 0) {
                    reaction = Math.min(clientReportedValue, Math.max(80, serverDelta));
                } else {
                    reaction = Math.max(80, serverDelta);
                }
                roundScores.put(pId, reaction);
                System.out.println("[Match " + room.getId() + "] " + player.getName() + " scored: " + reaction + "ms");
                room.broadcast(Protocol.PLAYER_SCORED + "|" + pId + "|" + player.getName());
            }
        } else {
            // Direct score for Sequence Memory, Number Recall, Visual Memory, Aim Trainer
            long score = Math.max(0, clientReportedValue);
            roundScores.put(pId, score);
            System.out.println("[Match " + room.getId() + "] " + player.getName() + " scored " + score + " pts in " + gameId);
            room.broadcast(Protocol.PLAYER_SCORED + "|" + pId + "|" + player.getName());
        }

        // If all players in the room have finished, end round immediately
        if (roundScores.size() >= room.getPlayerCount()) {
            if (timeoutFuture != null && !timeoutFuture.isDone()) {
                timeoutFuture.cancel(false);
            }
            scheduler.schedule(this::endRound, 400, TimeUnit.MILLISECONDS);
        }
    }

    private synchronized void endRound() {
        if (!roundActive && !waitingForTrigger) {
            return;
        }

        roundActive = false;
        waitingForTrigger = false;

        String gameId = getCurrentGameId();
        boolean isReaction = "reaction-rush".equalsIgnoreCase(gameId);

        StringBuilder sb = new StringBuilder();
        sb.append(Protocol.ROUND_RESULTS).append("|").append(currentRound);

        for (Player p : room.getPlayers()) {
            Long rawVal = roundScores.getOrDefault(p.getId(), isReaction ? -2L : 0L);
            int points = 0;

            if (isReaction) {
                if (rawVal > 0) {
                    points = (int) Math.max(100, 1000 - rawVal);
                } else {
                    points = 0;
                }
            } else {
                points = (int) Math.max(0, rawVal);
            }

            final int pts = points;
            int newTotal = totalScores.compute(p.getId(), (k, v) -> (v == null ? 0 : v) + pts);

            // Format: playerId,playerName,rawScoreOrReaction,roundPoints,totalPoints
            sb.append("|")
              .append(p.getId()).append(",")
              .append(p.getName()).append(",")
              .append(rawVal).append(",")
              .append(points).append(",")
              .append(newTotal);
        }

        System.out.println("[Match " + room.getId() + "] Round " + currentRound + " Results (" + gameId + "): " + sb);
        room.broadcast(sb.toString());

        // Display results for 4 seconds before advancing
        scheduler.schedule(this::startNextRound, 4, TimeUnit.SECONDS);
    }

    private void finishMatch() {
        System.out.println("[Match " + room.getId() + "] All games complete! Declaring match winner.");

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

    public synchronized void onPlayerLeft(int playerId) {
        roundScores.remove(playerId);
        totalScores.remove(playerId);

        if (room.getPlayerCount() == 0) {
            stop();
            return;
        }

        // If round is active and all remaining players have submitted, end round immediately
        if (roundActive && roundScores.size() >= room.getPlayerCount()) {
            if (timeoutFuture != null && !timeoutFuture.isDone()) {
                timeoutFuture.cancel(false);
            }
            scheduler.schedule(this::endRound, 300, TimeUnit.MILLISECONDS);
        }
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
