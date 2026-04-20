import { create } from "zustand";
import { produce, enablePatches, applyPatches, type Patch } from "immer";
import type { Project, Skeleton, Bone } from "../model/types";
import { emptyProject } from "../model/factory";

enablePatches();

export type ToolId = "select" | "bone" | "mesh" | "weights";

interface UndoEntry {
  redo: Patch[];
  undo: Patch[];
  label: string;
}

interface ProjectState {
  project: Project;
  activeSkeletonId: string;
  activeBoneId: string | null;
  activeTool: ToolId;
  playheadTime: number;
  history: { past: UndoEntry[]; future: UndoEntry[] };

  setActiveTool: (tool: ToolId) => void;
  setActiveBone: (id: string | null) => void;
  setPlayhead: (t: number) => void;

  commit: (label: string, mutator: (draft: Project) => void) => void;
  undo: () => void;
  redo: () => void;

  addBone: (parentId: string, x: number, y: number, length: number) => void;
  updateBone: (boneId: string, patch: Partial<Bone>) => void;
  replaceSkeleton: (skeleton: Skeleton) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const initial = emptyProject();
  return {
    project: initial,
    activeSkeletonId: initial.skeletons[0].id,
    activeBoneId: initial.skeletons[0].bones[0].id,
    activeTool: "select",
    playheadTime: 0,
    history: { past: [], future: [] },

    setActiveTool: (tool) => set({ activeTool: tool }),
    setActiveBone: (id) => set({ activeBoneId: id }),
    setPlayhead: (t) => set({ playheadTime: Math.max(0, t) }),

    commit: (label, mutator) => {
      const { project, history } = get();
      const redo: Patch[] = [];
      const undo: Patch[] = [];
      const next = produce(
        project,
        (draft) => mutator(draft),
        (patches, inverse) => {
          redo.push(...patches);
          undo.push(...inverse);
        },
      );
      if (redo.length === 0) return;
      set({
        project: next,
        history: { past: [...history.past, { redo, undo, label }], future: [] },
      });
    },

    undo: () => {
      const { project, history } = get();
      const last = history.past[history.past.length - 1];
      if (!last) return;
      const reverted = applyPatches(project, last.undo);
      set({
        project: reverted,
        history: {
          past: history.past.slice(0, -1),
          future: [last, ...history.future],
        },
      });
    },

    redo: () => {
      const { project, history } = get();
      const next = history.future[0];
      if (!next) return;
      const reapplied = applyPatches(project, next.redo);
      set({
        project: reapplied,
        history: {
          past: [...history.past, next],
          future: history.future.slice(1),
        },
      });
    },

    addBone: (parentId, x, y, length) => {
      get().commit("add bone", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        if (!skel) return;
        const parent = skel.bones.find((b) => b.id === parentId);
        if (!parent) return;
        skel.bones.push({
          id: crypto.randomUUID().slice(0, 8),
          name: `bone${skel.bones.length}`,
          parent: parentId,
          x,
          y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          length,
        });
      });
    },

    updateBone: (boneId, patch) => {
      get().commit("update bone", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        const bone = skel?.bones.find((b) => b.id === boneId);
        if (!bone) return;
        Object.assign(bone, patch);
      });
    },

    replaceSkeleton: (skeleton) => {
      get().commit("replace skeleton", (draft) => {
        const idx = draft.skeletons.findIndex((s) => s.id === skeleton.id);
        if (idx >= 0) draft.skeletons[idx] = skeleton;
        else draft.skeletons.push(skeleton);
      });
    },
  };
});
