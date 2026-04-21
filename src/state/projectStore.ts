import { create } from "zustand";
import { produce, enablePatches, applyPatches, type Patch } from "immer";
import { nanoid } from "nanoid";
import type {
  Animation,
  Bone,
  Keyframe,
  MeshAttachment,
  Project,
  RegionAttachment,
  Skeleton,
  Track,
} from "../model/types";
import { emptyProject, createSkeleton } from "../model/factory";
import { resolveBoneWorld, worldToLocal } from "../model/skeletonMath";
import { resolvePose } from "../model/pose";
import { regionToMeshGeometry, captureVertexRest, normalizeWeights } from "../model/mesh";
import { upsertKeyframe, removeKeyframeAt as removeKf } from "../model/animationEval";
import { buildInstantiation } from "../library/instantiate";
import type { StockTemplate } from "../library/templates";

enablePatches();

interface BoneSnapshot {
  boneId: string;
  before: Bone;
}

interface MeshVertexSnapshot {
  slotId: string;
  attachmentName: string;
  vertexIndex: number;
  beforeX: number;
  beforeY: number;
}

export type ToolId = "select" | "bone" | "mesh" | "weights";

interface UndoEntry {
  redo: Patch[];
  undo: Patch[];
  label: string;
}

interface ProjectState {
  project: Project;
  /** Filesystem path of the last save/open, or null for unsaved projects. */
  currentPath: string | null;
  activeSkeletonId: string;
  activeSkinId: string;
  activeBoneId: string | null;
  activeSlotId: string | null;
  activeAnimationId: string | null;
  activeTool: ToolId;
  playheadTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  isRecording: boolean;
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
  /** Instantiate a stock template as a new skeleton and make it active. */
  instantiateTemplate: (template: StockTemplate) => string;

  /** Replace the entire project (used by Open / Restore autosave). */
  replaceProject: (project: Project, path?: string | null) => void;
  /** Mark the store as saved to `path`, clearing the history so future undos
   *  don't pop back past the save point. */
  markSaved: (path: string) => void;

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

  // Animation (M7).
  setActiveAnimation: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setLooping: (loop: boolean) => void;
  setRecording: (rec: boolean) => void;
  addAnimation: (name?: string) => string;
  removeAnimation: (id: string) => void;
  renameAnimation: (id: string, name: string) => void;
  setAnimationDuration: (id: string, duration: number) => void;
  setAnimationFps: (id: string, fps: number) => void;
  /** Insert/replace rotate+translate+scale keys at `time` for the given bone
   *  using the bone's current setup-pose values. Creates tracks as needed. */
  insertBoneKeyframesAt: (boneId: string, time: number) => void;
  removeKeyframeAt: (trackKind: Track["kind"], boneOrSlot: string, time: number) => void;
  /** Set current playhead as a keyframe for the active bone. */
  insertKeyAtPlayhead: () => void;

  // IK constraints (M6).
  addIkConstraint: (bones: string[], target: string) => string;
  removeIkConstraint: (id: string) => void;
  updateIkConstraint: (
    id: string,
    patch: Partial<{ name: string; bones: string[]; target: string; mix: number; bendPositive: boolean }>,
  ) => void;

  // Meshes (M5).
  convertSlotToMesh: (slotId: string, cols?: number, rows?: number) => void;
  setMeshResolution: (slotId: string, cols: number, rows: number) => void;
  updateMeshVertex: (slotId: string, vertexIndex: number, x: number, y: number) => void;
  bindVertexToBone: (slotId: string, vertexIndex: number, boneId: string) => void;
  bindMeshToBone: (slotId: string, boneId: string) => void;

  beginMeshVertexDrag: (slotId: string, vertexIndex: number) => void;
  previewMeshVertexDrag: (x: number, y: number) => void;
  commitMeshVertexDrag: () => void;
  cancelMeshVertexDrag: () => void;
}

export const useProjectStore = create<
  ProjectState & {
    _dragSnapshot?: BoneSnapshot;
    _dragLabel?: string;
    _meshDragSnapshot?: MeshVertexSnapshot;
  }
>((set, get) => {
  const initial = emptyProject();
  return {
    project: initial,
    currentPath: null,
    activeSkeletonId: initial.skeletons[0].id,
    activeSkinId: initial.skeletons[0].skins[0].id,
    activeBoneId: initial.skeletons[0].bones[0].id,
    activeSlotId: null,
    activeAnimationId: null,
    activeTool: "select",
    playheadTime: 0,
    isPlaying: false,
    isLooping: true,
    isRecording: false,
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

    replaceProject: (project, path) => {
      const skel = project.skeletons[0];
      set({
        project,
        currentPath: path ?? null,
        activeSkeletonId: skel?.id ?? "",
        activeSkinId: skel?.skins[0]?.id ?? "",
        activeBoneId: skel?.bones[0]?.id ?? null,
        activeSlotId: null,
        activeAnimationId: null,
        playheadTime: 0,
        isPlaying: false,
        isRecording: false,
        history: { past: [], future: [] },
      });
    },

    markSaved: (path) => {
      set({ currentPath: path });
    },

    instantiateTemplate: (template) => {
      const result = buildInstantiation(template);
      get().commit(`insert ${template.name}`, (draft) => {
        draft.assets.push(...result.assets);
        draft.skeletons.push(result.skeleton);
      });
      set({
        activeSkeletonId: result.skeleton.id,
        activeSkinId: result.skeleton.skins[0].id,
        activeBoneId: result.skeleton.bones[0]?.id ?? null,
        activeSlotId: null,
      });
      return result.skeleton.id;
    },

    updateBone: (boneId, patch) => {
      get().commit("update bone", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        const bone = skel?.bones.find((b) => b.id === boneId);
        if (!bone) return;
        Object.assign(bone, patch);
      });
      const s = get();
      if (s.isRecording && s.activeAnimationId) {
        s.insertBoneKeyframesAt(boneId, s.playheadTime);
      }
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
      const s = get();
      if (s.isRecording && s.activeAnimationId) {
        s.insertBoneKeyframesAt(snap.boneId, s.playheadTime);
      }
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

    setActiveAnimation: (id) => set({ activeAnimationId: id, playheadTime: 0 }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
    setLooping: (loop) => set({ isLooping: loop }),
    setRecording: (rec) => set({ isRecording: rec }),

    addAnimation: (name) => {
      const state = get();
      const skeletonId = state.activeSkeletonId;
      const existing = state.project.animations.filter((a) => a.skeleton === skeletonId);
      const baseName = name ?? `animation${existing.length + 1}`;
      const uniqueName = uniqueAnimationName(state.project.animations, baseName);
      const id = nanoid(8);
      get().commit("add animation", (draft) => {
        draft.animations.push({
          id,
          name: uniqueName,
          skeleton: skeletonId,
          duration: 2,
          fps: 30,
          tracks: [],
        });
      });
      set({ activeAnimationId: id, playheadTime: 0 });
      return id;
    },

    removeAnimation: (id) => {
      get().commit("remove animation", (draft) => {
        draft.animations = draft.animations.filter((a) => a.id !== id);
      });
      if (get().activeAnimationId === id) {
        set({ activeAnimationId: null, isPlaying: false, playheadTime: 0 });
      }
    },

    renameAnimation: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      get().commit("rename animation", (draft) => {
        const a = draft.animations.find((a) => a.id === id);
        if (a) a.name = trimmed;
      });
    },

    setAnimationDuration: (id, duration) => {
      const clamped = Math.max(0.01, duration);
      get().commit("set duration", (draft) => {
        const a = draft.animations.find((a) => a.id === id);
        if (a) a.duration = clamped;
      });
    },

    setAnimationFps: (id, fps) => {
      const clamped = Math.max(1, Math.min(240, Math.round(fps)));
      get().commit("set fps", (draft) => {
        const a = draft.animations.find((a) => a.id === id);
        if (a) a.fps = clamped;
      });
    },

    insertBoneKeyframesAt: (boneId, time) => {
      const state = get();
      const anim = state.activeAnimationId
        ? state.project.animations.find((a) => a.id === state.activeAnimationId)
        : undefined;
      if (!anim) return;
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const bone = skel?.bones.find((b) => b.id === boneId);
      if (!bone) return;
      const t = Math.max(0, Math.min(anim.duration, time));

      get().commit("insert keyframe", (draft) => {
        const a = draft.animations.find((a) => a.id === anim.id);
        if (!a) return;
        upsertKeyframe(ensureRotateKeys(a, boneId), t, bone.rotation);
        upsertKeyframe(ensureTranslateKeys(a, boneId), t, [bone.x, bone.y]);
        upsertKeyframe(ensureScaleKeys(a, boneId), t, [bone.scaleX, bone.scaleY]);
      });
    },

    removeKeyframeAt: (trackKind, boneOrSlot, time) => {
      const state = get();
      if (!state.activeAnimationId) return;
      get().commit("remove keyframe", (draft) => {
        const a = draft.animations.find((a) => a.id === state.activeAnimationId);
        if (!a) return;
        for (const track of a.tracks) {
          if (track.kind !== trackKind) continue;
          if (trackKind === "slotAttachment") {
            if (track.slot !== boneOrSlot) continue;
          } else if (track.bone !== boneOrSlot) {
            continue;
          }
          removeKf(track.keyframes, time);
          return;
        }
      });
    },

    insertKeyAtPlayhead: () => {
      const state = get();
      if (!state.activeBoneId) return;
      state.insertBoneKeyframesAt(state.activeBoneId, state.playheadTime);
    },

    addIkConstraint: (bones, target) => {
      if (bones.length === 0 || bones.length > 2) return "";
      const id = nanoid(8);
      const name = `ik${get().project.skeletons.find((s) => s.id === get().activeSkeletonId)?.ikConstraints.length ?? 0 + 1}`;
      get().commit("add IK constraint", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        if (!skel) return;
        skel.ikConstraints.push({
          id,
          name,
          bones: [...bones],
          target,
          mix: 1,
          bendPositive: true,
        });
      });
      return id;
    },

    removeIkConstraint: (id) => {
      get().commit("remove IK constraint", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        if (!skel) return;
        skel.ikConstraints = skel.ikConstraints.filter((c) => c.id !== id);
      });
    },

    updateIkConstraint: (id, patch) => {
      get().commit("update IK constraint", (draft) => {
        const skel = draft.skeletons.find((s) => s.id === get().activeSkeletonId);
        const c = skel?.ikConstraints.find((c) => c.id === id);
        if (!c) return;
        if (patch.name !== undefined) c.name = patch.name;
        if (patch.bones !== undefined) c.bones = [...patch.bones];
        if (patch.target !== undefined) c.target = patch.target;
        if (patch.mix !== undefined) c.mix = Math.max(0, Math.min(1, patch.mix));
        if (patch.bendPositive !== undefined) c.bendPositive = patch.bendPositive;
      });
    },

    convertSlotToMesh: (slotId, cols = 5, rows = 5) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const skin = skel?.skins.find((s) => s.id === state.activeSkinId);
      if (!skel || !skin) return;
      const slot = skel.slots.find((s) => s.id === slotId);
      if (!slot || !slot.attachment) return;
      const region = skin.attachments.find(
        (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "region",
      ) as RegionAttachment | undefined;
      if (!region) return;
      const asset = state.project.assets.find((a) => a.id === region.assetId);
      if (!asset) return;

      const geom = regionToMeshGeometry(region, asset, cols, rows);
      const vertexCount = geom.vertices.length / 2;
      // Default weights: empty array per vertex → skinner will pin to main bone.
      const weights: MeshAttachment["weights"] = Array.from({ length: vertexCount }, () => []);

      get().commit("convert to mesh", (draft) => {
        const dskel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
        const dskin = dskel?.skins.find((s) => s.id === state.activeSkinId);
        if (!dskin) return;
        const idx = dskin.attachments.findIndex(
          (a) => a.slot === slot.id && a.id === slot.attachment,
        );
        if (idx < 0) return;
        const mesh: MeshAttachment = {
          kind: "mesh",
          id: region.id,
          slot: region.slot,
          assetId: region.assetId,
          vertices: geom.vertices,
          uvs: geom.uvs,
          triangles: geom.triangles,
          weights,
        };
        dskin.attachments[idx] = mesh;
      });
    },

    setMeshResolution: (slotId, cols, rows) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const skin = skel?.skins.find((s) => s.id === state.activeSkinId);
      if (!skel || !skin) return;
      const slot = skel.slots.find((s) => s.id === slotId);
      if (!slot) return;
      const mesh = skin.attachments.find(
        (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
      ) as MeshAttachment | undefined;
      if (!mesh) return;
      const asset = state.project.assets.find((a) => a.id === mesh.assetId);
      if (!asset) return;
      // Regenerate from a synthesized region at identity (since mesh carries no
      // rotation/scale anchor beyond its vertex positions). This discards any
      // hand-edited vertex moves — acceptable for an explicit resolution change.
      const synthRegion: RegionAttachment = {
        kind: "region",
        id: mesh.id,
        slot: mesh.slot,
        assetId: mesh.assetId,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      const geom = regionToMeshGeometry(synthRegion, asset, cols, rows);
      const vertexCount = geom.vertices.length / 2;
      get().commit("set mesh resolution", (draft) => {
        const dskel = draft.skeletons.find((s) => s.id === state.activeSkeletonId);
        const dskin = dskel?.skins.find((s) => s.id === state.activeSkinId);
        const dmesh = dskin?.attachments.find(
          (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
        ) as MeshAttachment | undefined;
        if (!dmesh) return;
        dmesh.vertices = geom.vertices;
        dmesh.uvs = geom.uvs;
        dmesh.triangles = geom.triangles;
        dmesh.weights = Array.from({ length: vertexCount }, () => []);
      });
    },

    updateMeshVertex: (slotId, vertexIndex, x, y) => {
      get().commit("move vertex", (draft) => {
        const mesh = findMeshForSlot(draft, get().activeSkeletonId, get().activeSkinId, slotId);
        if (!mesh) return;
        if (vertexIndex * 2 + 1 >= mesh.vertices.length) return;
        mesh.vertices[vertexIndex * 2] = x;
        mesh.vertices[vertexIndex * 2 + 1] = y;
      });
    },

    bindVertexToBone: (slotId, vertexIndex, boneId) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const skin = skel?.skins.find((s) => s.id === state.activeSkinId);
      if (!skel || !skin) return;
      const slot = skel.slots.find((s) => s.id === slotId);
      if (!slot) return;
      const mesh = skin.attachments.find(
        (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
      ) as MeshAttachment | undefined;
      if (!mesh) return;
      const vx = mesh.vertices[vertexIndex * 2];
      const vy = mesh.vertices[vertexIndex * 2 + 1];
      const worlds = resolvePose(skel).worlds;
      const rest = captureVertexRest(skel, slot.bone, boneId, vx, vy, worlds);

      get().commit("bind vertex", (draft) => {
        const m = findMeshForSlot(draft, state.activeSkeletonId, state.activeSkinId, slotId);
        if (!m) return;
        m.weights[vertexIndex] = [{ bone: boneId, weight: 1, x: rest.x, y: rest.y }];
      });
    },

    bindMeshToBone: (slotId, boneId) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const skin = skel?.skins.find((s) => s.id === state.activeSkinId);
      if (!skel || !skin) return;
      const slot = skel.slots.find((s) => s.id === slotId);
      if (!slot) return;
      const mesh = skin.attachments.find(
        (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
      ) as MeshAttachment | undefined;
      if (!mesh) return;

      const worlds = resolvePose(skel).worlds;
      const rests: { x: number; y: number }[] = [];
      for (let i = 0; i < mesh.vertices.length; i += 2) {
        rests.push(
          captureVertexRest(skel, slot.bone, boneId, mesh.vertices[i], mesh.vertices[i + 1], worlds),
        );
      }

      get().commit("bind mesh to bone", (draft) => {
        const m = findMeshForSlot(draft, state.activeSkeletonId, state.activeSkinId, slotId);
        if (!m) return;
        m.weights = rests.map((r) => [{ bone: boneId, weight: 1, x: r.x, y: r.y }]);
      });
    },

    beginMeshVertexDrag: (slotId, vertexIndex) => {
      const state = get();
      const skel = state.project.skeletons.find((s) => s.id === state.activeSkeletonId);
      const skin = skel?.skins.find((s) => s.id === state.activeSkinId);
      const slot = skel?.slots.find((s) => s.id === slotId);
      if (!skel || !skin || !slot || !slot.attachment) return;
      const mesh = skin.attachments.find(
        (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
      ) as MeshAttachment | undefined;
      if (!mesh) return;
      if (vertexIndex * 2 + 1 >= mesh.vertices.length) return;
      set({
        _meshDragSnapshot: {
          slotId,
          attachmentName: slot.attachment,
          vertexIndex,
          beforeX: mesh.vertices[vertexIndex * 2],
          beforeY: mesh.vertices[vertexIndex * 2 + 1],
        },
      });
    },

    previewMeshVertexDrag: (x, y) => {
      const state = get();
      const snap = state._meshDragSnapshot;
      if (!snap) return;
      set({
        project: produce(state.project, (draft) => {
          const m = findMeshForSlot(draft, state.activeSkeletonId, state.activeSkinId, snap.slotId);
          if (!m) return;
          m.vertices[snap.vertexIndex * 2] = x;
          m.vertices[snap.vertexIndex * 2 + 1] = y;
        }),
      });
    },

    commitMeshVertexDrag: () => {
      const state = get();
      const snap = state._meshDragSnapshot;
      if (!snap) return;
      const m = findMeshForSlot(state.project, state.activeSkeletonId, state.activeSkinId, snap.slotId);
      if (!m) {
        set({ _meshDragSnapshot: undefined });
        return;
      }
      const finalX = m.vertices[snap.vertexIndex * 2];
      const finalY = m.vertices[snap.vertexIndex * 2 + 1];
      // Rewind to before, then commit final through the patch-based history.
      set({
        project: produce(state.project, (draft) => {
          const dm = findMeshForSlot(draft, state.activeSkeletonId, state.activeSkinId, snap.slotId);
          if (!dm) return;
          dm.vertices[snap.vertexIndex * 2] = snap.beforeX;
          dm.vertices[snap.vertexIndex * 2 + 1] = snap.beforeY;
        }),
      });
      get().commit("move vertex", (draft) => {
        const dm = findMeshForSlot(draft, state.activeSkeletonId, state.activeSkinId, snap.slotId);
        if (!dm) return;
        dm.vertices[snap.vertexIndex * 2] = finalX;
        dm.vertices[snap.vertexIndex * 2 + 1] = finalY;
      });
      set({ _meshDragSnapshot: undefined });
    },

    cancelMeshVertexDrag: () => {
      const state = get();
      const snap = state._meshDragSnapshot;
      if (!snap) return;
      set({
        project: produce(state.project, (draft) => {
          const m = findMeshForSlot(draft, state.activeSkeletonId, state.activeSkinId, snap.slotId);
          if (!m) return;
          m.vertices[snap.vertexIndex * 2] = snap.beforeX;
          m.vertices[snap.vertexIndex * 2 + 1] = snap.beforeY;
        }),
        _meshDragSnapshot: undefined,
      });
    },
  };
});

function ensureRotateKeys(animation: Animation, boneId: string): Keyframe<number>[] {
  for (const t of animation.tracks) {
    if (t.kind === "boneRotate" && t.bone === boneId) return t.keyframes;
  }
  const track: Track = { kind: "boneRotate", bone: boneId, keyframes: [] };
  animation.tracks.push(track);
  return (track as Extract<Track, { kind: "boneRotate" }>).keyframes;
}

function ensureTranslateKeys(
  animation: Animation,
  boneId: string,
): Keyframe<[number, number]>[] {
  for (const t of animation.tracks) {
    if (t.kind === "boneTranslate" && t.bone === boneId) return t.keyframes;
  }
  const track: Track = { kind: "boneTranslate", bone: boneId, keyframes: [] };
  animation.tracks.push(track);
  return (track as Extract<Track, { kind: "boneTranslate" }>).keyframes;
}

function ensureScaleKeys(
  animation: Animation,
  boneId: string,
): Keyframe<[number, number]>[] {
  for (const t of animation.tracks) {
    if (t.kind === "boneScale" && t.bone === boneId) return t.keyframes;
  }
  const track: Track = { kind: "boneScale", bone: boneId, keyframes: [] };
  animation.tracks.push(track);
  return (track as Extract<Track, { kind: "boneScale" }>).keyframes;
}

function uniqueAnimationName(animations: Animation[], base: string): string {
  const existing = new Set(animations.map((a) => a.name));
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${nanoid(4)}`;
}

function findMeshForSlot(
  project: Project,
  skeletonId: string,
  skinId: string,
  slotId: string,
): MeshAttachment | undefined {
  const skel = project.skeletons.find((s) => s.id === skeletonId);
  const skin = skel?.skins.find((s) => s.id === skinId);
  const slot = skel?.slots.find((s) => s.id === slotId);
  if (!slot || !slot.attachment || !skin) return undefined;
  const att = skin.attachments.find(
    (a) => a.slot === slot.id && a.id === slot.attachment && a.kind === "mesh",
  );
  return att as MeshAttachment | undefined;
}

// Reference to keep tree-shaking from dropping normalizeWeights until it's
// wired into the weights-paint tool in M5.1.
void normalizeWeights;

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

