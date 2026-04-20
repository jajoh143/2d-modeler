import { nanoid } from "nanoid";
import type { Bone, Project, Skeleton } from "./types";

export function createSkeleton(name = "skeleton"): Skeleton {
  const rootBone: Bone = {
    id: nanoid(8),
    name: "root",
    parent: null,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    length: 0,
  };
  return {
    id: nanoid(8),
    name,
    bones: [rootBone],
    slots: [],
    skins: [{ id: nanoid(8), name: "default", attachments: [] }],
    ikConstraints: [],
  };
}

export function emptyProject(name = "Untitled"): Project {
  return {
    meta: { name, version: "0.1.0", canvasWidth: 1920, canvasHeight: 1080 },
    assets: [],
    skeletons: [createSkeleton()],
    animations: [],
  };
}

export function createBone(parent: string | null, x = 0, y = 0, length = 100): Bone {
  return {
    id: nanoid(8),
    name: "bone",
    parent,
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    length,
  };
}
