/**
 * lib/normal-layout.ts — Polaroid sheet geometry for normal mode.
 *
 * Sheet is 1080×1440 (3:4 portrait). Borderless purikura layout:
 * 2×2 cells, flush edges, thin gaps, no per-cell rotation. A header
 * band sits at top and a footer band at bottom; the four photo cells
 * fill the middle with a thin gutter so the result reads as a sticker
 * sheet rather than a polaroid stack.
 */

export const NORMAL_SHEET_WIDTH = 1080;
export const NORMAL_SHEET_HEIGHT = 1440;
export const NORMAL_BACKGROUND = "#fff5f8";

/** Decorative band heights — referenced by both layout and composer. */
export const NORMAL_HEADER_HEIGHT = 96;
export const NORMAL_FOOTER_HEIGHT = 96;
/** Outer margin & inter-cell gap. */
export const NORMAL_MARGIN = 18;
export const NORMAL_GUTTER = 14;

export interface PolaroidCellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
}

const innerLeft = NORMAL_MARGIN;
const innerTop = NORMAL_HEADER_HEIGHT + NORMAL_MARGIN;
const innerWidth = NORMAL_SHEET_WIDTH - NORMAL_MARGIN * 2;
const innerHeight =
  NORMAL_SHEET_HEIGHT -
  NORMAL_HEADER_HEIGHT -
  NORMAL_FOOTER_HEIGHT -
  NORMAL_MARGIN * 2;
const cellW = (innerWidth - NORMAL_GUTTER) / 2;
const cellH = (innerHeight - NORMAL_GUTTER) / 2;

export const NORMAL_CELL_RECTS: ReadonlyArray<PolaroidCellRect> = [
  { x: innerLeft, y: innerTop, width: cellW, height: cellH, rotationDeg: 0 },
  {
    x: innerLeft + cellW + NORMAL_GUTTER,
    y: innerTop,
    width: cellW,
    height: cellH,
    rotationDeg: 0,
  },
  {
    x: innerLeft,
    y: innerTop + cellH + NORMAL_GUTTER,
    width: cellW,
    height: cellH,
    rotationDeg: 0,
  },
  {
    x: innerLeft + cellW + NORMAL_GUTTER,
    y: innerTop + cellH + NORMAL_GUTTER,
    width: cellW,
    height: cellH,
    rotationDeg: 0,
  },
] as const;

export function cellCenter(rect: PolaroidCellRect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}
