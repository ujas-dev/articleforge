/**
 * Generates public/og-image.png (1200x630) for the Open Graph / Twitter card
 * tags in src/layouts/Base.astro (finding F17).
 *
 * Dependency-free on purpose: PNG is written with the built-in zlib, using a
 * hand-rolled 5x7 bitmap font for the wordmark. Re-run with `npm run og:image`
 * after changing the brand colours in src/styles/global.css.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const WIDTH = 1200;
const HEIGHT = 630;

const BG_TOP = [10, 10, 14];
const BG_BOTTOM = [16, 16, 25];
const GLOW = [0, 194, 224];
const WORDMARK = [121, 222, 255];
const SUBTITLE = [147, 147, 159];

const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#..#.', '#...#', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..']
};

const canvas = Buffer.alloc(WIDTH * HEIGHT * 3);

function set(x, y, [r, g, b], alpha = 1) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 3;
  canvas[i] = Math.round(canvas[i] * (1 - alpha) + r * alpha);
  canvas[i + 1] = Math.round(canvas[i + 1] * (1 - alpha) + g * alpha);
  canvas[i + 2] = Math.round(canvas[i + 2] * (1 - alpha) + b * alpha);
}

function fillRect(x0, y0, w, h, color, alpha = 1) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, color, alpha);
}

function drawText(text, x0, y0, scale, color) {
  let cursor = x0;
  for (const char of text) {
    const glyph = FONT[char];
    if (glyph) {
      for (let gy = 0; gy < glyph.length; gy++) {
        for (let gx = 0; gx < glyph[gy].length; gx++) {
          if (glyph[gy][gx] === '#') fillRect(cursor + gx * scale, y0 + gy * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
  return cursor;
}

// Background: vertical wash plus a soft cyan glow behind the wordmark.
for (let y = 0; y < HEIGHT; y++) {
  const t = y / (HEIGHT - 1);
  const base = BG_TOP.map((c, i) => Math.round(c + (BG_BOTTOM[i] - c) * t));
  fillRect(0, y, WIDTH, 1, base);
}

const glowX = WIDTH / 2;
const glowY = 150;
const glowR = 620;
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const d = Math.hypot(x - glowX, (y - glowY) * 1.35) / glowR;
    if (d < 1) set(x, y, GLOW, 0.16 * (1 - d) ** 2);
  }
}

const WORD = 'ARTICLEFORGE';
const scale = 13;
const wordWidth = WORD.length * 6 * scale - scale;
drawText(WORD, Math.round((WIDTH - wordWidth) / 2), 236, scale, WORDMARK);

// Three bars standing in for the tagline.
const barWidths = [520, 420, 300];
barWidths.forEach((w, i) => {
  fillRect(Math.round((WIDTH - w) / 2), 400 + i * 34, w, 12, SUBTITLE, 0.55 - i * 0.12);
});

// Hairline frame.
fillRect(0, 0, WIDTH, 2, GLOW, 0.5);
fillRect(0, HEIGHT - 2, WIDTH, 2, GLOW, 0.5);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolour
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
for (let y = 0; y < HEIGHT; y++) {
  const rowStart = y * (1 + WIDTH * 3);
  raw[rowStart] = 0; // filter: none
  canvas.copy(raw, rowStart + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const target = new URL('../public/og-image.png', import.meta.url);
writeFileSync(target, png);
console.log(`Wrote public/og-image.png (${WIDTH}x${HEIGHT}, ${png.length} bytes)`);
