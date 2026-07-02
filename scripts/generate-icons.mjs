// Generates simple wallet-glyph PWA icons (192/512 PNG) with no dependencies.
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const TEAL = [15, 118, 110, 255];
const CREAM = [246, 245, 241, 255];

function inRoundedRect(x, y, rx, ry, rw, rh, rad) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  // distance from the "core" rectangle (inset by rad) must be <= rad
  const cx = Math.max(rx + rad, Math.min(x, rx + rw - rad));
  const cy = Math.max(ry + rad, Math.min(y, ry + rh - rad));
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2;
}

function makeIcon(size) {
  const s = size;
  return png(size, (x, y) => {
    // full-bleed teal background (maskable-safe)
    let px = TEAL;
    // wallet body
    if (inRoundedRect(x, y, s * 0.18, s * 0.3, s * 0.64, s * 0.4, s * 0.07)) px = CREAM;
    // wallet flap slot
    if (inRoundedRect(x, y, s * 0.56, s * 0.44, s * 0.26, s * 0.12, s * 0.055)) px = TEAL;
    // clasp dot
    const dx = x - s * 0.69;
    const dy = y - s * 0.5;
    if (dx * dx + dy * dy <= (s * 0.035) ** 2) px = CREAM;
    return px;
  });
}

const outDir = path.resolve("public/icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png written`);
}
