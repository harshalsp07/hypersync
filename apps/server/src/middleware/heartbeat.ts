import { createChildLogger } from "../utils/logger.js";
import type { Connection } from "../transport/connection.js";

const log = createChildLogger("heartbeat");

export class HeartbeatManager {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private intervalMs: number,
    private timeoutMs: number
  ) {}

  start(connections: Map<string, Connection>) {
    this.interval = setInterval(() => {
      const now = Date.now();
      for (const [id, conn] of connections) {
        if (now - conn.lastActivity > this.timeoutMs) {
          log.warn({ connectionId: id }, "Connection timed out");
          conn.close(1000, "Heartbeat timeout");
          connections.delete(id);
          continue;
        }
        conn.sendPing();
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
