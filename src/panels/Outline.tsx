import { useProjectStore } from "../state/projectStore";
import type { Bone } from "../model/types";

export function Outline() {
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const activeBoneId = useProjectStore((s) => s.activeBoneId);
  const setActiveBone = useProjectStore((s) => s.setActiveBone);

  if (!skeleton) return <section><div className="panel-header">Outline</div></section>;

  const roots = skeleton.bones.filter((b) => !b.parent);
  const childrenOf = (id: string) => skeleton.bones.filter((b) => b.parent === id);

  const renderBone = (bone: Bone, depth: number) => (
    <div key={bone.id}>
      <div
        style={{
          paddingLeft: 8 + depth * 14,
          paddingTop: 3,
          paddingBottom: 3,
          cursor: "pointer",
          background: activeBoneId === bone.id ? "var(--accent-soft)" : "transparent",
        }}
        onClick={() => setActiveBone(bone.id)}
      >
        {bone.name}
      </div>
      {childrenOf(bone.id).map((c) => renderBone(c, depth + 1))}
    </div>
  );

  return (
    <section>
      <div className="panel-header">Outline</div>
      <div className="panel-body" style={{ padding: 0 }}>
        {roots.map((b) => renderBone(b, 0))}
      </div>
    </section>
  );
}
