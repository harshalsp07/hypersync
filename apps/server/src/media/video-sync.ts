import { MessageType } from "@hypersync/shared";
import { createChildLogger } from "../utils/logger.js";
import { ClockSync } from "./clock-sync.js";
import { VectorClock } from "../utils/vector-clock.js";
import type { Connection } from "../transport/connection.js";
import type { RoomManager } from "../rooms/room-manager.js";

const log = createChildLogger("video-sync");

interface PlaybackState {
  videoId: string;
  state: string;
  currentTime: number;
  playbackRate: number;
  serverTimestamp: number;
  initiatorId: string;
  vectorClock: Record<string, number>;
}

export class VideoSyncManager {
  private roomStates: Map<string, PlaybackState> = new Map();
  private roomClocks: Map<string, Map<string, VectorClock>> = new Map();
  private clockSyncs: Map<string, ClockSync> = new Map();

  constructor(private roomManager: RoomManager) {}

  handle(conn: Connection, payload: Uint8Array) {
    if (!conn.roomId) return;

    if (!conn.canConsume("VIDEO_SEEK")) {
      conn.sendError("Rate limited");
      return;
    }

    try {
      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(payload);
      const state: PlaybackState = JSON.parse(jsonStr);

      state.serverTimestamp = Date.now();
      state.initiatorId = conn.userId;

      this.updateVectorClock(conn.roomId, conn.userId, state.vectorClock);

      const roomState = this.roomStates.get(conn.roomId);
      if (roomState) {
        const comparison = this.compareVectorClocks(roomState.vectorClock, state.vectorClock);
        if (comparison === "before" || comparison === "concurrent") {
          this.roomStates.set(conn.roomId, state);
        }
      } else {
        this.roomStates.set(conn.roomId, state);
      }

      const room = this.roomManager.getRoom(conn.roomId);
      if (room) {
        const responsePayload = new TextEncoder().encode(jsonStr);
        const frame = new Uint8Array(2 + 1 + responsePayload.length);
        frame[0] = MessageType.VIDEO_SYNC;
        frame[1] = 0;
        frame[2] = 0;
        frame.set(responsePayload, 3);

        room.broadcast(frame, conn.id);
      }

      log.debug({ roomId: conn.roomId, videoId: state.videoId, state: state.state }, "Video state updated");
    } catch (err) {
      log.error({ err }, "Failed to parse video sync state");
    }
  }

  private updateVectorClock(roomId: string, userId: string, remoteClock: Record<string, number>) {
    if (!this.roomClocks.has(roomId)) {
      this.roomClocks.set(roomId, new Map());
    }

    const roomClocks = this.roomClocks.get(roomId)!;
    if (!roomClocks.has(userId)) {
      roomClocks.set(userId, new VectorClock());
    }

    const vc = roomClocks.get(userId)!;
    vc.increment(userId);
    vc.merge(remoteClock);
  }

  private compareVectorClocks(
    a: Record<string, number>,
    b: Record<string, number>
  ): "before" | "after" | "concurrent" | "equal" {
    const vcA = VectorClock.fromJSON(a);
    return vcA.compare(b);
  }

  getState(roomId: string): PlaybackState | undefined {
    return this.roomStates.get(roomId);
  }

  cleanup(roomId: string) {
    this.roomStates.delete(roomId);
    this.roomClocks.delete(roomId);
  }
}
