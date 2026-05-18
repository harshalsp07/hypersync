import * as Y from "yjs";
import { createChildLogger } from "../utils/logger.js";
import { CONSTANTS } from "../config/constants.js";
import type { RedisWAL } from "./redis-wal.js";
import type { PGStore } from "./pg-store.js";

const log = createChildLogger("compaction");

export class CompactionWorker {
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private opCounts: Map<string, number> = new Map();

  constructor(
    private redisWAL: RedisWAL,
    private pgStore: PGStore
  ) {}

  startTracking(roomId: string) {
    if (this.intervals.has(roomId)) return;

    this.opCounts.set(roomId, 0);

    const interval = setInterval(async () => {
      await this.compact(roomId);
    }, CONSTANTS.SNAPSHOT_TIME_INTERVAL_MS);

    this.intervals.set(roomId, interval);
    log.debug({ roomId }, "Started tracking for compaction");
  }

  incrementOps(roomId: string): void {
    const count = (this.opCounts.get(roomId) || 0) + 1;
    this.opCounts.set(roomId, count);

    if (count >= CONSTANTS.SNAPSHOT_OPS_INTERVAL) {
      this.compact(roomId).catch((err) => {
        log.error({ err, roomId }, "Compaction failed");
      });
    }
  }

  private async compact(roomId: string): Promise<void> {
    const opCount = this.opCounts.get(roomId) || 0;
    if (opCount === 0) return;

    log.info({ roomId, opCount }, "Starting compaction");

    try {
      const pending = await this.redisWAL.getPending(roomId);
      if (pending.length === 0) return;

      const doc = new Y.Doc();
      for (const entry of pending) {
        try {
          Y.applyUpdate(doc, entry.data);
        } catch (err) {
          log.warn({ err, entryId: entry.id }, "Failed to apply WAL entry");
        }
      }

      const stateVector = Y.encodeStateVector(doc);
      const snapshotData = Y.encodeStateAsUpdate(doc);

      await this.pgStore.saveSnapshot(
        roomId,
        "text",
        stateVector,
        snapshotData,
        opCount
      );

      await this.redisWAL.trim(roomId, 100);

      this.opCounts.set(roomId, 0);

      doc.destroy();

      log.info({ roomId, opCount, snapshotSize: snapshotData.length }, "Compaction complete");
    } catch (err) {
      log.error({ err, roomId }, "Compaction failed");
    }
  }

  stopTracking(roomId: string): void {
    const interval = this.intervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(roomId);
      this.opCounts.delete(roomId);
      log.debug({ roomId }, "Stopped tracking");
    }
  }

  shutdown(): void {
    for (const [roomId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.opCounts.clear();
  }
}
