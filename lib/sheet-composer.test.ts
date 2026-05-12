/**
 * lib/sheet-composer.test.ts — Sheet layout math + composition orchestration.
 *
 * Pure math (`cellRect`) is tested directly. `composeSheet` runs through a
 * stubbed canvas (jsdom doesn't render canvas pixels) where we observe
 * `drawImage` / `fillText` / `toBlob` calls and verify the right cells got
 * drawn.
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
import { CAPTURE_FRAMES } from "./frames";
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

  it("places title-cell (index 7) at bottom-right", () => {
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

function makeCtxStub(overrides: Partial<CanvasRenderingContext2D> = {}) {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    miterLimit: 0,
    textBaseline: "",
    textAlign: "",
    font: "",
    globalAlpha: 1,
    ...overrides,
  } as unknown as CanvasRenderingContext2D;
}

describe("composeSheet", () => {
  let ctxStub: ReturnType<typeof makeCtxStub>;

  beforeEach(() => {
    ctxStub = makeCtxStub();
    setupCanvas(() => ctxStub);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when cuts.length !== 7", async () => {
    await expect(composeSheet({ cuts: [] })).rejects.toThrow(
      /expected 7 cuts/,
    );
  });

  it("creates a 1080×2400 canvas and fills the background", async () => {
    const blob = await composeSheet({ cuts: makeCuts() });
    expect(blob).toBeInstanceOf(Blob);
    expect(ctxStub.fillRect).toHaveBeenCalledWith(
      0,
      0,
      SHEET_WIDTH,
      SHEET_HEIGHT,
    );
  });

  it("draws all 7 cuts (cell 7 is hand-painted, no PNG)", async () => {
    await composeSheet({ cuts: makeCuts() });
    // Default bg is a color (navy) so no pattern image is drawn; only
    // the 7 cuts call drawImage.
    expect(ctxStub.drawImage).toHaveBeenCalledTimes(7);
  });

  it("paints the cell-7 headline + footer text (outlined)", async () => {
    await composeSheet({ cuts: makeCuts() });
    // drawOutlinedText emits both strokeText and fillText for each of
    // HEADLINE_KR / HEADLINE_EN / FOOTER_TEXT.
    expect(ctxStub.fillText).toHaveBeenCalled();
    expect(ctxStub.strokeText).toHaveBeenCalled();
  });

  it("draws each cut at its frame's grid cell position", async () => {
    const cuts = makeCuts();
    await composeSheet({ cuts });
    const drawCalls = (ctxStub.drawImage as unknown as ReturnType<typeof vi.fn>)
      .mock.calls;
    for (let i = 0; i < CAPTURE_FRAMES.length; i++) {
      const frame = CAPTURE_FRAMES[i];
      const expected = cellRect(frame.gridIndex);
      const args = drawCalls[i];
      // ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) — 9-arg form
      // for cuts (we cover-crop into the slightly wider cell).
      expect(args[5]).toBe(expected.x);
      expect(args[6]).toBe(expected.y);
      expect(args[7]).toBe(SHEET_CELL_W);
      expect(args[8]).toBe(SHEET_CELL_H);
    }
  });

  it("skips cuts whose imageBitmap is null", async () => {
    const cuts = makeCuts();
    cuts[2] = { ...cuts[2], imageBitmap: null };
    await composeSheet({ cuts });
    expect(ctxStub.drawImage).toHaveBeenCalledTimes(6);
  });

  it("rejects when the 2D context can't be acquired", async () => {
    vi.restoreAllMocks();
    setupCanvas(() => null);
    await expect(composeSheet({ cuts: makeCuts() })).rejects.toThrow(
      /2D canvas context unavailable/,
    );
  });

  it("rejects when toBlob returns null", async () => {
    vi.restoreAllMocks();
    const stub = setupCanvas(() => makeCtxStub());
    stub.toBlob = vi.fn((cb: BlobCallback) => cb(null));
    await expect(composeSheet({ cuts: makeCuts() })).rejects.toThrow(
      /toBlob returned null/,
    );
  });
});
