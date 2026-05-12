// scripts/extract-char-from-checker.mjs
//
// Take a pixel-art PNG that has its transparency rendered as a 2-tone gray
// checker and turn the checker into real alpha=0. We can't just color-key
// the checker tones because the character itself contains pure-white pixels
// (face highlights, glasses). Instead we flood-fill the checker mask from
// the 4 corners — that gives us the "outside" connected region, which is
// the only part we want to make transparent.

import sharp from "sharp";
import path from "node:path";

const SRC = process.argv[2];
const OUT = process.argv[3];
const TARGET_H = Number(process.argv[4] || 0); // 0 = keep native height
if (!SRC || !OUT) {
  console.error(
    "usage: node extract-char-from-checker.mjs <src.png> <out.png> [target-height]"
  );
  process.exit(1);
}

const CHECKER_WHITE = [255, 255, 255];
const CHECKER_GRAY = [200, 200, 200];
const TOL = 18;

function isCheckerLike(r, g, b) {
  const dw =
    Math.abs(r - CHECKER_WHITE[0]) <= TOL &&
    Math.abs(g - CHECKER_WHITE[1]) <= TOL &&
    Math.abs(b - CHECKER_WHITE[2]) <= TOL;
  if (dw) return true;
  const dg =
    Math.abs(r - CHECKER_GRAY[0]) <= TOL &&
    Math.abs(g - CHECKER_GRAY[1]) <= TOL &&
    Math.abs(b - CHECKER_GRAY[2]) <= TOL;
  return dg;
}

async function main() {
  const { data, info } = await sharp(SRC)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Step 1: build checker-like mask.
  const checkerMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isCheckerLike(data[i], data[i + 1], data[i + 2])) {
        checkerMask[y * width + x] = 1;
      }
    }
  }

  // Step 2: flood-fill from corners (8-connectivity) into the "outside"
  // mask. Only checker-like pixels reachable from the image border count
  // as background; interior white/gray (glasses, face) stays opaque.
  const outside = new Uint8Array(width * height);
  const stack = [];
  function seed(x, y) {
    const idx = y * width + x;
    if (checkerMask[idx] === 1 && outside[idx] === 0) {
      outside[idx] = 1;
      stack.push(idx);
    }
  }
  // Seed every edge pixel that's checker-like.
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (stack.length) {
    const cur = stack.pop();
    const cy = (cur / width) | 0;
    const cx = cur - cy * width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (checkerMask[ni] === 1 && outside[ni] === 0) {
          outside[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }

  // Step 3: write RGBA: outside → alpha=0, else keep original RGB at full alpha.
  // Also compute tight bbox of the character (non-outside pixels).
  let minX = width,
    maxX = -1,
    minY = height,
    maxY = -1;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const si = idx * channels;
      const di = idx * 4;
      if (outside[idx]) {
        rgba[di + 3] = 0;
      } else {
        rgba[di] = data[si];
        rgba[di + 1] = data[si + 1];
        rgba[di + 2] = data[si + 2];
        rgba[di + 3] = 255;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("no character pixels found");

  const PAD = 2;
  const x0 = Math.max(0, minX - PAD);
  const y0 = Math.max(0, minY - PAD);
  const x1 = Math.min(width - 1, maxX + PAD);
  const y1 = Math.min(height - 1, maxY + PAD);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const cropped = Buffer.alloc(cw * ch * 4);
  for (let yy = 0; yy < ch; yy++) {
    for (let xx = 0; xx < cw; xx++) {
      const sIdx = ((y0 + yy) * width + (x0 + xx)) * 4;
      const dIdx = (yy * cw + xx) * 4;
      cropped[dIdx] = rgba[sIdx];
      cropped[dIdx + 1] = rgba[sIdx + 1];
      cropped[dIdx + 2] = rgba[sIdx + 2];
      cropped[dIdx + 3] = rgba[sIdx + 3];
    }
  }
  console.log(`bbox: ${cw}x${ch} (from ${width}x${height})`);

  let pipe = sharp(cropped, { raw: { width: cw, height: ch, channels: 4 } });
  if (TARGET_H > 0 && TARGET_H !== ch) {
    pipe = pipe.resize({
      height: TARGET_H,
      kernel: "nearest", // preserve pixel-art edges
    });
    console.log(`resize → height ${TARGET_H} (nearest)`);
  }
  await pipe.png({ compressionLevel: 9 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
