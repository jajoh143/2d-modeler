/**
 * Stock template catalogue. Each template describes a small skeleton with
 * slots and procedural art; instantiation rasterises the shapes into PNG
 * data URLs so no external art files are required.
 *
 * Bones coordinates are in a local space centred on (0, 0). Rotations are
 * radians. The template is dropped into the world at origin — users can
 * move it from there.
 */

import type { Shape } from "./shapeRenderer";

export type Category = "humanoid" | "furniture" | "bar" | "building" | "misc";

export interface TemplateBone {
  name: string;
  parent?: string; // by name within the template; omit for root
  x: number;
  y: number;
  rotation?: number;
  length?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface TemplatePart {
  /** Slot name (also the attachment name). Must be unique within the template. */
  name: string;
  bone: string; // bone name within the template
  drawOrder: number;
  shape: Shape;
  /** Attachment offset in bone-local space (defaults to 0). */
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface StockTemplate {
  id: string;
  name: string;
  category: Category;
  bones: TemplateBone[];
  parts: TemplatePart[];
}

// ──────────────────────────────────────────────────────────────────
// Colour palette (reused across templates for visual consistency)
// ──────────────────────────────────────────────────────────────────

const C = {
  skin: "#d9a27a",
  skinDark: "#b07a53",
  shirt: "#4a90e2",
  shirtDark: "#2b5e99",
  pants: "#3a3f56",
  pantsDark: "#22283a",
  shoe: "#1a1d28",
  hair: "#3a2a20",
  wood: "#8a5a38",
  woodDark: "#5a3c23",
  metal: "#8d97a5",
  metalDark: "#5a6370",
  brick: "#a1563a",
  concrete: "#9a9aa0",
  glass: "#4aa6c8",
  neonPink: "#ff3ba3",
  neonYellow: "#ffe66d",
  fabricRed: "#c94343",
  fabricGreen: "#3fa05a",
  leather: "#5a2f25",
  steel: "#c1c4c8",
  dark: "#20222c",
};

// ──────────────────────────────────────────────────────────────────
// Humanoid
// ──────────────────────────────────────────────────────────────────

const humanoid: StockTemplate = {
  id: "humanoid.basic",
  name: "Humanoid",
  category: "humanoid",
  bones: [
    { name: "root", x: 0, y: 0 },
    // Torso chain
    { name: "pelvis", parent: "root", x: 0, y: -280, length: 60 },
    { name: "torso", parent: "pelvis", x: 0, y: -10, rotation: -Math.PI / 2, length: 110 },
    { name: "neck", parent: "torso", x: 110, y: 0, length: 30 },
    { name: "head", parent: "neck", x: 30, y: 0, length: 80 },
    // Left arm (screen right when default-facing)
    { name: "L_shoulder", parent: "torso", x: 95, y: 35, rotation: Math.PI / 2, length: 10 },
    { name: "L_upperArm", parent: "L_shoulder", x: 10, y: 0, length: 90 },
    { name: "L_forearm", parent: "L_upperArm", x: 90, y: 0, length: 80 },
    { name: "L_hand", parent: "L_forearm", x: 80, y: 0, length: 30 },
    // Right arm
    { name: "R_shoulder", parent: "torso", x: 95, y: -35, rotation: Math.PI / 2, length: 10 },
    { name: "R_upperArm", parent: "R_shoulder", x: 10, y: 0, length: 90 },
    { name: "R_forearm", parent: "R_upperArm", x: 90, y: 0, length: 80 },
    { name: "R_hand", parent: "R_forearm", x: 80, y: 0, length: 30 },
    // Left leg
    { name: "L_thigh", parent: "pelvis", x: 0, y: 20, rotation: Math.PI / 2, length: 110 },
    { name: "L_shin", parent: "L_thigh", x: 110, y: 0, length: 100 },
    { name: "L_foot", parent: "L_shin", x: 100, y: 0, length: 40 },
    // Right leg
    { name: "R_thigh", parent: "pelvis", x: 0, y: -20, rotation: Math.PI / 2, length: 110 },
    { name: "R_shin", parent: "R_thigh", x: 110, y: 0, length: 100 },
    { name: "R_foot", parent: "R_shin", x: 100, y: 0, length: 40 },
  ],
  parts: [
    // Torso
    {
      name: "torso",
      bone: "torso",
      drawOrder: 5,
      shape: { kind: "capsule", width: 130, height: 80, fill: C.shirt, stroke: C.shirtDark, strokeWidth: 2 },
      x: 55,
      rotation: Math.PI / 2,
    },
    {
      name: "head",
      bone: "head",
      drawOrder: 10,
      shape: { kind: "circle", radius: 40, fill: C.skin, stroke: C.skinDark, strokeWidth: 2 },
      x: 40,
      rotation: Math.PI / 2,
    },
    // Arms
    {
      name: "L_upperArm",
      bone: "L_upperArm",
      drawOrder: 3,
      shape: { kind: "capsule", width: 90, height: 30, fill: C.shirt, stroke: C.shirtDark, strokeWidth: 2 },
      x: 45,
    },
    {
      name: "L_forearm",
      bone: "L_forearm",
      drawOrder: 3,
      shape: { kind: "capsule", width: 80, height: 26, fill: C.skin, stroke: C.skinDark, strokeWidth: 2 },
      x: 40,
    },
    {
      name: "L_hand",
      bone: "L_hand",
      drawOrder: 4,
      shape: { kind: "circle", radius: 16, fill: C.skin, stroke: C.skinDark, strokeWidth: 2 },
      x: 15,
    },
    {
      name: "R_upperArm",
      bone: "R_upperArm",
      drawOrder: 7,
      shape: { kind: "capsule", width: 90, height: 30, fill: C.shirt, stroke: C.shirtDark, strokeWidth: 2 },
      x: 45,
    },
    {
      name: "R_forearm",
      bone: "R_forearm",
      drawOrder: 7,
      shape: { kind: "capsule", width: 80, height: 26, fill: C.skin, stroke: C.skinDark, strokeWidth: 2 },
      x: 40,
    },
    {
      name: "R_hand",
      bone: "R_hand",
      drawOrder: 8,
      shape: { kind: "circle", radius: 16, fill: C.skin, stroke: C.skinDark, strokeWidth: 2 },
      x: 15,
    },
    // Legs
    {
      name: "L_thigh",
      bone: "L_thigh",
      drawOrder: 1,
      shape: { kind: "capsule", width: 110, height: 36, fill: C.pants, stroke: C.pantsDark, strokeWidth: 2 },
      x: 55,
    },
    {
      name: "L_shin",
      bone: "L_shin",
      drawOrder: 1,
      shape: { kind: "capsule", width: 100, height: 30, fill: C.pants, stroke: C.pantsDark, strokeWidth: 2 },
      x: 50,
    },
    {
      name: "L_foot",
      bone: "L_foot",
      drawOrder: 2,
      shape: { kind: "capsule", width: 40, height: 20, fill: C.shoe },
      x: 20,
    },
    {
      name: "R_thigh",
      bone: "R_thigh",
      drawOrder: 0,
      shape: { kind: "capsule", width: 110, height: 36, fill: C.pants, stroke: C.pantsDark, strokeWidth: 2 },
      x: 55,
    },
    {
      name: "R_shin",
      bone: "R_shin",
      drawOrder: 0,
      shape: { kind: "capsule", width: 100, height: 30, fill: C.pants, stroke: C.pantsDark, strokeWidth: 2 },
      x: 50,
    },
    {
      name: "R_foot",
      bone: "R_foot",
      drawOrder: 0,
      shape: { kind: "capsule", width: 40, height: 20, fill: C.shoe },
      x: 20,
    },
  ],
};

// ──────────────────────────────────────────────────────────────────
// Small helpers for making simple single-bone props
// ──────────────────────────────────────────────────────────────────

function simple(
  id: string,
  name: string,
  category: Category,
  shape: Shape,
): StockTemplate {
  return {
    id,
    name,
    category,
    bones: [{ name: "root", x: 0, y: 0 }],
    parts: [{ name: "body", bone: "root", drawOrder: 0, shape }],
  };
}

function twoPart(
  id: string,
  name: string,
  category: Category,
  a: { bone: string; x: number; y: number; shape: Shape },
  b: { bone: string; parent?: string; x: number; y: number; shape: Shape },
): StockTemplate {
  return {
    id,
    name,
    category,
    bones: [
      { name: "root", x: 0, y: 0 },
      { name: a.bone, parent: "root", x: a.x, y: a.y },
      { name: b.bone, parent: b.parent ?? "root", x: b.x, y: b.y },
    ],
    parts: [
      { name: a.bone, bone: a.bone, drawOrder: 0, shape: a.shape },
      { name: b.bone, bone: b.bone, drawOrder: 1, shape: b.shape },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────
// Furniture
// ──────────────────────────────────────────────────────────────────

const chair: StockTemplate = {
  id: "furniture.chair",
  name: "Chair",
  category: "furniture",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "seat", parent: "root", x: 0, y: 0 },
    { name: "back", parent: "seat", x: -50, y: -60 },
    { name: "leg_fl", parent: "seat", x: -35, y: 40 },
    { name: "leg_fr", parent: "seat", x: 35, y: 40 },
  ],
  parts: [
    {
      name: "seat",
      bone: "seat",
      drawOrder: 2,
      shape: { kind: "rect", width: 90, height: 24, fill: C.wood, stroke: C.woodDark, strokeWidth: 2, radius: 4 },
    },
    {
      name: "back",
      bone: "back",
      drawOrder: 3,
      shape: { kind: "rect", width: 20, height: 110, fill: C.wood, stroke: C.woodDark, strokeWidth: 2, radius: 4 },
      x: 10,
      y: 55,
    },
    {
      name: "leg_fl",
      bone: "leg_fl",
      drawOrder: 0,
      shape: { kind: "rect", width: 12, height: 80, fill: C.woodDark, radius: 2 },
      y: 40,
    },
    {
      name: "leg_fr",
      bone: "leg_fr",
      drawOrder: 0,
      shape: { kind: "rect", width: 12, height: 80, fill: C.woodDark, radius: 2 },
      y: 40,
    },
  ],
};

const desk: StockTemplate = {
  id: "furniture.desk",
  name: "Desk",
  category: "furniture",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "top", parent: "root", x: 0, y: 0 },
    { name: "legs", parent: "root", x: 0, y: 40 },
  ],
  parts: [
    {
      name: "top",
      bone: "top",
      drawOrder: 2,
      shape: { kind: "rect", width: 200, height: 20, fill: C.wood, stroke: C.woodDark, strokeWidth: 2, radius: 3 },
    },
    {
      name: "legs",
      bone: "legs",
      drawOrder: 0,
      shape: { kind: "rect", width: 180, height: 90, fill: C.woodDark },
      y: 40,
    },
  ],
};

const couch: StockTemplate = simple("furniture.couch", "Couch", "furniture", {
  kind: "rect",
  width: 260,
  height: 100,
  fill: C.fabricGreen,
  stroke: "#2d7a43",
  strokeWidth: 2,
  radius: 14,
});

const bookshelf: StockTemplate = simple(
  "furniture.bookshelf",
  "Bookshelf",
  "furniture",
  {
    kind: "rect",
    width: 160,
    height: 260,
    fill: C.wood,
    stroke: C.woodDark,
    strokeWidth: 3,
    radius: 4,
  },
);

const bed: StockTemplate = simple("furniture.bed", "Bed", "furniture", {
  kind: "rect",
  width: 240,
  height: 140,
  fill: "#e8dfd3",
  stroke: "#8a7864",
  strokeWidth: 2,
  radius: 10,
});

const table: StockTemplate = simple("furniture.table", "Table", "furniture", {
  kind: "rect",
  width: 180,
  height: 24,
  fill: C.wood,
  stroke: C.woodDark,
  strokeWidth: 2,
  radius: 4,
});

const rug: StockTemplate = simple("furniture.rug", "Rug", "furniture", {
  kind: "rect",
  width: 280,
  height: 180,
  fill: C.fabricRed,
  stroke: "#7a2a2a",
  strokeWidth: 3,
  radius: 6,
});

const lamp: StockTemplate = {
  id: "furniture.lamp",
  name: "Lamp",
  category: "furniture",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "base", parent: "root", x: 0, y: 60 },
    { name: "shade", parent: "root", x: 0, y: -30 },
  ],
  parts: [
    {
      name: "stem",
      bone: "root",
      drawOrder: 0,
      shape: { kind: "rect", width: 6, height: 100, fill: C.metalDark },
    },
    {
      name: "shade",
      bone: "shade",
      drawOrder: 2,
      shape: {
        kind: "trapezoid",
        topWidth: 50,
        bottomWidth: 90,
        height: 60,
        fill: C.neonYellow,
        stroke: "#c7a93d",
        strokeWidth: 2,
      },
    },
    {
      name: "base",
      bone: "base",
      drawOrder: 1,
      shape: { kind: "capsule", width: 80, height: 16, fill: C.metalDark },
    },
  ],
};

const tv: StockTemplate = simple("furniture.tv", "TV", "furniture", {
  kind: "rect",
  width: 200,
  height: 120,
  fill: C.dark,
  stroke: "#000000",
  strokeWidth: 3,
  radius: 6,
});

const fridge: StockTemplate = simple("furniture.fridge", "Fridge", "furniture", {
  kind: "rect",
  width: 100,
  height: 220,
  fill: "#e8eef3",
  stroke: "#8a97a0",
  strokeWidth: 2,
  radius: 6,
});

const sink: StockTemplate = simple("furniture.sink", "Sink", "furniture", {
  kind: "rect",
  width: 120,
  height: 70,
  fill: C.steel,
  stroke: "#8a8a8a",
  strokeWidth: 2,
  radius: 8,
});

const toilet: StockTemplate = simple("furniture.toilet", "Toilet", "furniture", {
  kind: "capsule",
  width: 70,
  height: 110,
  fill: "#f2f4f6",
  stroke: "#a0a6ae",
  strokeWidth: 2,
});

const computer: StockTemplate = simple(
  "furniture.computer",
  "Computer",
  "furniture",
  {
    kind: "rect",
    width: 140,
    height: 100,
    fill: "#3a3f56",
    stroke: "#000000",
    strokeWidth: 2,
    radius: 4,
  },
);

const phone: StockTemplate = simple("furniture.phone", "Phone", "furniture", {
  kind: "rect",
  width: 32,
  height: 64,
  fill: C.dark,
  stroke: "#000000",
  strokeWidth: 1,
  radius: 6,
});

const poolTable: StockTemplate = simple(
  "furniture.pool_table",
  "Pool Table",
  "furniture",
  {
    kind: "rect",
    width: 300,
    height: 160,
    fill: "#2f6e3f",
    stroke: C.wood,
    strokeWidth: 8,
    radius: 8,
  },
);

// ──────────────────────────────────────────────────────────────────
// Bar
// ──────────────────────────────────────────────────────────────────

const barCounter: StockTemplate = simple(
  "bar.counter",
  "Bar Counter",
  "bar",
  {
    kind: "rect",
    width: 320,
    height: 50,
    fill: C.wood,
    stroke: C.woodDark,
    strokeWidth: 3,
    radius: 4,
  },
);

const barStool: StockTemplate = {
  id: "bar.stool",
  name: "Bar Stool",
  category: "bar",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "seat", parent: "root", x: 0, y: -50 },
  ],
  parts: [
    {
      name: "post",
      bone: "root",
      drawOrder: 0,
      shape: { kind: "rect", width: 10, height: 100, fill: C.metal },
    },
    {
      name: "seat",
      bone: "seat",
      drawOrder: 1,
      shape: { kind: "capsule", width: 60, height: 18, fill: C.leather },
    },
  ],
};

const neonSign: StockTemplate = {
  id: "bar.neon_sign",
  name: "Neon Sign",
  category: "bar",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "frame", parent: "root", x: 0, y: 0 },
    { name: "tube", parent: "root", x: 0, y: 0 },
  ],
  parts: [
    {
      name: "frame",
      bone: "frame",
      drawOrder: 0,
      shape: {
        kind: "rect",
        width: 160,
        height: 90,
        fill: C.dark,
        stroke: "#000000",
        strokeWidth: 3,
        radius: 6,
      },
    },
    {
      name: "tube",
      bone: "tube",
      drawOrder: 1,
      shape: {
        kind: "rect",
        width: 140,
        height: 18,
        fill: C.neonPink,
        stroke: "#ff9ad4",
        strokeWidth: 2,
        radius: 9,
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────
// Building
// ──────────────────────────────────────────────────────────────────

const facade: StockTemplate = simple(
  "building.facade",
  "Apartment Facade",
  "building",
  {
    kind: "rect",
    width: 400,
    height: 520,
    fill: C.brick,
    stroke: "#5a2d1f",
    strokeWidth: 4,
    radius: 4,
  },
);

const storefront: StockTemplate = simple(
  "building.storefront",
  "Storefront",
  "building",
  {
    kind: "rect",
    width: 360,
    height: 280,
    fill: C.concrete,
    stroke: "#5a5c64",
    strokeWidth: 3,
    radius: 4,
  },
);

const door: StockTemplate = {
  id: "building.door",
  name: "Door",
  category: "building",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "frame", parent: "root", x: 0, y: 0 },
    // Hinge at frame left edge so rotating the leaf opens the door.
    { name: "hinge", parent: "frame", x: -40, y: 0 },
    { name: "leaf", parent: "hinge", x: 40, y: 0 },
  ],
  parts: [
    {
      name: "frame",
      bone: "frame",
      drawOrder: 0,
      shape: {
        kind: "rect",
        width: 110,
        height: 200,
        fill: C.wood,
        stroke: C.woodDark,
        strokeWidth: 4,
        radius: 3,
      },
    },
    {
      name: "leaf",
      bone: "leaf",
      drawOrder: 1,
      shape: {
        kind: "rect",
        width: 80,
        height: 180,
        fill: "#a66d40",
        stroke: C.woodDark,
        strokeWidth: 2,
        radius: 3,
      },
    },
  ],
};

const windowTemplate: StockTemplate = simple(
  "building.window",
  "Window",
  "building",
  {
    kind: "rect",
    width: 100,
    height: 120,
    fill: C.glass,
    stroke: C.wood,
    strokeWidth: 6,
    radius: 2,
  },
);

const sidewalk: StockTemplate = simple(
  "building.sidewalk",
  "Sidewalk",
  "building",
  {
    kind: "rect",
    width: 500,
    height: 60,
    fill: "#c8c9cd",
    stroke: "#8a8c92",
    strokeWidth: 2,
  },
);

// ──────────────────────────────────────────────────────────────────
// Misc
// ──────────────────────────────────────────────────────────────────

const streetlamp: StockTemplate = {
  id: "misc.streetlamp",
  name: "Streetlamp",
  category: "misc",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "head", parent: "root", x: 0, y: -160 },
  ],
  parts: [
    {
      name: "post",
      bone: "root",
      drawOrder: 0,
      shape: { kind: "rect", width: 10, height: 280, fill: C.metalDark },
    },
    {
      name: "head",
      bone: "head",
      drawOrder: 1,
      shape: {
        kind: "trapezoid",
        topWidth: 30,
        bottomWidth: 60,
        height: 40,
        fill: C.neonYellow,
        stroke: C.metalDark,
        strokeWidth: 2,
      },
    },
  ],
};

const trashCan: StockTemplate = simple("misc.trash_can", "Trash Can", "misc", {
  kind: "trapezoid",
  topWidth: 90,
  bottomWidth: 70,
  height: 100,
  fill: C.metalDark,
  stroke: "#333",
  strokeWidth: 2,
});

const bench: StockTemplate = twoPart(
  "misc.bench",
  "Bench",
  "misc",
  {
    bone: "seat",
    x: 0,
    y: 0,
    shape: { kind: "rect", width: 180, height: 18, fill: C.wood, stroke: C.woodDark, strokeWidth: 2, radius: 3 },
  },
  {
    bone: "legs",
    x: 0,
    y: 40,
    shape: { kind: "rect", width: 160, height: 50, fill: C.metalDark },
  },
);

const tree: StockTemplate = {
  id: "misc.tree",
  name: "Tree",
  category: "misc",
  bones: [
    { name: "root", x: 0, y: 0 },
    { name: "trunk", parent: "root", x: 0, y: 0 },
    { name: "crown", parent: "root", x: 0, y: -120 },
  ],
  parts: [
    {
      name: "trunk",
      bone: "trunk",
      drawOrder: 0,
      shape: { kind: "rect", width: 24, height: 200, fill: C.woodDark },
    },
    {
      name: "crown",
      bone: "crown",
      drawOrder: 1,
      shape: { kind: "circle", radius: 90, fill: "#3a8a3c", stroke: "#2b6a2b", strokeWidth: 3 },
    },
  ],
};

const planter: StockTemplate = simple("misc.planter", "Planter", "misc", {
  kind: "trapezoid",
  topWidth: 120,
  bottomWidth: 90,
  height: 80,
  fill: "#8d5a3a",
  stroke: "#5a3820",
  strokeWidth: 2,
});

const car: StockTemplate = simple("misc.car", "Car (silhouette)", "misc", {
  kind: "polygon",
  points: [
    [0, 40],
    [40, 10],
    [120, 0],
    [200, 0],
    [260, 30],
    [280, 60],
    [0, 60],
  ],
  fill: "#4a5868",
  stroke: "#1f252d",
  strokeWidth: 3,
});

export const STOCK_TEMPLATES: StockTemplate[] = [
  humanoid,
  // Furniture
  chair,
  desk,
  couch,
  bookshelf,
  bed,
  table,
  rug,
  lamp,
  tv,
  fridge,
  sink,
  toilet,
  computer,
  phone,
  poolTable,
  // Bar
  barCounter,
  barStool,
  neonSign,
  // Building
  facade,
  storefront,
  door,
  windowTemplate,
  sidewalk,
  // Misc
  streetlamp,
  trashCan,
  bench,
  tree,
  planter,
  car,
];

export const CATEGORY_ORDER: Category[] = [
  "humanoid",
  "furniture",
  "bar",
  "building",
  "misc",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  humanoid: "Humanoid",
  furniture: "Furniture",
  bar: "Bar",
  building: "Building",
  misc: "Misc",
};
