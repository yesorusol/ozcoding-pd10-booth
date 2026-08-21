/**
 * lib/normal-layout.ts — Polaroid sheet geometry for normal mode.
 *
 * Sheet matches the native size of the normal-mode frame PNGs — pre-designed,
 * alpha-punched frames (headline/date/footer/decorations baked in, 4 photo
 * windows cut fully transparent, including wherever a corner character
 * overlaps a window). Photos are drawn FIRST at the cell rects below, then the
 * frame is drawn on top; the frame's own alpha does all the masking, so no
 * per-corner clipping or extraction hacks are needed. Rects are each frame's
 * measured transparent-window bounds, expanded a few px so the photo fully
 * bleeds under the window's anti-aliased alpha edge.
 *
 * Both frames share the same sheet size, so only the cell rects differ.
 */

export const NORMAL_SHEET_WIDTH = 1086;
export const NORMAL_SHEET_HEIGHT = 1448;

export const NORMAL_FRAME_IDS = ["clover", "green"] as const;
export type NormalFrameId = (typeof NORMAL_FRAME_IDS)[number];

export function parseNormalFrameId(
  value: string | null | undefined,
): NormalFrameId {
  if (value === "green") return "green";
  return "clover";
}

export interface PolaroidCellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
}

const BLEED = 4;

type RawCellRect = Omit<PolaroidCellRect, "rotationDeg">;

/** Transparent-window bounding boxes measured per frame PNG. */
const RAW_CELL_RECTS: Readonly<Record<NormalFrameId, ReadonlyArray<RawCellRect>>> = {
  clover: [
    { x: 585, y: 110, width: 437, height: 512 },
    { x: 65, y: 362, width: 467, height: 507 },
    { x: 585, y: 648, width: 437, height: 465 },
    { x: 65, y: 894, width: 467, height: 461 },
  ],
  green: [
    { x: 605, y: 91, width: 426, height: 464 },
    { x: 56, y: 356, width: 488, height: 439 },
    { x: 605, y: 672, width: 426, height: 385 },
    { x: 56, y: 820, width: 488, height: 506 },
  ],
};

const CELL_RECTS: Readonly<
  Record<NormalFrameId, ReadonlyArray<PolaroidCellRect>>
> = {
  clover: expand(RAW_CELL_RECTS.clover),
  green: expand(RAW_CELL_RECTS.green),
};

function expand(
  raw: ReadonlyArray<RawCellRect>,
): ReadonlyArray<PolaroidCellRect> {
  return raw.map((r) => ({
    x: r.x - BLEED,
    y: r.y - BLEED,
    width: r.width + BLEED * 2,
    height: r.height + BLEED * 2,
    rotationDeg: 0,
  }));
}

export function getNormalCellRects(
  frameId: NormalFrameId,
): ReadonlyArray<PolaroidCellRect> {
  return CELL_RECTS[frameId];
}

export function cellCenter(rect: PolaroidCellRect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}
