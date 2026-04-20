import { useProjectStore } from "../state/projectStore";

export function Inspector() {
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const activeBoneId = useProjectStore((s) => s.activeBoneId);
  const updateBone = useProjectStore((s) => s.updateBone);

  const bone = skeleton?.bones.find((b) => b.id === activeBoneId);

  return (
    <section>
      <div className="panel-header">Inspector</div>
      <div className="panel-body">
        {!bone && <div style={{ color: "var(--text-dim)" }}>Select a bone to edit.</div>}
        {bone && (
          <div style={{ display: "grid", gap: 6 }}>
            <Field label="Name">
              <input
                type="text"
                value={bone.name}
                onChange={(e) => updateBone(bone.id, { name: e.target.value })}
              />
            </Field>
            <NumericField
              label="X"
              value={bone.x}
              onChange={(v) => updateBone(bone.id, { x: v })}
            />
            <NumericField
              label="Y"
              value={bone.y}
              onChange={(v) => updateBone(bone.id, { y: v })}
            />
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
        )}
      </div>
    </section>
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
