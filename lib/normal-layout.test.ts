/**
 * lib/normal-layout.test.ts — Coordinate bounds + cellCenter math.
 */

import { describe, it, expect } from "vitest";
import {
  NORMAL_CELL_RECTS,
  NORMAL_SHEET_HEIGHT,
  NORMAL_SHEET_WIDTH,
  cellCenter,
} from "./normal-layout";

describe("NORMAL_CELL_RECTS", () => {
  it("declares exactly 4 cells (one per polaroid)", () => {
    expect(NORMAL_CELL_RECTS).toHaveLength(4);
  });

  it("each cell stays within the 1080×1440 sheet bounds (axis-aligned)", () => {
    for (const rect of NORMAL_CELL_RECTS) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(NORMAL_SHEET_WIDTH);
      expect(rect.y + rect.height).toBeLessThanOrEqual(NORMAL_SHEET_HEIGHT);
    }
  });

  it("each cell has positive width and height", () => {
    for (const rect of NORMAL_CELL_RECTS) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  it("rotation magnitude stays small (< 10°) so polaroids look natural", () => {
    for (const rect of NORMAL_CELL_RECTS) {
      expect(Math.abs(rect.rotationDeg)).toBeLessThan(10);
    }
  });
});

describe("cellCenter", () => {
  it("returns the geometric center of the rect", () => {
    expect(cellCenter({ x: 0, y: 0, width: 100, height: 200, rotationDeg: 0 })).toEqual({
      x: 50,
      y: 100,
    });
  });

  it("returns center for the first declared cell", () => {
    const r = NORMAL_CELL_RECTS[0];
    expect(cellCenter(r)).toEqual({
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
    });
  });
});
