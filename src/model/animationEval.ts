/**
 * Animation evaluation. Given an animation and a playhead time, build per-bone
 * pose overrides and slot-attachment overrides that the renderer can layer on
 * top of the setup pose.
 *
 * MVP: linear interpolation for numeric and vector channels (with shortest-arc
 * blending for rotation), stepped for slot attachment swaps. Bezier is left as
 * data-only until the curve editor lands in M7.1.
 */

import type { Animation, Keyframe, Track } from "./types";
import type { PoseOverride } from "./skeletonMath";

export interface AnimationFrame {
  bones: Map<string, PoseOverride>;
  slotAttachments: Map<string, string | null>;
}

export function evaluateAnimation(animation: Animation, time: number): AnimationFrame {
  const bones = new Map<string, PoseOverride>();
  const slotAttachments = new Map<string, string | null>();

  for (const track of animation.tracks) {
    switch (track.kind) {
      case "boneRotate": {
        const v = interpolate(track.keyframes, time, lerpAngle);
        if (v !== undefined) mergeBone(bones, track.bone, { rotation: v });
        break;
      }
      case "boneTranslate": {
        const v = interpolate(track.keyframes, time, lerpVec2);
        if (v !== undefined) mergeBone(bones, track.bone, { x: v[0], y: v[1] });
        break;
      }
      case "boneScale": {
        const v = interpolate(track.keyframes, time, lerpVec2);
        if (v !== undefined) mergeBone(bones, track.bone, { scaleX: v[0], scaleY: v[1] });
        break;
      }
      case "slotAttachment": {
        const v = steppedValue(track.keyframes, time);
        if (v !== undefined) slotAttachments.set(track.slot, v);
        break;
      }
    }
  }

  return { bones, slotAttachments };
}

function mergeBone(map: Map<string, PoseOverride>, boneId: string, patch: PoseOverride) {
  const prev = map.get(boneId);
  map.set(boneId, prev ? { ...prev, ...patch } : patch);
}

function interpolate<T>(
  keyframes: Keyframe<T>[],
  time: number,
  lerp: (a: T, b: T, t: number) => T,
): T | undefined {
  if (keyframes.length === 0) return undefined;
  if (time <= keyframes[0].time) return keyframes[0].value;
  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].value;
  }

  // Binary search for the segment containing `time`.
  let lo = 0;
  let hi = keyframes.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid].time <= time) lo = mid;
    else hi = mid;
  }
  const a = keyframes[lo];
  const b = keyframes[lo + 1];

  if (a.curve?.kind === "stepped") return a.value;
  const span = b.time - a.time;
  if (span <= 0) return b.value;
  const t = clamp01((time - a.time) / span);
  // Bezier left as linear for the MVP; curve data is preserved for later.
  return lerp(a.value, b.value, t);
}

function steppedValue<T>(keyframes: Keyframe<T>[], time: number): T | undefined {
  if (keyframes.length === 0) return undefined;
  if (time < keyframes[0].time) return keyframes[0].value;
  for (let i = keyframes.length - 1; i >= 0; i--) {
    if (keyframes[i].time <= time) return keyframes[i].value;
  }
  return keyframes[0].value;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

function lerpVec2(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// ──────────────────────────────────────────────────────────────────
// Keyframe list utilities (shared between evaluator + store auto-key).
// ──────────────────────────────────────────────────────────────────

/** Upsert a keyframe into a sorted-by-time keyframe array. If a keyframe
 *  already exists within `epsilon` of `time`, its value is replaced; otherwise
 *  a new keyframe is inserted at the correct position. */
export function upsertKeyframe<T>(
  keyframes: Keyframe<T>[],
  time: number,
  value: T,
  epsilon = 1e-4,
): void {
  for (let i = 0; i < keyframes.length; i++) {
    if (Math.abs(keyframes[i].time - time) < epsilon) {
      keyframes[i] = { ...keyframes[i], value };
      return;
    }
    if (keyframes[i].time > time) {
      keyframes.splice(i, 0, { time, value, curve: { kind: "linear" } });
      return;
    }
  }
  keyframes.push({ time, value, curve: { kind: "linear" } });
}

export function removeKeyframeAt<T>(keyframes: Keyframe<T>[], time: number, epsilon = 1e-4): void {
  for (let i = 0; i < keyframes.length; i++) {
    if (Math.abs(keyframes[i].time - time) < epsilon) {
      keyframes.splice(i, 1);
      return;
    }
  }
}

export type TrackKind = Track["kind"];

/** Unique key times across every track, sorted — for the dopesheet ruler and
 *  "step to next/prev keyframe" commands. */
export function allKeyTimes(animation: Animation): number[] {
  const set = new Set<number>();
  for (const t of animation.tracks) {
    for (const k of t.keyframes) set.add(k.time);
  }
  return Array.from(set).sort((a, b) => a - b);
}
