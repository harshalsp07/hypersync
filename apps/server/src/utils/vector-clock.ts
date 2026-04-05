export class VectorClock {
  private clock: Map<string, number> = new Map();

  increment(nodeId: string): void {
    const current = this.clock.get(nodeId) || 0;
    this.clock.set(nodeId, current + 1);
  }

  merge(other: Record<string, number>): void {
    for (const [nodeId, value] of Object.entries(other)) {
      const current = this.clock.get(nodeId) || 0;
      if (value > current) {
        this.clock.set(nodeId, value);
      }
    }
  }

  compare(other: Record<string, number>): "before" | "after" | "concurrent" | "equal" {
    let hasLess = false;
    let hasGreater = false;

    const allKeys = new Set([...this.clock.keys(), ...Object.keys(other)]);

    for (const key of allKeys) {
      const thisVal = this.clock.get(key) || 0;
      const otherVal = other[key] || 0;

      if (thisVal < otherVal) hasLess = true;
      if (thisVal > otherVal) hasGreater = true;
    }

    if (!hasLess && !hasGreater) return "equal";
    if (hasLess && !hasGreater) return "before";
    if (!hasLess && hasGreater) return "after";
    return "concurrent";
  }

  toJSON(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [key, value] of this.clock) {
      obj[key] = value;
    }
    return obj;
  }

  static fromJSON(data: Record<string, number>): VectorClock {
    const vc = new VectorClock();
    for (const [key, value] of Object.entries(data)) {
      vc.clock.set(key, value);
    }
    return vc;
  }
}
