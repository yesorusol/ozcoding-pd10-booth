/**
 * lib/sheet-composer.ts — M5 sheet composition (challenge / 7-cut mode).
 *
 * Single-background layout: the user-chosen `BackgroundChoice` fills the
 * entire 1080×2400 sheet. The 7 captured cuts cover cells 0..6, so the
 * background only shows through as the outer frame, inter-cell gutters,
 * and cell 7 (bottom-right title cell). The frame and cell 7 therefore
 * read as one continuous surface — picking a light cream gives a clean
 * window-grid look; any solid color wraps around all 7 photos.
 *
 * Cell 7 is hand-painted (no PNG): a pink chip with the Korean headline
 * sits on top of the bleeding-through background, with English subline
 * and dated footer text underneath, all in the same pixel font + outline
 * treatment that normal-mode (4-cut) uses (navy fill + white halo).
 *
 * Layout math (verified to fit exactly):
 *   width  = 2 × margin + 2 × cellW + 1 × gutter
 *          = 2×20 + 2×510 + 1×20 = 1080 ✓
 *   height = 2 × margin + 4 × cellH + 3 × gutter
 *          = 2×20 + 4×575 + 3×20 = 2400 ✓
 *
 * Cell aspect (510:575 = 0.887) is slightly wider than the cut canvas
 * (576:720 = 0.800), so cuts are drawn with `coverCrop` — a small
 * top/bottom slice is trimmed. The character frames are designed with
 * padding, so the trim is visually safe.
 *
 * Grid index → cell:
 *   0 1
 *   2 3
 *   4 5
 *   6 7   ← gridIndex 7 = title cell (hand-painted)
 */

import type { Cut } from "./types";
import { CAPTURE_FRAMES, TITLE_FRAME } from "./frames";
import { coverCrop } from "./cover-crop-math";
import {
  BACKGROUND_PATTERNS,
  findBackgroundColor,
  findBackgroundPattern,
  type BackgroundChoice,
} from "./background-assets";

export const SHEET_WIDTH = 1080;
export const SHEET_HEIGHT = 2400;
export const SHEET_CELL_W = 510;
export const SHEET_CELL_H = 575;
export const SHEET_MARGIN_X = 20;
export const SHEET_MARGIN_Y = 20;
export const SHEET_GUTTER = 20;
export const SHEET_COLS = 2;
export const SHEET_ROWS = 4;
export const SHEET_TOTAL_CELLS = SHEET_COLS * SHEET_ROWS;

/**
 * Default background for the challenge sheet. Navy by default so the
 * sheet pops against the cream booth chrome — without this the sheet
 * blends into the surrounding cabinet UI and the window-grid effect
 * gets lost. Headline text auto-switches to white-on-navy when the bg
 * is dark; user can swap to any color via the sticker editor palette.
 */
export const DEFAULT_SHEET_BACKGROUND: BackgroundChoice = {
  kind: "color",
  colorId: "navy",
};

/** Brand strings — kept identical to overlay-composer (normal mode) so
 * both sheets read as the same product. */
const HEADLINE_KR = "9기와 추억남기기";
const HEADLINE_EN = "OZCODING PD09 NETWORKING DAY";
const FOOTER_TEXT = "2026.05.14 ⋆ MAKE MEMORIES ⋆ #PD09";

const FRAME_NAVY = "#1d2c4a";

export interface SheetCompositionOptions {
  /** Exactly 7 captured cuts (any order; matched by `frameId`). */
  cuts: ReadonlyArray<Cut>;
  /** Sheet-wide background — fills the entire 1080×2400 canvas. */
  background?: BackgroundChoice;
  /**
   * Deprecated. Cell 7 is now hand-painted from `paintTitleCell`, so the
   * old title-card PNG is unused. Kept optional so any legacy callers
   * still type-check; ignored at runtime.
   */
  titleCardImg?: HTMLImageElement;
}

const patternImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadPatternImage(src: string): Promise<HTMLImageElement> {
  const cached = patternImageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
  patternImageCache.set(src, promise);
  return promise;
}

/** Eager preload — caller fires-and-forgets at flow start so the first
 * re-compose after the user picks a pattern feels instant. */
export function preloadAllSheetBackgrounds(): void {
  for (const p of BACKGROUND_PATTERNS) {
    void loadPatternImage(p.src).catch(() => {
      /* swallow — paintBackground handles failure */
    });
  }
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
 * Compose all cuts + the painted title cell into a 1080×2400 PNG Blob.
 * Resolves to the Blob; rejects if the canvas context can't be acquired,
 * `cuts.length !== 7`, or `canvas.toBlob` fails.
 */
export async function composeSheet(
  options: SheetCompositionOptions,
): Promise<Blob> {
  const { cuts, background = DEFAULT_SHEET_BACKGROUND } = options;

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

  // 1. Sheet background — fills the entire sheet. The cuts cover most of
  //    it; the bg bleeds through as the outer frame + inter-cell gutters
  //    + cell 7 base. Frame and cell 7 therefore look continuous.
  await paintBackground(ctx, background);

  await ensurePixelFontReady();

  // 2. Cuts at cells 0..6 — cell aspect (~0.89) is slightly wider than the
  //    cut canvas (0.8), so use coverCrop to trim a small top/bottom slice
  //    while filling the cell uniformly.
  for (const frame of CAPTURE_FRAMES) {
    const cut = cuts.find((c) => c.frameId === frame.id);
    if (!cut || !cut.imageBitmap) continue;
    const { x, y } = cellRect(frame.gridIndex);
    const bmp = cut.imageBitmap;
    const c = coverCrop(bmp.width, bmp.height, SHEET_CELL_W, SHEET_CELL_H);
    ctx.drawImage(
      bmp,
      c.sx,
      c.sy,
      c.sw,
      c.sh,
      x,
      y,
      SHEET_CELL_W,
      SHEET_CELL_H,
    );
  }

  // 3. Cell 7 — title cell. The chosen bg bleeds through the cell; we
  //    paint the headline + sublines on top. Text colors flip with bg
  //    darkness so the same treatment reads on navy or cream.
  paintTitleCell(ctx, background);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("composeSheet: canvas.toBlob returned null"));
    }, "image/png");
  });
}

async function paintBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundChoice,
): Promise<void> {
  if (bg.kind === "color") {
    const color = findBackgroundColor(bg.colorId);
    ctx.fillStyle = color?.hex ?? FRAME_NAVY;
    ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
    return;
  }
  const pattern = findBackgroundPattern(bg.patternId);
  if (!pattern) {
    ctx.fillStyle = FRAME_NAVY;
    ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
    return;
  }
  try {
    const img = await loadPatternImage(pattern.src);
    const c = coverCrop(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      SHEET_WIDTH,
      SHEET_HEIGHT,
    );
    ctx.drawImage(
      img,
      c.sx,
      c.sy,
      c.sw,
      c.sh,
      0,
      0,
      SHEET_WIDTH,
      SHEET_HEIGHT,
    );
  } catch {
    ctx.fillStyle = pattern.accent;
    ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  }
}

function paintTitleCell(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundChoice,
): void {
  const { x, y } = cellRect(TITLE_FRAME.gridIndex);
  const w = SHEET_CELL_W;
  const h = SHEET_CELL_H;
  const cx = x + w / 2;
  const pixelFamily = getPixelFontFamily();
  const dark = isBgDark(bg);
  const fill = dark ? "#ffffff" : FRAME_NAVY;
  const stroke = dark ? FRAME_NAVY : "#ffffff";

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // Korean headline — sized up to fill the cell. Same outlined treatment
  // as the normal-mode `paintHeader` (overlay-composer), inverted on
  // dark bgs so navy default still reads.
  ctx.font = `56px ${pixelFamily}`;
  drawOutlinedText(ctx, HEADLINE_KR, cx, y + 180, {
    fill,
    stroke,
    strokeWidth: 10,
  });

  // English subline directly below.
  ctx.font = `24px ${pixelFamily}`;
  drawOutlinedText(ctx, HEADLINE_EN, cx, y + 230, {
    fill,
    stroke,
    strokeWidth: 6,
  });

  // Dated footer near the cell bottom — mirrors the normal-mode footer.
  ctx.font = `26px ${pixelFamily}`;
  drawOutlinedText(ctx, FOOTER_TEXT, cx, y + h - 55, {
    fill,
    stroke,
    strokeWidth: 6,
  });
  ctx.restore();
}

/**
 * Treat the sheet bg as "dark" so we can flip text fill to white. Colors
 * use BT.601 luminance; patterns assume light (most BACKGROUND_PATTERNS
 * are pastel halftones).
 */
function isBgDark(bg: BackgroundChoice): boolean {
  if (bg.kind !== "color") return false;
  const color = findBackgroundColor(bg.colorId);
  if (!color) return false;
  const hex = color.hex.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

interface OutlinedTextOptions {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: OutlinedTextOptions,
): void {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = opts.strokeWidth;
  ctx.strokeStyle = opts.stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, x, y);
}

let pixelFontReadyPromise: Promise<void> | null = null;

async function ensurePixelFontReady(): Promise<void> {
  if (typeof document === "undefined") return;
  if (!pixelFontReadyPromise) {
    pixelFontReadyPromise = (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore — fall back to system font */
      }
    })();
  }
  return pixelFontReadyPromise;
}

function getPixelFontFamily(): string {
  if (typeof document === "undefined") return "monospace";
  const cssVar = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-pixel-display")
    .trim();
  return `${cssVar || "DotGothic16"}, "DotGothic16", monospace`;
}
