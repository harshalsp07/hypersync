import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("e2ee-relay");

export class E2EERelay {
  handleEncryptedBlob(conn: any, payload: Uint8Array) {
    if (!conn.roomId) return;

    const room = (conn as any).roomManager?.getRoom(conn.roomId);
    if (!room) return;

    const frame = new Uint8Array(2 + payload.length);
    frame[0] = 0x06;
    frame[1] = 0x01;

    for (const [id, member] of room.members) {
      if (id !== conn.id && member.isConnected) {
        try {
          member.ws.send(frame, true);
        } catch {}
      }
    }

    log.debug({ roomId: conn.roomId, size: payload.length }, "Relayed encrypted blob");
  }
}
