// Mirrors src-tauri/src/project.rs — keep in sync.

export interface Project {
  meta: ProjectMeta;
  assets: Asset[];
  skeletons: Skeleton[];
  animations: Animation[];
}

export interface ProjectMeta {
  name: string;
  version: string;
  canvasWidth: number;
  canvasHeight: number;
}

export interface Asset {
  id: string;
  /** Display name (often the original filename). */
  name: string;
  /** Pixi-loadable URL. For imported PNGs this is a data URL; for saved
   *  projects it may become a relative file:// path after we implement the
   *  project bundle writer (M10). */
  path: string;
  width: number;
  height: number;
}

export interface Skeleton {
  id: string;
  name: string;
  bones: Bone[];
  slots: Slot[];
  skins: Skin[];
  ikConstraints: IkConstraint[];
}

export interface Bone {
  id: string;
  name: string;
  parent: string | null;
  x: number;
  y: number;
  rotation: number; // radians
  scaleX: number;
  scaleY: number;
  length: number;
}

export interface Slot {
  id: string;
  name: string;
  bone: string;
  drawOrder: number;
  attachment: string | null;
}

export interface Skin {
  id: string;
  name: string;
  attachments: Attachment[];
}

export type Attachment = RegionAttachment | MeshAttachment;

export interface RegionAttachment {
  kind: "region";
  id: string;
  slot: string;
  assetId: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface MeshAttachment {
  kind: "mesh";
  id: string;
  slot: string;
  assetId: string;
  vertices: number[];
  uvs: number[];
  triangles: number[];
  weights: BoneWeight[][];
}

export interface BoneWeight {
  bone: string;
  weight: number;
  /** Vertex position in this bone's local rest-pose space. Captured when the
   *  bone is first bound to the vertex, and re-used during skinning so that
   *  multi-bone blends are stable regardless of the current pose. */
  x: number;
  y: number;
}

export interface IkConstraint {
  id: string;
  name: string;
  bones: string[];
  target: string;
  mix: number;
  bendPositive: boolean;
}

export interface Animation {
  id: string;
  name: string;
  skeleton: string;
  duration: number;
  fps: number;
  tracks: Track[];
}

export type Track =
  | { kind: "boneRotate"; bone: string; keyframes: Keyframe<number>[] }
  | { kind: "boneTranslate"; bone: string; keyframes: Keyframe<[number, number]>[] }
  | { kind: "boneScale"; bone: string; keyframes: Keyframe<[number, number]>[] }
  | { kind: "slotAttachment"; slot: string; keyframes: Keyframe<string | null>[] };

export interface Keyframe<T> {
  time: number;
  value: T;
  curve?: Curve;
}

export type Curve =
  | { kind: "linear" }
  | { kind: "stepped" }
  | { kind: "bezier"; cx1: number; cy1: number; cx2: number; cy2: number };
