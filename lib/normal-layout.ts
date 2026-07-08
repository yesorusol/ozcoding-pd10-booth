/**
 * lib/normal-layout.ts — Polaroid sheet geometry for normal mode.
 *
 * Sheet matches the native size of `public/overlays/normal-frame.png` — a
 * pre-designed, alpha-punched frame (headline/date/footer/decorations baked
 * in, 4 photo windows cut fully transparent, including wherever a corner
 * character overlaps a window). Photos are drawn FIRST at the cell rects
 * below, then the frame is drawn on top; the frame's own alpha does all the
 * masking, so no per-corner clipping or extraction hacks are needed. Rects
 * are the frame's measured transparent-window bounds, expanded a few px so
 * the photo fully bleeds under the window's anti-aliased alpha edge.
 */

export const NORMAL_SHEET_WIDTH = 1086;
export const NORMAL_SHEET_HEIGHT = 1448;

export interface PolaroidCellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
}

const BLEED = 4;

/** Transparent-window bounding boxes measured from normal-frame.png. */
const RAW_CELL_RECTS: ReadonlyArray<Omit<PolaroidCellRect, "rotationDeg">> = [
  { x: 152, y: 288, width: 378, height: 444 },
  { x: 562, y: 290, width: 376, height: 440 },
  { x: 156, y: 760, width: 372, height: 446 },
  { x: 562, y: 760, width: 376, height: 446 },
];

export const NORMAL_CELL_RECTS: ReadonlyArray<PolaroidCellRect> =
  RAW_CELL_RECTS.map((r) => ({
    x: r.x - BLEED,
    y: r.y - BLEED,
    width: r.width + BLEED * 2,
    height: r.height + BLEED * 2,
    rotationDeg: 0,
  }));

export function cellCenter(rect: PolaroidCellRect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}
