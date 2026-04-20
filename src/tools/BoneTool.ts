/**
 * Bone tool — click-drag on the viewport creates a new bone parented to the
 * currently selected bone. This file will be wired into PixiViewport input
 * handling once the M3 transform gizmos land; right now it's the interface.
 */

import { useProjectStore } from "../state/projectStore";

export interface BoneDrag {
  startX: number;
  startY: number;
}

export function beginBoneDrag(worldX: number, worldY: number): BoneDrag {
  return { startX: worldX, startY: worldY };
}

export function commitBoneDrag(drag: BoneDrag, worldX: number, worldY: number) {
  const dx = worldX - drag.startX;
  const dy = worldY - drag.startY;
  const length = Math.hypot(dx, dy);
  if (length < 2) return;

  const state = useProjectStore.getState();
  const parentId = state.activeBoneId ?? state.project.skeletons[0].bones[0].id;
  state.addBone(parentId, drag.startX, drag.startY, length);
}
