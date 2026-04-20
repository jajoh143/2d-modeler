import { Container, Graphics } from "pixi.js";
import type { Skeleton } from "../model/types";
import { resolveBoneWorld } from "../model/skeletonMath";

const BONE_LAYER = "bones";

export function renderSkeleton(world: Container, skeleton: Skeleton | undefined) {
  const existing = world.getChildByLabel(BONE_LAYER);
  if (existing) world.removeChild(existing);
  if (!skeleton) return;

  const layer = new Container();
  layer.label = BONE_LAYER;
  world.addChild(layer);

  const worldTransforms = resolveBoneWorld(skeleton);

  const g = new Graphics();
  for (const bone of skeleton.bones) {
    const wt = worldTransforms.get(bone.id);
    if (!wt) continue;
    const tipX = wt.x + Math.cos(wt.rotation) * bone.length * wt.scaleX;
    const tipY = wt.y + Math.sin(wt.rotation) * bone.length * wt.scaleX;

    g.moveTo(wt.x, wt.y).lineTo(tipX, tipY);
    g.setStrokeStyle({ width: 2, color: 0x5aa9ff, alpha: 0.9 });
    g.stroke();

    g.circle(wt.x, wt.y, 3).fill({ color: 0x5aa9ff });
  }
  layer.addChild(g);
}
