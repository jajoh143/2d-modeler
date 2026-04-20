/**
 * 1-bone and 2-bone analytical IK solvers.
 *
 * Returns the bone rotations (in radians) required to reach `target`.
 * The 2-bone solver uses the law of cosines; it's what Spine's runtime does
 * and it's stable as long as the target is reachable.
 */

export function solveIk1(
  boneX: number,
  boneY: number,
  targetX: number,
  targetY: number,
): number {
  return Math.atan2(targetY - boneY, targetX - boneX);
}

export interface Ik2Result {
  parentRotation: number;
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
