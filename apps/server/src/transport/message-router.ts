import { MessageType, CRDTSubType } from "@hypersync/shared";
import { decodeEnvelope } from "../utils/binary.js";
import { createChildLogger } from "../utils/logger.js";
import type { Connection } from "./connection.js";
import type { RoomManager } from "../rooms/room-manager.js";
import type { CRDTDocManager } from "../crdt/doc-manager.js";
import type { AwarenessHandler } from "../crdt/awareness-handler.js";
import type { VideoSyncManager } from "../media/video-sync.js";
import type { RedisPubSub } from "../scaling/redis-pubsub.js";

const log = createChildLogger("message-router");

type SubHandler = (conn: Connection, payload: Uint8Array) => void;

export class MessageRouter {
  private handlers: Map<number, SubHandler> = new Map();
  private subHandlers: Map<number, Map<number, SubHandler>> = new Map();

  constructor(
    private roomManager: RoomManager,
    private docManager: CRDTDocManager,
    private awarenessHandler: AwarenessHandler,
    private videoSync: VideoSyncManager,
    private redisPubSub?: RedisPubSub
  ) {
    this.registerHandlers();
    this.setupPubSub();
  }

  private setupPubSub() {
    if (!this.redisPubSub) return;

    this.redisPubSub.subscribe("room:*", (channel, data) => {
      const roomId = channel.replace("room:", "");
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        room.broadcast(data);
      }
    });
  }

  private registerHandlers() {
    this.handlers.set(MessageType.CRDT_SYNC, (conn, payload) => {
      if (payload.length < 1) return;
      const subType = payload[0];
      const data = payload.slice(1);
      this.dispatchSub(MessageType.CRDT_SYNC, subType, conn, data);
    });

    this.handlers.set(MessageType.AWARENESS, (conn, payload) => {
      this.awarenessHandler.handle(conn, payload);
    });

    this.handlers.set(MessageType.VIDEO_SYNC, (conn, payload) => {
      this.videoSync.handle(conn, payload);
    });

    this.handlers.set(MessageType.ROOM_MGMT, (conn, payload) => {
      if (payload.length < 1) return;
      const subType = payload[0];
      const data = payload.slice(1);
      this.dispatchSub(MessageType.ROOM_MGMT, subType, conn, data);
    });

    this.handlers.set(MessageType.CONTROL, (conn, payload) => {
      if (payload.length < 1) return;
      if (payload[0] === 0x01) {
        conn.sendPong();
      }
    });

    this.registerCRDTSubHandlers();
    this.registerRoomSubHandlers();
  }

  private registerCRDTSubHandlers() {
    const crdtSubs = new Map<number, SubHandler>();

    crdtSubs.set(CRDTSubType.SYNC_STEP_1, (conn, payload) => {
      this.docManager.handleSyncStep1(conn, payload);
    });

    crdtSubs.set(CRDTSubType.SYNC_STEP_2, (conn, payload) => {
      this.docManager.handleSyncStep2(conn, payload);
    });

    crdtSubs.set(CRDTSubType.UPDATE, (conn, payload) => {
      this.docManager.handleUpdate(conn, payload);
    });

    this.subHandlers.set(MessageType.CRDT_SYNC, crdtSubs);
  }

  private registerRoomSubHandlers() {
    const roomSubs = new Map<number, SubHandler>();

    roomSubs.set(0x00, (conn, payload) => {
      const decoder = new TextDecoder();
      const roomId = decoder.decode(payload);
      this.roomManager.joinRoom(conn, roomId);
    });

    roomSubs.set(0x01, (conn) => {
      this.roomManager.leaveRoom(conn);
    });

    this.subHandlers.set(MessageType.ROOM_MGMT, roomSubs);
  }

  private dispatchSub(type: number, subType: number, conn: Connection, payload: Uint8Array) {
    const subs = this.subHandlers.get(type);
    const handler = subs?.get(subType);
    if (handler) {
      handler(conn, payload);
    } else {
      log.warn({ type, subType }, "Unknown sub-type");
    }
  }

  route(conn: Connection, data: Uint8Array) {
    const envelope = decodeEnvelope(data);
    if (!envelope) {
      log.warn({ connectionId: conn.id }, "Invalid message envelope");
      return;
    }

    const handler = this.handlers.get(envelope.type);
    if (handler) {
      handler(conn, envelope.payload);
    } else {
      log.warn({ type: envelope.type }, "Unknown message type");
    }
  }
}
