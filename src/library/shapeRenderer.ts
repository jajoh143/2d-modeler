/**
 * Procedural shape renderer. Rasterizes simple vector primitives to PNG
 * data URLs so stock templates can ship without bundled art. Generated once
 * per shape (at template instantiation) and cached in the project's assets.
 */

export type Shape =
  | { kind: "rect"; width: number; height: number; fill: string; stroke?: string; strokeWidth?: number; radius?: number }
  | { kind: "circle"; radius: number; fill: string; stroke?: string; strokeWidth?: number }
  | { kind: "capsule"; width: number; height: number; fill: string; stroke?: string; strokeWidth?: number }
  | { kind: "trapezoid"; topWidth: number; bottomWidth: number; height: number; fill: string; stroke?: string; strokeWidth?: number }
  | { kind: "polygon"; points: [number, number][]; fill: string; stroke?: string; strokeWidth?: number };

export interface RenderedShape {
  dataUrl: string;
  width: number;
  height: number;
}

export function renderShape(shape: Shape): RenderedShape {
  const bounds = shapeBounds(shape);
  const pad = 4; // breathing room for strokes / anti-aliasing
  const width = Math.ceil(bounds.width + pad * 2);
  const height = Math.ceil(bounds.height + pad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Translate so the shape is centred on the canvas.
  ctx.translate(width / 2, height / 2);
  drawShape(ctx, shape);

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

function shapeBounds(shape: Shape): { width: number; height: number } {
  switch (shape.kind) {
    case "rect":
      return { width: shape.width, height: shape.height };
    case "circle":
      return { width: shape.radius * 2, height: shape.radius * 2 };
    case "capsule":
      return { width: shape.width, height: shape.height };
    case "trapezoid":
      return { width: Math.max(shape.topWidth, shape.bottomWidth), height: shape.height };
    case "polygon": {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of shape.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { width: maxX - minX, height: maxY - minY };
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.fillStyle = shape.fill;
  if ("stroke" in shape && shape.stroke) {
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth ?? 2;
    ctx.lineJoin = "round";
  }

  switch (shape.kind) {
    case "rect": {
      const r = shape.radius ?? 0;
      const w = shape.width;
      const h = shape.height;
      roundedRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.fill();
      if (shape.stroke) ctx.stroke();
      break;
    }
    case "circle": {
      ctx.beginPath();
      ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
      ctx.fill();
      if (shape.stroke) ctx.stroke();
      break;
    }
    case "capsule": {
      const w = shape.width;
      const h = shape.height;
      const r = Math.min(w, h) / 2;
      roundedRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.fill();
      if (shape.stroke) ctx.stroke();
      break;
    }
    case "trapezoid": {
      const tw = shape.topWidth;
      const bw = shape.bottomWidth;
      const h = shape.height;
      ctx.beginPath();
      ctx.moveTo(-tw / 2, -h / 2);
      ctx.lineTo(tw / 2, -h / 2);
      ctx.lineTo(bw / 2, h / 2);
      ctx.lineTo(-bw / 2, h / 2);
      ctx.closePath();
      ctx.fill();
      if (shape.stroke) ctx.stroke();
      break;
    }
    case "polygon": {
      ctx.beginPath();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of shape.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      shape.points.forEach(([x, y], i) => {
        const lx = x - cx;
        const ly = y - cy;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      });
      ctx.closePath();
      ctx.fill();
      if (shape.stroke) ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}
