import { create } from "zustand";
import { produce, enablePatches, applyPatches, type Patch } from "immer";
import { nanoid } from "nanoid";
import type { Project, Skeleton, Bone } from "../model/types";
import { emptyProject, createSkeleton } from "../model/factory";
import { resolveBoneWorld, worldToLocal } from "../model/skeletonMath";

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
  activeSkinId: string;
  activeBoneId: string | null;
  activeSlotId: string | null;
  activeTool: ToolId;
  playheadTime: number;
  history: { past: UndoEntry[]; future: UndoEntry[] };

  setActiveTool: (tool: ToolId) => void;
  setActiveBone: (id: string | null) => void;
  setActiveSkeleton: (id: string) => void;
  setActiveSkin: (id: string) => void;
  setActiveSlot: (id: string | null) => void;
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

  // Assets + slots + attachments + skins (M4).
  addAsset: (name: string, dataUrl: string, width: number, height: number) => string;
  removeAsset: (assetId: string) => void;
  addSlotWithAttachment: (
    boneId: string,
    assetId: string,
    worldX: number,
    worldY: number,
  ) => void;
  moveSlotDrawOrder: (slotId: string, delta: number) => void;
  setSlotAttachment: (slotId: string, attachmentName: string | null) => void;
  addSkin: (name?: string) => string;
  removeSkin: (id: string) => void;
  renameSkin: (id: string, name: string) => void;
}

export const useProjectStore = create<
  ProjectState & { _dragSnapshot?: BoneSnapshot; _dragLabel?: string }
>((set, get) => {
  const initial = emptyProject();
  return {
    project: initial,
    activeSkeletonId: initial.skeletons[0].id,
    activeSkinId: initial.skeletons[0].skins[0].id,
    activeBoneId: initial.skeletons[0].bones[0].id,
    activeSlotId: null,
    activeTool: "select",
    playheadTime: 0,
    history: { past: [], future: [] },

    setActiveTool: (tool) => set({ activeTool: tool }),
    setActiveBone: (id) => set({ activeBoneId: id }),
    setActiveSkeleton: (id) => {
      const skel = get().project.skeletons.find((s) => s.id === id);
      if (!skel) return;
      set({
        activeSkeletonId: id,
        activeBoneId: skel.bones[0]?.id ?? null,
        activeSkinId: skel.skins[0]?.id ?? "",
        activeSlotId: null,
      });
    },
    setActiveSkin: (id) => {
      const skel = get().project.skeletons.find((s) => s.id === get().activeSkeletonId);
      if (skel?.skins.some((s) => s.id === id)) set({ activeSkinId: id });
    },
    setActiveSlot: (id) => set({ activeSlotId: id }),
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

    addAsset: (name, dataUrl, width, height) => {
      const id = nanoid(8);
      get().commit("import asset", (draft) => {
        draft.assets.push({ id, path: dataUrl, name, width, height });
      });
      return id;
    },

    removeAsset: (assetId) => {
      get().commit("remove asset", (draft) => {
        draft.assets = draft.assets.filter((a) => a.id !== assetId);
        for (const skel of draft.skeletons) {
          for (const skin of skel.skins) {
            skin.attachments = skin.attachments.filter(
              (att) => !("assetId" in att) || att.assetId !== assetId,
            );
          }
        }
      });
    },

    addSlotWithAttachment: (boneId, assetId, worldX, worldY) => {
      const state = get();
      const skelBefore = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      if (!skelBefore) return;
      const asset = state.project.assets.find((a) => a.id === assetId);
      if (!asset) return;
      const bone = skelBefore.bones.find((b) => b.id === boneId);
      if (!bone) return;

      // Convert world drop point to bone-local offset; attachment (x, y) is
      // stored in the slot's bone-local space.
      const worlds = resolveBoneWorld(skelBefore);
      const boneWorld = worlds.get(bone.id) ?? null;
      const local = worldToLocal(boneWorld, worldX, worldY);

      const baseName = sanitizeName(asset.name.replace(/\.[^.]+$/, ""));
      const slotName = uniqueSlotName(skelBefore, baseName);
      const attachmentName = slotName;
      const slotId = nanoid(8);

      get().commit("add slot + attachment", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
        if (!skel) return;
        const drawOrder = skel.slots.length;
        skel.slots.push({
          id: slotId,
          name: slotName,
          bone: boneId,
          drawOrder,
          attachment: attachmentName,
        });
        const skin = skel.skins.find((s) => s.id === state.activeSkinId) ?? skel.skins[0];
        if (!skin) return;
        skin.attachments.push({
          kind: "region",
          id: attachmentName,
          slot: slotId,
          assetId,
          x: local.x,
          y: local.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });
      });
      set({ activeSlotId: slotId });
    },

    moveSlotDrawOrder: (slotId, delta) => {
      get().commit("reorder slot", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        if (!skel) return;
        // Sort by current drawOrder, then renumber after swap so ties resolve.
        const sorted = [...skel.slots].sort((a, b) => a.drawOrder - b.drawOrder);
        const idx = sorted.findIndex((s) => s.id === slotId);
        if (idx < 0) return;
        const newIdx = Math.max(0, Math.min(sorted.length - 1, idx + delta));
        if (newIdx === idx) return;
        const [moved] = sorted.splice(idx, 1);
        sorted.splice(newIdx, 0, moved);
        for (let i = 0; i < sorted.length; i++) {
          const slot = skel.slots.find((s) => s.id === sorted[i].id);
          if (slot) slot.drawOrder = i;
        }
      });
    },

    setSlotAttachment: (slotId, attachmentName) => {
      get().commit("set slot attachment", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        const slot = skel?.slots.find((s) => s.id === slotId);
        if (slot) slot.attachment = attachmentName;
      });
    },

    addSkin: (name) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      if (!skel) return "";
      const skinName = uniqueSkinName(skel, name ?? "skin");
      const id = nanoid(8);
      // Clone attachments from the current default/active skin so the new skin
      // renders identically until edited.
      const source = skel.skins.find((s) => s.id === state.activeSkinId) ?? skel.skins[0];
      const clonedAttachments = source ? source.attachments.map((a) => ({ ...a })) : [];
      get().commit("add skin", (draft) => {
        const dskel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
        if (!dskel) return;
        dskel.skins.push({ id, name: skinName, attachments: clonedAttachments });
      });
      set({ activeSkinId: id });
      return id;
    },

    removeSkin: (id) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      if (!skel) return;
      if (skel.skins.length <= 1) return;
      get().commit("remove skin", (draft) => {
        const dskel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
        if (!dskel) return;
        dskel.skins = dskel.skins.filter((s) => s.id !== id);
      });
      if (get().activeSkinId === id) {
        const next = get().project.skeletons.find((s) => s.id === state.activeSkeletonId)?.skins[0];
        if (next) set({ activeSkinId: next.id });
      }
    },

    renameSkin: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      get().commit("rename skin", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        const skin = skel?.skins.find((s) => s.id === id);
        if (skin) skin.name = trimmed;
      });
    },
  };
});

function sanitizeName(s: string): string {
  const cleaned = s.replace(/[^\w.-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "slot";
}

function uniqueSlotName(skel: Skeleton, base: string): string {
  const existing = new Set(skel.slots.map((s) => s.name));
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${nanoid(4)}`;
}

function uniqueSkinName(skel: Skeleton, base: string): string {
  const existing = new Set(skel.skins.map((s) => s.name));
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${nanoid(4)}`;
}

