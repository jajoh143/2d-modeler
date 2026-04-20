import { useProjectStore } from "../state/projectStore";

export function SkeletonTabs() {
  const skeletons = useProjectStore((s) => s.project.skeletons);
  const activeId = useProjectStore((s) => s.activeSkeletonId);
  const setActive = useProjectStore((s) => s.setActiveSkeleton);
  const add = useProjectStore((s) => s.addSkeleton);
  const remove = useProjectStore((s) => s.removeSkeleton);
  const rename = useProjectStore((s) => s.renameSkeleton);

  return (
    <div className="skeleton-tabs">
      {skeletons.map((s) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            className={`skeleton-tab${active ? " active" : ""}`}
            onClick={() => setActive(s.id)}
            onDoubleClick={() => {
              const n = window.prompt("Rename skeleton", s.name);
              if (n) rename(s.id, n);
            }}
            title="Double-click to rename"
          >
            <span>{s.name}</span>
            {skeletons.length > 1 && (
              <button
                className="skeleton-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete skeleton "${s.name}"?`)) remove(s.id);
                }}
                title="Delete skeleton"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        className="skeleton-tab-add"
        onClick={() => add(`skeleton${skeletons.length + 1}`)}
        title="New skeleton"
      >
        +
      </button>
    </div>
  );
}
