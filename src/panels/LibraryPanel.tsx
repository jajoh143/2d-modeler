import { useState } from "react";
import { useProjectStore } from "../state/projectStore";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  STOCK_TEMPLATES,
  type Category,
  type StockTemplate,
} from "../library/templates";

export function LibraryPanel() {
  const instantiate = useProjectStore((s) => s.instantiateTemplate);
  const [openCats, setOpenCats] = useState<Set<Category>>(new Set(["humanoid"]));

  const toggle = (c: Category) => {
    const next = new Set(openCats);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setOpenCats(next);
  };

  const groups: Record<Category, StockTemplate[]> = {
    humanoid: [],
    furniture: [],
    bar: [],
    building: [],
    misc: [],
  };
  for (const t of STOCK_TEMPLATES) groups[t.category].push(t);

  return (
    <section>
      <div className="panel-header">
        <span>Library</span>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        {CATEGORY_ORDER.map((cat) => {
          const items = groups[cat];
          if (items.length === 0) return null;
          const open = openCats.has(cat);
          return (
            <div key={cat} className="library-group">
              <button className="library-group-header" onClick={() => toggle(cat)}>
                <span>{open ? "▾" : "▸"}</span>
                <span>{CATEGORY_LABEL[cat]}</span>
                <span className="library-count">{items.length}</span>
              </button>
              {open && (
                <ul className="library-list">
                  {items.map((t) => (
                    <li key={t.id} className="library-item">
                      <span className="library-item-name" title={t.id}>
                        {t.name}
                      </span>
                      <button
                        className="library-insert"
                        onClick={() => instantiate(t)}
                        title={`Insert ${t.name} as a new skeleton`}
                      >
                        Insert
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
