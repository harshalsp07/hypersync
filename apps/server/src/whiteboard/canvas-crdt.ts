import * as Y from "yjs";
import { createChildLogger } from "../utils/logger.js";
import type { Shape, ShapeType } from "@hypersync/shared";

const log = createChildLogger("canvas-crdt");

export class CanvasCRDT {
  private shapes: Y.Map<Y.Map<unknown>>;

  constructor(doc: Y.Doc) {
    this.shapes = doc.getMap("whiteboard");
  }

  addShape(shape: Shape): void {
    const shapeMap = new Y.Map<unknown>();
    shapeMap.set("id", shape.id);
    shapeMap.set("type", shape.type);
    shapeMap.set("x", shape.x);
    shapeMap.set("y", shape.y);
    if (shape.width !== undefined) shapeMap.set("width", shape.width);
    if (shape.height !== undefined) shapeMap.set("height", shape.height);
    if (shape.radius !== undefined) shapeMap.set("radius", shape.radius);
    if (shape.points) shapeMap.set("points", shape.points);
    shapeMap.set("fill", shape.fill);
    shapeMap.set("stroke", shape.stroke);
    shapeMap.set("strokeWidth", shape.strokeWidth);
    shapeMap.set("opacity", shape.opacity);
    shapeMap.set("zOrder", shape.zOrder);
    shapeMap.set("rotation", shape.rotation);
    shapeMap.set("createdBy", shape.createdBy);
    shapeMap.set("createdAt", shape.createdAt);
    shapeMap.set("locked", shape.locked);

    this.shapes.set(shape.id, shapeMap);
    log.debug({ shapeId: shape.id, type: shape.type }, "Shape added");
  }

  updateShape(id: string, updates: Partial<Shape>): void {
    const shapeMap = this.shapes.get(id);
    if (!shapeMap) {
      log.warn({ shapeId: id }, "Shape not found");
      return;
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        shapeMap.set(key, value);
      }
    }

    log.debug({ shapeId: id, updates: Object.keys(updates) }, "Shape updated");
  }

  deleteShape(id: string): void {
    this.shapes.delete(id);
    log.debug({ shapeId: id }, "Shape deleted");
  }

  getShape(id: string): Shape | undefined {
    const shapeMap = this.shapes.get(id);
    if (!shapeMap) return undefined;

    return this.mapToShape(shapeMap);
  }

  getAllShapes(): Shape[] {
    const result: Shape[] = [];
    this.shapes.forEach((shapeMap, id) => {
      result.push(this.mapToShape(shapeMap));
    });
    return result;
  }

  getShapeCount(): number {
    return this.shapes.size;
  }

  private mapToShape(shapeMap: Y.Map<unknown>): Shape {
    return {
      id: shapeMap.get("id") as string,
      type: shapeMap.get("type") as ShapeType,
      x: shapeMap.get("x") as number,
      y: shapeMap.get("y") as number,
      width: shapeMap.get("width") as number | undefined,
      height: shapeMap.get("height") as number | undefined,
      radius: shapeMap.get("radius") as number | undefined,
      points: shapeMap.get("points") as [number, number][] | undefined,
      fill: shapeMap.get("fill") as string,
      stroke: shapeMap.get("stroke") as string,
      strokeWidth: shapeMap.get("strokeWidth") as number,
      opacity: shapeMap.get("opacity") as number,
      zOrder: shapeMap.get("zOrder") as string,
      rotation: shapeMap.get("rotation") as number,
      createdBy: shapeMap.get("createdBy") as string,
      createdAt: shapeMap.get("createdAt") as number,
      locked: shapeMap.get("locked") as boolean,
    };
  }

  observe(callback: (event: Y.YMapEvent<Y.Map<unknown>>) => void) {
    this.shapes.observe(callback);
  }

  unobserve(callback: (event: Y.YMapEvent<Y.Map<unknown>>) => void) {
    this.shapes.unobserve(callback);
  }
}
