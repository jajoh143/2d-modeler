import { useProjectStore } from "../state/projectStore";

export function Timeline() {
  const animations = useProjectStore((s) => s.project.animations);
  const playhead = useProjectStore((s) => s.playheadTime);
  const setPlayhead = useProjectStore((s) => s.setPlayhead);

  const activeAnim = animations[0];
  const duration = activeAnim?.duration ?? 2;

  return (
    <div style={{ display: "grid", gridTemplateRows: "28px 1fr", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 8px",
          background: "var(--bg-2)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        <span>Timeline</span>
        <span>{activeAnim?.name ?? "no animation"}</span>
        <span style={{ flex: 1 }} />
        <span>{playhead.toFixed(2)}s / {duration.toFixed(2)}s</span>
      </div>
      <div style={{ padding: 8 }}>
        <input
          type="range"
          min={0}
          max={duration}
          step={1 / 60}
          value={playhead}
          onChange={(e) => setPlayhead(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ color: "var(--text-dim)", marginTop: 8 }}>
          Dopesheet + curve editor come in M7.
        </div>
      </div>
    </div>
  );
}
