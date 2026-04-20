import { useProjectStore } from "../state/projectStore";
import type { Slot } from "../model/types";

export function SlotsPanel() {
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const activeSlotId = useProjectStore((s) => s.activeSlotId);
  const setActiveSlot = useProjectStore((s) => s.setActiveSlot);
  const moveSlot = useProjectStore((s) => s.moveSlotDrawOrder);
  const setAttachment = useProjectStore((s) => s.setSlotAttachment);

  const slots: Slot[] = (skeleton?.slots ?? [])
    .slice()
    .sort((a, b) => a.drawOrder - b.drawOrder);

  return (
    <section>
      <div className="panel-header">Slots (draw order: top = back)</div>
      <div className="panel-body" style={{ padding: 0 }}>
        {slots.length === 0 && (
          <div style={{ padding: 8, color: "var(--text-dim)", fontSize: 12 }}>
            No slots. Drop an asset on the viewport to attach it to the selected bone.
          </div>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {slots.map((slot) => {
            const active = slot.id === activeSlotId;
            return (
              <li
                key={slot.id}
                onClick={() => setActiveSlot(slot.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  cursor: "pointer",
                  background: active ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span>
                  {slot.name}
                  {slot.attachment === null && (
                    <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>(hidden)</span>
                  )}
                </span>
                <button
                  className="slot-btn"
                  title="Toggle attachment visibility"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachment(slot.id, slot.attachment ? null : slot.name);
                  }}
                >
                  {slot.attachment ? "◉" : "○"}
                </button>
                <button
                  className="slot-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSlot(slot.id, -1);
                  }}
                  title="Move up (draws behind)"
                >
                  ▲
                </button>
                <button
                  className="slot-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSlot(slot.id, 1);
                  }}
                  title="Move down (draws in front)"
                >
                  ▼
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
