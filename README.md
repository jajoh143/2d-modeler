# 2D Modeler

Skeletal rigging + keyframe animation for 2D game assets. Cross-platform desktop app (Windows + macOS) built with Tauri 2 (Rust) and a React + PixiJS frontend.

Scope: humanoid characters and modern-world props (buildings, bars, chairs, desks, etc.), exported as sprite sheets + JSON atlases.

## Status

**Pre-alpha.** This is the initial scaffold covering milestone M1. The full 13-week milestone plan lives in `docs/plan.md` (see `/root/.claude/plans/i-want-you-to-wild-sloth.md` for the source).

## Stack

- **Shell**: Tauri 2 (ships `.msi` / `.dmg`)
- **Frontend**: React 18 + TypeScript + Vite
- **Renderer**: PixiJS 8 (WebGL canvas)
- **State**: Zustand + Immer (with patch-based undo/redo)
- **Rust deps**: `image` (raster), `rectangle-pack` (atlas packing), `serde`

## Development

Prerequisites: Rust stable, Node 20+, pnpm 9.

```bash
pnpm install
pnpm tauri:dev
```

On first run Tauri will fetch its Rust toolchain + compile the native shell (several minutes cold).

## Project layout

```
src/                     # React + PixiJS frontend
  viewport/              # PixiJS canvas
  model/                 # Data types, math, IK
  state/                 # Zustand store + undo/redo
  panels/                # Outline, Inspector, Asset browser, Toolbar, Menu
  timeline/              # Dopesheet + playback
  tools/                 # Bone/mesh/weights tool implementations
  library/               # Stock humanoid + props catalogue
  dialogs/               # Export, preferences
  workers/               # Off-thread skinning
src-tauri/               # Rust shell
  src/
    main.rs              # Tauri entry
    commands.rs          # invoke handlers (save/load/export)
    project.rs           # data types (mirrors src/model/types.ts)
    export/              # Sprite sheet export pipeline (stub in M1, real in M9)
resources/library/       # Stock templates and art (M8)
```

## Milestones

See `/root/.claude/plans/i-want-you-to-wild-sloth.md` for the full plan. Summary:

- **M1** — scaffolding (this commit)
- **M2** — viewport pan/zoom/grid
- **M3** — bone creation + transform gizmos
- **M4** — slots, attachments, skins
- **M5** — mesh + weights
- **M6** — 1-bone and 2-bone IK
- **M7** — timeline, dopesheet, onion skinning
- **M8** — stock humanoid + prop library
- **M9** — sprite sheet + JSON export
- **M10** — polish (autosave, recents, shortcuts)

## License

MIT.
