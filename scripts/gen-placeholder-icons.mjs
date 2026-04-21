#!/usr/bin/env node
/**
 * Generates placeholder Tauri icons (32×32, 128×128, 128×128@2x = 256×256)
 * using only Node built-ins. Icons are a solid accent-blue RGBA square —
 * enough to unblock `tauri dev`. For bundling (`tauri build`) swap in a real
 * icon via `pnpm tauri icon path/to/source.png`.
 */

import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const FORCE = process.argv.includes("--force");

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "src-tauri", "icons");

// Pre-compute CRC-32 table.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, [r, g, b, a]) {
  const stride = size * 4 + 1; // 1-byte filter per row
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0; // filter type 0 (None)
    for (let x = 0; x < size; x++) {
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const compressed = deflateSync(raw);

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

// Brand accent blue (#5aa9ff) at full opacity.
const ACCENT = [0x5a, 0xa9, 0xff, 0xff];

const SIZES = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
];

for (const [name, size] of SIZES) {
  const path = resolve(OUT_DIR, name);
  if (existsSync(path) && !FORCE) {
    console.log(`skip ${path} (already exists; pass --force to overwrite)`);
    continue;
  }
  const bytes = makePng(size, ACCENT);
  writeFileSync(path, bytes);
  console.log(`wrote ${path} (${bytes.length} bytes, ${size}×${size})`);
}
