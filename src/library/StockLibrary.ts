/**
 * Stock library — ships with the app. Each entry is a partial skeleton that can
 * be instantiated into the current project. Real art and mesh data come from
 * resources/library/*.json and resources/library/assets/*.png (wired in M8).
 */

export interface LibraryEntry {
  id: string;
  name: string;
  category: "humanoid" | "furniture" | "building" | "bar" | "misc";
  thumbnail?: string;
  manifestPath: string;
}

export const STOCK_LIBRARY: LibraryEntry[] = [
  { id: "humanoid.basic", name: "Humanoid", category: "humanoid", manifestPath: "library/humanoid.json" },
  { id: "furniture.chair", name: "Chair", category: "furniture", manifestPath: "library/chair.json" },
  { id: "furniture.desk", name: "Desk", category: "furniture", manifestPath: "library/desk.json" },
  { id: "furniture.couch", name: "Couch", category: "furniture", manifestPath: "library/couch.json" },
  { id: "furniture.bookshelf", name: "Bookshelf", category: "furniture", manifestPath: "library/bookshelf.json" },
  { id: "bar.counter", name: "Bar Counter", category: "bar", manifestPath: "library/bar_counter.json" },
  { id: "bar.stool", name: "Bar Stool", category: "bar", manifestPath: "library/bar_stool.json" },
  { id: "bar.neon_sign", name: "Neon Sign", category: "bar", manifestPath: "library/neon_sign.json" },
  { id: "building.facade", name: "Apartment Facade", category: "building", manifestPath: "library/facade.json" },
  { id: "building.storefront", name: "Storefront", category: "building", manifestPath: "library/storefront.json" },
  { id: "building.door", name: "Door", category: "building", manifestPath: "library/door.json" },
  { id: "building.window", name: "Window", category: "building", manifestPath: "library/window.json" },
  { id: "misc.streetlamp", name: "Streetlamp", category: "misc", manifestPath: "library/streetlamp.json" },
  { id: "misc.trash_can", name: "Trash Can", category: "misc", manifestPath: "library/trash_can.json" },
  { id: "misc.bench", name: "Bench", category: "misc", manifestPath: "library/bench.json" },
];
