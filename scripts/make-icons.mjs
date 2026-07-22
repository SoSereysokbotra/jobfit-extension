/**
 * Generates the JobFit extension icons (16/48/128) into ./public with no
 * dependencies — hand-rolled RGBA PNG encoder.
 *
 * Design: rounded-corner tile with the brand gradient (primary-800 → primary-600,
 * matching the popup header) and a white 4-point sparkle — the same ✦ mark used
 * on the in-page badge. Corners are transparent so the tile reads as a rounded
 * app icon on any background.
 *
 * Run: `node scripts/make-icons.mjs`
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public");

const PRIMARY_800 = [0x3c, 0x09, 0x6c];
const PRIMARY_600 = [0x7b, 0x2c, 0xbf];
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** Coverage of a rounded rectangle at (x,y), supersampled for smooth edges. */
function tileCoverage(x, y, size, radius) {
  const inside = (px, py) => {
    const cx = Math.min(Math.max(px, radius), size - radius);
    const cy = Math.min(Math.max(py, radius), size - radius);
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
  let hits = 0;
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      if (inside(x + 0.25 + sx * 0.5, y + 0.25 + sy * 0.5)) hits++;
    }
  }
  return hits / 4;
}

/**
 * Coverage of a 4-point sparkle (astroid: |x|^0.5 + |y|^0.5 <= 1), supersampled.
 * The concave curves give the ✦ look rather than a plain diamond.
 */
function sparkleCoverage(x, y, size) {
  const c = size / 2;
  const r = size * 0.36;
  const inside = (px, py) => {
    const nx = Math.abs((px - c) / r);
    const ny = Math.abs((py - c) / r);
    return Math.sqrt(nx) + Math.sqrt(ny) <= 1;
  };
  let hits = 0;
  const steps = 3;
  for (let sy = 0; sy < steps; sy++) {
    for (let sx = 0; sx < steps; sx++) {
      if (inside(x + (sx + 0.5) / steps, y + (sy + 0.5) / steps)) hits++;
    }
  }
  return hits / (steps * steps);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA (alpha → transparent rounded corners)

  const rows = [];
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // leading filter byte (0 = none)
    for (let x = 0; x < size; x++) {
      // Diagonal brand gradient, same direction as the popup header.
      const t = clamp01((x + y) / (2 * (size - 1)));
      let r = lerp(PRIMARY_800[0], PRIMARY_600[0], t);
      let g = lerp(PRIMARY_800[1], PRIMARY_600[1], t);
      let b = lerp(PRIMARY_800[2], PRIMARY_600[2], t);

      // Composite the white sparkle over the gradient.
      const s = sparkleCoverage(x, y, size);
      if (s > 0) {
        r = lerp(r, WHITE[0], s);
        g = lerp(g, WHITE[1], s);
        b = lerp(b, WHITE[2], s);
      }

      const o = 1 + x * 4;
      row[o] = r;
      row[o + 1] = g;
      row[o + 2] = b;
      row[o + 3] = Math.round(tileCoverage(x, y, size, radius) * 255);
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(OUT, `icon${size}.png`), png(size));
  console.log(`wrote public/icon${size}.png`);
}
