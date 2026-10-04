package mindarena;

public class Protocol {

    public static final String NAME = "NAME";
    public static final String TOGGLE_READY = "TOGGLE_READY";
    public static final String PLAYER_LIST = "PLAYER_LIST";
    public static final String DISCONNECT = "DISCONNECT";

    public static final String WELCOME = "WELCOME";
    public static final String PLAYER_INFO = "PLAYER_INFO";
    public static final String PLAYER_COUNT = "PLAYER_COUNT";
    public static final String READY_STATUS = "READY_STATUS";
    public static final String ERROR = "ERROR";
    public static final String CREATE_ROOM = "CREATE_ROOM";
    public static final String JOIN_ROOM = "JOIN_ROOM";
    public static final String LEAVE_ROOM = "LEAVE_ROOM";

    public static final String ROOM_CREATED = "ROOM_CREATED";
    public static final String ROOM_JOINED = "ROOM_JOINED";
    public static final String ROOM_LEFT = "ROOM_LEFT";
    public static final String NOT_IN_ROOM = "NOT_IN_ROOM";

    public static final String PLAYER_JOINED = "PLAYER_JOINED";
    public static final String PLAYER_LEFT = "PLAYER_LEFT";
    public static final String HOST_CHANGED = "HOST_CHANGED";

    public static final String START_MATCH = "START_MATCH";

    public static final String MATCH_STARTED = "MATCH_STARTED";
    public static final String ROOM_STATE = "ROOM_STATE";
}