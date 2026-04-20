import { useProjectStore, type ToolId } from "../state/projectStore";

const TOOLS: { id: ToolId; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "V" },
  { id: "bone", label: "Bone", hint: "B" },
  { id: "mesh", label: "Mesh", hint: "M" },
  { id: "weights", label: "Weights", hint: "W" },
];

export function Toolbar() {
  const activeTool = useProjectStore((s) => s.activeTool);
  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  return (
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={activeTool === t.id ? "active" : ""}
          onClick={() => setActiveTool(t.id)}
          title={t.hint}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
