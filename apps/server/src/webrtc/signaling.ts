import { MessageType } from "@hypersync/shared";
import { createChildLogger } from "../utils/logger.js";
import type { Connection } from "../transport/connection.js";
import type { RoomManager } from "../rooms/room-manager.js";

const log = createChildLogger("signaling");

interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate";
  from: string;
  to: string;
  data: unknown;
}

export class WebRTCSignaling {
  constructor(private roomManager: RoomManager) {}

  handle(conn: Connection, payload: Uint8Array) {
    if (!conn.roomId) return;

    try {
      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(payload);
      const message: SignalingMessage = JSON.parse(jsonStr);

      message.from = conn.userId;

      const room = this.roomManager.getRoom(conn.roomId);
      if (!room) return;

      const targetConn = Array.from(room.members.values()).find(
        (m) => m.userId === message.to
      );

      if (targetConn) {
        const responsePayload = new TextEncoder().encode(JSON.stringify(message));
        const frame = new Uint8Array(2 + 1 + responsePayload.length);
        frame[0] = MessageType.WEBRTC_SIGNAL;
        frame[1] = 0;
        frame[2] = 0;
        frame.set(responsePayload, 3);

        targetConn.ws.send(frame, true);

        log.debug(
          {
            roomId: conn.roomId,
            from: conn.userId,
            to: message.to,
            type: message.type,
          },
          "Relayed signaling message"
        );
      }
    } catch (err) {
      log.error({ err }, "Failed to handle signaling message");
    }
  }
}
