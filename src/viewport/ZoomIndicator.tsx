import { useViewportStore } from "../state/viewportStore";

export function ZoomIndicator() {
  const scale = useViewportStore((s) => s.scaleX);
  const pct = Math.round(scale * 100);
  return (
    <div
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        background: "rgba(34, 35, 42, 0.85)",
        color: "var(--text-dim)",
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
        pointerEvents: "none",
      }}
    >
      {pct}%
    </div>
  );
}
