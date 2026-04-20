import { useProjectStore } from "../state/projectStore";
import { Dopesheet } from "./Dopesheet";

export function Timeline() {
  const activeSkeletonId = useProjectStore((s) => s.activeSkeletonId);
  const animations = useProjectStore((s) =>
    s.project.animations.filter((a) => a.skeleton === activeSkeletonId),
  );
  const activeAnimationId = useProjectStore((s) => s.activeAnimationId);
  const activeAnim = animations.find((a) => a.id === activeAnimationId);

  const setActiveAnimation = useProjectStore((s) => s.setActiveAnimation);
  const addAnimation = useProjectStore((s) => s.addAnimation);
  const removeAnimation = useProjectStore((s) => s.removeAnimation);
  const renameAnimation = useProjectStore((s) => s.renameAnimation);
  const setDuration = useProjectStore((s) => s.setAnimationDuration);
  const setFps = useProjectStore((s) => s.setAnimationFps);

  const playhead = useProjectStore((s) => s.playheadTime);
  const setPlayhead = useProjectStore((s) => s.setPlayhead);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const togglePlaying = useProjectStore((s) => s.togglePlaying);
  const isLooping = useProjectStore((s) => s.isLooping);
  const setLooping = useProjectStore((s) => s.setLooping);
  const isRecording = useProjectStore((s) => s.isRecording);
  const setRecording = useProjectStore((s) => s.setRecording);
  const insertKeyAtPlayhead = useProjectStore((s) => s.insertKeyAtPlayhead);

  const duration = activeAnim?.duration ?? 2;
  const fps = activeAnim?.fps ?? 30;

  return (
    <div className="timeline-root">
      <div className="timeline-toolbar">
        <button
          className={`tl-btn ${isPlaying ? "active" : ""}`}
          onClick={togglePlaying}
          disabled={!activeAnim}
          title="Play / pause (Space)"
        >
          {isPlaying ? "❙❙" : "▶"}
        </button>
        <button
          className="tl-btn"
          onClick={() => setPlayhead(0)}
          disabled={!activeAnim}
          title="Go to start"
        >
          ⏮
        </button>
        <label className="tl-row">
          <input
            type="checkbox"
            checked={isLooping}
            onChange={(e) => setLooping(e.target.checked)}
          />
          <span>Loop</span>
        </label>

        <span className="tl-sep" />

        <select
          className="tl-select"
          value={activeAnimationId ?? ""}
          onChange={(e) => setActiveAnimation(e.target.value || null)}
        >
          <option value="">— no animation —</option>
          {animations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          className="tl-btn"
          onClick={() => addAnimation()}
          title="New animation"
        >
          +
        </button>
        <button
          className="tl-btn"
          disabled={!activeAnim}
          onClick={() => {
            if (!activeAnim) return;
            const n = window.prompt("Rename animation", activeAnim.name);
            if (n) renameAnimation(activeAnim.id, n);
          }}
          title="Rename animation"
        >
          ✎
        </button>
        <button
          className="tl-btn"
          disabled={!activeAnim}
          onClick={() => {
            if (!activeAnim) return;
            if (window.confirm(`Delete animation "${activeAnim.name}"?`)) {
              removeAnimation(activeAnim.id);
            }
          }}
          title="Delete animation"
        >
          ×
        </button>

        <span className="tl-sep" />

        <label className="tl-row">
          <span>Dur</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={duration}
            disabled={!activeAnim}
            onChange={(e) => {
              if (!activeAnim) return;
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) setDuration(activeAnim.id, v);
            }}
            style={{ width: 52 }}
          />
        </label>
        <label className="tl-row">
          <span>FPS</span>
          <input
            type="number"
            min={1}
            max={240}
            value={fps}
            disabled={!activeAnim}
            onChange={(e) => {
              if (!activeAnim) return;
              setFps(activeAnim.id, parseInt(e.target.value || "30", 10));
            }}
            style={{ width: 46 }}
          />
        </label>

        <span className="tl-sep" />

        <button
          className={`tl-btn ${isRecording ? "recording" : ""}`}
          onClick={() => setRecording(!isRecording)}
          disabled={!activeAnim}
          title="Record: auto-keyframe on bone edits"
        >
          ● Rec
        </button>
        <button
          className="tl-btn"
          onClick={insertKeyAtPlayhead}
          disabled={!activeAnim}
          title="Insert keyframes for selected bone at playhead (K)"
        >
          + Key
        </button>

        <span style={{ flex: 1 }} />

        <span className="tl-time">
          {playhead.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
      </div>

      <div className="timeline-body">
        {activeAnim ? (
          <Dopesheet animation={activeAnim} />
        ) : (
          <div className="timeline-empty">
            Create an animation to keyframe bones. The active animation plays back and
            drives the viewport pose.
          </div>
        )}
      </div>
    </div>
  );
}
