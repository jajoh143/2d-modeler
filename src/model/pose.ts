/**
 * Combined forward-kinematics + IK resolver. Use this for rendering and any
 * math that should see the final posed skeleton. Use resolveBoneWorld for
 * raw FK (e.g. user editing that should ignore IK).
 */

import type { Skeleton } from "./types";
import { resolvePosedWorld, type WorldTransform } from "./skeletonMath";
import { solveIkConstraints } from "./ik";

export function resolvePose(skeleton: Skeleton): Map<string, WorldTransform> {
  const overrides = solveIkConstraints(skeleton, skeleton.ikConstraints);
  return resolvePosedWorld(skeleton, overrides);
}
