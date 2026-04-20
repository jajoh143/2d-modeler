import { useRef } from "react";
import { useProjectStore } from "../state/projectStore";

export const ASSET_DRAG_MIME = "application/x-2dm-asset";

export function AssetBrowser() {
  const assets = useProjectStore((s) => s.project.assets);
  const addAsset = useProjectStore((s) => s.addAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const importFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readAsDataUrl(file);
      const { width, height } = await imageSize(dataUrl);
      addAsset(file.name, dataUrl, width, height);
    }
  };

  return (
    <section
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault();
          void importFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="panel-header">
        <span>Assets</span>
        <button
          className="panel-header-action"
          onClick={() => fileInput.current?.click()}
          title="Import PNG files"
        >
          Import…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="panel-body">
        {assets.length === 0 && (
          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
            Drop PNGs here or click Import.
            <br />
            Drag a thumbnail onto the viewport to attach it to the selected bone.
          </div>
        )}
        <div className="asset-grid">
          {assets.map((a) => (
            <div
              key={a.id}
              className="asset-thumb"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(ASSET_DRAG_MIME, a.id);
                e.dataTransfer.setData("text/plain", a.name);
                e.dataTransfer.effectAllowed = "copy";
              }}
              title={`${a.name} (${a.width}×${a.height})`}
            >
              <img src={a.path} alt={a.name} />
              <div className="asset-thumb-name">{a.name}</div>
              <button
                className="asset-thumb-remove"
                onClick={() => {
                  if (window.confirm(`Remove asset "${a.name}"?`)) removeAsset(a.id);
                }}
                title="Remove asset"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = src;
  });
}
