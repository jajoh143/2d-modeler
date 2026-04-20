import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../state/projectStore";

interface ExportOptions {
  scales: number[];
  padding: number;
  powerOfTwo: boolean;
  maxSize: number;
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const [opts, setOpts] = useState<ExportOptions>({
    scales: [1],
    padding: 2,
    powerOfTwo: true,
    maxSize: 4096,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir !== "string") return;
    setBusy(true);
    try {
      const r = await invoke<{ atlasPath: string; jsonPath: string }>("export_spritesheet", {
        project,
        outputDir: dir,
        options: opts,
      });
      setResult(`Wrote ${r.atlasPath}`);
    } catch (err) {
      setResult(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 10, minWidth: 360 }}>
      <h3 style={{ margin: 0 }}>Export Sprite Sheet</h3>
      <label>
        Padding{" "}
        <input
          type="number"
          value={opts.padding}
          onChange={(e) => setOpts({ ...opts, padding: parseInt(e.target.value || "0", 10) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={opts.powerOfTwo}
          onChange={(e) => setOpts({ ...opts, powerOfTwo: e.target.checked })}
        />{" "}
        Power-of-two output
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={run} disabled={busy}>Choose folder & export</button>
        <button onClick={onClose}>Close</button>
      </div>
      {result && <div>{result}</div>}
    </div>
  );
}
