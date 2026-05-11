/**
 * scripts/split-stickers.mjs — Split the two Gemini character sheets into
 * 10 individual transparent PNGs under /public/stickers/chars/.
 *
 * The sheets ship with a faux "transparency checker" baked into pixels
 * (alpha=255 everywhere). We strip that by flood-filling background colors
 * (near-white + near-gray) from the four corners and setting alpha=0.
 * Then we split each sheet into a 3-top-row + 2-bottom-row grid and trim.
 *
 * Run: `node scripts/split-stickers.mjs`
 */

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "PD09_Sticker");
const OUT = join(ROOT, "public", "stickers", "chars");

const SHEETS = [
  {
    file: "Gemini_Generated_Image_j3weiwj3weiwj3we 1.png",
    startIdx: 1, // chars 1..5
  },
  {
    file: "Gemini_Generated_Image_3cgnh3cgnh3cgnh3.png",
    startIdx: 6, // chars 6..10
  },
];

/** True iff (r,g,b) looks like the checker bg — achromatic and bright (>= 185). */
function isCheckerBg(r, g, b) {
  const maxCh = Math.max(r, g, b);
  const minCh = Math.min(r, g, b);
  // Achromatic: channels within ±14 (covers anti-aliased transition pixels).
  if (maxCh - minCh > 14) return false;
  // Bright enough to be a checker square (white or light gray).
  if (minCh < 185) return false;
  return true;
}

/**
 * Flood-fill bg from the four corners of (data, w, h). Mutates `data` so
 * pixels deemed "outside the character" get alpha=0. Uses a stack to avoid
 * recursion blowups on large images.
 */
function killBackground(data, w, h, channels) {
  const visited = new Uint8Array(w * h);
  const stack = [];

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const o = idx * channels;
    if (!isCheckerBg(data[o], data[o + 1], data[o + 2])) return;
    visited[idx] = 1;
    stack.push(x, y);
  }

  // Seed all 4 corners
  tryPush(0, 0);
  tryPush(w - 1, 0);
  tryPush(0, h - 1);
  tryPush(w - 1, h - 1);

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const idx = y * w + x;
    data[idx * channels + 3] = 0; // alpha = 0
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
}

/**
 * Walk the alpha channel and return a tight bbox around opaque pixels,
 * padded by `pad` and ignoring rows/columns with fewer than `noiseFloor`
 * opaque pixels (suppresses stray dust specks like the one in char-09).
 */
function computeAlphaBBox(data, w, h, channels, pad = 0, noiseFloor = 8) {
  const rowCounts = new Uint32Array(h);
  const colCounts = new Uint32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * channels + 3] > 0) {
        rowCounts[y]++;
        colCounts[x]++;
      }
    }
  }
  let minY = -1, maxY = -1, minX = -1, maxX = -1;
  for (let y = 0; y < h; y++) {
    if (rowCounts[y] >= noiseFloor) {
      if (minY < 0) minY = y;
      maxY = y;
    }
  }
  for (let x = 0; x < w; x++) {
    if (colCounts[x] >= noiseFloor) {
      if (minX < 0) minX = x;
      maxX = x;
    }
  }
  if (minY < 0 || minX < 0) return null;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(w - 1, maxX + pad);
  const bottom = Math.min(h - 1, maxY + pad);
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

async function splitSheet({ file, startIdx }) {
  const src = join(SRC, file);
  const meta = await sharp(src).metadata();
  const w = meta.width;
  const h = meta.height;
  const channels = 4;

  // Load raw pixels, kill bg, save into a temp Buffer.
  const raw = await sharp(src).ensureAlpha().raw().toBuffer();
  killBackground(raw, w, h, channels);

  // Re-encode as PNG with alpha, then split.
  const cleanedSheet = await sharp(raw, {
    raw: { width: w, height: h, channels },
  })
    .png()
    .toBuffer();

  const halfH = Math.floor(h / 2);
  const topColW = Math.floor(w / 3);
  const botColW = Math.floor(w / 2);

  const cells = [
    { left: 0, top: 0, width: topColW, height: halfH },
    { left: topColW, top: 0, width: topColW, height: halfH },
    { left: 2 * topColW, top: 0, width: w - 2 * topColW, height: halfH },
    { left: 0, top: halfH, width: botColW, height: h - halfH },
    { left: botColW, top: halfH, width: w - botColW, height: h - halfH },
  ];

  for (let i = 0; i < cells.length; i++) {
    const idx = startIdx + i;
    const outFile = join(OUT, `char-${String(idx).padStart(2, "0")}.png`);
    const cellRaw = await sharp(cleanedSheet)
      .extract(cells[i])
      .raw()
      .toBuffer();
    const tight = computeAlphaBBox(
      cellRaw,
      cells[i].width,
      cells[i].height,
      channels,
      4, // padding px
    );
    if (!tight) {
      console.log(`char-${String(idx).padStart(2, "0")}.png  (skipped — no opaque pixels)`);
      continue;
    }
    await sharp(cellRaw, {
      raw: { width: cells[i].width, height: cells[i].height, channels },
    })
      .extract(tight)
      .png()
      .toFile(outFile);
    const m = await sharp(outFile).metadata();
    console.log(`char-${String(idx).padStart(2, "0")}.png  ${m.width}×${m.height}`);
  }
}

for (const sheet of SHEETS) {
  console.log(`\n→ Splitting ${sheet.file}`);
  await splitSheet(sheet);
}
console.log("\n✅ done");
