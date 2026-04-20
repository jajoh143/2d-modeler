/**
 * Mesh generation and CPU skinning for mesh attachments.
 *
 * Vertex positions are stored in the slot's main bone's local rest-pose
 * space. When a bone is weighted onto a vertex, the vertex's position in
 * that bone's local rest-pose is captured in BoneWeight.x/y, so the skinning
 * math stays stable even as the rig is edited.
 */

import type {
  Asset,
  BoneWeight,
  MeshAttachment,
  RegionAttachment,
  Skeleton,
} from "./types";
import { resolveBoneWorld, worldToLocal, type WorldTransform } from "./skeletonMath";

export interface MeshGeometry {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/** Build an NxM grid mesh for a region attachment. Vertex coordinates are in
 *  the slot's main bone local space (same frame as the region attachment). */
export function regionToMeshGeometry(
  region: RegionAttachment,
  asset: Asset,
  cols: number,
  rows: number,
): {
  vertices: number[]; // x0,y0,x1,y1,... in bone-local space
  uvs: number[];
  triangles: number[];
} {
  cols = Math.max(2, Math.floor(cols));
  rows = Math.max(2, Math.floor(rows));

  // Attachment local rectangle (centered at the attachment's x,y, with
  // rotation applied at that anchor, scaled by the attachment's scale).
  const w = asset.width * region.scaleX;
  const h = asset.height * region.scaleY;
  const cos = Math.cos(region.rotation);
  const sin = Math.sin(region.rotation);

  const vertices: number[] = [];
  const uvs: number[] = [];
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1);
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1);
      // Local rectangle coords before attachment rotation/translation.
      const lx = (u - 0.5) * w;
      const ly = (v - 0.5) * h;
      // Apply attachment rotation + offset.
      const x = region.x + cos * lx - sin * ly;
      const y = region.y + sin * lx + cos * ly;
      vertices.push(x, y);
      uvs.push(u, v);
    }
  }

  const triangles: number[] = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      triangles.push(a, b, d);
      triangles.push(a, d, c);
    }
  }

  return { vertices, uvs, triangles };
}

/** Skin a mesh attachment to produce world-space vertex positions. Single-bone
 *  case (empty weights or one entry 100%) short-circuits to a matrix-apply
 *  through the slot's main bone. Multi-bone case blends rest-local coords
 *  through each weighted bone's current world transform. */
export function skinMesh(
  mesh: MeshAttachment,
  skeleton: Skeleton,
  slotBoneId: string,
): Float32Array {
  const worlds = resolveBoneWorld(skeleton);
  const mainWorld = worlds.get(slotBoneId);
  const vCount = mesh.vertices.length / 2;
  const out = new Float32Array(mesh.vertices.length);

  for (let i = 0; i < vCount; i++) {
    const vx = mesh.vertices[i * 2];
    const vy = mesh.vertices[i * 2 + 1];
    const weights = mesh.weights[i];

    if (!weights || weights.length === 0) {
      // Default: pin to the slot's main bone.
      if (!mainWorld) {
        out[i * 2] = vx;
        out[i * 2 + 1] = vy;
        continue;
      }
      const { x, y } = applyWorld(mainWorld, vx, vy);
      out[i * 2] = x;
      out[i * 2 + 1] = y;
      continue;
    }

    let wx = 0;
    let wy = 0;
    let total = 0;
    for (const bw of weights) {
      const bWorld = worlds.get(bw.bone);
      if (!bWorld || bw.weight <= 0) continue;
      const p = applyWorld(bWorld, bw.x, bw.y);
      wx += p.x * bw.weight;
      wy += p.y * bw.weight;
      total += bw.weight;
    }
    if (total < 1e-4 && mainWorld) {
      const p = applyWorld(mainWorld, vx, vy);
      wx = p.x;
      wy = p.y;
      total = 1;
    }
    out[i * 2] = total > 0 ? wx / total : wx;
    out[i * 2 + 1] = total > 0 ? wy / total : wy;
  }

  return out;
}

function applyWorld(w: WorldTransform, lx: number, ly: number): { x: number; y: number } {
  const cos = Math.cos(w.rotation);
  const sin = Math.sin(w.rotation);
  const sx = lx * w.scaleX;
  const sy = ly * w.scaleY;
  return { x: w.x + cos * sx - sin * sy, y: w.y + sin * sx + cos * sy };
}

/** Capture a vertex's rest-local position for a given bone. Used when adding
 *  a bone weight to a vertex so the skinning math has per-bone reference
 *  coords. The vertex position is supplied in the main bone's local space
 *  (the canonical storage in MeshAttachment.vertices). */
export function captureVertexRest(
  skeleton: Skeleton,
  mainBoneId: string,
  targetBoneId: string,
  vxMainLocal: number,
  vyMainLocal: number,
): { x: number; y: number } {
  const worlds = resolveBoneWorld(skeleton);
  const main = worlds.get(mainBoneId);
  const target = worlds.get(targetBoneId);
  if (!main || !target) return { x: vxMainLocal, y: vyMainLocal };
  const world = applyWorld(main, vxMainLocal, vyMainLocal);
  return worldToLocal(target, world.x, world.y);
}

/** Normalize a weight array so values sum to 1 (or leave empty if total is 0). */
export function normalizeWeights(weights: BoneWeight[]): BoneWeight[] {
  let total = 0;
  for (const w of weights) total += Math.max(0, w.weight);
  if (total <= 0) return [];
  return weights
    .filter((w) => w.weight > 0)
    .map((w) => ({ ...w, weight: w.weight / total }));
}
