import { createChildLogger } from "../utils/logger.js";
import { CONSTANTS } from "../config/constants.js";
import type { Connection } from "../transport/connection.js";
import type { RoomManager } from "../rooms/room-manager.js";

const log = createChildLogger("awareness-handler");

interface AwarenessState {
  user: {
    name: string;
    color: string;
    avatarUrl?: string;
  };
  cursor?: {
    anchor: number;
    head: number;
  };
  viewport?: {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
  };
  lastActive: number;
}

export class AwarenessHandler {
  private states: Map<string, Map<number, AwarenessState>> = new Map();
  private cleanupTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(private roomManager: RoomManager) {}

  handle(conn: Connection, payload: Uint8Array) {
    if (!conn.roomId || payload.length < 5) return;

    if (!conn.canConsume("AWARENESS")) return;

    const clientIdView = new DataView(payload.buffer, payload.byteOffset, 4);
    const clientId = clientIdView.getInt32(0);
    const data = payload.slice(4);

    if (!this.states.has(conn.roomId)) {
      this.states.set(conn.roomId, new Map());
      this.startCleanup(conn.roomId);
    }

    const roomStates = this.states.get(conn.roomId)!;

    if (data.length === 0) {
      roomStates.delete(clientId);
    } else {
      try {
        const decoder = new TextDecoder();
        const jsonStr = decoder.decode(data);
        const state: AwarenessState = JSON.parse(jsonStr);
        state.lastActive = Date.now();
        roomStates.set(clientId, state);
      } catch (err) {
        log.error({ err }, "Failed to parse awareness state");
      }
    }

    const room = this.roomManager.getRoom(conn.roomId);
    if (room) {
      const awarenessPayload = new Uint8Array(payload.length + 1);
      awarenessPayload[0] = 0x01;
      awarenessPayload.set(payload, 1);

      const frame = new Uint8Array(2 + awarenessPayload.length);
      frame[0] = 0x01;
      frame[1] = 0;
      frame.set(awarenessPayload, 2);

      room.broadcast(frame, conn.id);
    }
  }

  private startCleanup(roomId: string) {
    if (this.cleanupTimers.has(roomId)) return;

    const timer = setInterval(() => {
      const roomStates = this.states.get(roomId);
      if (!roomStates) return;

      const now = Date.now();
      for (const [clientId, state] of roomStates) {
        if (now - state.lastActive > CONSTANTS.AWARENESS_TIMEOUT_MS) {
          roomStates.delete(clientId);
        }
      }

      if (roomStates.size === 0) {
        this.states.delete(roomId);
        clearInterval(timer);
        this.cleanupTimers.delete(roomId);
      }
    }, 5000);

    this.cleanupTimers.set(roomId, timer);
  }

  getStates(roomId: string): Map<number, AwarenessState> | undefined {
    return this.states.get(roomId);
  }

  cleanup(roomId: string) {
    this.states.delete(roomId);
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.cleanupTimers.delete(roomId);
    }
  }
}
