/**
 * Persistence helpers: save/open via Tauri dialog, autosave + recents files
 * stored in the app data directory.
 *
 * Two I/O paths are used:
 *   - User-initiated save/open → Rust commands (arbitrary filesystem paths).
 *   - Autosave + recents list → plugin-fs with BaseDirectory.AppData
 *     (sandboxed; no extra scope config needed).
 */

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Project } from "../model/types";
import { useProjectStore } from "../state/projectStore";
import { toast } from "../state/toastStore";

export const AUTOSAVE_FILE = "autosave.2dm";
export const RECENTS_FILE = "recents.json";
const MAX_RECENTS = 10;

export interface RecentEntry {
  path: string;
  name: string;
  savedAt: number;
}

/** Save the current project to an arbitrary path (Rust command). */
async function saveToPath(path: string, project: Project): Promise<void> {
  await invoke<void>("save_project", { path, project });
}

/** Load a project from an arbitrary path (Rust command). */
async function loadFromPath(path: string): Promise<Project> {
  return await invoke<Project>("load_project", { path });
}

export async function saveProject(): Promise<void> {
  const state = useProjectStore.getState();
  const path = state.currentPath;
  if (!path) {
    await saveProjectAs();
    return;
  }
  try {
    await saveToPath(path, state.project);
    state.markSaved(path);
    await touchRecent(path, state.project.meta.name);
    toast.success(`Saved ${basename(path)}`);
  } catch (err) {
    toast.error(`Save failed: ${err}`);
  }
}

export async function saveProjectAs(): Promise<void> {
  const state = useProjectStore.getState();
  const suggested = state.currentPath ?? `${state.project.meta.name || "project"}.2dm`;
  const path = await saveDialog({
    defaultPath: suggested,
    filters: [{ name: "2D Modeler Project", extensions: ["2dm", "json"] }],
  });
  if (!path) return;
  try {
    await saveToPath(path, state.project);
    state.markSaved(path);
    await touchRecent(path, state.project.meta.name);
    toast.success(`Saved ${basename(path)}`);
  } catch (err) {
    toast.error(`Save failed: ${err}`);
  }
}

export async function openProject(): Promise<void> {
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: "2D Modeler Project", extensions: ["2dm", "json"] }],
  });
  if (typeof picked !== "string") return;
  await openProjectAt(picked);
}

export async function openProjectAt(path: string): Promise<void> {
  try {
    const project = await loadFromPath(path);
    useProjectStore.getState().replaceProject(project, path);
    await touchRecent(path, project.meta.name);
    toast.success(`Opened ${basename(path)}`);
  } catch (err) {
    toast.error(`Open failed: ${err}`);
  }
}

// ──────────────────────────────────────────────────────────────────
// Autosave
// ──────────────────────────────────────────────────────────────────

async function ensureAppDataDir(): Promise<void> {
  // BaseDirectory.AppData resolves to the OS-appropriate location; mkdir is
  // idempotent via recursive=true.
  try {
    await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    /* may already exist; that's fine */
  }
}

export async function writeAutosave(project: Project): Promise<void> {
  await ensureAppDataDir();
  await writeTextFile(AUTOSAVE_FILE, JSON.stringify(project, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function readAutosave(): Promise<Project | null> {
  try {
    const has = await exists(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData });
    if (!has) return null;
    const text = await readTextFile(AUTOSAVE_FILE, { baseDir: BaseDirectory.AppData });
    return JSON.parse(text) as Project;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Recent files
// ──────────────────────────────────────────────────────────────────

export async function readRecents(): Promise<RecentEntry[]> {
  try {
    const has = await exists(RECENTS_FILE, { baseDir: BaseDirectory.AppData });
    if (!has) return [];
    const text = await readTextFile(RECENTS_FILE, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeRecents(entries: RecentEntry[]): Promise<void> {
  await ensureAppDataDir();
  await writeTextFile(RECENTS_FILE, JSON.stringify(entries, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function touchRecent(path: string, name: string): Promise<void> {
  const current = await readRecents();
  const without = current.filter((r) => r.path !== path);
  const next: RecentEntry[] = [{ path, name, savedAt: Date.now() }, ...without].slice(
    0,
    MAX_RECENTS,
  );
  await writeRecents(next);
}

function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
