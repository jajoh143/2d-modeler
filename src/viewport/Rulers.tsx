import { useViewportStore, niceStep } from "../state/viewportStore";

const RULER_SIZE = 22;

export function Rulers() {
  const { x, y, scaleX, scaleY, width, height } = useViewportStore();
  if (width === 0 || height === 0) return null;

  return (
    <>
      <div
        className="ruler ruler-corner"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      />
      <div
        className="ruler ruler-top"
        style={{ left: RULER_SIZE, height: RULER_SIZE, right: 0 }}
      >
        <RulerTicks axis="x" camOffset={x} camScale={scaleX} length={width} />
      </div>
      <div
        className="ruler ruler-left"
        style={{ top: RULER_SIZE, width: RULER_SIZE, bottom: 0 }}
      >
        <RulerTicks axis="y" camOffset={y} camScale={scaleY} length={height} />
      </div>
    </>
  );
}

function RulerTicks({
  axis,
  camOffset,
  camScale,
  length,
}: {
  axis: "x" | "y";
  camOffset: number;
  camScale: number;
  length: number;
}) {
  // The viewport's world origin sits at screen position camOffset (0..length range).
  // worldFromScreen(s) = (s - camOffset) / camScale
  const minor = niceStep(60 / camScale);
  const major = minor * 5;

  const startWorld = (0 - camOffset) / camScale;
  const endWorld = (length - camOffset) / camScale;

  const firstMajor = Math.ceil(startWorld / major) * major;
  const ticks: { worldVal: number; screen: number; label: string }[] = [];
  for (let v = firstMajor; v <= endWorld; v += major) {
    const screen = camOffset + v * camScale;
    if (screen < 0 || screen > length) continue;
    ticks.push({ worldVal: v, screen, label: formatTick(v) });
  }

  const minorTicks: number[] = [];
  const firstMinor = Math.ceil(startWorld / minor) * minor;
  for (let v = firstMinor; v <= endWorld; v += minor) {
    const screen = camOffset + v * camScale;
    if (screen < 0 || screen > length) continue;
    minorTicks.push(screen);
  }

  return (
    <>
      {minorTicks.map((s, i) =>
        axis === "x" ? (
          <span
            key={`m${i}`}
            className="ruler-tick-minor"
            style={{ left: s, top: RULER_SIZE - 4, height: 4 }}
          />
        ) : (
          <span
            key={`m${i}`}
            className="ruler-tick-minor"
            style={{ top: s, left: RULER_SIZE - 4, width: 4 }}
          />
        ),
      )}
      {ticks.map((t, i) =>
        axis === "x" ? (
          <div key={`t${i}`} className="ruler-major-x" style={{ left: t.screen }}>
            <span className="ruler-tick-major" />
            <span className="ruler-label">{t.label}</span>
          </div>
        ) : (
          <div key={`t${i}`} className="ruler-major-y" style={{ top: t.screen }}>
            <span className="ruler-tick-major" />
            <span className="ruler-label">{t.label}</span>
          </div>
        ),
      )}
    </>
  );
}

function formatTick(v: number): string {
  if (Math.abs(v) < 1e-6) return "0";
  if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

export const RULER_THICKNESS = RULER_SIZE;
