/**
 * lib/sheet-composer.ts — M5 sheet composition.
 *
 * Composes the 7 captured cuts plus the title card into a single 1080×2400
 * PNG laid out as a 4 (row) × 2 (col) grid of cells. The output Blob is
 * persisted by M6 (POST /api/captures) and surfaced to the user via QR
 * (M7).
 *
 * Layout math (verified to fit exactly):
 *   width  = 2 × marginX + 2 × cellW + 1 × gutter
 *          = 2×70 + 2×460 + 1×20 = 1080 ✓
 *   height = 2 × marginY + 4 × cellH + 3 × gutter
 *          = 2×20 + 4×575 + 3×20 = 2400 ✓
 *
 * Cell aspect (460:575 = 0.8) matches the cut canvas (576:720) exactly, so
 * cuts scale uniformly with no distortion. The title-card PNG (800×900,
 * aspect 0.889) doesn't match — we use `coverCrop` to clip its 40px
 * transparent margins (and ~25px more on each side of the artwork) so the
 * grid stays uniform.
 *
 * Grid index → cell:
 *   0 1
 *   2 3
 *   4 5
 *   6 7   ← gridIndex 7 = title card (bottom-right)
 */

import type { Cut } from "./types";
import { CAPTURE_FRAMES, TITLE_FRAME } from "./frames";
import { coverCrop } from "./cover-crop-math";

export const SHEET_WIDTH = 1080;
export const SHEET_HEIGHT = 2400;
export const SHEET_CELL_W = 460;
export const SHEET_CELL_H = 575;
export const SHEET_MARGIN_X = 70;
export const SHEET_MARGIN_Y = 20;
export const SHEET_GUTTER = 20;
export const SHEET_COLS = 2;
export const SHEET_ROWS = 4;
export const SHEET_TOTAL_CELLS = SHEET_COLS * SHEET_ROWS;

export interface SheetCompositionOptions {
  /** Exactly 7 captured cuts (any order; matched by `frameId`). */
  cuts: ReadonlyArray<Cut>;
  /** Loaded title-card PNG (HTMLImageElement). */
  titleCardImg: HTMLImageElement;
  /** Sheet background fill. Defaults to white. */
  background?: string;
}

/**
 * Top-left pixel position of cell `gridIndex` (0..7) on the 1080×2400 sheet.
 * Row-major: 0/1 row 0, 2/3 row 1, …, 6/7 row 3.
 */
export function cellRect(gridIndex: number): { x: number; y: number } {
  const col = gridIndex % SHEET_COLS;
  const row = Math.floor(gridIndex / SHEET_COLS);
  const x = SHEET_MARGIN_X + col * (SHEET_CELL_W + SHEET_GUTTER);
  const y = SHEET_MARGIN_Y + row * (SHEET_CELL_H + SHEET_GUTTER);
  return { x, y };
}

/**
 * Compose all cuts + title card into a 1080×2400 PNG Blob.
 * Resolves to the Blob; rejects if the canvas context can't be acquired,
 * `cuts.length !== 7`, or `canvas.toBlob` fails.
 */
export async function composeSheet(
  options: SheetCompositionOptions,
): Promise<Blob> {
  const { cuts, titleCardImg, background = "#ffffff" } = options;

  if (cuts.length !== 7) {
    throw new Error(`composeSheet: expected 7 cuts, got ${cuts.length}`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("composeSheet: 2D canvas context unavailable");
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  // Cuts: cell aspect matches cut aspect, so uniform scale (no cover-crop).
  for (const frame of CAPTURE_FRAMES) {
    const cut = cuts.find((c) => c.frameId === frame.id);
    if (!cut || !cut.imageBitmap) continue;
    const { x, y } = cellRect(frame.gridIndex);
    ctx.drawImage(cut.imageBitmap, x, y, SHEET_CELL_W, SHEET_CELL_H);
  }

  // Title card: aspect mismatch, use cover-fit to clip transparent margins.
  if (titleCardImg.complete && titleCardImg.naturalWidth > 0) {
    const { x, y } = cellRect(TITLE_FRAME.gridIndex);
    const t = coverCrop(
      titleCardImg.naturalWidth,
      titleCardImg.naturalHeight,
      SHEET_CELL_W,
      SHEET_CELL_H,
    );
    ctx.drawImage(
      titleCardImg,
      t.sx,
      t.sy,
      t.sw,
      t.sh,
      x,
      y,
      SHEET_CELL_W,
      SHEET_CELL_H,
    );
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("composeSheet: canvas.toBlob returned null"));
    }, "image/png");
  });
}
