import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { useProjectStore } from "../state/projectStore";
import { useViewportStore, niceStep } from "../state/viewportStore";
import { renderSkeleton } from "./renderSkeleton";

interface GridLayer {
  container: Container;
  minor: Graphics;
  major: Graphics;
  axes: Graphics;
}

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

    const cleanups: Array<() => void> = [];
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

      const grid: GridLayer = {
        container: new Container(),
        minor: new Graphics(),
        major: new Graphics(),
        axes: new Graphics(),
      };
      grid.container.label = "grid";
      grid.container.addChild(grid.minor, grid.major, grid.axes);
      world.addChild(grid.container);

      worldRef.current = world;
      appRef.current = app;

      const pushCamera = () => {
        useViewportStore.getState().set({
          x: world.x,
          y: world.y,
          scaleX: world.scale.x,
          scaleY: world.scale.y,
          width: app.screen.width,
          height: app.screen.height,
        });
        drawAdaptiveGrid(grid, world, app.screen.width, app.screen.height);
      };

      const teardownInput = wireViewportInput(app, world, pushCamera);
      pushCamera();

      const ro = new ResizeObserver(() => {
        // Pixi's resizeTo handles canvas; we still need to redraw the grid + push state.
        pushCamera();
      });
      ro.observe(host);
      cleanups.push(() => ro.disconnect(), teardownInput);
    })();

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
      cleanups.length = 0;
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

function drawAdaptiveGrid(grid: GridLayer, world: Container, screenW: number, screenH: number) {
  grid.minor.clear();
  grid.major.clear();
  grid.axes.clear();

  const scale = world.scale.x;
  // Aim for ~50px between minor lines, ~250px between majors.
  const minor = niceStep(50 / scale);
  const major = minor * 5;

  const left = -world.x / scale - minor;
  const right = (screenW - world.x) / scale + minor;
  const top = -world.y / scale - minor;
  const bottom = (screenH - world.y) / scale + minor;

  const pixelWidth = 1 / scale;

  const firstMinorX = Math.floor(left / minor) * minor;
  for (let x = firstMinorX; x <= right; x += minor) {
    grid.minor.moveTo(x, top).lineTo(x, bottom);
  }
  const firstMinorY = Math.floor(top / minor) * minor;
  for (let y = firstMinorY; y <= bottom; y += minor) {
    grid.minor.moveTo(left, y).lineTo(right, y);
  }
  grid.minor.stroke({ width: pixelWidth, color: 0x2a2c35, alpha: 1 });

  const firstMajorX = Math.floor(left / major) * major;
  for (let x = firstMajorX; x <= right; x += major) {
    grid.major.moveTo(x, top).lineTo(x, bottom);
  }
  const firstMajorY = Math.floor(top / major) * major;
  for (let y = firstMajorY; y <= bottom; y += major) {
    grid.major.moveTo(left, y).lineTo(right, y);
  }
  grid.major.stroke({ width: pixelWidth, color: 0x363842, alpha: 1 });

  grid.axes.moveTo(0, top).lineTo(0, bottom);
  grid.axes.moveTo(left, 0).lineTo(right, 0);
  grid.axes.stroke({ width: pixelWidth * 1.5, color: 0x4d5060, alpha: 1 });
}

function wireViewportInput(
  app: Application,
  world: Container,
  onCameraChange: () => void,
): () => void {
  const canvas = app.canvas;
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.altKey || e.metaKey))) {
      panning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    }
  };
  const stop = () => (panning = false);
  const onPointerMove = (e: PointerEvent) => {
    if (!panning) return;
    world.x += e.clientX - lastX;
    world.y += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    onCameraChange();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = canvas.getBoundingClientRect();
    zoomAt(world, e.clientX - rect.left, e.clientY - rect.top, factor);
    onCameraChange();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      world.scale.set(1);
      world.position.set(app.screen.width / 2, app.screen.height / 2);
      onCameraChange();
    } else if (e.key === "=" || e.key === "+") {
      zoomAt(world, app.screen.width / 2, app.screen.height / 2, 1.2);
      onCameraChange();
    } else if (e.key === "-") {
      zoomAt(world, app.screen.width / 2, app.screen.height / 2, 1 / 1.2);
      onCameraChange();
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("keydown", onKey);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    window.removeEventListener("keydown", onKey);
  };
}

function zoomAt(world: Container, screenX: number, screenY: number, factor: number) {
  const lx = (screenX - world.x) / world.scale.x;
  const ly = (screenY - world.y) / world.scale.y;
  const next = Math.max(0.05, Math.min(50, world.scale.x * factor));
  world.scale.set(next);
  world.x = screenX - lx * next;
  world.y = screenY - ly * next;
}
