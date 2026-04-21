import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../state/projectStore";
import {
  openProject,
  openProjectAt,
  readRecents,
  saveProject,
  saveProjectAs,
  type RecentEntry,
} from "../persistence";

interface Props {
  onExport: () => void;
  onShortcuts: () => void;
}

export function MenuBar({ onExport, onShortcuts }: Props) {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const currentPath = useProjectStore((s) => s.currentPath);

  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Refresh recents whenever the dropdown opens so newly-saved files appear.
    if (recentsOpen) {
      void readRecents().then(setRecents);
    }
  }, [recentsOpen]);

  useEffect(() => {
    if (!recentsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setRecentsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [recentsOpen]);

  return (
    <div className="menu-bar" ref={rootRef}>
      <span className="title">2D Modeler</span>
      <span>—</span>
      <span>{projectName}</span>
      {currentPath && <span className="menu-path">{basename(currentPath)}</span>}
      <span style={{ flex: 1 }} />
      <button onClick={() => void saveProject()} title="Save (Cmd/Ctrl+S)">
        Save
      </button>
      <button onClick={() => void saveProjectAs()} title="Save As (Cmd/Ctrl+Shift+S)">
        Save As…
      </button>
      <button onClick={() => void openProject()} title="Open (Cmd/Ctrl+O)">
        Open…
      </button>
      <div className="menu-dropdown">
        <button
          onClick={() => setRecentsOpen((v) => !v)}
          title="Recent files"
          aria-haspopup="menu"
          aria-expanded={recentsOpen}
        >
          Recent ▾
        </button>
        {recentsOpen && (
          <div className="menu-dropdown-panel">
            {recents.length === 0 && <div className="menu-empty">No recent files</div>}
            {recents.map((r) => (
              <button
                key={r.path}
                className="menu-dropdown-item"
                onClick={() => {
                  setRecentsOpen(false);
                  void openProjectAt(r.path);
                }}
                title={r.path}
              >
                <span className="menu-item-name">{r.name || basename(r.path)}</span>
                <span className="menu-item-path">{basename(r.path)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onExport} title="Export sprite sheet + JSON atlas">
        Export…
      </button>
      <span className="tl-sep" />
      <button onClick={undo} title="Undo (Cmd/Ctrl+Z)">
        Undo
      </button>
      <button onClick={redo} title="Redo (Cmd/Ctrl+Shift+Z)">
        Redo
      </button>
      <button onClick={onShortcuts} title="Keyboard shortcuts">
        ?
      </button>
    </div>
  );
}

function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
