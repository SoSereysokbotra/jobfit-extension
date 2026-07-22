/**
 * Packages ./dist into release/jobfit-extension-v<version>.zip for the Chrome
 * Web Store. Run `npm run package` (which builds first).
 *
 * Writes the ZIP itself rather than shelling out: Windows PowerShell 5.1's
 * Compress-Archive stores paths with BACKSLASH separators, which violates the
 * ZIP spec (APPNOTE 4.4.17.1 requires "/") and can break the Web Store upload.
 * This writer always emits forward slashes, so the archive is identical on every
 * platform and has no external dependency.
 */
import { deflateRawSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const RELEASE = join(ROOT, "release");

// ─── CRC32 (required in every ZIP header) ───────────────────────────────────
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

/** MS-DOS packed time/date, as the ZIP format requires. */
function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    // Always "/" — never the platform separator.
    else out.push({ full, name: relative(base, full).split(sep).join("/") });
  }
  return out;
}

function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const data = readFileSync(file.full);
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const name = Buffer.from(file.name, "utf8");
    const { time, date } = dosDateTime(statSync(file.full).mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    chunks.push(local, name, compressed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // central directory signature
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(compressed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comment
    dir.writeUInt16LE(0, 34); // disk number start
    dir.writeUInt16LE(0, 36); // internal attrs
    dir.writeUInt32LE(0, 38); // external attrs
    dir.writeUInt32LE(offset, 42); // relative offset of local header
    central.push(dir, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}

// ─── Run ────────────────────────────────────────────────────────────────────
if (!existsSync(DIST)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const zipPath = join(RELEASE, `jobfit-extension-v${version}.zip`);

// Guard against shipping a dev build.
const manifest = JSON.parse(readFileSync(join(DIST, "manifest.json"), "utf8"));
const localhost = (manifest.host_permissions ?? []).filter((h) => h.includes("localhost"));
if (localhost.length > 0) {
  console.warn(
    `\n⚠  WARNING: host_permissions still points at localhost:\n   ${localhost.join(
      "\n   ",
    )}\n   Set production URLs in .env and rebuild before submitting.\n`,
  );
}

mkdirSync(RELEASE, { recursive: true });
rmSync(zipPath, { force: true });

const files = walk(DIST);
writeFileSync(zipPath, buildZip(files));

const kb = (statSync(zipPath).size / 1024).toFixed(1);
console.log(`\n✓ ${zipPath}  (${kb} kB)`);
console.log(`  manifest v${manifest.version} · ${files.length} files`);
console.log("  Upload at https://chrome.google.com/webstore/devconsole");
