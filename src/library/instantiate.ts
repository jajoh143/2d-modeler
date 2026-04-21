/**
 * Instantiate a stock template into the active project. Produces fresh
 * asset/bone/slot/attachment ids, rasterises part shapes, and commits the
 * whole set as a single undo entry.
 */

import { nanoid } from "nanoid";
import type {
  Asset,
  Project,
  RegionAttachment,
  Skeleton,
  Slot,
  Bone,
} from "../model/types";
import { renderShape } from "./shapeRenderer";
import type { StockTemplate } from "./templates";

export interface InstantiationResult {
  skeleton: Skeleton;
  assets: Asset[];
}

export function buildInstantiation(template: StockTemplate): InstantiationResult {
  // 1. Rasterise each unique shape into an asset. Shapes are rendered per
  //    part (no de-dup across parts of the same template — rare for it to
  //    matter and avoids awkward shape-equality checks).
  const assets: Asset[] = [];
  const assetByPartName = new Map<string, Asset>();
  for (const part of template.parts) {
    const rendered = renderShape(part.shape);
    const asset: Asset = {
      id: nanoid(8),
      name: `${template.id}.${part.name}`,
      path: rendered.dataUrl,
      width: rendered.width,
      height: rendered.height,
    };
    assets.push(asset);
    assetByPartName.set(part.name, asset);
  }

  // 2. Build bones; map template-name → new id for parent/slot lookups.
  const boneIdByName = new Map<string, string>();
  const bones: Bone[] = template.bones.map((tb) => {
    const id = nanoid(8);
    boneIdByName.set(tb.name, id);
    return {
      id,
      name: tb.name,
      parent: null, // filled in after all ids are assigned
      x: tb.x,
      y: tb.y,
      rotation: tb.rotation ?? 0,
      scaleX: tb.scaleX ?? 1,
      scaleY: tb.scaleY ?? 1,
      length: tb.length ?? 0,
    };
  });
  for (let i = 0; i < bones.length; i++) {
    const tb = template.bones[i];
    if (tb.parent) {
      const parentId = boneIdByName.get(tb.parent);
      if (!parentId) {
        throw new Error(`Template ${template.id}: bone "${tb.name}" references unknown parent "${tb.parent}"`);
      }
      bones[i].parent = parentId;
    }
  }

  // 3. Slots + attachments into the default skin.
  const slots: Slot[] = [];
  const attachments: RegionAttachment[] = [];
  for (const part of template.parts) {
    const boneId = boneIdByName.get(part.bone);
    const asset = assetByPartName.get(part.name);
    if (!boneId || !asset) {
      throw new Error(`Template ${template.id}: part "${part.name}" references unknown bone or asset`);
    }
    const slotId = nanoid(8);
    slots.push({
      id: slotId,
      name: part.name,
      bone: boneId,
      drawOrder: part.drawOrder,
      attachment: part.name,
    });
    attachments.push({
      kind: "region",
      id: part.name,
      slot: slotId,
      assetId: asset.id,
      x: part.x ?? 0,
      y: part.y ?? 0,
      rotation: part.rotation ?? 0,
      scaleX: part.scaleX ?? 1,
      scaleY: part.scaleY ?? 1,
    });
  }

  const skeleton: Skeleton = {
    id: nanoid(8),
    name: template.name,
    bones,
    slots,
    skins: [
      {
        id: nanoid(8),
        name: "default",
        attachments,
      },
    ],
    ikConstraints: [],
  };

  return { skeleton, assets };
}

/** Apply an instantiation result to a Project draft (for use inside an
 *  immer-based commit). Returns the new skeleton's id so the caller can
 *  set it as active. */
export function applyInstantiation(draft: Project, result: InstantiationResult): string {
  draft.assets.push(...result.assets);
  draft.skeletons.push(result.skeleton);
  return result.skeleton.id;
}
