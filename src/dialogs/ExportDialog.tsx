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

interface ExportReport {
  atlasPath: string;
  jsonPath: string;
  atlasWidth: number;
  atlasHeight: number;
  entries: number;
  warnings: string[];
}

const AVAILABLE_SCALES: number[] = [1, 2, 4];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const [opts, setOpts] = useState<ExportOptions>({
    scales: [1],
    padding: 2,
    powerOfTwo: true,
    maxSize: 4096,
  });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ExportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleScale = (s: number) => {
    const next = opts.scales.includes(s)
      ? opts.scales.filter((x) => x !== s)
      : [...opts.scales, s].sort((a, b) => a - b);
    setOpts({ ...opts, scales: next.length ? next : [1] });
  };

  const run = async () => {
    setError(null);
    setReport(null);
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir !== "string") return;
    setBusy(true);
    try {
      const r = await invoke<ExportReport>("export_spritesheet", {
        project,
        outputDir: dir,
        options: opts,
      });
      setReport(r);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <h3>Export Sprite Sheet</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <div className="field-label">Scales</div>
            <div className="scale-row">
              {AVAILABLE_SCALES.map((s) => (
                <label key={s} className="chip">
                  <input
                    type="checkbox"
                    checked={opts.scales.includes(s)}
                    onChange={() => toggleScale(s)}
                  />
                  <span>{s}×</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Padding</span>
              <input
                type="number"
                min={0}
                max={32}
                value={opts.padding}
                onChange={(e) =>
                  setOpts({ ...opts, padding: Math.max(0, parseInt(e.target.value || "0", 10)) })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Max size</span>
              <input
                type="number"
                min={64}
                max={16384}
                step={64}
                value={opts.maxSize}
                onChange={(e) =>
                  setOpts({
                    ...opts,
                    maxSize: Math.max(64, parseInt(e.target.value || "4096", 10)),
                  })
                }
              />
            </label>
          </div>

          <label className="chip standalone">
            <input
              type="checkbox"
              checked={opts.powerOfTwo}
              onChange={(e) => setOpts({ ...opts, powerOfTwo: e.target.checked })}
            />
            <span>Power-of-two atlas dimensions</span>
          </label>

          <div className="modal-note">
            Writes <code>atlas.png</code> (+ <code>atlas@2x.png</code> etc. per scale) and{" "}
            <code>atlas.json</code> with skeletons, animations, and per-asset atlas rects to the
            chosen folder.
          </div>

          {error && <div className="modal-error">Error: {error}</div>}

          {report && (
            <div className="export-report">
              <div>
                <strong>{report.entries}</strong> assets packed into{" "}
                <strong>
                  {report.atlasWidth}×{report.atlasHeight}
                </strong>
                .
              </div>
              <div className="report-path">{report.atlasPath}</div>
              <div className="report-path">{report.jsonPath}</div>
              {report.warnings.length > 0 && (
                <ul className="report-warnings">
                  {report.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="inspector-btn" onClick={onClose}>
            Close
          </button>
          <button
            className="inspector-btn primary"
            onClick={run}
            disabled={busy || opts.scales.length === 0}
          >
            {busy ? "Exporting…" : "Choose folder & export…"}
          </button>
        </div>
      </div>
    </div>
  );
}
