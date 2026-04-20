import type { Bone, Skeleton } from "./types";

export interface WorldTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Per-bone transform override, applied in place of the bone's setup-pose
 *  values when resolving world transforms. Populated by animation evaluation
 *  (x/y/rotation/scale from keyframe tracks) and the IK solver (rotation
 *  only, stacked on top of animation). */
export interface PoseOverride {
  rotation?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
}

/** Resolve each bone's world-space transform by walking the parent chain.
 *  If `overrides` are provided, the override's rotation (when present) is
 *  used in place of bone.rotation. */
export function resolvePosedWorld(
  skeleton: Skeleton,
  overrides?: Map<string, PoseOverride>,
): Map<string, WorldTransform> {
  const byId = new Map<string, Bone>();
  for (const b of skeleton.bones) byId.set(b.id, b);

  const cache = new Map<string, WorldTransform>();

  const localValues = (bone: Bone) => {
    const o = overrides?.get(bone.id);
    return {
      x: o?.x ?? bone.x,
      y: o?.y ?? bone.y,
      rotation: o?.rotation ?? bone.rotation,
      scaleX: o?.scaleX ?? bone.scaleX,
      scaleY: o?.scaleY ?? bone.scaleY,
    };
  };

  const resolve = (bone: Bone): WorldTransform => {
    const cached = cache.get(bone.id);
    if (cached) return cached;

    const lv = localValues(bone);

    if (!bone.parent) {
      const wt: WorldTransform = {
        x: lv.x,
        y: lv.y,
        rotation: lv.rotation,
        scaleX: lv.scaleX,
        scaleY: lv.scaleY,
      };
      cache.set(bone.id, wt);
      return wt;
    }

    const parent = byId.get(bone.parent);
    if (!parent) return { x: lv.x, y: lv.y, rotation: lv.rotation, scaleX: lv.scaleX, scaleY: lv.scaleY };
    const pw = resolve(parent);

    const cos = Math.cos(pw.rotation);
    const sin = Math.sin(pw.rotation);
    const localX = lv.x * pw.scaleX;
    const localY = lv.y * pw.scaleY;

    const wt: WorldTransform = {
      x: pw.x + cos * localX - sin * localY,
      y: pw.y + sin * localX + cos * localY,
      rotation: pw.rotation + lv.rotation,
      scaleX: pw.scaleX * lv.scaleX,
      scaleY: pw.scaleY * lv.scaleY,
    };
    cache.set(bone.id, wt);
    return wt;
  };

  for (const b of skeleton.bones) resolve(b);
  return cache;
}

/** Plain forward-kinematics resolve (no IK). Equivalent to resolvePosedWorld
 *  with no overrides — used by editing code that must see the rest/setup
 *  pose, not the IK-posed one. */
export function resolveBoneWorld(skeleton: Skeleton): Map<string, WorldTransform> {
  return resolvePosedWorld(skeleton);
}

/** Convert a world-space point to a bone's local space (inverse of the bone's
 *  parent transform — for editing, you want this on the parent so the result
 *  is what you'd assign to bone.x / bone.y). */
export function worldToLocal(
  parent: WorldTransform | null,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  if (!parent) return { x: worldX, y: worldY };
  const dx = worldX - parent.x;
  const dy = worldY - parent.y;
  const cos = Math.cos(parent.rotation);
  const sin = Math.sin(parent.rotation);
  // Inverse rotation, then divide by parent scale.
  const sx = parent.scaleX || 1;
  const sy = parent.scaleY || 1;
  return { x: (cos * dx + sin * dy) / sx, y: (-sin * dx + cos * dy) / sy };
}


