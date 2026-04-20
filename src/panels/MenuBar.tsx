import { useProjectStore } from "../state/projectStore";

export function MenuBar() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const projectName = useProjectStore((s) => s.project.meta.name);

  return (
    <div className="menu-bar">
      <span className="title">2D Modeler</span>
      <span>—</span>
      <span>{projectName}</span>
      <span style={{ flex: 1 }} />
      <button onClick={undo} title="Ctrl+Z">Undo</button>
      <button onClick={redo} title="Ctrl+Shift+Z">Redo</button>
    </div>
  );
}
