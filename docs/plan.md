# 2D Modeler — Implementation Plan

See `/root/.claude/plans/i-want-you-to-wild-sloth.md` for the authoritative plan.
This file is a copy committed into the repo so it travels with the code.

## Context

The goal is a cross-platform (Windows + macOS) desktop application for authoring 2D game assets with a focus on humanoid characters and modern-world props (buildings, bars, chairs, desks). We are building a **skeletal rigging + keyframe animation tool** (Spine/DragonBones-style) in **Tauri 2 (Rust + web UI)** that exports **sprite sheets + JSON atlases** as its primary format.

### Why these choices

- **Skeletal**: bones, IK, mesh deform, and skins cover 95% of 2D character needs and extend cleanly to animated props (doors, chairs tipping, signs swinging).
- **Tauri 2**: ~28 MB RAM and sub-500 ms startup vs. Electron's 250+ MB; ships `.msi` (Win) and `.dmg` (Mac) out of the box; Rust backend is ideal for image processing (sprite packing, trimming) and file I/O; WebView frontend unlocks PixiJS for GPU-accelerated canvas work.
- **Sprite sheets + JSON**: universal baseline — consumable in Unity, Godot, Phaser, any 2D engine. Spine-compatible JSON export is a follow-on.
- **Modeling + animation in one app**: matches Spine/DragonBones scope; single source of truth is easier than a modeler plus a separate animator.

## Architecture

```
Tauri Shell
  Frontend: React + TS + Vite
    PixiJS viewport (WebGL canvas)
    Zustand store (project state, undo/redo via immer patches)
    Panels: outline, inspector, timeline, assets
    Tools: bone, mesh, weights, IK, skin
  Rust Backend (tauri commands)
    Project save/load (.2dm JSON bundle)
    Image import + trim (image crate)
    Sprite sheet packing (rectangle-pack crate)
    Export pipeline (atlas JSON writer)
```

## Data model

`Project` owns `assets`, `skeletons[]`, and `animations[]`. Each `Skeleton` owns `bones`, `slots`, `skins[]`, `ikConstraints[]`. Attachments are either `region` (whole image) or `mesh` (triangulated + per-vertex bone weights). Animation `tracks` are typed: `boneRotate`, `boneTranslate`, `boneScale`, `slotAttachment`. The schema is intentionally Spine-compatible-ish so that exporting to Spine JSON later is straightforward.

Source of truth: `src/model/types.ts` (TypeScript) mirrors `src-tauri/src/project.rs` (Rust).

## Milestones

- **M1** — project skeleton (this commit).
- **M2** — viewport pan/zoom/grid/rulers, multi-canvas tabs.
- **M3** — bone tool, transform gizmos, outline & inspector, undo/redo.
- **M4** — attachments, slots, skin manager.
- **M5** — mesh tool, weights tool, skinning worker.
- **M6** — 1-bone and 2-bone IK constraints.
- **M7** — dopesheet, curve editor, onion skinning, playback.
- **M8** — stock humanoid + ~30 modern-world prop templates.
- **M9** — sprite sheet export (maxrects pack + atlas JSON).
- **M10** — autosave, recents, shortcuts, crash reporter.

## Non-goals for v1

- No Spine-compatible JSON export (our own schema first; Spine export in v1.1).
- No physics (jiggle) or path constraints.
- No 3D / 2.5D features.
- No cloud sync or collaborative editing.
- No built-in drawing tools — users bring PNGs.
