/**
 * lib/normal-layout.ts — Polaroid sheet geometry for normal mode.
 *
 * Sheet matches the native size of `public/overlays/normal-frame.png`
 * (a pre-designed frame with headline/date/footer baked in and 4 white
 * cutout windows for the photos). Cell rects below were measured directly
 * off that PNG's white cutout bounding boxes, then inset a few px so a
 * rounded-rect-clipped photo tucks under the frame's rounded window border
 * instead of poking past its corners.
 */

export const NORMAL_SHEET_WIDTH = 1086;
export const NORMAL_SHEET_HEIGHT = 1448;

/** Corner radius used to clip each photo so it matches the frame's rounded windows. */
export const NORMAL_CELL_RADIUS = 20;

export interface PolaroidCellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
}

const CELL_INSET = 6;

/** Raw white-window bounding boxes measured from normal-frame.png. */
const RAW_CELL_RECTS: ReadonlyArray<Omit<PolaroidCellRect, "rotationDeg">> = [
  { x: 156, y: 292, width: 372, height: 438 },
  { x: 562, y: 292, width: 374, height: 438 },
  { x: 156, y: 760, width: 372, height: 446 },
  { x: 562, y: 760, width: 374, height: 446 },
];

export const NORMAL_CELL_RECTS: ReadonlyArray<PolaroidCellRect> =
  RAW_CELL_RECTS.map((r) => ({
    x: r.x + CELL_INSET,
    y: r.y + CELL_INSET,
    width: r.width - CELL_INSET * 2,
    height: r.height - CELL_INSET * 2,
    rotationDeg: 0,
  }));

export function cellCenter(rect: PolaroidCellRect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}
