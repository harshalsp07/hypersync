import { generateKeyBetween } from "fractional-indexing";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("z-order");

export class ZOrderManager {
  private keys: Map<string, string> = new Map();

  getKey(shapeId: string, aboveId?: string, belowId?: string): string {
    const aboveKey = aboveId ? this.keys.get(aboveId) : undefined;
    const belowKey = belowId ? this.keys.get(belowId) : undefined;

    let newKey: string;

    if (aboveKey && belowKey) {
      newKey = generateKeyBetween(aboveKey, belowKey);
    } else if (aboveKey) {
      newKey = generateKeyBetween(aboveKey, undefined);
    } else if (belowKey) {
      newKey = generateKeyBetween(undefined, belowKey);
    } else {
      newKey = generateKeyBetween(undefined, undefined);
    }

    this.keys.set(shapeId, newKey);
    log.debug({ shapeId, key: newKey }, "Generated z-order key");
    return newKey;
  }

  getKeyForShape(shapeId: string): string | undefined {
    return this.keys.get(shapeId);
  }

  removeKey(shapeId: string): void {
    this.keys.delete(shapeId);
  }

  sortShapes(shapeIds: string[]): string[] {
    return shapeIds.sort((a, b) => {
      const keyA = this.keys.get(a) || "";
      const keyB = this.keys.get(b) || "";
      return keyA.localeCompare(keyB);
    });
  }

  moveAbove(shapeId: string, targetId: string): string {
    const targetKey = this.keys.get(targetId);
    if (!targetKey) {
      return this.getKey(shapeId);
    }

    const newKey = generateKeyBetween(targetKey, undefined);
    this.keys.set(shapeId, newKey);
    return newKey;
  }

  moveBelow(shapeId: string, targetId: string): string {
    const targetKey = this.keys.get(targetId);
    if (!targetKey) {
      return this.getKey(shapeId);
    }

    const newKey = generateKeyBetween(undefined, targetKey);
    this.keys.set(shapeId, newKey);
    return newKey;
  }

  moveBetween(shapeId: string, aboveId: string, belowId: string): string {
    const aboveKey = this.keys.get(aboveId);
    const belowKey = this.keys.get(belowId);

    if (!aboveKey || !belowKey) {
      return this.getKey(shapeId);
    }

    const newKey = generateKeyBetween(aboveKey, belowKey);
    this.keys.set(shapeId, newKey);
    return newKey;
  }
}
