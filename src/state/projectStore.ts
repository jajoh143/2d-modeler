import { create } from "zustand";
import { produce, enablePatches, applyPatches, type Patch } from "immer";
import { nanoid } from "nanoid";
import type { Project, Skeleton, Bone } from "../model/types";
import { emptyProject, createSkeleton } from "../model/factory";

enablePatches();

interface BoneSnapshot {
  boneId: string;
  before: Bone;
}

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
  setActiveSkeleton: (id: string) => void;
  setPlayhead: (t: number) => void;

  commit: (label: string, mutator: (draft: Project) => void) => void;
  undo: () => void;
  redo: () => void;

  addBone: (parentId: string, x: number, y: number, length: number, rotation?: number) => string;
  updateBone: (boneId: string, patch: Partial<Bone>) => void;
  removeBone: (boneId: string) => void;
  replaceSkeleton: (skeleton: Skeleton) => void;

  // Drag transactions: live preview during drag, one undo entry on commit.
  beginBoneDrag: (boneId: string, label: string) => void;
  previewBoneDrag: (patch: Partial<Bone>) => void;
  commitBoneDrag: () => void;
  cancelBoneDrag: () => void;

  addSkeleton: (name?: string) => string;
  removeSkeleton: (id: string) => void;
  renameSkeleton: (id: string, name: string) => void;
}

export const useProjectStore = create<
  ProjectState & { _dragSnapshot?: BoneSnapshot; _dragLabel?: string }
>((set, get) => {
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
    setActiveSkeleton: (id) => {
      const skel = get().project.skeletons.find((s) => s.id === id);
      if (!skel) return;
      set({ activeSkeletonId: id, activeBoneId: skel.bones[0]?.id ?? null });
    },
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

    addBone: (parentId, x, y, length, rotation = 0) => {
      const newId = nanoid(8);
      get().commit("add bone", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        if (!skel) return;
        const parent = skel.bones.find((b) => b.id === parentId);
        if (!parent) return;
        skel.bones.push({
          id: newId,
          name: `bone${skel.bones.length}`,
          parent: parentId,
          x,
          y,
          rotation,
          scaleX: 1,
          scaleY: 1,
          length,
        });
      });
      set({ activeBoneId: newId });
      return newId;
    },

    removeBone: (boneId) => {
      const project = get().project;
      const skel = project.skeletons.find((s) => s.id === get().activeSkeletonId);
      if (!skel) return;
      const target = skel.bones.find((b) => b.id === boneId);
      if (!target || !target.parent) return; // Don't delete the root.
      get().commit("delete bone", (draft) => {
        const dskel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        if (!dskel) return;
        // Remove the bone and any descendants.
        const toRemove = new Set<string>([boneId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const b of dskel.bones) {
            if (b.parent && toRemove.has(b.parent) && !toRemove.has(b.id)) {
              toRemove.add(b.id);
              changed = true;
            }
          }
        }
        dskel.bones = dskel.bones.filter((b) => !toRemove.has(b.id));
        dskel.slots = dskel.slots.filter((s) => !toRemove.has(s.bone));
      });
      if (get().activeBoneId === boneId) {
        set({ activeBoneId: target.parent });
      }
    },

    addSkeleton: (name) => {
      const skel = createSkeleton(name);
      get().commit("add skeleton", (draft) => {
        draft.skeletons.push(skel);
      });
      set({ activeSkeletonId: skel.id, activeBoneId: skel.bones[0]?.id ?? null });
      return skel.id;
    },

    removeSkeleton: (id) => {
      const project = get().project;
      if (project.skeletons.length <= 1) return;
      get().commit("remove skeleton", (draft) => {
        draft.skeletons = draft.skeletons.filter((s) => s.id !== id);
      });
      if (get().activeSkeletonId === id) {
        const next = get().project.skeletons[0];
        set({ activeSkeletonId: next.id, activeBoneId: next.bones[0]?.id ?? null });
      }
    },

    renameSkeleton: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      get().commit("rename skeleton", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === id);
        if (skel) skel.name = trimmed;
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

    beginBoneDrag: (boneId, label) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const bone = skel?.bones.find((b) => b.id === boneId);
      if (!bone) return;
      set({ _dragSnapshot: { boneId, before: { ...bone } }, _dragLabel: label });
    },

    previewBoneDrag: (patch) => {
      const state = get();
      const snap = state._dragSnapshot;
      if (!snap) return;
      // Mutate live without history; commitBoneDrag pushes a single undo entry.
      set({
        project: produce(state.project, (draft) => {
          const skel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
          const bone = skel?.bones.find((b) => b.id === snap.boneId);
          if (bone) Object.assign(bone, patch);
        }),
      });
    },

    commitBoneDrag: () => {
      const state = get();
      const snap = state._dragSnapshot;
      const label = state._dragLabel;
      if (!snap || !label) return;
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const final = skel?.bones.find((b) => b.id === snap.boneId);
      if (!final) {
        set({ _dragSnapshot: undefined, _dragLabel: undefined });
        return;
      }
      const finalCopy = { ...final };
      // Rewind to snapshot, then commit the final state — produces one patch entry.
      set({
        project: produce(state.project, (draft) => {
          const dskel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
          const bone = dskel?.bones.find((b) => b.id === snap.boneId);
          if (bone) Object.assign(bone, snap.before);
        }),
      });
      get().commit(label, (draft) => {
        const dskel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
        const bone = dskel?.bones.find((b) => b.id === snap.boneId);
        if (bone) Object.assign(bone, finalCopy);
      });
      set({ _dragSnapshot: undefined, _dragLabel: undefined });
    },

    cancelBoneDrag: () => {
      const state = get();
      const snap = state._dragSnapshot;
      if (!snap) return;
      set({
        project: produce(state.project, (draft) => {
          const skel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
          const bone = skel?.bones.find((b) => b.id === snap.boneId);
          if (bone) Object.assign(bone, snap.before);
        }),
        _dragSnapshot: undefined,
        _dragLabel: undefined,
      });
    },
  };
});
