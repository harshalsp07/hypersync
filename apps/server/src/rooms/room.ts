import { createChildLogger } from "../utils/logger.js";
import { CONSTANTS } from "../config/constants.js";
import type { Connection } from "../transport/connection.js";
import * as Y from "yjs";

const log = createChildLogger("room");

export interface RoomState {
  id: string;
  members: Map<string, Connection>;
  doc: Y.Doc;
  awarenessStates: Map<number, unknown>;
}

export class Room {
  public id: string;
  public members: Map<string, Connection> = new Map();
  public doc: Y.Doc;
  public awarenessStates: Map<number, unknown> = new Map();

  constructor(id: string) {
    this.id = id;
    this.doc = new Y.Doc();
    log.info({ roomId: id }, "Room created");
  }

  addMember(conn: Connection): boolean {
    if (this.members.size >= CONSTANTS.MAX_ROOM_SIZE) {
      log.warn({ roomId: this.id, connectionId: conn.id }, "Room full");
      return false;
    }

    this.members.set(conn.id, conn);
    conn.roomId = this.id;

    log.info({ roomId: this.id, userId: conn.userId, username: conn.username }, "User joined room");
    this.broadcastMemberList();
    return true;
  }

  removeMember(conn: Connection) {
    this.members.delete(conn.id);
    conn.roomId = null;
    this.awarenessStates.delete(this.getClientId(conn));

    log.info({ roomId: this.id, userId: conn.userId }, "User left room");
    this.broadcastMemberList();
  }

  broadcast(data: ArrayBuffer | Uint8Array, excludeId?: string) {
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    for (const [id, conn] of this.members) {
      if (id !== excludeId && conn.isConnected) {
        try {
          conn.ws.send(buf, true);
        } catch {}
      }
    }
  }

  broadcastMemberList() {
    const encoder = new TextEncoder();
    const memberData = Array.from(this.members.values()).map((c) => ({
      id: c.userId,
      username: c.username,
    }));
    const payload = encoder.encode(JSON.stringify({ members: memberData }));
    for (const conn of this.members.values()) {
      conn.ws.send(new Uint8Array([0x05, 0x02, ...payload]), true);
    }
  }

  getClientId(conn: Connection): number {
    let hash = 0;
    for (let i = 0; i < conn.userId.length; i++) {
      hash = (hash * 31 + conn.userId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  isEmpty(): boolean {
    return this.members.size === 0;
  }

  destroy() {
    this.doc.destroy();
    log.info({ roomId: this.id }, "Room destroyed");
  }
}
