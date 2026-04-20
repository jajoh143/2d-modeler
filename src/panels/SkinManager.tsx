import { useProjectStore } from "../state/projectStore";

export function SkinManager() {
  const skins = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId)?.skins ?? [],
  );
  const activeSkinId = useProjectStore((s) => s.activeSkinId);
  const setActiveSkin = useProjectStore((s) => s.setActiveSkin);
  const addSkin = useProjectStore((s) => s.addSkin);
  const removeSkin = useProjectStore((s) => s.removeSkin);
  const renameSkin = useProjectStore((s) => s.renameSkin);

  return (
    <div className="skin-bar">
      {skins.map((s) => (
        <div
          key={s.id}
          className={`skin-chip${s.id === activeSkinId ? " active" : ""}`}
          onClick={() => setActiveSkin(s.id)}
          onDoubleClick={() => {
            const n = window.prompt("Rename skin", s.name);
            if (n) renameSkin(s.id, n);
          }}
          title="Double-click to rename"
        >
          <span>{s.name}</span>
          {skins.length > 1 && s.name !== "default" && (
            <button
              className="skin-chip-close"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete skin "${s.name}"?`)) removeSkin(s.id);
              }}
              title="Delete skin"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button className="skin-chip-add" onClick={() => addSkin()} title="Duplicate active skin">
        + skin
      </button>
    </div>
  );
}
