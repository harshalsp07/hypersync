import * as Y from "yjs";
import { MessageType, CRDTSubType } from "@hypersync/shared";
import { createChildLogger } from "../utils/logger.js";
import { encodeEnvelope } from "../utils/binary.js";
import type { Connection } from "../transport/connection.js";
import type { RoomManager } from "../rooms/room-manager.js";
import type { RedisWAL } from "../persistence/redis-wal.js";
import type { CompactionWorker } from "../persistence/compaction.js";

const log = createChildLogger("doc-manager");

export class CRDTDocManager {
  private docs: Map<string, Y.Doc> = new Map();

  constructor(
    private roomManager: RoomManager,
    private redisWAL?: RedisWAL,
    private compaction?: CompactionWorker
  ) {}

  private getOrCreateDoc(roomId: string): Y.Doc {
    let doc = this.docs.get(roomId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(roomId, doc);

      if (this.compaction) {
        this.compaction.startTracking(roomId);
      }
    }
    return doc;
  }

  handleSyncStep1(conn: Connection, payload: Uint8Array) {
    if (!conn.roomId) return;

    const doc = this.getOrCreateDoc(conn.roomId);
    const clientStateVector = payload;

    const update = Y.encodeStateAsUpdate(doc, clientStateVector.length > 0 ? clientStateVector : undefined);

    const response = new Uint8Array([CRDTSubType.SYNC_STEP_2, ...update]);
    conn.send(MessageType.CRDT_SYNC, 0, response);

    log.debug(
      { roomId: conn.roomId, connectionId: conn.id, updateSize: update.length },
      "Sent sync step 2"
    );
  }

  handleSyncStep2(conn: Connection, payload: Uint8Array) {
    if (!conn.roomId) return;

    const doc = this.getOrCreateDoc(conn.roomId);
    const update = payload;

    if (update.length > 0) {
      Y.applyUpdate(doc, update);

      const room = this.roomManager.getRoom(conn.roomId);
      if (room) {
        const broadcastPayload = new Uint8Array([CRDTSubType.UPDATE, ...update]);
        room.broadcast(
          encodeEnvelope(MessageType.CRDT_SYNC, 0, broadcastPayload),
          conn.id
        );
      }

      this.persistUpdate(conn.roomId, update);

      log.debug(
        { roomId: conn.roomId, connectionId: conn.id, updateSize: update.length },
        "Applied sync step 2"
      );
    }
  }

  handleUpdate(conn: Connection, payload: Uint8Array) {
    if (!conn.roomId) return;

    if (!conn.canConsume("CRDT_UPDATE")) {
      conn.sendError("Rate limited");
      return;
    }

    const doc = this.getOrCreateDoc(conn.roomId);
    Y.applyUpdate(doc, payload);

    const room = this.roomManager.getRoom(conn.roomId);
    if (room) {
      const broadcastPayload = new Uint8Array([CRDTSubType.UPDATE, ...payload]);
      room.broadcast(
        encodeEnvelope(MessageType.CRDT_SYNC, 0, broadcastPayload),
        conn.id
      );
    }

    this.persistUpdate(conn.roomId, payload);

    log.debug(
      { roomId: conn.roomId, connectionId: conn.id, updateSize: payload.length },
      "Applied CRDT update"
    );
  }

  private async persistUpdate(roomId: string, update: Uint8Array) {
    try {
      if (this.redisWAL) {
        await this.redisWAL.append(roomId, update);
      }
      if (this.compaction) {
        this.compaction.incrementOps(roomId);
      }
    } catch (err) {
      log.error({ err, roomId }, "Failed to persist update");
    }
  }

  getStateVector(roomId: string): Uint8Array {
    const doc = this.docs.get(roomId);
    return doc ? Y.encodeStateVector(doc) : new Uint8Array(0);
  }

  destroyDoc(roomId: string) {
    const doc = this.docs.get(roomId);
    if (doc) {
      doc.destroy();
      this.docs.delete(roomId);
    }
  }
}
