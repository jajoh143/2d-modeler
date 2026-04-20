import { useState } from "react";
import { useProjectStore } from "../state/projectStore";
import type { Bone } from "../model/types";

export function IkConstraintsPanel() {
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const add = useProjectStore((s) => s.addIkConstraint);
  const remove = useProjectStore((s) => s.removeIkConstraint);
  const update = useProjectStore((s) => s.updateIkConstraint);

  const bones: Bone[] = skeleton?.bones ?? [];
  const constraints = skeleton?.ikConstraints ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [bone1, setBone1] = useState<string>("");
  const [bone2, setBone2] = useState<string>("");
  const [target, setTarget] = useState<string>("");

  const canAdd = bone1 && target && bone1 !== target && bone2 !== target;

  const doAdd = () => {
    if (!canAdd) return;
    const chain = bone2 ? [bone1, bone2] : [bone1];
    add(chain, target);
    setShowAdd(false);
    setBone1("");
    setBone2("");
    setTarget("");
  };

  return (
    <section>
      <div className="panel-header">
        <span>IK Constraints</span>
        <button className="panel-header-action" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>
      <div className="panel-body">
        {showAdd && (
          <div className="ik-add-form">
            <BoneSelect label="Bone (or chain root)" value={bone1} onChange={setBone1} bones={bones} />
            <BoneSelect
              label="Child bone (2-bone IK only)"
              value={bone2}
              onChange={setBone2}
              bones={bones.filter((b) => !bone1 || b.parent === bone1)}
              allowEmpty
            />
            <BoneSelect label="Target" value={target} onChange={setTarget} bones={bones} />
            <button className="inspector-btn" onClick={doAdd} disabled={!canAdd}>
              Create
            </button>
          </div>
        )}

        {constraints.length === 0 && !showAdd && (
          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
            No IK constraints. Select bones → + Add. 2-bone IK requires the second bone
            to be a direct child of the first.
          </div>
        )}

        {constraints.map((c) => {
          const chainBones = c.bones
            .map((id) => bones.find((b) => b.id === id)?.name ?? "?")
            .join(" → ");
          const targetName = bones.find((b) => b.id === c.target)?.name ?? "?";
          return (
            <div key={c.id} className="ik-item">
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => update(c.id, { name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button
                  className="slot-btn"
                  onClick={() => {
                    if (window.confirm(`Delete IK "${c.name}"?`)) remove(c.id);
                  }}
                  title="Delete constraint"
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                {chainBones} → target {targetName}
              </div>
              <label className="ik-row">
                <span>Mix</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={c.mix}
                  onChange={(e) => update(c.id, { mix: parseFloat(e.target.value) })}
                />
                <span className="ik-value">{c.mix.toFixed(2)}</span>
              </label>
              {c.bones.length === 2 && (
                <label className="ik-row">
                  <input
                    type="checkbox"
                    checked={c.bendPositive}
                    onChange={(e) => update(c.id, { bendPositive: e.target.checked })}
                  />
                  <span>Bend positive</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BoneSelect({
  label,
  value,
  onChange,
  bones,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bones: Bone[];
  allowEmpty?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--bg-0)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          padding: "3px 6px",
          borderRadius: 3,
          fontSize: 12,
        }}
      >
        {allowEmpty && <option value="">(none)</option>}
        {!allowEmpty && !value && <option value="">— pick —</option>}
        {bones.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
