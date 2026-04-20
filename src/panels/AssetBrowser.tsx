import { useProjectStore } from "../state/projectStore";

export function AssetBrowser() {
  const assets = useProjectStore((s) => s.project.assets);
  return (
    <section>
      <div className="panel-header">Assets</div>
      <div className="panel-body">
        {assets.length === 0 && (
          <div style={{ color: "var(--text-dim)" }}>
            Drop PNGs here to import. (Wired up in M4.)
          </div>
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {assets.map((a) => (
            <li key={a.id} style={{ padding: "3px 0" }}>
              {a.path} <span style={{ color: "var(--text-dim)" }}>({a.width}×{a.height})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
