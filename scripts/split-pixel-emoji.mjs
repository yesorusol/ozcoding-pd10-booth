// scripts/split-pixel-emoji.mjs
//
// Extracts individual pixel-art emoji stickers from a 4-row Gemini sheet
// where each sticker has a thick white outline on a checker-gray background.
//
// Background detection: pixel is background if it matches either checker tone
// within tolerance. Everything else (sticker body + white outline) becomes
// the foreground mask, which we flood-fill into connected components.
//
// Per-component output: crop to bbox + padding, then rewrite background
// pixels in that crop to alpha=0 so the saved PNG is properly transparent.

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const SRC = process.argv[2];
const OUT_DIR = process.argv[3];
if (!SRC || !OUT_DIR) {
  console.error("usage: node split-pixel-emoji.mjs <src.png> <out-dir>");
  process.exit(1);
}

// Checker tones sampled from this sheet.
const BG_A = [160, 152, 152];
const BG_B = [200, 200, 192];
const BG_TOL = 25;

function isBackground(r, g, b) {
  const da =
    Math.abs(r - BG_A[0]) <= BG_TOL &&
    Math.abs(g - BG_A[1]) <= BG_TOL &&
    Math.abs(b - BG_A[2]) <= BG_TOL;
  if (da) return true;
  const db =
    Math.abs(r - BG_B[0]) <= BG_TOL &&
    Math.abs(g - BG_B[1]) <= BG_TOL &&
    Math.abs(b - BG_B[2]) <= BG_TOL;
  return db;
}

const PAD = 8;
const MIN_AREA = 4000;
const MAX_AREA = 400000;
const MIN_DIM = 50;
const MAX_DIM = 600;

async function main() {
  const { data, info } = await sharp(SRC)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log(`source: ${width}x${height} (${channels}ch)`);

  // 1. Build foreground mask (1 = sticker pixel).
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (!isBackground(data[i], data[i + 1], data[i + 2])) {
        mask[y * width + x] = 1;
      }
    }
  }

  // 2. Flood fill (8-connectivity) → connected components.
  const labels = new Int32Array(width * height);
  const stack = [];
  let nextLabel = 0;
  const bboxes = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0 || labels[idx] !== 0) continue;
      nextLabel++;
      labels[idx] = nextLabel;
      stack.length = 0;
      stack.push(idx);
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y,
        area = 0;
      while (stack.length) {
        const cur = stack.pop();
        const cy = (cur / width) | 0;
        const cx = cur - cy * width;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (mask[nIdx] === 1 && labels[nIdx] === 0) {
              labels[nIdx] = nextLabel;
              stack.push(nIdx);
            }
          }
        }
      }
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      if (
        area >= MIN_AREA &&
        area <= MAX_AREA &&
        w >= MIN_DIM &&
        h >= MIN_DIM &&
        w <= MAX_DIM &&
        h <= MAX_DIM
      ) {
        bboxes.push({ label: nextLabel, minX, maxX, minY, maxY, w, h, area });
      }
    }
  }
  console.log(`components: total=${nextLabel}, kept=${bboxes.length}`);

  // 3. Sort row-major: group by Y bands then by X.
  bboxes.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
  // Group into rows using a Y-distance threshold (half median height).
  const heights = bboxes.map((b) => b.h).sort((a, b) => a - b);
  const medH = heights[Math.floor(heights.length / 2)] || 200;
  const rowGap = Math.floor(medH * 0.6);
  const rows = [];
  let curRow = [];
  let rowAnchorY = -1;
  for (const b of bboxes) {
    const cy = (b.minY + b.maxY) / 2;
    if (rowAnchorY < 0 || Math.abs(cy - rowAnchorY) <= rowGap) {
      curRow.push(b);
      rowAnchorY =
        rowAnchorY < 0 ? cy : (rowAnchorY * (curRow.length - 1) + cy) / curRow.length;
    } else {
      rows.push(curRow);
      curRow = [b];
      rowAnchorY = cy;
    }
  }
  if (curRow.length) rows.push(curRow);
  for (const r of rows) r.sort((a, b) => a.minX - b.minX);
  const ordered = rows.flat();
  console.log(`rows: ${rows.map((r) => r.length).join(",")}`);

  // 4. Crop + write per-sticker PNGs with background → alpha=0.
  await fs.mkdir(OUT_DIR, { recursive: true });
  let n = 0;
  for (const b of ordered) {
    n++;
    const x0 = Math.max(0, b.minX - PAD);
    const y0 = Math.max(0, b.minY - PAD);
    const x1 = Math.min(width - 1, b.maxX + PAD);
    const y1 = Math.min(height - 1, b.maxY + PAD);
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    const out = Buffer.alloc(cw * ch * 4);
    for (let yy = 0; yy < ch; yy++) {
      for (let xx = 0; xx < cw; xx++) {
        const sx = x0 + xx;
        const sy = y0 + yy;
        const si = (sy * width + sx) * channels;
        const r = data[si];
        const g = data[si + 1];
        const bb = data[si + 2];
        const di = (yy * cw + xx) * 4;
        if (isBackground(r, g, bb)) {
          out[di] = 0;
          out[di + 1] = 0;
          out[di + 2] = 0;
          out[di + 3] = 0;
        } else {
          out[di] = r;
          out[di + 1] = g;
          out[di + 2] = bb;
          out[di + 3] = 255;
        }
      }
    }
    const id = String(n).padStart(2, "0");
    const file = path.join(OUT_DIR, `emoji-${id}.png`);
    await sharp(out, { raw: { width: cw, height: ch, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(file);
    console.log(`  emoji-${id}.png  ${cw}x${ch}  area=${b.area}`);
  }
  console.log(`done. wrote ${n} icons to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
