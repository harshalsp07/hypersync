import { Pool } from "pg";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("pg-store");

export class PGStore {
  private pool: Pool;

  constructor(pgUrl: string) {
    this.pool = new Pool({
      connectionString: pgUrl,
      max: 20,
      idleTimeoutMillis: 30000,
    });
  }

  async saveSnapshot(
    roomId: string,
    docType: string,
    stateVector: Uint8Array,
    snapshotData: Uint8Array,
    operationCount: number
  ): Promise<void> {
    const byteSize = snapshotData.length;
    const query = `
      INSERT INTO document_snapshots (room_id, doc_type, state_vector, snapshot_data, byte_size, operation_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (room_id, doc_type, created_at) DO UPDATE
      SET snapshot_data = EXCLUDED.snapshot_data,
          state_vector = EXCLUDED.state_vector,
          byte_size = EXCLUDED.byte_size,
          operation_count = EXCLUDED.operation_count
    `;

    await this.pool.query(query, [
      roomId,
      docType,
      Buffer.from(stateVector),
      Buffer.from(snapshotData),
      byteSize,
      operationCount,
    ]);

    log.debug({ roomId, docType, byteSize, operationCount }, "Saved snapshot");
  }

  async getLatestSnapshot(
    roomId: string,
    docType: string
  ): Promise<{ stateVector: Uint8Array; snapshotData: Uint8Array; operationCount: number } | null> {
    const query = `
      SELECT state_vector, snapshot_data, operation_count
      FROM document_snapshots
      WHERE room_id = $1 AND doc_type = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [roomId, docType]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      stateVector: new Uint8Array(row.state_vector),
      snapshotData: new Uint8Array(row.snapshot_data),
      operationCount: row.operation_count,
    };
  }

  async saveHistorySnapshot(
    roomId: string,
    docType: string,
    snapshotRef: Uint8Array,
    operationCount: number,
    eventLabel?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const query = `
      INSERT INTO history_snapshots (room_id, doc_type, snapshot_ref, operation_count, event_label, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await this.pool.query(query, [
      roomId,
      docType,
      Buffer.from(snapshotRef),
      operationCount,
      eventLabel || null,
      metadata ? JSON.stringify(metadata) : null,
    ]);

    log.debug({ roomId, docType, operationCount, eventLabel }, "Saved history snapshot");
  }

  async getHistorySnapshots(roomId: string, docType: string): Promise<Array<{
    id: number;
    operationCount: number;
    eventLabel: string | null;
    createdAt: Date;
  }>> {
    const query = `
      SELECT id, operation_count, event_label, created_at
      FROM history_snapshots
      WHERE room_id = $1 AND doc_type = $2
      ORDER BY created_at ASC
    `;

    const result = await this.pool.query(query, [roomId, docType]);
    return result.rows.map((row) => ({
      id: row.id,
      operationCount: row.operation_count,
      eventLabel: row.event_label,
      createdAt: row.created_at,
    }));
  }

  async getHistorySnapshotById(id: number): Promise<{ snapshotRef: Uint8Array; operationCount: number } | null> {
    const query = `
      SELECT snapshot_ref, operation_count
      FROM history_snapshots
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      snapshotRef: new Uint8Array(row.snapshot_ref),
      operationCount: row.operation_count,
    };
  }

  async createRoom(
    name: string,
    slug: string,
    createdBy: string,
    roomType: string = "workspace"
  ): Promise<string> {
    const query = `
      INSERT INTO rooms (name, slug, created_by, room_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;

    const result = await this.pool.query(query, [name, slug, createdBy, roomType]);
    return result.rows[0].id;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
