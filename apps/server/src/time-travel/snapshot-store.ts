import { createChildLogger } from "../utils/logger.js";
import * as Y from "yjs";

const log = createChildLogger("snapshot-store");

export interface Snapshot {
  id: number;
  roomId: string;
  docType: string;
  snapshotRef: Y.Snapshot;
  operationCount: number;
  eventLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export class SnapshotManager {
  private snapshots: Map<string, Snapshot[]> = new Map();
  private opCounts: Map<string, number> = new Map();

  createSnapshot(roomId: string, doc: Y.Doc, docType: string, eventLabel?: string): Snapshot {
    const snapshot = Y.snapshot(doc);
    const opCount = this.opCounts.get(roomId) || 0;

    const newSnapshot: Snapshot = {
      id: Date.now(),
      roomId,
      docType,
      snapshotRef: snapshot,
      operationCount: opCount,
      eventLabel,
      createdAt: new Date(),
    };

    if (!this.snapshots.has(roomId)) {
      this.snapshots.set(roomId, []);
    }
    this.snapshots.get(roomId)!.push(newSnapshot);

    log.debug({ roomId, docType, opCount, eventLabel }, "Created snapshot");
    return newSnapshot;
  }

  getSnapshots(roomId: string): Snapshot[] {
    return this.snapshots.get(roomId) || [];
  }

  getSnapshotById(roomId: string, snapshotId: number): Snapshot | undefined {
    const snapshots = this.snapshots.get(roomId) || [];
    return snapshots.find((s) => s.id === snapshotId);
  }

  getNearestSnapshot(roomId: string, targetTime: Date): Snapshot | undefined {
    const snapshots = this.snapshots.get(roomId) || [];
    if (snapshots.length === 0) return undefined;

    let nearest = snapshots[0];
    let minDiff = Math.abs(targetTime.getTime() - nearest.createdAt.getTime());

    for (const snapshot of snapshots) {
      const diff = Math.abs(targetTime.getTime() - snapshot.createdAt.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        nearest = snapshot;
      }
    }

    return nearest;
  }

  incrementOps(roomId: string): number {
    const count = (this.opCounts.get(roomId) || 0) + 1;
    this.opCounts.set(roomId, count);
    return count;
  }

  getOpCount(roomId: string): number {
    return this.opCounts.get(roomId) || 0;
  }

  cleanup(roomId: string) {
    this.snapshots.delete(roomId);
    this.opCounts.delete(roomId);
  }
}
