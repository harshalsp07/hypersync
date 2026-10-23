import { useRef, useEffect, useState, useCallback } from "react";
import type { Shape, ShapeType } from "@hypersync/shared";
import * as Y from "yjs";

interface CanvasProps {
  doc?: Y.Doc;
  username?: string;
  shapes?: Shape[];
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
  { type: "sticky", icon: "🗈", label: "Sticky Note" },
];

const COLORS = ["#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#ec4899"];

// Image cache for fast rendering on canvas
const imageCache = new Map<string, HTMLImageElement>();

export function Canvas({ doc, username = "you", shapes: externalShapes, onShapeAdd }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalShapes, setInternalShapes] = useState<Shape[]>([]);
  const [selectedTool, setSelectedTool] = useState<ShapeType>("rect");
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<[number, number][]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Synchronize with Y.Doc whiteboard CRDT Map
  useEffect(() => {
    if (!doc) {
      if (externalShapes) setInternalShapes(externalShapes);
      return;
    }

    const yShapes = doc.getMap<Y.Map<any>>("whiteboard");

    const syncFromY = () => {
      const list: Shape[] = [];
      yShapes.forEach((shapeMap) => {
        list.push(shapeMap.toJSON() as Shape);
      });
      setInternalShapes(list);
    };

    yShapes.observeDeep(syncFromY);
    syncFromY();

    return () => {
      yShapes.unobserveDeep(syncFromY);
    };
  }, [doc, externalShapes]);

  const shapes = doc ? internalShapes : (externalShapes || internalShapes);

  const addShapeToStore = useCallback(
    (shape: Shape) => {
      if (doc) {
        doc.transact(() => {
          const yShapes = doc.getMap<Y.Map<any>>("whiteboard");
          const map = new Y.Map<any>();
          Object.entries(shape).forEach(([k, v]) => {
            if (v !== undefined) map.set(k, v);
          });
          yShapes.set(shape.id, map);
        });
      } else {
        setInternalShapes((prev) => [...prev, shape]);
        onShapeAdd?.(shape);
      }
    },
    [doc, onShapeAdd]
  );

  // Redraw canvas on shapes or viewport change
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

    // Draw background grid dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    const gridSize = 30;
    const startX = Math.floor(viewport.x / gridSize) * gridSize;
    const startY = Math.floor(viewport.y / gridSize) * gridSize;
    for (let x = startX; x < startX + canvas.width / viewport.zoom + gridSize; x += gridSize) {
      for (let y = startY; y < startY + canvas.height / viewport.zoom + gridSize; y += gridSize) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    const sorted = [...shapes].sort((a, b) => (a.zOrder || "").localeCompare(b.zOrder || ""));
    for (const shape of sorted) {
      drawShape(ctx, shape);
    }

    // Render active freehand path preview
    if (isDrawing && selectedTool === "path" && currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentPath[0][0], currentPath[0][1]);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i][0], currentPath[i][1]);
      }
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    ctx.restore();
  }, [shapes, viewport, isDrawing, currentPath, selectedTool, selectedColor]);

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.globalAlpha = shape.opacity || 1;
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
        if (shape.fill !== "transparent") {
          ctx.fillStyle = shape.fill;
          ctx.fill();
        }
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = shape.strokeWidth;
        ctx.stroke();
        break;

      case "ellipse":
        ctx.beginPath();
        ctx.ellipse(
          shape.x + (shape.width || 0) / 2,
          shape.y + (shape.height || 0) / 2,
          (shape.width || 0) / 2,
          (shape.height || 0) / 2,
          0,
          0,
          Math.PI * 2
        );
        if (shape.fill !== "transparent") {
          ctx.fillStyle = shape.fill;
          ctx.fill();
        }
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

      case "text":
        ctx.font = "16px sans-serif";
        ctx.fillStyle = shape.stroke;
        ctx.fillText((shape as any).text || "Text Note", shape.x, shape.y);
        break;

      case "sticky":
        ctx.fillStyle = shape.fill || "#fef08a";
        ctx.fillRect(shape.x, shape.y, shape.width || 120, shape.height || 80);
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 1;
        ctx.strokeRect(shape.x, shape.y, shape.width || 120, shape.height || 80);
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#1e293b";
        ctx.fillText((shape as any).text || "Sticky Note", shape.x + 8, shape.y + 24);
        break;

      case "image":
        const src = (shape as any).src;
        if (src) {
          let img = imageCache.get(src);
          if (!img) {
            img = new Image();
            img.src = src;
            img.onload = () => {
              imageCache.set(src, img!);
              const canvas = canvasRef.current;
              if (canvas) {
                const c = canvas.getContext("2d");
                if (c) drawShape(c, shape);
              }
            };
          } else if (img.complete) {
            ctx.drawImage(img, shape.x, shape.y, shape.width || 200, shape.height || 150);
          }
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
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    setStartPos(pos);
    if (selectedTool === "path") {
      setCurrentPath([[pos.x, pos.y]]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    if (selectedTool === "path") {
      const pos = getCanvasPos(e);
      setCurrentPath((prev) => [...prev, [pos.x, pos.y]]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const pos = getCanvasPos(e);
    const w = pos.x - startPos.x;
    const h = pos.y - startPos.y;

    if (selectedTool === "path") {
      if (currentPath.length >= 2) {
        const shape: Shape = {
          id: crypto.randomUUID(),
          type: "path",
          x: startPos.x,
          y: startPos.y,
          points: currentPath,
          fill: "transparent",
          stroke: selectedColor,
          strokeWidth: 2,
          opacity: 1,
          zOrder: `a${Date.now()}`,
          rotation: 0,
          createdBy: username,
          createdAt: Date.now(),
          locked: false,
        };
        addShapeToStore(shape);
      }
    } else if (selectedTool === "text" || selectedTool === "sticky") {
      const text = prompt("Enter text:") || "Sample Text";
      const shape: any = {
        id: crypto.randomUUID(),
        type: selectedTool,
        x: pos.x,
        y: pos.y,
        width: selectedTool === "sticky" ? 140 : 100,
        height: selectedTool === "sticky" ? 90 : 30,
        text,
        fill: selectedTool === "sticky" ? "#fef08a" : "transparent",
        stroke: selectedColor,
        strokeWidth: 1,
        opacity: 1,
        zOrder: `a${Date.now()}`,
        rotation: 0,
        createdBy: username,
        createdAt: Date.now(),
        locked: false,
      };
      addShapeToStore(shape);
    } else if (Math.abs(w) > 5 || Math.abs(h) > 5) {
      const shape: Shape = {
        id: crypto.randomUUID(),
        type: selectedTool,
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(w),
        height: Math.abs(h),
        radius: Math.hypot(w, h) / 2,
        fill: "transparent",
        stroke: selectedColor,
        strokeWidth: 2,
        opacity: 1,
        zOrder: `a${Date.now()}`,
        rotation: 0,
        createdBy: username,
        createdAt: Date.now(),
        locked: false,
      };
      addShapeToStore(shape);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPath([]);
  };

  // Image Upload handler (File input or Drag-and-drop)
  const processImageFile = (file: File, x = 100, y = 100) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const shape: any = {
        id: crypto.randomUUID(),
        type: "image",
        x,
        y,
        width: 240,
        height: 180,
        src,
        fill: "transparent",
        stroke: "transparent",
        strokeWidth: 0,
        opacity: 1,
        zOrder: `a${Date.now()}`,
        rotation: 0,
        createdBy: username,
        createdAt: Date.now(),
        locked: false,
      };
      addShapeToStore(shape);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file, viewport.x + 100, viewport.y + 100);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const pos = getCanvasPos(e);
      processImageFile(file, pos.x, pos.y);
    }
  };

  // Clipboard Paste (Ctrl+V image drop)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = e.clipboardData?.items[0];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) processImageFile(file, viewport.x + 150, viewport.y + 150);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [viewport]);

  // Export board as PNG
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleClear = () => {
    if (confirm("Clear all shapes from the whiteboard?")) {
      if (doc) {
        doc.transact(() => {
          doc.getMap("whiteboard").clear();
        });
      } else {
        setInternalShapes([]);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport((p) => ({ ...p, zoom: Math.max(0.1, Math.min(10, p.zoom * delta)) }));
  };

  return (
    <div
      className="whiteboard-wrapper"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: selectedTool === "path" ? "crosshair" : "default" }}
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
        <div className="wb-divider" />
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button
          className="wb-tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload or Drop Image onto Board"
        >
          🖼️
        </button>
        <button className="wb-tool-btn" onClick={handleExportPNG} title="Export as PNG">
          💾
        </button>
        <button className="wb-tool-btn" onClick={handleClear} title="Clear Board">
          🗑️
        </button>
      </div>

      <div className="wb-zoom-controls">
        <button
          className="wb-zoom-btn"
          onClick={() => setViewport((p) => ({ ...p, zoom: Math.min(10, p.zoom * 1.2) }))}
        >
          +
        </button>
        <div className="wb-zoom-label">{(viewport.zoom * 100).toFixed(0)}%</div>
        <button
          className="wb-zoom-btn"
          onClick={() => setViewport((p) => ({ ...p, zoom: Math.max(0.1, p.zoom / 1.2) }))}
        >
          −
        </button>
      </div>
    </div>
  );
}
