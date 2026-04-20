/**
 * Bone + attachment + gizmo rendering and hit-testing for the viewport.
 *
 * Drawing lives inside the world container (panned/zoomed with the camera),
 * but stroke widths and gizmo radii are divided by camera scale so they stay
 * constant in screen pixels. Attachment sprites render in world space so
 * their PNG pixels scale naturally with zoom.
 */

import { Assets, Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Asset, Bone, RegionAttachment, Skeleton, Skin } from "../model/types";
import { resolveBoneWorld, type WorldTransform } from "../model/skeletonMath";

export interface BoneScreen {
  bone: Bone;
  origin: { x: number; y: number };
  tip: { x: number; y: number };
}

export interface SceneLayer {
  container: Container;
  attachments: Container;
  bones: Graphics;
  selection: Graphics;
  gizmos: Graphics;
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
  const preview = new Graphics();
  // Draw order: attachment sprites at the back, then bone overlay on top.
  container.addChild(attachments, bones, selection, gizmos, preview);
  return { container, attachments, bones, selection, gizmos, preview };
}

const COLOR_BONE = 0x5aa9ff;
const COLOR_BONE_DIM = 0x4a6588;
const COLOR_SELECTED = 0xffd166;
const COLOR_HANDLE = 0xffffff;
const COLOR_HANDLE_DRAG = 0xffd166;
const COLOR_PREVIEW = 0x9a9aa6;

const HANDLE_PIXELS = 5;
const BONE_PIXELS = 2;
const HIT_PIXELS = 6;

export function drawScene(
  layer: SceneLayer,
  skeleton: Skeleton | undefined,
  assets: Asset[],
  activeSkin: Skin | undefined,
  activeBoneId: string | null,
  worldScale: number,
  showGizmos: boolean,
  onTextureReady: () => void,
): BoneScreen[] {
  layer.bones.clear();
  layer.selection.clear();
  layer.gizmos.clear();
  layer.preview.clear();

  if (!skeleton) {
    disposeSprites(layer);
    return [];
  }

  const px = 1 / worldScale;
  const world = resolveBoneWorld(skeleton);

  if (activeSkin) {
    drawAttachments(layer, skeleton, assets, activeSkin, world, onTextureReady);
  } else {
    disposeSprites(layer);
  }

  const list: BoneScreen[] = [];
  for (const bone of skeleton.bones) {
    const wt = world.get(bone.id);
    if (!wt) continue;
    const tip = boneTip(bone, wt);
    list.push({ bone, origin: { x: wt.x, y: wt.y }, tip });

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

  if (showGizmos && activeBoneId) {
    const sel = list.find((b) => b.bone.id === activeBoneId);
    if (sel) drawGizmos(layer.gizmos, sel, px);
  }

  return list;
}

function drawGizmos(g: Graphics, sel: BoneScreen, px: number) {
  // Origin handle (translate).
  g.circle(sel.origin.x, sel.origin.y, HANDLE_PIXELS * px).fill({ color: COLOR_HANDLE });
  g.circle(sel.origin.x, sel.origin.y, HANDLE_PIXELS * px).stroke({
    width: 1.2 * px,
    color: 0x222330,
  });

  if (sel.bone.length > 0) {
    // Tip handle (rotate + length).
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

/** Hit-test the selected bone's gizmo handles. World coords + camera scale. */
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

/** Hit-test all bones; returns the topmost one whose shaft is within tolerance. */
export function hitTestBones(
  bones: BoneScreen[],
  worldX: number,
  worldY: number,
  worldScale: number,
): BoneScreen | null {
  const tol = HIT_PIXELS / worldScale;
  // Iterate in reverse for top-down hit.
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

// Shared texture cache. Keyed by asset id so two sprites of the same PNG share
// the same GPU texture. Textures are kept alive across redraws.
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

function disposeSprites(layer: SceneLayer) {
  const removed = layer.attachments.removeChildren();
  for (const s of removed) s.destroy({ children: false, texture: false });
}

function drawAttachments(
  layer: SceneLayer,
  skeleton: Skeleton,
  assets: Asset[],
  skin: Skin,
  worldTransforms: Map<string, WorldTransform>,
  onReady: () => void,
) {
  disposeSprites(layer);

  const sortedSlots = [...skeleton.slots].sort((a, b) => a.drawOrder - b.drawOrder);
  for (const slot of sortedSlots) {
    if (!slot.attachment) continue;

    const attachment = skin.attachments.find(
      (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "region",
    ) as RegionAttachment | undefined;
    if (!attachment) continue;

    const asset = assets.find((a) => a.id === attachment.assetId);
    if (!asset) continue;

    const tex = ensureTexture(asset.id, asset.path, onReady);
    if (!tex) continue; // Still loading; onReady will trigger a redraw.

    const boneWorld = worldTransforms.get(slot.bone);
    if (!boneWorld) continue;

    const cos = Math.cos(boneWorld.rotation);
    const sin = Math.sin(boneWorld.rotation);
    const lx = attachment.x * boneWorld.scaleX;
    const ly = attachment.y * boneWorld.scaleY;
    const wx = boneWorld.x + cos * lx - sin * ly;
    const wy = boneWorld.y + sin * lx + cos * ly;

    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.position.set(wx, wy);
    sprite.rotation = boneWorld.rotation + attachment.rotation;
    sprite.scale.set(
      boneWorld.scaleX * attachment.scaleX,
      boneWorld.scaleY * attachment.scaleY,
    );
    sprite.label = slot.id;
    layer.attachments.addChild(sprite);
  }
}
