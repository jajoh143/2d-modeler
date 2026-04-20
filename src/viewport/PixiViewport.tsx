import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { useProjectStore } from "../state/projectStore";
import { useViewportStore, niceStep } from "../state/viewportStore";
import { resolveBoneWorld, worldToLocal } from "../model/skeletonMath";
import { ASSET_DRAG_MIME } from "../panels/AssetBrowser";
import {
  createSceneLayer,
  drawScene,
  drawBoneCreatePreview,
  clearPreview,
  hitTestBones,
  hitTestGizmo,
  type BoneScreen,
  type SceneLayer,
} from "./scene";

interface GridLayer {
  container: Container;
  minor: Graphics;
  major: Graphics;
  axes: Graphics;
}

type DragKind = "translate" | "rotate" | "create" | "pan";

interface ActiveDrag {
  kind: DragKind;
  /** Screen position where drag started (for movement threshold). */
  screenStart: { x: number; y: number };
  /** World position where drag started. */
  worldStart: { x: number; y: number };
  /** Whether the drag has crossed the movement threshold. */
  active: boolean;
  /** Bone being transformed (for translate/rotate). */
  boneId?: string;
  /** Parent of the bone (for translate / create / rotate). */
  parentId?: string | null;
}

const CLICK_THRESHOLD_PX = 3;

export function PixiViewport() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const sceneRef = useRef<SceneLayer | null>(null);
  const bonesRef = useRef<BoneScreen[]>([]);
  const dragRef = useRef<ActiveDrag | null>(null);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

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

      const scene = createSceneLayer();
      world.addChild(scene.container);

      worldRef.current = world;
      sceneRef.current = scene;
      appRef.current = app;

      const redrawScene = () => {
        const state = useProjectStore.getState();
        const skeleton = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
        const skin = skeleton?.skins.find((s) => s.id === state.activeSkinId) ?? skeleton?.skins[0];
        const showGizmos = state.activeTool === "select" || state.activeTool === "bone";
        bonesRef.current = drawScene(
          scene,
          skeleton,
          state.project.assets,
          skin,
          state.activeBoneId,
          world.scale.x,
          showGizmos,
          redrawScene,
        );
      };

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
        redrawScene();
      };

      const teardownInput = wireInput(app, world, pushCamera, redrawScene, dragRef, lastPanRef, bonesRef, sceneRef);
      const teardownDrop = wireDropTarget(host, app, world);
      pushCamera();

      const ro = new ResizeObserver(() => pushCamera());
      ro.observe(host);

      const unsub = useProjectStore.subscribe(redrawScene);

      cleanups.push(() => ro.disconnect(), teardownInput, teardownDrop, unsub);
    })();

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
      cleanups.length = 0;
      appRef.current?.destroy(true);
      appRef.current = null;
      worldRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}

// ──────────────────────────────────────────────────────────────────
// Grid
// ──────────────────────────────────────────────────────────────────

function drawAdaptiveGrid(grid: GridLayer, world: Container, screenW: number, screenH: number) {
  grid.minor.clear();
  grid.major.clear();
  grid.axes.clear();

  const scale = world.scale.x;
  const minor = niceStep(50 / scale);
  const major = minor * 5;

  const left = -world.x / scale - minor;
  const right = (screenW - world.x) / scale + minor;
  const top = -world.y / scale - minor;
  const bottom = (screenH - world.y) / scale + minor;

  const px = 1 / scale;

  for (let x = Math.floor(left / minor) * minor; x <= right; x += minor) {
    grid.minor.moveTo(x, top).lineTo(x, bottom);
  }
  for (let y = Math.floor(top / minor) * minor; y <= bottom; y += minor) {
    grid.minor.moveTo(left, y).lineTo(right, y);
  }
  grid.minor.stroke({ width: px, color: 0x2a2c35, alpha: 1 });

  for (let x = Math.floor(left / major) * major; x <= right; x += major) {
    grid.major.moveTo(x, top).lineTo(x, bottom);
  }
  for (let y = Math.floor(top / major) * major; y <= bottom; y += major) {
    grid.major.moveTo(left, y).lineTo(right, y);
  }
  grid.major.stroke({ width: px, color: 0x363842, alpha: 1 });

  grid.axes.moveTo(0, top).lineTo(0, bottom);
  grid.axes.moveTo(left, 0).lineTo(right, 0);
  grid.axes.stroke({ width: px * 1.5, color: 0x4d5060, alpha: 1 });
}

// ──────────────────────────────────────────────────────────────────
// Input wiring
// ──────────────────────────────────────────────────────────────────

function wireInput(
  app: Application,
  world: Container,
  onCameraChange: () => void,
  redrawScene: () => void,
  dragRef: React.MutableRefObject<ActiveDrag | null>,
  panRef: React.MutableRefObject<{ x: number; y: number } | null>,
  bonesRef: React.MutableRefObject<BoneScreen[]>,
  sceneRef: React.MutableRefObject<SceneLayer | null>,
): () => void {
  const canvas = app.canvas;

  const screenToWorld = (sx: number, sy: number) => {
    const rect = canvas.getBoundingClientRect();
    const cx = sx - rect.left;
    const cy = sy - rect.top;
    return { x: (cx - world.x) / world.scale.x, y: (cy - world.y) / world.scale.y };
  };

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId);

    // Pan (middle mouse, alt/cmd-left).
    if (e.button === 1 || (e.button === 0 && (e.altKey || e.metaKey))) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    const wp = screenToWorld(e.clientX, e.clientY);
    const state = useProjectStore.getState();
    const tool = state.activeTool;

    if (tool === "bone") {
      // Bone tool: drag to create. Parent = currently selected bone.
      const parentId = state.activeBoneId;
      if (!parentId) return;
      dragRef.current = {
        kind: "create",
        screenStart: { x: e.clientX, y: e.clientY },
        worldStart: wp,
        active: false,
        parentId,
      };
      return;
    }

    if (tool === "select") {
      const selected = state.activeBoneId
        ? bonesRef.current.find((b) => b.bone.id === state.activeBoneId)
        : undefined;

      // 1) Hit a gizmo handle on the currently selected bone?
      const gizmo = hitTestGizmo(selected, wp.x, wp.y, world.scale.x);
      if (gizmo && selected) {
        dragRef.current = {
          kind: gizmo.kind === "tip" ? "rotate" : "translate",
          screenStart: { x: e.clientX, y: e.clientY },
          worldStart: wp,
          active: false,
          boneId: selected.bone.id,
          parentId: selected.bone.parent,
        };
        return;
      }

      // 2) Hit any bone shaft?
      const hit = hitTestBones(bonesRef.current, wp.x, wp.y, world.scale.x);
      if (hit) {
        if (hit.bone.id !== state.activeBoneId) {
          state.setActiveBone(hit.bone.id);
        }
        if (hit.bone.parent) {
          dragRef.current = {
            kind: "translate",
            screenStart: { x: e.clientX, y: e.clientY },
            worldStart: wp,
            active: false,
            boneId: hit.bone.id,
            parentId: hit.bone.parent,
          };
        }
        return;
      }

      // 3) Empty space — deselect.
      state.setActiveBone(null);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    // Pan
    if (panRef.current) {
      world.x += e.clientX - panRef.current.x;
      world.y += e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      onCameraChange();
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const dxScreen = e.clientX - drag.screenStart.x;
    const dyScreen = e.clientY - drag.screenStart.y;
    if (!drag.active && Math.hypot(dxScreen, dyScreen) < CLICK_THRESHOLD_PX) return;
    drag.active = true;

    const wp = screenToWorld(e.clientX, e.clientY);

    if (drag.kind === "create") {
      const scene = sceneRef.current;
      if (!scene) return;
      drawBoneCreatePreview(scene, drag.worldStart, wp, world.scale.x);
      return;
    }

    if (!drag.boneId) return;
    const store = useProjectStore.getState();
    const skel = store.project.skeletons.find((s) => s.id === store.activeSkeletonId);
    const bone = skel?.bones.find((b) => b.id === drag.boneId);
    if (!skel || !bone) return;

    const worlds = resolveBoneWorld(skel);
    const parentWorld = bone.parent ? worlds.get(bone.parent) ?? null : null;

    // Lazily begin the drag transaction the first frame movement crosses.
    if (!store._dragSnapshot) {
      store.beginBoneDrag(drag.boneId, drag.kind === "rotate" ? "rotate bone" : "move bone");
    }

    if (drag.kind === "translate") {
      const local = worldToLocal(parentWorld, wp.x, wp.y);
      store.previewBoneDrag({ x: local.x, y: local.y });
    } else if (drag.kind === "rotate") {
      const originWorld = worlds.get(bone.id);
      if (!originWorld) return;
      const ang = Math.atan2(wp.y - originWorld.y, wp.x - originWorld.x);
      const parentRot = parentWorld?.rotation ?? 0;
      const parentScale = parentWorld?.scaleX ?? 1;
      const len = Math.hypot(wp.x - originWorld.x, wp.y - originWorld.y) / Math.max(0.0001, parentScale);
      store.previewBoneDrag({ rotation: ang - parentRot, length: len });
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    canvas.releasePointerCapture?.(e.pointerId);
    panRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    const store = useProjectStore.getState();

    if (drag.kind === "create") {
      const scene = sceneRef.current;
      if (scene) clearPreview(scene);
      if (!drag.active) return;
      const wp = screenToWorld(e.clientX, e.clientY);
      const skel = store.project.skeletons.find((s) => s.id === store.activeSkeletonId);
      const parent = skel?.bones.find((b) => b.id === drag.parentId);
      if (!skel || !parent) return;
      const worlds = resolveBoneWorld(skel);
      const parentWorld = worlds.get(parent.id) ?? null;
      const local = worldToLocal(parentWorld, drag.worldStart.x, drag.worldStart.y);
      const dx = wp.x - drag.worldStart.x;
      const dy = wp.y - drag.worldStart.y;
      const parentScale = parentWorld?.scaleX ?? 1;
      const length = Math.hypot(dx, dy) / Math.max(0.0001, parentScale);
      const rotation = Math.atan2(dy, dx) - (parentWorld?.rotation ?? 0);
      store.addBone(parent.id, local.x, local.y, length, rotation);
      return;
    }

    if (drag.kind === "translate" || drag.kind === "rotate") {
      if (drag.active) {
        store.commitBoneDrag();
      } else {
        store.cancelBoneDrag();
      }
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = canvas.getBoundingClientRect();
    zoomAt(world, e.clientX - rect.left, e.clientY - rect.top, factor);
    onCameraChange();
  };

  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isInput = !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"));
    const store = useProjectStore.getState();

    // Modifier shortcuts work everywhere.
    if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      world.scale.set(1);
      world.position.set(app.screen.width / 2, app.screen.height / 2);
      onCameraChange();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (dragRef.current) {
        store.cancelBoneDrag();
        dragRef.current = null;
        const scene = sceneRef.current;
        if (scene) clearPreview(scene);
      }
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Z")) {
      e.preventDefault();
      if (dragRef.current) {
        store.cancelBoneDrag();
        dragRef.current = null;
        const scene = sceneRef.current;
        if (scene) clearPreview(scene);
      }
      store.redo();
      return;
    }

    // Single-key shortcuts: only when not in a text input.
    if (isInput) return;

    if (e.key === "=" || e.key === "+") {
      zoomAt(world, app.screen.width / 2, app.screen.height / 2, 1.2);
      onCameraChange();
    } else if (e.key === "-") {
      zoomAt(world, app.screen.width / 2, app.screen.height / 2, 1 / 1.2);
      onCameraChange();
    } else if (e.key === "v" || e.key === "V") store.setActiveTool("select");
    else if (e.key === "b" || e.key === "B") store.setActiveTool("bone");
    else if (e.key === "m" || e.key === "M") store.setActiveTool("mesh");
    else if (e.key === "w" || e.key === "W") store.setActiveTool("weights");
    else if (e.key === "Delete" || e.key === "Backspace") {
      if (store.activeBoneId) {
        e.preventDefault();
        store.removeBone(store.activeBoneId);
      }
    } else if (e.key === "Escape") {
      if (dragRef.current) {
        store.cancelBoneDrag();
        const scene = sceneRef.current;
        if (scene) clearPreview(scene);
        dragRef.current = null;
        redrawScene();
      } else {
        store.setActiveBone(null);
      }
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
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

function wireDropTarget(host: HTMLDivElement, app: Application, world: Container): () => void {
  const canvas = app.canvas;

  const onDragOver = (e: DragEvent) => {
    // Accept drops if carrying an asset id (asset browser) or a file.
    const types = e.dataTransfer?.types ?? [];
    if ((types as ReadonlyArray<string>).includes(ASSET_DRAG_MIME)) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    }
  };

  const onDrop = (e: DragEvent) => {
    const assetId = e.dataTransfer?.getData(ASSET_DRAG_MIME);
    if (!assetId) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = (cx - world.x) / world.scale.x;
    const wy = (cy - world.y) / world.scale.y;

    const store = useProjectStore.getState();
    const boneId = store.activeBoneId;
    if (!boneId) {
      // eslint-disable-next-line no-console
      console.warn("Drop ignored: no active bone to attach to.");
      return;
    }
    store.addSlotWithAttachment(boneId, assetId, wx, wy);
  };

  host.addEventListener("dragover", onDragOver);
  host.addEventListener("drop", onDrop);
  return () => {
    host.removeEventListener("dragover", onDragOver);
    host.removeEventListener("drop", onDrop);
  };
}
