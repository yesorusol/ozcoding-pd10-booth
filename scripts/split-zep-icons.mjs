/**
 * scripts/split-zep-icons.mjs — Slice the ZEP pixel-frame icon sheet into
 * individual transparent PNGs under /public/stickers/zep/.
 *
 * The sheet (public/stickers/zep-pack.png) ships with a dark navy panel
 * background that is fully opaque. We:
 *   1) Color-key the navy bg → alpha=0
 *   2) Flood-fill the outer white border from the four corners → alpha=0
 *   3) Find connected components of remaining opaque pixels (one per icon)
 *   4) Save each component as a tightly-cropped transparent PNG
 *
 * Run: `node scripts/split-zep-icons.mjs`
 */

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "public", "stickers", "zep-pack.png");
const OUT_DIR = join(ROOT, "public", "stickers", "zep");

mkdirSync(OUT_DIR, { recursive: true });

const MIN_BLOB_PIXELS = 60;
const PAD = 2;

function isNavy(r, g, b) {
  // Navy panel pixels are distinctly blue-tinted: B noticeably bigger than
  // R and G. Pure-black icon outlines (R≈G≈B≈20) are excluded so we don't
  // strip pixel-art outlines. Sample sheet pixels: (32,51,91) and (21,30,56).
  return b >= 40 && b <= 105 && b - r >= 18 && b - g >= 8;
}

/**
 * Edge-halo cleanup: navy-tinted pixels that survived the main key but sit
 * directly next to a transparent pixel are AA fringe and should also be
 * killed. Loose enough to catch the lighter "blend toward navy" pixels but
 * still requires a clear blue-tint to avoid eating real icon content.
 */
function isNavyHalo(r, g, b) {
  // Conservative: only dim navy-tinted AA fringe (R, G low; B noticeably
  // higher than R; B itself still relatively dark — not a bright blue icon).
  return b - r >= 15 && b - g >= 8 && r < 80 && g < 95 && b < 115;
}

function isWhiteBorder(r, g, b) {
  return r >= 230 && g >= 230 && b >= 230;
}

const meta = await sharp(SRC).metadata();
const w = meta.width;
const h = meta.height;
const channels = 4;
const raw = await sharp(SRC).ensureAlpha().raw().toBuffer();

// Step 1: color-key navy bg
let navyKilled = 0;
for (let i = 0; i < w * h; i++) {
  const o = i * channels;
  if (raw[o + 3] === 0) continue;
  if (isNavy(raw[o], raw[o + 1], raw[o + 2])) {
    raw[o + 3] = 0;
    navyKilled++;
  }
}

// Step 2: flood-fill outer white border from corners
function tryPushWhite(stack, visited, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const idx = y * w + x;
  if (visited[idx]) return;
  const o = idx * channels;
  if (raw[o + 3] === 0) {
    visited[idx] = 1;
    return;
  }
  if (!isWhiteBorder(raw[o], raw[o + 1], raw[o + 2])) return;
  visited[idx] = 1;
  stack.push(x, y);
}

const whiteVisited = new Uint8Array(w * h);
const whiteStack = [];
tryPushWhite(whiteStack, whiteVisited, 0, 0);
tryPushWhite(whiteStack, whiteVisited, w - 1, 0);
tryPushWhite(whiteStack, whiteVisited, 0, h - 1);
tryPushWhite(whiteStack, whiteVisited, w - 1, h - 1);

let whiteKilled = 0;
while (whiteStack.length) {
  const y = whiteStack.pop();
  const x = whiteStack.pop();
  raw[(y * w + x) * channels + 3] = 0;
  whiteKilled++;
  tryPushWhite(whiteStack, whiteVisited, x + 1, y);
  tryPushWhite(whiteStack, whiteVisited, x - 1, y);
  tryPushWhite(whiteStack, whiteVisited, x, y + 1);
  tryPushWhite(whiteStack, whiteVisited, x, y - 1);
}

console.log(`navy keyed: ${navyKilled}px | white flood: ${whiteKilled}px`);

// Step 2.5: halo cleanup — iteratively kill navy-tinted pixels adjacent to
// already-transparent pixels. Removes the "blue glow" fringe that survives
// the main color-key on AA edges.
let haloTotal = 0;
for (let pass = 0; pass < 2; pass++) {
  const toKill = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const o = idx * channels;
      if (raw[o + 3] === 0) continue;
      if (!isNavyHalo(raw[o], raw[o + 1], raw[o + 2])) continue;
      // 4-neighbor check for transparent
      let hasTransparent = false;
      if (x > 0 && raw[(idx - 1) * channels + 3] === 0) hasTransparent = true;
      else if (x < w - 1 && raw[(idx + 1) * channels + 3] === 0) hasTransparent = true;
      else if (y > 0 && raw[(idx - w) * channels + 3] === 0) hasTransparent = true;
      else if (y < h - 1 && raw[(idx + w) * channels + 3] === 0) hasTransparent = true;
      if (hasTransparent) toKill.push(o);
    }
  }
  for (const o of toKill) raw[o + 3] = 0;
  haloTotal += toKill.length;
  if (toKill.length === 0) break;
}
console.log(`halo cleanup: ${haloTotal}px`);

// Step 3: find connected components of remaining opaque pixels (8-connected
// to keep diagonal-touching pixel-art parts merged into one icon)
const visited = new Uint8Array(w * h);
const components = [];

for (let yStart = 0; yStart < h; yStart++) {
  for (let xStart = 0; xStart < w; xStart++) {
    const idx0 = yStart * w + xStart;
    if (visited[idx0]) continue;
    if (raw[idx0 * channels + 3] === 0) {
      visited[idx0] = 1;
      continue;
    }
    // BFS for this island
    const stack = [xStart, yStart];
    let minX = xStart,
      maxX = xStart,
      minY = yStart,
      maxY = yStart,
      count = 0;
    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      const i = y * w + x;
      if (visited[i]) continue;
      visited[i] = 1;
      if (raw[i * channels + 3] === 0) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      // 4-connectivity (no diagonals) — keeps adjacent pixel-art icons
      // separated even when their bounding boxes are 1px apart diagonally.
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!visited[ny * w + nx]) stack.push(nx, ny);
      }
    }
    if (count >= MIN_BLOB_PIXELS) {
      components.push({ minX, maxX, minY, maxY, count });
    }
  }
}

// Step 4: filter out non-icon components (title bar text, thin border
// lines). Real icons are at least 20×20 AND sit below the "ZEP PIXEL FRAME
// ICONS" title bar (y ≥ 70).
const MIN_DIM = 20;
const MAX_DIM = 200;
const TITLE_BAR_BOTTOM = 70;
const filtered = components.filter((c) => {
  const cw = c.maxX - c.minX + 1;
  const ch = c.maxY - c.minY + 1;
  return (
    cw >= MIN_DIM &&
    ch >= MIN_DIM &&
    cw <= MAX_DIM &&
    ch <= MAX_DIM &&
    c.minY >= TITLE_BAR_BOTTOM
  );
});
components.length = 0;
components.push(...filtered);

// Step 5: sort top-to-bottom, left-to-right (treat icons in similar y as same row)
const ROW_TOLERANCE = 30;
components.sort((a, b) => {
  if (Math.abs(a.minY - b.minY) > ROW_TOLERANCE) return a.minY - b.minY;
  return a.minX - b.minX;
});

console.log(`found ${components.length} icons (after merge)`);

// Step 6: save cleaned sheet then crop each component
const cleanedSheet = await sharp(raw, {
  raw: { width: w, height: h, channels },
})
  .png()
  .toBuffer();

const summary = [];
for (let i = 0; i < components.length; i++) {
  const c = components[i];
  const left = Math.max(0, c.minX - PAD);
  const top = Math.max(0, c.minY - PAD);
  const right = Math.min(w - 1, c.maxX + PAD);
  const bottom = Math.min(h - 1, c.maxY + PAD);
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  const slug = `zep-${String(i + 1).padStart(2, "0")}`;
  const outFile = join(OUT_DIR, `${slug}.png`);
  await sharp(cleanedSheet)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toFile(outFile);
  summary.push({
    slug,
    left,
    top,
    width: cropW,
    height: cropH,
    pixels: c.count,
  });
}

writeFileSync(
  join(OUT_DIR, "manifest.json"),
  JSON.stringify(summary, null, 2),
);
console.log(`\n✅ wrote ${components.length} icons to ${OUT_DIR}`);
for (const s of summary) {
  console.log(`  ${s.slug}  ${s.width}×${s.height}  (${s.pixels}px)`);
}
