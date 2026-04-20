import { useState } from "react";
import { useProjectStore } from "../state/projectStore";
import type { MeshAttachment } from "../model/types";

export function Inspector() {
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const activeBoneId = useProjectStore((s) => s.activeBoneId);
  const activeSlotId = useProjectStore((s) => s.activeSlotId);
  const activeSkinId = useProjectStore((s) => s.activeSkinId);
  const updateBone = useProjectStore((s) => s.updateBone);

  const bone = skeleton?.bones.find((b) => b.id === activeBoneId);
  const slot = skeleton?.slots.find((s) => s.id === activeSlotId);
  const skin = skeleton?.skins.find((s) => s.id === activeSkinId);
  const attachment = slot?.attachment
    ? skin?.attachments.find((a) => a.slot === slot.id && a.id === slot.attachment)
    : undefined;

  return (
    <section>
      <div className="panel-header">Inspector</div>
      <div className="panel-body">
        {bone && (
          <>
            <div className="inspector-section-title">Bone</div>
            <div style={{ display: "grid", gap: 6 }}>
              <Field label="Name">
                <input
                  type="text"
                  value={bone.name}
                  onChange={(e) => updateBone(bone.id, { name: e.target.value })}
                />
              </Field>
              <NumericField label="X" value={bone.x} onChange={(v) => updateBone(bone.id, { x: v })} />
              <NumericField label="Y" value={bone.y} onChange={(v) => updateBone(bone.id, { y: v })} />
              <NumericField
                label="Rotation (deg)"
                value={(bone.rotation * 180) / Math.PI}
                onChange={(v) => updateBone(bone.id, { rotation: (v * Math.PI) / 180 })}
              />
              <NumericField
                label="Length"
                value={bone.length}
                onChange={(v) => updateBone(bone.id, { length: v })}
              />
              <NumericField
                label="Scale X"
                value={bone.scaleX}
                onChange={(v) => updateBone(bone.id, { scaleX: v })}
                step={0.1}
              />
              <NumericField
                label="Scale Y"
                value={bone.scaleY}
                onChange={(v) => updateBone(bone.id, { scaleY: v })}
                step={0.1}
              />
            </div>
          </>
        )}

        {slot && (
          <>
            <div className="inspector-section-title" style={{ marginTop: 14 }}>
              Slot · {slot.name}
            </div>
            <SlotSection />
          </>
        )}

        {attachment?.kind === "mesh" && slot && (
          <MeshSection mesh={attachment as MeshAttachment} slotId={slot.id} />
        )}

        {!bone && !slot && (
          <div style={{ color: "var(--text-dim)" }}>Select a bone or slot to edit.</div>
        )}
      </div>
    </section>
  );
}

function SlotSection() {
  const convertToMesh = useProjectStore((s) => s.convertSlotToMesh);
  const activeSlotId = useProjectStore((s) => s.activeSlotId);
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const activeSkinId = useProjectStore((s) => s.activeSkinId);
  const slot = skeleton?.slots.find((s) => s.id === activeSlotId);
  const skin = skeleton?.skins.find((s) => s.id === activeSkinId);
  const attachment = slot?.attachment
    ? skin?.attachments.find((a) => a.slot === slot.id && a.id === slot.attachment)
    : undefined;

  if (!slot) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
        {attachment
          ? `Attachment: ${attachment.id} (${attachment.kind})`
          : "No attachment"}
      </div>
      {attachment?.kind === "region" && (
        <button className="inspector-btn" onClick={() => convertToMesh(slot.id, 5, 5)}>
          Convert to mesh (5×5 grid)
        </button>
      )}
    </div>
  );
}

function MeshSection({ mesh, slotId }: { mesh: MeshAttachment; slotId: string }) {
  const setMeshResolution = useProjectStore((s) => s.setMeshResolution);
  const bindMeshToBone = useProjectStore((s) => s.bindMeshToBone);
  const activeBoneId = useProjectStore((s) => s.activeBoneId);
  const activeBoneName = useProjectStore((s) => {
    const skel = s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId);
    return skel?.bones.find((b) => b.id === s.activeBoneId)?.name;
  });
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);

  const vertexCount = mesh.vertices.length / 2;
  const triangleCount = mesh.triangles.length / 3;

  return (
    <>
      <div className="inspector-section-title" style={{ marginTop: 14 }}>
        Mesh
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {vertexCount} vertices · {triangleCount} triangles
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 2, flex: 1 }}>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>Cols</span>
            <input
              type="number"
              min={2}
              max={50}
              value={cols}
              onChange={(e) => setCols(Math.max(2, parseInt(e.target.value || "2", 10)))}
            />
          </label>
          <label style={{ display: "grid", gap: 2, flex: 1 }}>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>Rows</span>
            <input
              type="number"
              min={2}
              max={50}
              value={rows}
              onChange={(e) => setRows(Math.max(2, parseInt(e.target.value || "2", 10)))}
            />
          </label>
          <button
            className="inspector-btn"
            onClick={() => setMeshResolution(slotId, cols, rows)}
            title="Rebuild the grid — discards manual vertex edits and weights"
          >
            Regen
          </button>
        </div>
        <button
          className="inspector-btn"
          disabled={!activeBoneId}
          onClick={() => {
            if (activeBoneId) bindMeshToBone(slotId, activeBoneId);
          }}
          title="Bind every vertex 100% to the selected bone"
        >
          Bind all to {activeBoneName ?? "…"}
        </button>
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          Weights tool (W): click a vertex to bind it to the selected bone.
          <br />
          Mesh tool (M): drag a vertex to reshape the rest pose.
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{label}</span>
      {children}
    </label>
  );
}

function NumericField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </Field>
  );
}
