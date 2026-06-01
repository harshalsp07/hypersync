import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("clock-sync");

interface ClockSample {
  t0: number;
  t1: number;
  t2: number;
  t3: number;
  rtt: number;
  offset: number;
}

export class ClockSync {
  private samples: ClockSample[] = [];
  private currentOffset = 0;
  private smoothedOffset = 0;
  private isSynced = false;
  private onPongCallback: ((t1: number, t2: number) => void) | null = null;

  constructor(private sendPing: (t0: number) => void) {}

  handlePong(t1: number, t2: number) {
    if (this.onPongCallback) {
      this.onPongCallback(t1, t2);
    }
  }

  recordSample(t0: number, t1: number, t2: number, t3: number) {
    const rtt = (t3 - t0) - (t2 - t1);
    const offset = ((t1 - t0) + (t2 - t3)) / 2;

    if (rtt < 0) return;

    this.samples.push({ t0, t1, t2, t3, rtt, offset });

    if (this.samples.length >= 4) {
      this.computeOffset();
    }
  }

  private computeOffset() {
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);

    const trimCount = Math.floor(sorted.length * 0.25);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

    if (trimmed.length === 0) return;

    let totalWeight = 0;
    let weightedSum = 0;
    for (const sample of trimmed) {
      const weight = 1 / sample.rtt;
      totalWeight += weight;
      weightedSum += weight * sample.offset;
    }

    const newOffset = weightedSum / totalWeight;

    if (!this.isSynced) {
      this.smoothedOffset = newOffset;
      this.isSynced = true;
    } else {
      this.smoothedOffset = 0.8 * this.smoothedOffset + 0.2 * newOffset;
    }

    this.currentOffset = this.smoothedOffset;
    this.samples = [];

    log.debug({ offset: this.currentOffset }, "Clock offset updated");
  }

  getServerTime(): number {
    return performance.now() + this.currentOffset;
  }

  getOffset(): number {
    return this.currentOffset;
  }

  getRTT(): number | null {
    if (this.samples.length === 0) return null;
    return this.samples[this.samples.length - 1].rtt;
  }

  isSynchronized(): boolean {
    return this.isSynced;
  }
}
