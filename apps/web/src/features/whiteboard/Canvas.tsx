import { useRef, useEffect, useState, useCallback } from "react";
import type { Shape, ShapeType } from "@hypersync/shared";

interface CanvasProps {
  shapes: Shape[];
  onShapeAdd?: (shape: Shape) => void;
  onShapeUpdate?: (id: string, updates: Partial<Shape>) => void;
  onShapeDelete?: (id: string) => void;
}

const TOOLS: { type: ShapeType; icon: string; label: string }[] = [
  { type: "rect", icon: "▭", label: "Rectangle" },
  { type: "circle", icon: "●", label: "Circle" },
  { type: "ellipse", icon: "⬭", label: "Ellipse" },
  { type: "line", icon: "╱", label: "Line" },
  { type: "path", icon: "✎", label: "Pen" },
  { type: "text", icon: "T", label: "Text" },
];

const COLORS = ["#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#ec4899"];

export function Canvas({ shapes, onShapeAdd }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<ShapeType>("rect");
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom);
    ctx.scale(viewport.zoom, viewport.zoom);

    const sorted = [...shapes].sort((a, b) => a.zOrder.localeCompare(b.zOrder));
    for (const shape of sorted) {
      drawShape(ctx, shape);
    }
    ctx.restore();
  }, [shapes, viewport]);

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.globalAlpha = shape.opacity;
    switch (shape.type) {
      case "rect":
        ctx.fillStyle = shape.fill === "transparent" ? "transparent" : shape.fill;
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = shape.strokeWidth;
        if (shape.fill !== "transparent") ctx.fillRect(shape.x, shape.y, shape.width || 0, shape.height || 0);
        ctx.strokeRect(shape.x, shape.y, shape.width || 0, shape.height || 0);
        break;
      case "circle":
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius || 0, 0, Math.PI * 2);
        if (shape.fill !== "transparent") { ctx.fillStyle = shape.fill; ctx.fill(); }
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = shape.strokeWidth;
        ctx.stroke();
        break;
      case "ellipse":
        ctx.beginPath();
        ctx.ellipse(shape.x + (shape.width || 0) / 2, shape.y + (shape.height || 0) / 2, (shape.width || 0) / 2, (shape.height || 0) / 2, 0, 0, Math.PI * 2);
        if (shape.fill !== "transparent") { ctx.fillStyle = shape.fill; ctx.fill(); }
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = shape.strokeWidth;
        ctx.stroke();
        break;
      case "line":
        if (shape.points && shape.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0][0], shape.points[0][1]);
          for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i][0], shape.points[i][1]);
          ctx.strokeStyle = shape.stroke;
          ctx.lineWidth = shape.strokeWidth;
          ctx.stroke();
        }
        break;
      case "path":
        if (shape.points && shape.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0][0], shape.points[0][1]);
          for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i][0], shape.points[i][1]);
          ctx.strokeStyle = shape.stroke;
          ctx.lineWidth = shape.strokeWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();
        }
        break;
    }
    ctx.globalAlpha = 1;
  };

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / viewport.zoom + viewport.x,
      y: (e.clientY - rect.top) / viewport.zoom + viewport.y,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true);
    setStartPos(getCanvasPos(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const pos = getCanvasPos(e);
    const w = pos.x - startPos.x;
    const h = pos.y - startPos.y;
    if (Math.abs(w) > 5 || Math.abs(h) > 5) {
      const shape: Shape = {
        id: crypto.randomUUID(), type: selectedTool,
        x: Math.min(startPos.x, pos.x), y: Math.min(startPos.y, pos.y),
        width: Math.abs(w), height: Math.abs(h),
        fill: "transparent", stroke: selectedColor, strokeWidth: 2,
        opacity: 1, zOrder: "a0", rotation: 0,
        createdBy: "current-user", createdAt: Date.now(), locked: false,
      };
      onShapeAdd?.(shape);
    }
    setIsDrawing(false);
    setStartPos(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport((p) => ({ ...p, zoom: Math.max(0.1, Math.min(10, p.zoom * delta)) }));
  };

  return (
    <div className="whiteboard-wrapper">
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      <div className="wb-toolbar">
        {TOOLS.map((t) => (
          <button
            key={t.type}
            className={`wb-tool-btn ${selectedTool === t.type ? "active" : ""}`}
            onClick={() => setSelectedTool(t.type)}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
        <div className="wb-divider" />
        {COLORS.map((c) => (
          <button
            key={c}
            className={`wb-color-swatch ${selectedColor === c ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => setSelectedColor(c)}
          />
        ))}
      </div>

      <div className="wb-zoom-controls">
        <button className="wb-zoom-btn" onClick={() => setViewport((p) => ({ ...p, zoom: Math.min(10, p.zoom * 1.2) }))}>+</button>
        <div className="wb-zoom-label">{(viewport.zoom * 100).toFixed(0)}%</div>
        <button className="wb-zoom-btn" onClick={() => setViewport((p) => ({ ...p, zoom: Math.max(0.1, p.zoom / 1.2) }))}>−</button>
      </div>
    </div>
  );
}
