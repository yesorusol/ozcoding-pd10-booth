/**
 * lib/overlay-composer.ts — Normal-mode sheet composer.
 *
 * Composites the 4 captured cuts onto `public/overlays/normal-frame.png` —
 * a pre-designed frame with headline/date/footer/decorations baked in and
 * 4 white cutout windows. The frame is opaque, so it must be painted FIRST;
 * each photo is then drawn on top, rounded-rect clipped to tuck under the
 * window's rounded corners (see NORMAL_CELL_RECTS / NORMAL_CELL_RADIUS).
 *
 * The corner astronaut characters overlap slightly onto each window in the
 * source artwork, so a photo drawn on top would clip them. `normal-frame-fg.png`
 * is those overlapping pixels only (rest fully transparent), extracted from
 * normal-frame.png and redrawn last so the astronauts sit in front of the photos.
 *
 * Inputs:
 *   - cuts: 4 captured ImageBitmaps in capture order
 *
 * Output: a NORMAL_SHEET_WIDTH×NORMAL_SHEET_HEIGHT PNG blob.
 */

import { coverCrop } from "./cover-crop-math";
import {
  NORMAL_CELL_RADIUS,
  NORMAL_CELL_RECTS,
  NORMAL_SHEET_HEIGHT,
  NORMAL_SHEET_WIDTH,
} from "./normal-layout";

export interface OverlayComposerCut {
  index: number;
  imageBitmap: ImageBitmap | null;
}

export interface OverlayComposerOptions {
  cuts: ReadonlyArray<OverlayComposerCut>;
}

const FRAME_SRC = "/overlays/normal-frame.png";
const FRAME_FG_SRC = "/overlays/normal-frame-fg.png";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

let frameImagePromise: Promise<HTMLImageElement> | null = null;
let frameFgImagePromise: Promise<HTMLImageElement> | null = null;

function loadFrameImage(): Promise<HTMLImageElement> {
  if (!frameImagePromise) frameImagePromise = loadImage(FRAME_SRC);
  return frameImagePromise;
}

function loadFrameFgImage(): Promise<HTMLImageElement> {
  if (!frameFgImagePromise) frameFgImagePromise = loadImage(FRAME_FG_SRC);
  return frameFgImagePromise;
}

/** Best-effort eager preload — caller can fire-and-forget at editor open. */
export function preloadNormalFrameImage(): void {
  void loadFrameImage().catch(() => {
    /* ignore — paintFrame handles failure */
  });
  void loadFrameFgImage().catch(() => {
    /* ignore — paintFrameForeground handles failure */
  });
}

export async function composeOverlaySheet(
  options: OverlayComposerOptions,
): Promise<Blob> {
  const { cuts } = options;

  if (cuts.length !== 4) {
    throw new Error(
      `composeOverlaySheet: expected 4 cuts, got ${cuts.length}`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = NORMAL_SHEET_WIDTH;
  canvas.height = NORMAL_SHEET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("composeOverlaySheet: 2D canvas context unavailable");
  }

  await paintFrame(ctx);

  for (let i = 0; i < NORMAL_CELL_RECTS.length; i++) {
    const rect = NORMAL_CELL_RECTS[i];
    const cut = cuts[i];
    if (!cut || !cut.imageBitmap) continue;

    const bmp = cut.imageBitmap;
    const c = coverCrop(bmp.width, bmp.height, rect.width, rect.height);

    ctx.save();
    roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, NORMAL_CELL_RADIUS);
    ctx.clip();
    ctx.drawImage(bmp, c.sx, c.sy, c.sw, c.sh, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  await paintFrameForeground(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("composeOverlaySheet: canvas.toBlob returned null"));
    }, "image/png");
  });
}

async function paintFrame(ctx: CanvasRenderingContext2D): Promise<void> {
  try {
    const img = await loadFrameImage();
    ctx.drawImage(img, 0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
  } catch {
    ctx.fillStyle = "#1d2c4a";
    ctx.fillRect(0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
  }
}

async function paintFrameForeground(ctx: CanvasRenderingContext2D): Promise<void> {
  try {
    const img = await loadFrameFgImage();
    ctx.drawImage(img, 0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
  } catch {
    /* corner astronauts just won't sit in front of the photo — non-fatal */
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

