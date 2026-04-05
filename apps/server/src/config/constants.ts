export const CONSTANTS = {
  WS_PATH: "/ws",

  CRDT_SYNC_INTERVAL_MS: 50,
  AWARENESS_TIMEOUT_MS: 30_000,

  SNAPSHOT_OPS_INTERVAL: 100,
  SNAPSHOT_TIME_INTERVAL_MS: 60_000,

  WAL_MAX_LENGTH: 10_000,
  MAX_ROOM_SIZE: 50,

  RATE_LIMIT: {
    CRDT_UPDATE: { capacity: 200, refillRate: 50 },
    AWARENESS: { capacity: 100, refillRate: 30 },
    VIDEO_SEEK: { capacity: 20, refillRate: 2, cost: 5 },
    WHITEBOARD: { capacity: 150, refillRate: 40 },
    WEBRTC_SIGNAL: { capacity: 50, refillRate: 10 },
  } as const,

  COLORS: [
    "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
    "#1abc9c", "#e67e22", "#34495e", "#e91e63", "#00bcd4",
  ],
} as const;
