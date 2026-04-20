/**
 * Combined animation + IK + forward-kinematics resolver. Use this for
 * rendering and any math that should see the final posed skeleton. Use
 * resolveBoneWorld for raw FK (e.g. user editing that should ignore the pose).
 *
 * Order of application:
 *   1. Animation tracks -> per-bone pose overrides, per-slot attachment overrides
 *   2. IK solve on top of animated pose (rotation only)
 *   3. Forward-kinematics walk with merged overrides
 */

import type { Animation, Skeleton } from "./types";
import { resolvePosedWorld, type WorldTransform } from "./skeletonMath";
import { solveIkConstraints } from "./ik";
import { evaluateAnimation } from "./animationEval";

export interface PoseInputs {
  animation?: Animation;
  time?: number;
}

export interface PoseResult {
  worlds: Map<string, WorldTransform>;
  /** Per-slot attachment overrides driven by the animation (empty when no
   *  animation is active). A value of `null` means "hide the attachment". */
  slotAttachments: Map<string, string | null>;
}

export function resolvePose(skeleton: Skeleton, inputs: PoseInputs = {}): PoseResult {
  let baseOverrides: ReturnType<typeof evaluateAnimation>["bones"] | undefined;
  let slotAttachments = new Map<string, string | null>();

  if (inputs.animation && inputs.time !== undefined) {
    const frame = evaluateAnimation(inputs.animation, inputs.time);
    baseOverrides = frame.bones;
    slotAttachments = frame.slotAttachments;
  }

  const overrides = solveIkConstraints(skeleton, skeleton.ikConstraints, baseOverrides);
  const worlds = resolvePosedWorld(skeleton, overrides);
  return { worlds, slotAttachments };
}
