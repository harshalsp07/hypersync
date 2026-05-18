import { Redis } from "ioredis";
import { createChildLogger } from "../utils/logger.js";
import { CONSTANTS } from "../config/constants.js";

const log = createChildLogger("redis-wal");

export class RedisWAL {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });
  }

  async append(roomId: string, data: Uint8Array): Promise<string> {
    const streamKey = `wal:${roomId}`;
    const entryId = await this.redis.xadd(
      streamKey,
      "*",
      "data",
      Buffer.from(data),
      "ts",
      Date.now().toString()
    );

    const length = await this.redis.xlen(streamKey);
    if (length > CONSTANTS.WAL_MAX_LENGTH) {
      await this.redis.xtrim(streamKey, "MAXLEN", CONSTANTS.WAL_MAX_LENGTH);
    }

    log.debug({ roomId, entryId, length }, "Appended to WAL");
    return entryId!;
  }

  async getPending(roomId: string, afterEntryId: string = "0"): Promise<Array<{ id: string; data: Uint8Array; ts: number }>> {
    const streamKey = `wal:${roomId}`;
    const entries = await this.redis.xrange(streamKey, `(${afterEntryId}`, "+");

    return entries.map(([id, fields]: [string, string[]]) => {
      const dataIdx = fields.indexOf("data");
      const tsIdx = fields.indexOf("ts");
      return {
        id,
        data: new Uint8Array(Buffer.from(fields[dataIdx + 1], "base64")),
        ts: parseInt(fields[tsIdx + 1], 10),
      };
    });
  }

  async getLatestEntryId(roomId: string): Promise<string> {
    const streamKey = `wal:${roomId}`;
    const entries = await this.redis.xrevrange(streamKey, "+", "-", "COUNT", 1);
    return entries.length > 0 ? entries[0][0] : "0";
  }

  async trim(roomId: string, maxLen: number): Promise<void> {
    const streamKey = `wal:${roomId}`;
    await this.redis.xtrim(streamKey, "MAXLEN", maxLen);
    log.debug({ roomId, maxLen }, "Trimmed WAL");
  }

  async getLength(roomId: string): Promise<number> {
    return this.redis.xlen(`wal:${roomId}`);
  }

  async destroy(roomId: string): Promise<void> {
    await this.redis.del(`wal:${roomId}`);
    log.info({ roomId }, "WAL destroyed");
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
