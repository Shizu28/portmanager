'use strict';
const zlib = require('zlib');
const fs   = require('fs');

const SIZE = 256;
const BG   = [0x18, 0x18, 0x2a];
const FG   = [0xa7, 0x8b, 0xfa];
const CX   = SIZE / 2, CY = SIZE / 2, R = 110;

// ── raw RGB rows (PNG filter byte 0 = None per row) ──────────────
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 3)] = 0;
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = Math.hypot(x - CX + 0.5, y - CY + 0.5) <= R ? FG : BG;
    const i = y * (1 + SIZE * 3) + 1 + x * 3;
    raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
  }
}

// ── PNG helpers ───────────────────────────────────────────────────
function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = t[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const tBuf = Buffer.from(type, 'ascii');
  const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(Buffer.concat([tBuf, data])));
  return Buffer.concat([len, tBuf, data, crcB]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 2; // bit-depth=8, color-type=RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

// ── ICO (PNG-in-ICO, Windows Vista+) ─────────────────────────────
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type = ICO
icoHeader.writeUInt16LE(1, 4); // count = 1

const icoEntry = Buffer.alloc(16);
icoEntry[0] = SIZE; icoEntry[1] = SIZE;   // width, height
icoEntry.writeUInt16LE(1,  4);             // planes
icoEntry.writeUInt16LE(32, 6);             // bit count
icoEntry.writeUInt32LE(png.length, 8);    // size of image data
icoEntry.writeUInt32LE(22, 12);           // offset = 6 + 16

fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/icon.png', png);
fs.writeFileSync('assets/icon.ico', Buffer.concat([icoHeader, icoEntry, png]));
console.log('Icons created: assets/icon.png + assets/icon.ico');
