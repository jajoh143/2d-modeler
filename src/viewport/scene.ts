/**
 * Bone + attachment + gizmo rendering and hit-testing for the viewport.
 *
 * Drawing lives inside the world container (panned/zoomed with the camera),
 * but stroke widths and gizmo radii are divided by camera scale so they stay
 * constant in screen pixels. Attachment sprites render in world space so
 * their PNG pixels scale naturally with zoom.
 */

import {
  Assets,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Sprite,
  type Texture,
} from "pixi.js";
import type {
  Animation,
  Asset,
  Bone,
  MeshAttachment,
  RegionAttachment,
  Skeleton,
  Skin,
} from "../model/types";
import { type WorldTransform } from "../model/skeletonMath";
import { resolvePose } from "../model/pose";
import { skinMesh } from "../model/mesh";
import type { ToolId } from "../state/projectStore";

export interface BoneScreen {
  bone: Bone;
  origin: { x: number; y: number };
  tip: { x: number; y: number };
}

export interface MeshEditFrame {
  slotId: string;
  /** Skinned world-space vertex positions (2 floats per vertex). */
  skinned: Float32Array;
}

export interface SceneFrame {
  bones: BoneScreen[];
  /** Set when a mesh-based attachment is on the active slot — used by the
   *  mesh/weights tools for vertex hit tests. */
  activeMesh?: MeshEditFrame;
}

export interface SceneLayer {
  container: Container;
  attachments: Container;
  bones: Graphics;
  selection: Graphics;
  gizmos: Graphics;
  meshOverlay: Graphics;
  preview: Graphics;
}

export function createSceneLayer(): SceneLayer {
  const container = new Container();
  container.label = "scene";
  const attachments = new Container();
  attachments.label = "attachments";
  const bones = new Graphics();
  const selection = new Graphics();
  const gizmos = new Graphics();
  const meshOverlay = new Graphics();
  const preview = new Graphics();
  container.addChild(attachments, bones, selection, gizmos, meshOverlay, preview);
  return { container, attachments, bones, selection, gizmos, meshOverlay, preview };
}

const COLOR_BONE = 0x5aa9ff;
const COLOR_BONE_DIM = 0x4a6588;
const COLOR_SELECTED = 0xffd166;
const COLOR_HANDLE = 0xffffff;
const COLOR_HANDLE_DRAG = 0xffd166;
const COLOR_PREVIEW = 0x9a9aa6;
const COLOR_MESH_EDGE = 0x7ccefa;
const COLOR_MESH_VERTEX = 0xffffff;

const HANDLE_PIXELS = 5;
const BONE_PIXELS = 2;
const HIT_PIXELS = 6;
const VERTEX_PIXELS = 4;
const VERTEX_HIT_PIXELS = 7;

export function drawScene(
  layer: SceneLayer,
  skeleton: Skeleton | undefined,
  assets: Asset[],
  activeSkin: Skin | undefined,
  activeBoneId: string | null,
  activeSlotId: string | null,
  activeTool: ToolId,
  worldScale: number,
  animation: Animation | undefined,
  time: number,
  onTextureReady: () => void,
): SceneFrame {
  layer.bones.clear();
  layer.selection.clear();
  layer.gizmos.clear();
  layer.meshOverlay.clear();
  layer.preview.clear();

  if (!skeleton) {
    disposeAttachments(layer);
    return { bones: [] };
  }

  const px = 1 / worldScale;
  const pose = resolvePose(skeleton, { animation, time });
  const world = pose.worlds;
  const slotOverrides = pose.slotAttachments;

  let activeMesh: MeshEditFrame | undefined;
  if (activeSkin) {
    activeMesh = drawAttachments(
      layer,
      skeleton,
      assets,
      activeSkin,
      world,
      activeSlotId,
      slotOverrides,
      onTextureReady,
    );
  } else {
    disposeAttachments(layer);
  }

  const bones: BoneScreen[] = [];
  for (const bone of skeleton.bones) {
    const wt = world.get(bone.id);
    if (!wt) continue;
    const tip = boneTip(bone, wt);
    bones.push({ bone, origin: { x: wt.x, y: wt.y }, tip });

    const isActive = bone.id === activeBoneId;
    const target = isActive ? layer.selection : layer.bones;
    const color = isActive ? COLOR_SELECTED : COLOR_BONE;

    if (bone.length > 0) {
      target.moveTo(wt.x, wt.y).lineTo(tip.x, tip.y);
      target.stroke({ width: BONE_PIXELS * px * (isActive ? 1.6 : 1), color, alpha: 1 });
    }
    target
      .circle(wt.x, wt.y, (isActive ? 4 : 3) * px)
      .fill({ color: isActive ? COLOR_SELECTED : COLOR_BONE_DIM });
  }

  const showBoneGizmos = activeTool === "select" || activeTool === "bone";
  if (showBoneGizmos && activeBoneId) {
    const sel = bones.find((b) => b.bone.id === activeBoneId);
    if (sel) drawGizmos(layer.gizmos, sel, px);
  }

  if ((activeTool === "mesh" || activeTool === "weights") && activeMesh && activeSkin) {
    const meshAttachment = findActiveMesh(skeleton, activeSkin, activeSlotId);
    if (meshAttachment) {
      drawMeshOverlay(
        layer.meshOverlay,
        meshAttachment,
        activeMesh.skinned,
        worldScale,
        activeTool,
        activeBoneId,
      );
    }
  }

  return { bones, activeMesh };
}

function drawGizmos(g: Graphics, sel: BoneScreen, px: number) {
  g.circle(sel.origin.x, sel.origin.y, HANDLE_PIXELS * px).fill({ color: COLOR_HANDLE });
  g.circle(sel.origin.x, sel.origin.y, HANDLE_PIXELS * px).stroke({
    width: 1.2 * px,
    color: 0x222330,
  });
  if (sel.bone.length > 0) {
    g.circle(sel.tip.x, sel.tip.y, HANDLE_PIXELS * px).fill({ color: COLOR_HANDLE });
    g.circle(sel.tip.x, sel.tip.y, HANDLE_PIXELS * px).stroke({
      width: 1.2 * px,
      color: 0x222330,
    });
  }
}

export function drawBoneCreatePreview(
  layer: SceneLayer,
  startWorld: { x: number; y: number },
  endWorld: { x: number; y: number },
  worldScale: number,
) {
  layer.preview.clear();
  const px = 1 / worldScale;
  layer.preview.moveTo(startWorld.x, startWorld.y).lineTo(endWorld.x, endWorld.y);
  layer.preview.stroke({ width: 2 * px, color: COLOR_PREVIEW, alpha: 0.9 });
  layer.preview.circle(startWorld.x, startWorld.y, 4 * px).fill({ color: COLOR_PREVIEW });
  layer.preview.circle(endWorld.x, endWorld.y, 4 * px).fill({ color: COLOR_HANDLE_DRAG });
}

export function clearPreview(layer: SceneLayer) {
  layer.preview.clear();
}

function boneTip(bone: Bone, wt: WorldTransform): { x: number; y: number } {
  return {
    x: wt.x + Math.cos(wt.rotation) * bone.length * wt.scaleX,
    y: wt.y + Math.sin(wt.rotation) * bone.length * wt.scaleX,
  };
}

export type GizmoHit = { kind: "origin" } | { kind: "tip" };

export function hitTestGizmo(
  selected: BoneScreen | undefined,
  worldX: number,
  worldY: number,
  worldScale: number,
): GizmoHit | null {
  if (!selected) return null;
  const r = (HANDLE_PIXELS + 3) / worldScale;
  if (selected.bone.length > 0 && dist2(worldX, worldY, selected.tip.x, selected.tip.y) <= r * r) {
    return { kind: "tip" };
  }
  if (dist2(worldX, worldY, selected.origin.x, selected.origin.y) <= r * r) {
    return { kind: "origin" };
  }
  return null;
}

export function hitTestBones(
  bones: BoneScreen[],
  worldX: number,
  worldY: number,
  worldScale: number,
): BoneScreen | null {
  const tol = HIT_PIXELS / worldScale;
  for (let i = bones.length - 1; i >= 0; i--) {
    const b = bones[i];
    if (b.bone.length === 0) {
      if (dist2(worldX, worldY, b.origin.x, b.origin.y) <= (tol + 2 / worldScale) ** 2) return b;
      continue;
    }
    if (
      pointToSegmentDistSq(worldX, worldY, b.origin.x, b.origin.y, b.tip.x, b.tip.y) <=
      tol * tol
    ) {
      return b;
    }
  }
  return null;
}

/** Returns the index of the nearest mesh vertex within the pick tolerance. */
export function hitTestMeshVertex(
  frame: MeshEditFrame | undefined,
  worldX: number,
  worldY: number,
  worldScale: number,
): number | null {
  if (!frame) return null;
  const tolSq = (VERTEX_HIT_PIXELS / worldScale) ** 2;
  let best = -1;
  let bestSq = tolSq;
  const verts = frame.skinned;
  for (let i = 0; i < verts.length; i += 2) {
    const d = dist2(worldX, worldY, verts[i], verts[i + 1]);
    if (d <= bestSq) {
      bestSq = d;
      best = i / 2;
    }
  }
  return best >= 0 ? best : null;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist2(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return dist2(px, py, cx, cy);
}

// ──────────────────────────────────────────────────────────────────
// Attachment rendering
// ──────────────────────────────────────────────────────────────────

const textureCache = new Map<string, Texture>();
const loadingAssets = new Set<string>();

function ensureTexture(assetId: string, url: string, onReady: () => void): Texture | null {
  const cached = textureCache.get(assetId);
  if (cached) return cached;
  if (loadingAssets.has(assetId)) return null;
  loadingAssets.add(assetId);
  Assets.load<Texture>(url)
    .then((tex) => {
      textureCache.set(assetId, tex);
      loadingAssets.delete(assetId);
      onReady();
    })
    .catch((err) => {
      loadingAssets.delete(assetId);
      // eslint-disable-next-line no-console
      console.error(`Failed to load asset ${assetId}:`, err);
    });
  return null;
}

function disposeAttachments(layer: SceneLayer) {
  const removed = layer.attachments.removeChildren();
  for (const s of removed) s.destroy({ children: false, texture: false });
}

function findActiveMesh(
  skeleton: Skeleton,
  skin: Skin,
  activeSlotId: string | null,
): MeshAttachment | undefined {
  if (!activeSlotId) return undefined;
  const slot = skeleton.slots.find((s) => s.id === activeSlotId);
  if (!slot || !slot.attachment) return undefined;
  const att = skin.attachments.find(
    (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
  );
  return att as MeshAttachment | undefined;
}

function drawAttachments(
  layer: SceneLayer,
  skeleton: Skeleton,
  assets: Asset[],
  skin: Skin,
  worldTransforms: Map<string, WorldTransform>,
  activeSlotId: string | null,
  slotOverrides: Map<string, string | null>,
  onReady: () => void,
): MeshEditFrame | undefined {
  disposeAttachments(layer);

  const sortedSlots = [...skeleton.slots].sort((a, b) => a.drawOrder - b.drawOrder);
  let activeMesh: MeshEditFrame | undefined;

  for (const slot of sortedSlots) {
    // Animation-driven attachment override wins. `null` means "hide this slot".
    const attachmentName = slotOverrides.has(slot.id)
      ? slotOverrides.get(slot.id)
      : slot.attachment;
    if (!attachmentName) continue;

    const att = skin.attachments.find(
      (a) => a.slot === slot.id && a.id === attachmentName,
    );
    if (!att) continue;

    const asset = assets.find((a) => a.id === att.assetId);
    if (!asset) continue;

    const tex = ensureTexture(asset.id, asset.path, onReady);
    if (!tex) continue;

    if (att.kind === "region") {
      const region = att as RegionAttachment;
      const boneWorld = worldTransforms.get(slot.bone);
      if (!boneWorld) continue;
      const cos = Math.cos(boneWorld.rotation);
      const sin = Math.sin(boneWorld.rotation);
      const lx = region.x * boneWorld.scaleX;
      const ly = region.y * boneWorld.scaleY;
      const wx = boneWorld.x + cos * lx - sin * ly;
      const wy = boneWorld.y + sin * lx + cos * ly;

      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.position.set(wx, wy);
      sprite.rotation = boneWorld.rotation + region.rotation;
      sprite.scale.set(
        boneWorld.scaleX * region.scaleX,
        boneWorld.scaleY * region.scaleY,
      );
      sprite.label = slot.id;
      layer.attachments.addChild(sprite);
    } else if (att.kind === "mesh") {
      const mesh = att as MeshAttachment;
      const skinned = skinMesh(mesh, skeleton, slot.bone, worldTransforms);
      const geom = new MeshGeometry({
        positions: skinned,
        uvs: new Float32Array(mesh.uvs),
        indices: new Uint32Array(mesh.triangles),
      });
      const pixiMesh = new Mesh({ geometry: geom, texture: tex });
      pixiMesh.label = slot.id;
      layer.attachments.addChild(pixiMesh);

      if (slot.id === activeSlotId) {
        activeMesh = { slotId: slot.id, skinned };
      }
    }
  }

  return activeMesh;
}

function drawMeshOverlay(
  g: Graphics,
  mesh: MeshAttachment,
  skinned: Float32Array,
  worldScale: number,
  tool: ToolId,
  activeBoneId: string | null,
) {
  const px = 1 / worldScale;

  // Edges from triangle indices. Use a set to avoid drawing each edge twice.
  const seen = new Set<number>();
  const tris = mesh.triangles;
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i];
    const b = tris[i + 1];
    const c = tris[i + 2];
    drawEdgeIfNew(g, skinned, a, b, seen);
    drawEdgeIfNew(g, skinned, b, c, seen);
    drawEdgeIfNew(g, skinned, c, a, seen);
  }
  g.stroke({ width: px, color: COLOR_MESH_EDGE, alpha: 0.7 });

  // Vertices.
  const vCount = skinned.length / 2;
  for (let i = 0; i < vCount; i++) {
    const x = skinned[i * 2];
    const y = skinned[i * 2 + 1];

    if (tool === "weights") {
      const weight = activeBoneId ? weightFor(mesh, i, activeBoneId) : 0;
      const color = weightColor(weight);
      g.circle(x, y, VERTEX_PIXELS * px).fill({ color });
      g.circle(x, y, VERTEX_PIXELS * px).stroke({ width: px, color: 0x222330 });
    } else {
      g.circle(x, y, VERTEX_PIXELS * px).fill({ color: COLOR_MESH_VERTEX });
      g.circle(x, y, VERTEX_PIXELS * px).stroke({ width: px, color: 0x222330 });
    }
  }
}

function drawEdgeIfNew(
  g: Graphics,
  verts: Float32Array,
  a: number,
  b: number,
  seen: Set<number>,
) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const key = lo * 1_000_003 + hi;
  if (seen.has(key)) return;
  seen.add(key);
  g.moveTo(verts[a * 2], verts[a * 2 + 1]).lineTo(verts[b * 2], verts[b * 2 + 1]);
}

function weightFor(mesh: MeshAttachment, vertexIndex: number, boneId: string): number {
  const list = mesh.weights[vertexIndex];
  if (!list) return 0;
  for (const w of list) if (w.bone === boneId) return w.weight;
  return 0;
}

function weightColor(w: number): number {
  // Blue (cold, 0) → red (hot, 1).
  const t = Math.max(0, Math.min(1, w));
  const r = Math.round(40 + 215 * t);
  const g = Math.round(90 * (1 - t) + 40 * t);
  const b = Math.round(220 * (1 - t) + 40 * t);
  return (r << 16) | (g << 8) | b;
}
