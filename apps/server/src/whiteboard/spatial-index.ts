import RBush from "rbush";
import { createChildLogger } from "../utils/logger.js";
import type { Shape } from "@hypersync/shared";

const log = createChildLogger("spatial-index");

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  shapeId: string;
}

export class SpatialIndex {
  private tree: RBush<BBox>;

  constructor() {
    this.tree = new RBush<BBox>();
  }

  insert(shape: Shape): void {
    const bbox = this.shapeToBBox(shape);
    this.tree.insert(bbox);
  }

  remove(shapeId: string): void {
    const items = this.tree.all().filter((item) => item.shapeId === shapeId);
    for (const item of items) {
      this.tree.remove(item);
    }
  }

  update(shape: Shape): void {
    this.remove(shape.id);
    this.insert(shape);
  }

  search(viewport: { x: number; y: number; width: number; height: number; zoom: number }): string[] {
    const scaledViewport = {
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.width / viewport.zoom,
      maxY: viewport.y + viewport.height / viewport.zoom,
    };

    const results = this.tree.search(scaledViewport);
    return results.map((item) => item.shapeId);
  }

  getVisibleShapes(
    shapes: Map<string, Shape>,
    viewport: { x: number; y: number; width: number; height: number; zoom: number }
  ): Shape[] {
    const visibleIds = this.search(viewport);
    return visibleIds
      .map((id) => shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);
  }

  clear(): void {
    this.tree.clear();
  }

  getSize(): number {
    return this.tree.all().length;
  }

  private shapeToBBox(shape: Shape): BBox {
    let minX = shape.x;
    let minY = shape.y;
    let maxX = shape.x;
    let maxY = shape.y;

    switch (shape.type) {
      case "rect":
      case "sticky":
      case "image":
        maxX = shape.x + (shape.width || 0);
        maxY = shape.y + (shape.height || 0);
        break;

      case "circle":
        const radius = shape.radius || 0;
        minX = shape.x - radius;
        minY = shape.y - radius;
        maxX = shape.x + radius;
        maxY = shape.y + radius;
        break;

      case "ellipse":
        maxX = shape.x + (shape.width || 0);
        maxY = shape.y + (shape.height || 0);
        break;

      case "line":
      case "polyline":
      case "path":
        if (shape.points && shape.points.length > 0) {
          for (const [px, py] of shape.points) {
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
          }
        }
        break;

      case "text":
        maxX = shape.x + (shape.width || 100);
        maxY = shape.y + (shape.height || 20);
        break;
    }

    return { minX, minY, maxX, maxY, shapeId: shape.id };
  }
}
