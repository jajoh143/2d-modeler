import { useEffect } from "react";
import { useProjectStore } from "../state/projectStore";

/** Advances the playhead via requestAnimationFrame while isPlaying is true.
 *  Renders nothing; lives in the React tree purely for lifecycle management. */
export function PlaybackLoop() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      const state = useProjectStore.getState();
      if (state.isPlaying && state.activeAnimationId) {
        const anim = state.project.animations.find((a) => a.id === state.activeAnimationId);
        if (anim) {
          let t = state.playheadTime + dt;
          if (t > anim.duration) {
            if (state.isLooping) {
              t = anim.duration > 0 ? t % anim.duration : 0;
            } else {
              t = anim.duration;
              state.setPlaying(false);
            }
          }
          state.setPlayhead(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
