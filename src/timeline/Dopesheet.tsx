import { useMemo, useRef } from "react";
import { useProjectStore } from "../state/projectStore";
import type { Animation, Track } from "../model/types";

const ROW_LABEL_WIDTH = 140;
const ROW_HEIGHT = 18;
const KEY_RADIUS = 4;

interface DopesheetRow {
  trackIndex: number;
  label: string;
  track: Track;
}

export function Dopesheet({ animation }: { animation: Animation }) {
  const skeleton = useProjectStore((s) =>
    s.project.skeletons.find((sk) => sk.id === s.activeSkeletonId),
  );
  const playhead = useProjectStore((s) => s.playheadTime);
  const setPlayhead = useProjectStore((s) => s.setPlayhead);
  const removeKeyframe = useProjectStore((s) => s.removeKeyframeAt);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rows: DopesheetRow[] = useMemo(() => {
    if (!skeleton) return [];
    const boneName = new Map(skeleton.bones.map((b) => [b.id, b.name]));
    const slotName = new Map(skeleton.slots.map((s) => [s.id, s.name]));
    const out: DopesheetRow[] = [];
    animation.tracks.forEach((track, i) => {
      if (track.kind === "slotAttachment") {
        out.push({
          trackIndex: i,
          label: `${slotName.get(track.slot) ?? "?"} · attachment`,
          track,
        });
      } else {
        const shortKind =
          track.kind === "boneRotate"
            ? "rot"
            : track.kind === "boneTranslate"
              ? "trans"
              : "scale";
        out.push({
          trackIndex: i,
          label: `${boneName.get(track.bone) ?? "?"} · ${shortKind}`,
          track,
        });
      }
    });
    // Group by bone/slot id so related tracks appear together.
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [animation, skeleton]);

  const duration = Math.max(0.01, animation.duration);

  const timeFromX = (px: number, trackWidth: number) => {
    return Math.max(0, Math.min(duration, (px / trackWidth) * duration));
  };

  return (
    <div className="dopesheet">
      <div className="dopesheet-header">
        <div className="dopesheet-row-label" style={{ width: ROW_LABEL_WIDTH }}>
          Tracks
        </div>
        <TimeRuler duration={duration} playhead={playhead} onScrub={setPlayhead} />
      </div>
      <div className="dopesheet-scroll" ref={scrollRef}>
        <div style={{ position: "relative" }}>
          {rows.length === 0 && (
            <div className="dopesheet-empty">
              No keyframes yet. Select a bone, enable Rec, and move it — or use +Key
              at the current playhead.
            </div>
          )}
          {rows.map((row) => (
            <DopesheetRowView
              key={row.trackIndex}
              row={row}
              duration={duration}
              playhead={playhead}
              onScrub={(e, trackWidth) => setPlayhead(timeFromX(e, trackWidth))}
              onRemoveKey={(time) => {
                const target =
                  row.track.kind === "slotAttachment" ? row.track.slot : row.track.bone;
                removeKeyframe(row.track.kind, target, time);
              }}
            />
          ))}
          {/* Playhead line, spans all rows. */}
          <PlayheadLine
            duration={duration}
            playhead={playhead}
            rowCount={rows.length}
          />
        </div>
      </div>
    </div>
  );
}

function TimeRuler({
  duration,
  playhead,
  onScrub,
}: {
  duration: number;
  playhead: number;
  onScrub: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handle = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    onScrub(Math.max(0, Math.min(duration, pct * duration)));
  };

  // Tick positions: major every 0.5s, minor every 0.1s up to ~20 major/row.
  const majorStep = pickMajorStep(duration);
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-4; t += majorStep) ticks.push(t);

  return (
    <div
      ref={ref}
      className="dopesheet-ruler"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        handle(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons) handle(e.clientX);
      }}
    >
      {ticks.map((t) => (
        <div
          key={t}
          className="dopesheet-tick"
          style={{ left: `${(t / duration) * 100}%` }}
        >
          <span>{t.toFixed(1)}</span>
        </div>
      ))}
      <div
        className="dopesheet-playhead-marker"
        style={{ left: `${(playhead / duration) * 100}%` }}
      />
    </div>
  );
}

function pickMajorStep(duration: number): number {
  const target = duration / 10;
  const candidates = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  for (const c of candidates) if (c >= target) return c;
  return 10;
}

function DopesheetRowView({
  row,
  duration,
  onScrub,
  onRemoveKey,
}: {
  row: DopesheetRow;
  duration: number;
  playhead: number;
  onScrub: (pxFromLeft: number, trackWidth: number) => void;
  onRemoveKey: (time: number) => void;
}) {
  const lanes = useRef<HTMLDivElement | null>(null);
  return (
    <div className="dopesheet-row" style={{ height: ROW_HEIGHT }}>
      <div className="dopesheet-row-label" style={{ width: ROW_LABEL_WIDTH }}>
        {row.label}
      </div>
      <div
        ref={lanes}
        className="dopesheet-row-lane"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onScrub(e.clientX - rect.left, rect.width);
        }}
      >
        {row.track.keyframes.map((k) => (
          <div
            key={k.time}
            className="dopesheet-key"
            style={{
              left: `${(k.time / duration) * 100}%`,
              width: KEY_RADIUS * 2,
              height: KEY_RADIUS * 2,
              marginLeft: -KEY_RADIUS,
              marginTop: -KEY_RADIUS,
              top: "50%",
            }}
            title={`t=${k.time.toFixed(3)}  (right-click to delete)`}
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemoveKey(k.time);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PlayheadLine({
  duration,
  playhead,
  rowCount,
}: {
  duration: number;
  playhead: number;
  rowCount: number;
}) {
  if (rowCount === 0) return null;
  return (
    <div
      className="dopesheet-playhead-line"
      style={{
        left: `calc(${ROW_LABEL_WIDTH}px + (100% - ${ROW_LABEL_WIDTH}px) * ${
          playhead / duration
        })`,
        height: rowCount * ROW_HEIGHT,
      }}
    />
  );
}
