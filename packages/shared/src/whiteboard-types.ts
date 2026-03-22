export type ShapeType = "rect" | "circle" | "ellipse" | "line" | "polyline" | "path" | "text" | "sticky" | "image";

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: [number, number][];
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  zOrder: string;
  rotation: number;
  createdBy: string;
  createdAt: number;
  locked: boolean;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}
