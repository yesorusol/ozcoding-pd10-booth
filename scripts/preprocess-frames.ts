// M1: 핑크 → 투명 + 800×900 패딩 전처리. 빌드 전 1회 실행.
//
// Investigation findings (2026-05-06):
// - Most character frames (burger, ramen, tamagotchi, teeth, mic, cosplay) already have
//   alpha=0 in their face-hole regions — no RGB chroma keying needed.
// - "waiter.png" encodes the face hole as near-white pixels (rgb ~254,254,254) with
//   low alpha values (22–127). We threshold: alpha < 128 → alpha=0 for all pixels.
// - "title-card.png" is RGB-only (no alpha channel); passthrough with padding only.
// - All frames are padded from 720×900 to 800×900 (40px transparent left + 40px right).
//
// Update (2026-05-07): mic.png raw artwork is 697 px wide (vs 720 for other frames),
// leaving asymmetric ~11/12px transparent gutters on each side after the 800×900 pad.
// We now normalize artwork width: any frame whose alpha bounding box is narrower than
// 720 px gets uniform-scaled to 720 wide, re-anchored vertically (bottom for designs
// like mic where the original artwork is bottom-biased; centered otherwise).

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const RAW_DIR = path.resolve("public/frames/raw");
const OUT_DIR = path.resolve("public/frames/processed");

const RAW_WIDTH = 720;
const RAW_HEIGHT = 900;
const PAD_TARGET_WIDTH = 800;

const CHARACTER_FRAMES = [
  "ramen",
  "teeth",
  "cosplay",
  "waiter",
];

// Skip list — these frames had their processed/*.png hand-swapped to newer
// designs while raw/*.png was left at the initial-commit version. Running
// preprocess against the stale raw overwrites the good processed image and
// regresses the design (observed 2026-05-13 on bb316b4). Until each frame
// gets a fresh 720×900 raw source committed, leave them out of the pipeline.
//   - burger:     swapped in 70a54ae to split-bun cutout
//   - mic:        swapped in 53b0c49 to full-color cutout
//   - title-card: swapped in 91f66e3 to MAKE MEMORIES design
//   - tamagotchi: swapped to 두쫀쿠 mask design (no longer a tamagotchi pet)
const PASSTHROUGH_FRAMES: string[] = [];

const ALPHA_THRESHOLD = 128;

// Per-frame zoom applied after width-normalize, before 800×900 pad.
// >1.0 scales the 720×900 artwork up and crops back to 720×900, enlarging
// features (e.g. face holes) at the cost of edge clipping.
//   - factor: scale multiplier (1.0 = no-op)
//   - anchor: which edge to preserve when cropping ("center" | "top")
//     "top" crops only from the bottom — useful when the top of the artwork
//     (e.g. princess hair) must not be clipped.
const FRAME_SCALES: Record<
  string,
  { factor: number; anchor?: "center" | "top" }
> = {
  cosplay: { factor: 1.25, anchor: "top" },
};

interface AlphaBbox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Walk an RGBA buffer and return the bounding box of non-zero alpha pixels.
 * Returns null if every pixel is fully transparent.
 */
async function detectAlphaBbox(input: Buffer): Promise<AlphaBbox | null> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let xMin = width;
  let xMax = -1;
  let yMin = height;
  let yMax = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 0) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (xMax === -1) return null;
  return {
    left: xMin,
    top: yMin,
    width: xMax - xMin + 1,
    height: yMax - yMin + 1,
  };
}

/**
 * For character frames: walk raw RGBA pixels and set alpha=0 for any pixel
 * whose alpha is below ALPHA_THRESHOLD. Ensures face holes are fully
 * transparent regardless of solid-zero vs vignette encoding.
 */
async function thresholdAlpha(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const buf = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const aIdx = i * channels + 3;
    if (buf[aIdx] < ALPHA_THRESHOLD) {
      buf[aIdx] = 0;
    }
  }

  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * If the artwork's alpha bounding box is narrower than RAW_WIDTH, uniform-scale
 * it to fill the full RAW_WIDTH (preserving aspect) and re-anchor on a fresh
 * transparent RAW_WIDTH × RAW_HEIGHT canvas.
 *
 * Vertical anchor:
 *   - bottom-anchored when the original artwork's vertical center sits in the
 *     lower half of the raw canvas (e.g. mic's bottom-biased graphic),
 *   - centered otherwise.
 *
 * Frames whose bbox already fills the raw width (most character frames) pass
 * through unchanged.
 */
export async function normalizeArtworkWidth(input: Buffer): Promise<Buffer> {
  const bbox = await detectAlphaBbox(input);
  if (!bbox) return input;
  if (bbox.width >= RAW_WIDTH) return input;

  // Default: scale to fill RAW_WIDTH. If that would overflow RAW_HEIGHT
  // (artwork fills the full vertical and is just slightly narrower), fall
  // back to scaling by height so we never composite a taller-than-canvas
  // image (sharp throws on that).
  let newWidth = RAW_WIDTH;
  let newHeight = Math.round((RAW_WIDTH / bbox.width) * bbox.height);
  if (newHeight > RAW_HEIGHT) {
    newHeight = RAW_HEIGHT;
    newWidth = Math.round((RAW_HEIGHT / bbox.height) * bbox.width);
  }

  const cropped = await sharp(input)
    .extract({
      left: bbox.left,
      top: bbox.top,
      width: bbox.width,
      height: bbox.height,
    })
    .toBuffer();

  const resized = await sharp(cropped)
    .resize({ width: newWidth, height: newHeight, fit: "fill" })
    .png()
    .toBuffer();

  const originalCenterY = bbox.top + (bbox.height - 1) / 2;
  const rawCenterY = (RAW_HEIGHT - 1) / 2;
  const anchorBottom = originalCenterY > rawCenterY;

  // Clamp newTop / newLeft so we never overflow the raw canvas.
  const maxTop = Math.max(0, RAW_HEIGHT - newHeight);
  const newTop = anchorBottom
    ? maxTop
    : Math.max(0, Math.floor((RAW_HEIGHT - newHeight) / 2));
  const newLeft = Math.max(0, Math.floor((RAW_WIDTH - newWidth) / 2));

  return sharp({
    create: {
      width: RAW_WIDTH,
      height: RAW_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: newLeft, top: newTop }])
    .png()
    .toBuffer();
}

/**
 * Scale a 720×900 artwork by `factor` (>1 zooms in) and crop back to
 * 720×900. `anchor` selects the crop reference: "center" trims equally
 * from all sides; "top" keeps the top row and only trims the bottom
 * (preserves top-aligned features like hair / headwear).
 */
export async function scaleArtwork(
  input: Buffer,
  factor: number,
  anchor: "center" | "top" = "center",
): Promise<Buffer> {
  if (factor === 1) return input;
  const newW = Math.round(RAW_WIDTH * factor);
  const newH = Math.round(RAW_HEIGHT * factor);
  const left = Math.floor((newW - RAW_WIDTH) / 2);
  const top = anchor === "top" ? 0 : Math.floor((newH - RAW_HEIGHT) / 2);
  return sharp(input)
    .resize({ width: newW, height: newH, fit: "fill" })
    .extract({ left, top, width: RAW_WIDTH, height: RAW_HEIGHT })
    .png()
    .toBuffer();
}

/**
 * Pad a 720×900 RGBA buffer to 800×900 by adding 40px transparent columns
 * on each side. The original artwork is centered; no resampling occurs.
 */
async function padTo800x900(input: Buffer): Promise<Buffer> {
  const padX = (PAD_TARGET_WIDTH - RAW_WIDTH) / 2;
  return sharp(input)
    .ensureAlpha()
    .extend({
      top: 0,
      bottom: 0,
      left: padX,
      right: padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Character frames: threshold alpha → normalize artwork width → pad
  for (const name of CHARACTER_FRAMES) {
    const srcPath = path.join(RAW_DIR, `${name}.png`);
    const raw = await fs.readFile(srcPath);
    const thresholded = await thresholdAlpha(raw);
    const normalized = await normalizeArtworkWidth(thresholded);
    const spec = FRAME_SCALES[name];
    const scaled = await scaleArtwork(
      normalized,
      spec?.factor ?? 1,
      spec?.anchor ?? "center",
    );
    const padded = await padTo800x900(scaled);
    const outPath = path.join(OUT_DIR, `${name}.png`);
    await fs.writeFile(outPath, padded);
    console.log(`✓ ${name}.png → ${padded.length} bytes`);
  }

  // Passthrough frames: pad only (title-card is RGB; ensureAlpha adds alpha channel)
  for (const name of PASSTHROUGH_FRAMES) {
    const srcPath = path.join(RAW_DIR, `${name}.png`);
    const raw = await fs.readFile(srcPath);
    const padded = await padTo800x900(raw);
    const outPath = path.join(OUT_DIR, `${name}.png`);
    await fs.writeFile(outPath, padded);
    console.log(`✓ ${name}.png (passthrough) → ${padded.length} bytes`);
  }

  console.log(
    `\nDone. ${CHARACTER_FRAMES.length + PASSTHROUGH_FRAMES.length} files written to ${OUT_DIR}`,
  );
}

// Only execute main when invoked directly via `tsx`. Importing this module
// from tests should not trigger a side-effect run.
const invokedAsScript = (() => {
  if (typeof process === "undefined") return false;
  const argv1 = process.argv[1];
  if (!argv1) return false;
  return argv1.includes("preprocess-frames");
})();

if (invokedAsScript) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
