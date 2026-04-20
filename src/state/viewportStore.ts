import { create } from "zustand";

/** Camera state mirrored from the PixiJS viewport so React panels (rulers,
 *  zoom indicator, etc.) can read it reactively. PixiViewport pushes updates;
 *  the store is read-only from the rest of the app. */
export interface ViewportState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  set: (next: Partial<ViewportState>) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  width: 0,
  height: 0,
  set: (next) => set(next),
}));

/** Round a target spacing up to a "nice" step (1, 2, 5 × 10^n).
 *  Used for grid spacing and ruler ticks. */
export function niceStep(target: number): number {
  if (target <= 0 || !Number.isFinite(target)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const norm = target / pow;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 7) nice = 5;
  else nice = 10;
  return nice * pow;
}
