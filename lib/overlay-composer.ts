/**
 * lib/overlay-composer.ts — Normal-mode (borderless purikura) sheet composer.
 *
 * Tone-and-manner: pixel-font header / footer text floating directly on the
 * chosen sheet background — no yellow band, no rule lines. Cells get a navy
 * hairline border. Sparkle accents in cell corners.
 *
 * Inputs:
 *   - cuts: 4 captured ImageBitmaps in capture order
 *   - background: BackgroundChoice (pattern path or color id)
 *
 * Output: a 1080×1440 PNG blob.
 */

import { coverCrop } from "./cover-crop-math";
import {
  NORMAL_CELL_RECTS,
  NORMAL_FOOTER_HEIGHT,
  NORMAL_HEADER_HEIGHT,
  NORMAL_SHEET_HEIGHT,
  NORMAL_SHEET_WIDTH,
  cellCenter,
} from "./normal-layout";
import {
  BACKGROUND_PATTERNS,
  DEFAULT_BACKGROUND,
  findBackgroundColor,
  findBackgroundPattern,
  type BackgroundChoice,
} from "./background-assets";

export interface OverlayComposerCut {
  index: number;
  imageBitmap: ImageBitmap | null;
}

export interface OverlayComposerOptions {
  cuts: ReadonlyArray<OverlayComposerCut>;
  background?: BackgroundChoice;
}

const HEADLINE_KR = "9기와 추억남기기";
const HEADLINE_EN = "OZCODING PD09 NETWORKING DAY";
const FOOTER_TEXT = "2026.05.14 ⋆ MAKE MEMORIES ⋆ #PD09";

const FRAME_NAVY = "#1d2c4a";
const ACCENT_YELLOW = "#fff36b";

/** Cache loaded pattern images so re-composes are cheap. */
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

/** Best-effort eager preload — caller can fire-and-forget at editor open. */
export function preloadAllPatternImages(): void {
  for (const p of BACKGROUND_PATTERNS) {
    void loadPatternImage(p.src).catch(() => {
      /* ignore — paintBackground handles failure */
    });
  }
}

export async function composeOverlaySheet(
  options: OverlayComposerOptions,
): Promise<Blob> {
  const { cuts, background = DEFAULT_BACKGROUND } = options;

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

  await paintBackground(ctx, background);
  await ensurePixelFontReady();

  for (let i = 0; i < NORMAL_CELL_RECTS.length; i++) {
    const rect = NORMAL_CELL_RECTS[i];
    const cut = cuts[i];
    if (!cut || !cut.imageBitmap) continue;

    const center = cellCenter(rect);
    const bmp = cut.imageBitmap;
    const c = coverCrop(bmp.width, bmp.height, rect.width, rect.height);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.drawImage(
      bmp,
      c.sx,
      c.sy,
      c.sw,
      c.sh,
      -rect.width / 2,
      -rect.height / 2,
      rect.width,
      rect.height,
    );
    ctx.restore();
  }

  paintHeader(ctx);
  paintFooter(ctx);
  paintCornerSparkles(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("composeOverlaySheet: canvas.toBlob returned null"));
    }, "image/png");
  });
}

async function paintBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundChoice,
) {
  if (bg.kind === "color") {
    const color = findBackgroundColor(bg.colorId);
    ctx.fillStyle = color?.hex ?? "#ffffff";
    ctx.fillRect(0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
    return;
  }
  const pattern = findBackgroundPattern(bg.patternId);
  if (!pattern) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
    return;
  }
  try {
    const img = await loadPatternImage(pattern.src);
    // Cover-fit the pattern to the sheet (no distortion).
    const c = coverCrop(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      NORMAL_SHEET_WIDTH,
      NORMAL_SHEET_HEIGHT,
    );
    ctx.drawImage(
      img,
      c.sx,
      c.sy,
      c.sw,
      c.sh,
      0,
      0,
      NORMAL_SHEET_WIDTH,
      NORMAL_SHEET_HEIGHT,
    );
  } catch {
    ctx.fillStyle = pattern.accent;
    ctx.fillRect(0, 0, NORMAL_SHEET_WIDTH, NORMAL_SHEET_HEIGHT);
  }
}

function paintHeader(ctx: CanvasRenderingContext2D): void {
  const h = NORMAL_HEADER_HEIGHT;
  const pixelFamily = getPixelFontFamily();

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // Korean headline — large pixel text with white outline for legibility.
  // " ♥" is appended so the heart renders in the same DotGothic16 pixel
  // font as the rest of the headline (no separate image).
  ctx.font = `40px ${pixelFamily}`;
  drawOutlinedText(ctx, `${HEADLINE_KR} ♥`, NORMAL_SHEET_WIDTH / 2, h / 2 - 14, {
    fill: FRAME_NAVY,
    stroke: "#ffffff",
    strokeWidth: 8,
  });

  // English subline — smaller pixel text, same outline.
  ctx.font = `20px ${pixelFamily}`;
  drawOutlinedText(ctx, HEADLINE_EN, NORMAL_SHEET_WIDTH / 2, h / 2 + 22, {
    fill: FRAME_NAVY,
    stroke: "#ffffff",
    strokeWidth: 5,
  });
  ctx.restore();
}

function paintFooter(ctx: CanvasRenderingContext2D) {
  const h = NORMAL_FOOTER_HEIGHT;
  const y = NORMAL_SHEET_HEIGHT - h;
  const pixelFamily = getPixelFontFamily();

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `30px ${pixelFamily}`;
  drawOutlinedText(ctx, FOOTER_TEXT, NORMAL_SHEET_WIDTH / 2, y + h / 2, {
    fill: FRAME_NAVY,
    stroke: "#ffffff",
    strokeWidth: 6,
  });
  ctx.restore();
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
) {
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
  // CSS var resolves to the next/font-generated family stack already;
  // append plain DotGothic16 + monospace as belt-and-suspenders fallback.
  return `${cssVar || "DotGothic16"}, "DotGothic16", monospace`;
}

function paintCornerSparkles(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = ACCENT_YELLOW;
  for (const rect of NORMAL_CELL_RECTS) {
    drawStar(ctx, rect.x + 12, rect.y + 12, 8);
    drawStar(ctx, rect.x + rect.width - 14, rect.y + rect.height - 14, 6);
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  // 4-point pixel sparkle: vertical + horizontal cross
  ctx.fillRect(cx - 1, cy - size, 2, size * 2);
  ctx.fillRect(cx - size, cy - 1, size * 2, 2);
}

