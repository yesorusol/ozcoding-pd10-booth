/**
 * lib/capture.test.ts — Unit tests for captureCut.
 *
 * jsdom doesn't provide a working CanvasRenderingContext2D or
 * createImageBitmap, so the tests stub document.createElement('canvas'),
 * the 2D context's drawImage, and the global createImageBitmap. We then
 * assert that the right drawImage source rects (cover-fit) are used and
 * that the mirror policy is honored: the video step wraps a
 * translate+scale(-1,1) transform (matches the live preview), and the
 * frame PNG is drawn unflipped at the same scope.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureCut, captureRawCut, CUT_WIDTH, CUT_HEIGHT } from "./capture";

function makeMockVideo(w: number, h: number): HTMLVideoElement {
  return { videoWidth: w, videoHeight: h } as unknown as HTMLVideoElement;
}

function makeMockFrame(w: number, h: number, complete = true): HTMLImageElement {
  return {
    naturalWidth: w,
    naturalHeight: h,
    complete,
  } as unknown as HTMLImageElement;
}

interface FakeCanvas {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
}

function setupCanvasMock(getContextImpl: () => CanvasRenderingContext2D | null) {
  const fakeCanvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(getContextImpl),
  };
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return fakeCanvas as unknown as HTMLCanvasElement;
    return origCreate(tag);
  });
  return fakeCanvas;
}

describe("captureCut", () => {
  let drawImage: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;
  let restore: ReturnType<typeof vi.fn>;
  let translate: ReturnType<typeof vi.fn>;
  let scale: ReturnType<typeof vi.fn>;
  let originalCreateImageBitmap: typeof globalThis.createImageBitmap | undefined;

  beforeEach(() => {
    drawImage = vi.fn();
    save = vi.fn();
    restore = vi.fn();
    translate = vi.fn();
    scale = vi.fn();
    setupCanvasMock(
      () => ({ drawImage, save, restore, translate, scale }) as unknown as CanvasRenderingContext2D,
    );

    originalCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: CUT_WIDTH, height: CUT_HEIGHT, close: vi.fn() } as unknown as ImageBitmap);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCreateImageBitmap === undefined) {
      delete (globalThis as { createImageBitmap?: typeof globalThis.createImageBitmap }).createImageBitmap;
    } else {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    }
  });

  it("sizes the canvas to 576×720 and returns the resulting ImageBitmap", async () => {
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(800, 900);
    const bitmap = await captureCut({ video, frameImg: frame });
    expect(globalThis.createImageBitmap).toHaveBeenCalledOnce();
    const canvasArg = (globalThis.createImageBitmap as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { width: number; height: number };
    expect(canvasArg.width).toBe(CUT_WIDTH);
    expect(canvasArg.height).toBe(CUT_HEIGHT);
    expect(bitmap).toBeDefined();
  });

  it("draws video first, then frame (z-order: frame on top)", async () => {
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(800, 900);
    await captureCut({ video, frameImg: frame });
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls[0][0]).toBe(video);
    expect(drawImage.mock.calls[1][0]).toBe(frame);
  });

  it("mirrors the video draw — translate+scale(-1,1) wraps the video drawImage and is undone before the frame draw", async () => {
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(800, 900);
    await captureCut({ video, frameImg: frame });
    expect(save).toHaveBeenCalledOnce();
    expect(translate).toHaveBeenCalledWith(CUT_WIDTH, 0);
    expect(scale).toHaveBeenCalledWith(-1, 1);
    expect(restore).toHaveBeenCalledOnce();
    // Destination rect is still positive; the flip lives in the matrix.
    const args = drawImage.mock.calls[0];
    expect(args[5]).toBe(0);
    expect(args[6]).toBe(0);
    expect(args[7]).toBe(CUT_WIDTH);
    expect(args[8]).toBe(CUT_HEIGHT);
  });

  it("uses cover-crop for video 1280×720 → 576×720 (centers horizontally)", async () => {
    // cover scale = max(576/1280, 720/720) = max(0.45, 1.0) = 1.0
    // sw = 576 / 1.0 = 576; sh = 720 / 1.0 = 720
    // sx = (1280 − 576) / 2 = 352; sy = (720 − 720) / 2 = 0
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(800, 900);
    await captureCut({ video, frameImg: frame });
    const args = drawImage.mock.calls[0];
    expect(args[1]).toBe(352);
    expect(args[2]).toBe(0);
    expect(args[3]).toBe(576);
    expect(args[4]).toBe(720);
  });

  it("uses cover-crop for frame 800×900 → 576×720 (clips 40px transparent margins)", async () => {
    // Frame aspect 0.889, cut aspect 0.8.
    // cover scale = max(576/800, 720/900) = max(0.72, 0.8) = 0.8
    // sw = 576 / 0.8 = 720; sh = 720 / 0.8 = 900
    // sx = (800 − 720) / 2 = 40; sy = (900 − 900) / 2 = 0
    // The 40px sx exactly clips the M1 transparent left margin.
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(800, 900);
    await captureCut({ video, frameImg: frame });
    const args = drawImage.mock.calls[1];
    expect(args[1]).toBe(40);
    expect(args[2]).toBe(0);
    expect(args[3]).toBe(720);
    expect(args[4]).toBe(900);
  });

  it("skips the video draw when videoWidth is 0 (camera not initialized)", async () => {
    const video = makeMockVideo(0, 0);
    const frame = makeMockFrame(800, 900);
    await captureCut({ video, frameImg: frame });
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0][0]).toBe(frame);
  });

  it("skips the frame draw when the image hasn't loaded", async () => {
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(0, 0, false);
    await captureCut({ video, frameImg: frame });
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0][0]).toBe(video);
  });

  it("throws when a 2D context cannot be acquired", async () => {
    vi.restoreAllMocks();
    setupCanvasMock(() => null);
    const video = makeMockVideo(1280, 720);
    const frame = makeMockFrame(800, 900);
    await expect(captureCut({ video, frameImg: frame })).rejects.toThrow(
      /2D canvas context unavailable/,
    );
  });
});

describe("captureRawCut", () => {
  let drawImage: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;
  let restore: ReturnType<typeof vi.fn>;
  let translate: ReturnType<typeof vi.fn>;
  let scale: ReturnType<typeof vi.fn>;
  let originalCreateImageBitmap: typeof globalThis.createImageBitmap | undefined;

  beforeEach(() => {
    drawImage = vi.fn();
    save = vi.fn();
    restore = vi.fn();
    translate = vi.fn();
    scale = vi.fn();
    setupCanvasMock(
      () => ({ drawImage, save, restore, translate, scale }) as unknown as CanvasRenderingContext2D,
    );

    originalCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: CUT_WIDTH, height: CUT_HEIGHT, close: vi.fn() } as unknown as ImageBitmap);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCreateImageBitmap === undefined) {
      delete (globalThis as { createImageBitmap?: typeof globalThis.createImageBitmap }).createImageBitmap;
    } else {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    }
  });

  it("returns a 576×720 ImageBitmap with no frame draw", async () => {
    const video = makeMockVideo(1280, 720);
    const bitmap = await captureRawCut({ video });
    expect(globalThis.createImageBitmap).toHaveBeenCalledOnce();
    const canvasArg = (globalThis.createImageBitmap as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { width: number; height: number };
    expect(canvasArg.width).toBe(CUT_WIDTH);
    expect(canvasArg.height).toBe(CUT_HEIGHT);
    expect(bitmap).toBeDefined();
    // Only the video draw — no second drawImage for a frame overlay.
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0][0]).toBe(video);
  });

  it("works without a frameImg argument and uses cover-crop math", async () => {
    const video = makeMockVideo(1280, 720);
    await captureRawCut({ video });
    const args = drawImage.mock.calls[0];
    expect(args[1]).toBe(352);  // sx
    expect(args[2]).toBe(0);    // sy
    expect(args[3]).toBe(576);  // sw
    expect(args[4]).toBe(720);  // sh
    expect(args[7]).toBe(CUT_WIDTH);
    expect(args[8]).toBe(CUT_HEIGHT);
  });
});
