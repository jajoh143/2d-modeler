/**
 * 1-bone and 2-bone analytical IK solvers, plus a constraint runner that
 * produces per-bone rotation overrides for use with resolvePosedWorld.
 *
 * The 2-bone solver uses the law of cosines — same approach Spine's runtime
 * uses. It's stable and has no iteration/convergence concerns as long as the
 * target is inside the chain's reach; when the target is outside reach we
 * clamp to just below `max` so the chain straightens toward the target.
 */

import type { IkConstraint, Skeleton } from "./types";
import { resolvePosedWorld, type PoseOverride } from "./skeletonMath";

export function solveIk1(
  boneX: number,
  boneY: number,
  targetX: number,
  targetY: number,
): number {
  return Math.atan2(targetY - boneY, targetX - boneX);
}

export interface Ik2Result {
  /** World rotation of the first (parent) bone in the chain. */
  parentRotation: number;
  /** Local rotation of the second (child) bone relative to the parent. */
  childRotation: number;
}

export function solveIk2(
  rootX: number,
  rootY: number,
  targetX: number,
  targetY: number,
  parentLength: number,
  childLength: number,
  bendPositive: boolean,
): Ik2Result {
  const dx = targetX - rootX;
  const dy = targetY - rootY;
  const dist = Math.hypot(dx, dy);

  const maxReach = parentLength + childLength;
  const minReach = Math.abs(parentLength - childLength);
  const clamped = Math.min(Math.max(dist, minReach + 1e-4), maxReach - 1e-4);

  const cosA =
    (parentLength * parentLength + clamped * clamped - childLength * childLength) /
    (2 * parentLength * clamped);
  const cosB =
    (parentLength * parentLength + childLength * childLength - clamped * clamped) /
    (2 * parentLength * childLength);

  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const b = Math.acos(Math.min(1, Math.max(-1, cosB)));

  const base = Math.atan2(dy, dx);
  const sign = bendPositive ? 1 : -1;
  return {
    parentRotation: base - a * sign,
    childRotation: Math.PI - b * sign,
  };
}

/** Run every IK constraint in order and return a rotation-override map that
 *  can be fed back into resolvePosedWorld to render the posed skeleton. */
export function solveIkConstraints(
  skeleton: Skeleton,
  constraints: IkConstraint[],
): Map<string, PoseOverride> {
  const overrides = new Map<string, PoseOverride>();
  if (!constraints.length) return overrides;

  const boneById = new Map(skeleton.bones.map((b) => [b.id, b]));

  for (const c of constraints) {
    if (c.mix <= 0 || c.bones.length === 0) continue;

    // Recompute with current overrides so later constraints see the effect
    // of earlier ones. Fine for small chains; O(bones × constraints).
    const worlds = resolvePosedWorld(skeleton, overrides);
    const target = worlds.get(c.target);
    if (!target) continue;

    if (c.bones.length === 1) {
      const boneId = c.bones[0];
      const bone = boneById.get(boneId);
      if (!bone) continue;
      const bw = worlds.get(boneId);
      if (!bw) continue;

      const parent = bone.parent ? boneById.get(bone.parent) : undefined;
      const parentWorldRot = parent ? worlds.get(parent.id)?.rotation ?? 0 : 0;

      const desiredWorld = solveIk1(bw.x, bw.y, target.x, target.y);
      const desiredLocal = desiredWorld - parentWorldRot;
      const currentLocal = overrides.get(boneId)?.rotation ?? bone.rotation;

      overrides.set(boneId, { rotation: lerpAngle(currentLocal, desiredLocal, c.mix) });
      continue;
    }

    // 2-bone: bones[0] is the proximal (parent) bone, bones[1] its direct child.
    const parentId = c.bones[0];
    const childId = c.bones[1];
    const parentBone = boneById.get(parentId);
    const childBone = boneById.get(childId);
    if (!parentBone || !childBone) continue;
    if (childBone.parent !== parentId) continue; // Must be a direct chain.

    const parentWorld = worlds.get(parentId);
    if (!parentWorld) continue;
    const parentParent = parentBone.parent ? boneById.get(parentBone.parent) : undefined;
    const parentParentWorld = parentParent ? worlds.get(parentParent.id) : undefined;
    const grandparentRot = parentParentWorld?.rotation ?? 0;
    const chainScale = parentWorld.scaleX || 1;

    const result = solveIk2(
      parentWorld.x,
      parentWorld.y,
      target.x,
      target.y,
      parentBone.length * chainScale,
      childBone.length * chainScale,
      c.bendPositive,
    );

    const desiredParentLocal = result.parentRotation - grandparentRot;
    const desiredChildLocal = result.childRotation;

    const curParentLocal = overrides.get(parentId)?.rotation ?? parentBone.rotation;
    const curChildLocal = overrides.get(childId)?.rotation ?? childBone.rotation;

    overrides.set(parentId, {
      rotation: lerpAngle(curParentLocal, desiredParentLocal, c.mix),
    });
    overrides.set(childId, {
      rotation: lerpAngle(curChildLocal, desiredChildLocal, c.mix),
    });
  }

  return overrides;
}

function lerpAngle(a: number, b: number, t: number): number {
  // Interpolate along the shortest arc so ±π doesn't flip the chain.
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}
