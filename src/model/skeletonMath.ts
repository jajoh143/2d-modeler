import type { Bone, Skeleton } from "./types";

export interface WorldTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Resolve each bone's world-space transform by walking the parent chain. */
export function resolveBoneWorld(skeleton: Skeleton): Map<string, WorldTransform> {
  const byId = new Map<string, Bone>();
  for (const b of skeleton.bones) byId.set(b.id, b);

  const cache = new Map<string, WorldTransform>();

  const resolve = (bone: Bone): WorldTransform => {
    const cached = cache.get(bone.id);
    if (cached) return cached;

    if (!bone.parent) {
      const wt: WorldTransform = {
        x: bone.x,
        y: bone.y,
        rotation: bone.rotation,
        scaleX: bone.scaleX,
        scaleY: bone.scaleY,
      };
      cache.set(bone.id, wt);
      return wt;
    }

    const parent = byId.get(bone.parent);
    if (!parent) return { x: bone.x, y: bone.y, rotation: bone.rotation, scaleX: 1, scaleY: 1 };
    const pw = resolve(parent);

    const cos = Math.cos(pw.rotation);
    const sin = Math.sin(pw.rotation);
    const localX = bone.x * pw.scaleX;
    const localY = bone.y * pw.scaleY;

    const wt: WorldTransform = {
      x: pw.x + cos * localX - sin * localY,
      y: pw.y + sin * localX + cos * localY,
      rotation: pw.rotation + bone.rotation,
      scaleX: pw.scaleX * bone.scaleX,
      scaleY: pw.scaleY * bone.scaleY,
    };
    cache.set(bone.id, wt);
    return wt;
  };

  for (const b of skeleton.bones) resolve(b);
  return cache;
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

