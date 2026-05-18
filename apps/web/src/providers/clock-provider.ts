export class ClockProvider {
  private offset = 0;
  private rtt = 0;
  private isSynced = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private sendPing: (t0: number) => void,
    private syncIntervalMs: number = 30000
  ) {}

  startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      this.requestSync();
    }, this.syncIntervalMs);
  }

  requestSync() {
    const t0 = performance.now();
    this.sendPing(t0);
  }

  handlePong(t0: number, t1: number, t2: number) {
    const t3 = performance.now();

    this.rtt = (t3 - t0) - (t2 - t1);
    this.offset = ((t1 - t0) + (t2 - t3)) / 2;
    this.isSynced = true;
  }

  getServerTime(): number {
    return performance.now() + this.offset;
  }

  getOffset(): number {
    return this.offset;
  }

  getRTT(): number {
    return this.rtt;
  }

  isSynchronized(): boolean {
    return this.isSynced;
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}
