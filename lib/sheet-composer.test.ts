/**
 * lib/sheet-composer.test.ts — Sheet layout math + composition orchestration.
 *
 * Pure math (`cellRect`) is tested directly. `composeSheet` runs through a
 * stubbed canvas (jsdom doesn't render canvas pixels) where we observe
 * `drawImage` / `toBlob` calls and verify the right cells got drawn.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cellRect,
  composeSheet,
  SHEET_WIDTH,
  SHEET_HEIGHT,
  SHEET_CELL_W,
  SHEET_CELL_H,
  SHEET_MARGIN_X,
  SHEET_MARGIN_Y,
  SHEET_GUTTER,
} from "./sheet-composer";
import { CAPTURE_FRAMES, TITLE_FRAME } from "./frames";
import type { Cut } from "./types";

function fakeBitmap(): ImageBitmap {
  return {
    width: 576,
    height: 720,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

function makeCuts(): Cut[] {
  return CAPTURE_FRAMES.map((frame, i) => ({
    index: i,
    frameId: frame.id as Cut["frameId"],
    imageBitmap: fakeBitmap(),
    capturedAt: 1_000_000 + i,
  }));
}

function makeMockTitleImg(): HTMLImageElement {
  return {
    naturalWidth: 800,
    naturalHeight: 900,
    complete: true,
  } as unknown as HTMLImageElement;
}

describe("cellRect (sheet grid math)", () => {
  it("places cell 0 at top-left margin", () => {
    expect(cellRect(0)).toEqual({ x: SHEET_MARGIN_X, y: SHEET_MARGIN_Y });
  });

  it("places cell 1 to the right of cell 0 (with gutter)", () => {
    expect(cellRect(1)).toEqual({
      x: SHEET_MARGIN_X + SHEET_CELL_W + SHEET_GUTTER,
      y: SHEET_MARGIN_Y,
    });
  });

  it("places cell 2 below cell 0", () => {
    expect(cellRect(2)).toEqual({
      x: SHEET_MARGIN_X,
      y: SHEET_MARGIN_Y + SHEET_CELL_H + SHEET_GUTTER,
    });
  });

  it("places title-card cell (index 7) at bottom-right", () => {
    expect(cellRect(7)).toEqual({
      x: SHEET_MARGIN_X + SHEET_CELL_W + SHEET_GUTTER,
      y: SHEET_MARGIN_Y + 3 * (SHEET_CELL_H + SHEET_GUTTER),
    });
  });

  it("right edge of cell 1 = sheet width − marginX (exact fit)", () => {
    const c1 = cellRect(1);
    expect(c1.x + SHEET_CELL_W).toBe(SHEET_WIDTH - SHEET_MARGIN_X);
  });

  it("bottom edge of cell 7 = sheet height − marginY (exact fit)", () => {
    const c7 = cellRect(7);
    expect(c7.y + SHEET_CELL_H).toBe(SHEET_HEIGHT - SHEET_MARGIN_Y);
  });
});

interface StubCanvas {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
}

function setupCanvas(getCtx: () => CanvasRenderingContext2D | null): StubCanvas {
  const stub: StubCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(getCtx),
    toBlob: vi.fn((cb: BlobCallback) => cb(new Blob(["fake"], { type: "image/png" }))),
  };
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return stub as unknown as HTMLCanvasElement;
    return origCreate(tag);
  });
  return stub;
}

describe("composeSheet", () => {
  let drawImage: ReturnType<typeof vi.fn>;
  let fillRect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    drawImage = vi.fn();
    fillRect = vi.fn();
    setupCanvas(() => ({
      drawImage,
      fillRect,
      fillStyle: "",
    }) as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when cuts.length !== 7", async () => {
    const titleImg = makeMockTitleImg();
    await expect(composeSheet({ cuts: [], titleCardImg: titleImg })).rejects.toThrow(
      /expected 7 cuts/,
    );
  });

  it("creates a 1080×2400 canvas and fills the background", async () => {
    const titleImg = makeMockTitleImg();
    const blob = await composeSheet({ cuts: makeCuts(), titleCardImg: titleImg });
    expect(blob).toBeInstanceOf(Blob);
    expect(fillRect).toHaveBeenCalledWith(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  });

  it("draws all 7 cuts plus the title card (8 drawImage calls)", async () => {
    const titleImg = makeMockTitleImg();
    await composeSheet({ cuts: makeCuts(), titleCardImg: titleImg });
    expect(drawImage).toHaveBeenCalledTimes(8);
  });

  it("draws each cut at its frame's grid cell position", async () => {
    const titleImg = makeMockTitleImg();
    const cuts = makeCuts();
    await composeSheet({ cuts, titleCardImg: titleImg });

    // Calls 0..6 are cuts in CAPTURE_FRAMES order, call 7 is the title card.
    for (let i = 0; i < CAPTURE_FRAMES.length; i++) {
      const frame = CAPTURE_FRAMES[i];
      const expected = cellRect(frame.gridIndex);
      const args = drawImage.mock.calls[i];
      // ctx.drawImage(bitmap, x, y, w, h) — 5-arg form for cuts
      expect(args[1]).toBe(expected.x);
      expect(args[2]).toBe(expected.y);
      expect(args[3]).toBe(SHEET_CELL_W);
      expect(args[4]).toBe(SHEET_CELL_H);
    }
  });

  it("draws the title card at bottom-right with cover-crop math", async () => {
    const titleImg = makeMockTitleImg();
    await composeSheet({ cuts: makeCuts(), titleCardImg: titleImg });

    // Last call is the title card. 9-arg drawImage form: (img, sx, sy, sw, sh, dx, dy, dw, dh)
    const titleArgs = drawImage.mock.calls[7];
    const titlePos = cellRect(TITLE_FRAME.gridIndex);
    expect(titleArgs[5]).toBe(titlePos.x);   // dx
    expect(titleArgs[6]).toBe(titlePos.y);   // dy
    expect(titleArgs[7]).toBe(SHEET_CELL_W); // dw
    expect(titleArgs[8]).toBe(SHEET_CELL_H); // dh
  });

  it("skips cuts whose imageBitmap is null", async () => {
    const titleImg = makeMockTitleImg();
    const cuts = makeCuts();
    // null out the third cut's bitmap
    cuts[2] = { ...cuts[2], imageBitmap: null };
    await composeSheet({ cuts, titleCardImg: titleImg });
    // 6 cuts + 1 title = 7 drawImage calls
    expect(drawImage).toHaveBeenCalledTimes(7);
  });

  it("skips title-card draw if the image isn't loaded", async () => {
    const titleImg = {
      naturalWidth: 0,
      naturalHeight: 0,
      complete: false,
    } as unknown as HTMLImageElement;
    await composeSheet({ cuts: makeCuts(), titleCardImg: titleImg });
    expect(drawImage).toHaveBeenCalledTimes(7);
  });

  it("rejects when the 2D context can't be acquired", async () => {
    vi.restoreAllMocks();
    setupCanvas(() => null);
    const titleImg = makeMockTitleImg();
    await expect(
      composeSheet({ cuts: makeCuts(), titleCardImg: titleImg }),
    ).rejects.toThrow(/2D canvas context unavailable/);
  });

  it("rejects when toBlob returns null", async () => {
    vi.restoreAllMocks();
    const stub = setupCanvas(() => ({
      drawImage,
      fillRect,
      fillStyle: "",
    }) as unknown as CanvasRenderingContext2D);
    stub.toBlob = vi.fn((cb: BlobCallback) => cb(null));
    const titleImg = makeMockTitleImg();
    await expect(
      composeSheet({ cuts: makeCuts(), titleCardImg: titleImg }),
    ).rejects.toThrow(/toBlob returned null/);
  });
});
