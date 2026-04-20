import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { useProjectStore } from "../state/projectStore";
import { renderSkeleton } from "./renderSkeleton";

export function PixiViewport() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);

  const project = useProjectStore((s) => s.project);
  const activeSkeletonId = useProjectStore((s) => s.activeSkeletonId);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    (async () => {
      await app.init({
        resizeTo: host,
        background: 0x1a1a1e,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);

      const world = new Container();
      world.label = "world";
      world.position.set(app.screen.width / 2, app.screen.height / 2);
      app.stage.addChild(world);

      const grid = drawGrid();
      world.addChild(grid);

      worldRef.current = world;
      appRef.current = app;

      wireViewportInput(app, world);
    })();

    return () => {
      cancelled = true;
      appRef.current?.destroy(true);
      appRef.current = null;
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const skeleton = project.skeletons.find((s) => s.id === activeSkeletonId);
    renderSkeleton(world, skeleton);
  }, [project, activeSkeletonId]);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}

function drawGrid(): Graphics {
  const g = new Graphics();
  const size = 2000;
  const step = 50;
  g.setStrokeStyle({ width: 1, color: 0x2a2c35, alpha: 1 });
  for (let x = -size; x <= size; x += step) {
    g.moveTo(x, -size).lineTo(x, size);
  }
  for (let y = -size; y <= size; y += step) {
    g.moveTo(-size, y).lineTo(size, y);
  }
  g.stroke();
  g.setStrokeStyle({ width: 1.5, color: 0x3a3c46, alpha: 1 });
  g.moveTo(-size, 0).lineTo(size, 0);
  g.moveTo(0, -size).lineTo(0, size);
  g.stroke();
  return g;
}

function wireViewportInput(app: Application, world: Container) {
  const canvas = app.canvas;
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  window.addEventListener("pointerup", () => (panning = false));
  canvas.addEventListener("pointermove", (e) => {
    if (!panning) return;
    world.x += e.clientX - lastX;
    world.y += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const lx = (cx - world.x) / world.scale.x;
    const ly = (cy - world.y) / world.scale.y;
    world.scale.x *= factor;
    world.scale.y *= factor;
    world.x = cx - lx * world.scale.x;
    world.y = cy - ly * world.scale.y;
  });
}
