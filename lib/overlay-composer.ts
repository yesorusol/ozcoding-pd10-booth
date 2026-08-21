/**
 * lib/overlay-composer.ts — Normal-mode sheet composer.
 *
 * Composites the 4 captured cuts under the selected normal-mode frame PNG —
 * a pre-designed, alpha-punched frame (headline/date/footer/decorations
 * baked in) whose 4 photo windows are cut fully transparent, including
 * wherever a corner character overlaps a window. Photos are drawn FIRST at
 * the cell rects, then the frame is drawn on top — its own alpha does all
 * the masking, so characters that overlap a window naturally render in
 * front of the photo with no per-corner clipping or extraction needed.
 *
 * Inputs:
 *   - cuts: 4 captured ImageBitmaps in capture order
 *   - frameId: which frame design the user picked at onboarding
 *
 * Output: a NORMAL_SHEET_WIDTH×NORMAL_SHEET_HEIGHT PNG blob.
 */

import { coverCrop } from "./cover-crop-math";
import {
  getNormalCellRects,
  NORMAL_SHEET_HEIGHT,
  NORMAL_SHEET_WIDTH,
  type NormalFrameId,
} from "./normal-layout";

export interface OverlayComposerCut {
  index: number;
  imageBitmap: ImageBitmap | null;
}

export interface OverlayComposerOptions {
  cuts: ReadonlyArray<OverlayComposerCut>;
  frameId: NormalFrameId;
}

const FRAME_SRC: Readonly<Record<NormalFrameId, string>> = {
  clover: "/overlays/normal-frame-clover.png",
  green: "/overlays/normal-frame-green.png",
};

const frameImagePromises = new Map<NormalFrameId, Promise<HTMLImageElement>>();

function loadFrameImage(frameId: NormalFrameId): Promise<HTMLImageElement> {
  let promise = frameImagePromises.get(frameId);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = FRAME_SRC[frameId];
    });
    frameImagePromises.set(frameId, promise);
  }
  return promise;
}

/** Best-effort eager preload — caller can fire-and-forget at editor open. */
export function preloadNormalFrameImage(frameId: NormalFrameId): void {
  void loadFrameImage(frameId).catch(() => {
    /* ignore — paintFrame handles failure */
  });
}

export async function composeOverlaySheet(
  options: OverlayComposerOptions,
): Promise<Blob> {
  const { cuts, frameId } = options;

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

  const cellRects = getNormalCellRects(frameId);
  for (let i = 0; i < cellRects.length; i++) {
    const rect = cellRects[i];
    const cut = cuts[i];
    if (!cut || !cut.imageBitmap) continue;

    const bmp = cut.imageBitmap;
    const c = coverCrop(bmp.width, bmp.height, rect.width, rect.height);
    ctx.drawImage(bmp, c.sx, c.sy, c.sw, c.sh, rect.x, rect.y, rect.width, rect.height);
  }

  await paintFrame(ctx, frameId);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("composeOverlaySheet: canvas.toBlob returned null"));
    }, "image/png");
  });
}

async function paintFrame(
  ctx: CanvasRenderingContext2D,
  frameId: NormalFrameId,
): Promise<void> {
  try {
    const img = await loadFrameImage(frameId);
    ctx.drawImage(img, 0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
  } catch {
    /* frame decorations/text just won't render — photos still show */
  }
}
