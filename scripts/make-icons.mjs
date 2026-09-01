/**
 * Generates the JobFit extension icons (16/48/128) into ./public from the
 * brand logo master at ./assets/logo.png — with no dependencies, via a
 * hand-rolled RGBA PNG decoder + encoder.
 *
 * The master is the top-hatted JobFit dino badge: a full-bleed disc with a real
 * alpha channel, so the icon reads as a round app mark on any toolbar theme
 * (light, dark, or a coloured Chrome profile) instead of sitting in a box.
 *
 * Downsampling is a premultiplied-alpha box filter (true area average over the
 * source footprint). Premultiplying matters: averaging straight RGBA would drag
 * the transparent-pixel colour into the disc edge and leave a dark fringe.
 *
 * The master is deliberately OUTSIDE ./public — public/ is copied verbatim into
 * the extension bundle, and a 1024px logo nobody loads is ~630KB of dead weight.
 * Only the three generated icons ship.
 *
 * Run: `npm run icons` (after replacing assets/logo.png to rebrand).
 */
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "assets", "logo.png");
const OUT = join(ROOT, "public");
const SIZES = [16, 48, 128];

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

/**
 * Minimal PNG reader: 8-bit RGB/RGBA, non-interlaced — which is what our own
 * encoder below emits, so the pipeline round-trips its own output.
 * Returns { width, height, rgba } with rgba as straight (un-premultiplied) bytes.
 */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${SRC} is not a PNG`);

  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];

  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString("ascii", o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colorType = data[9];
      if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colorType} (want 8-bit RGB/RGBA)`);
      }
      if (data[12] !== 0) throw new Error("interlaced PNGs are not supported");
      channels = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    o += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));

    // Undo the per-scanline filter (PNG spec §9.2).
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + add) & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }

  return { width, height, rgba: out };
}

/**
 * Box-filter downscale in premultiplied-alpha space. Each destination pixel
 * averages the full block of source pixels it covers, so a 1024→16 reduction
 * uses all 4096 contributing pixels rather than point-sampling one of them.
 */
function resize(src, size) {
  const { width: sw, height: sh, rgba } = src;
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * sh) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / size));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * sw) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / size));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4;
          const al = rgba[i + 3] / 255;
          r += rgba[i] * al;
          g += rgba[i + 1] * al;
          b += rgba[i + 2] * al;
          a += al;
          n++;
        }
      }

      const d = (y * size + x) * 4;
      // Un-premultiply back to straight alpha for storage.
      out[d] = a > 0 ? Math.round(r / a) : 0;
      out[d + 1] = a > 0 ? Math.round(g / a) : 0;
      out[d + 2] = a > 0 ? Math.round(b / a) : 0;
      out[d + 3] = Math.round((a / n) * 255);
    }
  }

  return { width: size, height: size, rgba: out };
}

function encodePng({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 1; // Sub filter — cheap and compresses flat art well
    const line = rgba.subarray(y * width * 4, (y + 1) * width * 4);
    for (let i = 0; i < line.length; i++) row[1 + i] = (line[i] - (i >= 4 ? line[i - 4] : 0)) & 0xff;
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const master = decodePng(readFileSync(SRC));
console.log(`source assets/logo.png — ${master.width}x${master.height}`);

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(resize(master, size));
  writeFileSync(join(OUT, `icon${size}.png`), png);
  console.log(`wrote public/icon${size}.png (${png.length} bytes)`);
}
