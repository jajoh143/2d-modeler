interface Shortcut {
  keys: string;
  description: string;
}

interface Group {
  title: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "File",
    items: [
      { keys: "Cmd/Ctrl + S", description: "Save project" },
      { keys: "Cmd/Ctrl + Shift + S", description: "Save as…" },
      { keys: "Cmd/Ctrl + O", description: "Open project…" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: "Cmd/Ctrl + Z", description: "Undo" },
      { keys: "Cmd/Ctrl + Shift + Z / Cmd+Y", description: "Redo" },
    ],
  },
  {
    title: "Tools",
    items: [
      { keys: "V", description: "Select tool" },
      { keys: "B", description: "Bone tool — drag to create a child bone" },
      { keys: "M", description: "Mesh tool — drag vertices to reshape" },
      { keys: "W", description: "Weights tool — click a vertex to bind to active bone" },
      { keys: "Backspace / Delete", description: "Delete the active bone (and descendants)" },
      { keys: "Esc", description: "Cancel in-flight drag / deselect" },
    ],
  },
  {
    title: "Viewport",
    items: [
      { keys: "Mouse wheel", description: "Zoom at cursor" },
      { keys: "Alt / ⌥ + drag", description: "Pan" },
      { keys: "Middle-mouse drag", description: "Pan" },
      { keys: "+ / -", description: "Zoom in / out around centre" },
      { keys: "Cmd/Ctrl + 0", description: "Reset camera" },
    ],
  },
  {
    title: "Animation",
    items: [
      { keys: "Space", description: "Play / pause (needs an active animation)" },
      { keys: "K", description: "Insert keyframes at playhead for selected bone" },
      { keys: "Right-click a key", description: "Delete the keyframe (in the dopesheet)" },
    ],
  },
];

export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <h3>Keyboard Shortcuts</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body shortcuts-body">
          {GROUPS.map((g) => (
            <div key={g.title} className="shortcut-group">
              <div className="shortcut-group-title">{g.title}</div>
              <table className="shortcut-table">
                <tbody>
                  {g.items.map((item, i) => (
                    <tr key={i}>
                      <td className="shortcut-keys">
                        <kbd>{item.keys}</kbd>
                      </td>
                      <td className="shortcut-desc">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="inspector-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
