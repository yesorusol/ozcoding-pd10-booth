/**
 * lib/capture.ts — M4 cut composition.
 *
 * Composes a single captured cut by drawing the live <video> frame and the
 * active frame PNG onto a 576×720 RGBA canvas (aspect 0.8 — matches the
 * frame artwork and LiveOverlay viewport). Returns the result as an
 * ImageBitmap that the sheet composer (M5) will draw into one of the 4×2
 * grid cells.
 *
 * Mirror policy:
 *   • The LIVE preview is mirrored via CSS (`transform: scaleX(-1)`) on the
 *     <video> element — selfie convention.
 *   • The captured cut **also mirrors the video** so the saved photo
 *     matches what the user saw in the kiosk. Users complained that the
 *     un-mirrored capture flipped their pose relative to the live preview,
 *     which felt wrong at the booth. We apply `ctx.scale(-1, 1)` only
 *     around the video draw — the frame PNG is drawn un-mirrored so any
 *     text or asymmetric artwork on the frame still reads correctly.
 *
 * Cover-fit math (locked across M2 / M4):
 *   • The container in LiveOverlay uses `object-fit: cover` to fit the
 *     1280×720 camera stream inside a 576:720-aspect box. We reproduce the
 *     identical crop here using `lib/cover-crop-math.ts`.
 *   • Frame PNGs are 800×900 (M1 padded 720×900 → 800×900 with 40px
 *     transparent each side). Cover-fit into 576×720 clips exactly the
 *     transparent margins, so the captured cut shows the same artwork the
 *     user saw.
 */

import { coverCrop } from "./cover-crop-math";

/** Per-cut canvas width in pixels. Aspect 0.8 paired with CUT_HEIGHT. */
export const CUT_WIDTH = 576;
/** Per-cut canvas height in pixels. */
export const CUT_HEIGHT = 720;

export interface CaptureCutOptions {
  /** Live <video> element with an attached MediaStream. */
  video: HTMLVideoElement;
  /** Loaded frame PNG (HTMLImageElement) for the active cut. */
  frameImg: HTMLImageElement;
}

export interface CaptureRawCutOptions {
  /** Live <video> element with an attached MediaStream. */
  video: HTMLVideoElement;
}

/**
 * Capture only the live video frame (no overlay) into a 576×720 RGBA
 * ImageBitmap, mirrored to match the on-screen preview. Used by normal
 * mode where the polaroid overlay is composited later by
 * `composeOverlaySheet`.
 */
export async function captureRawCut(
  options: CaptureRawCutOptions,
): Promise<ImageBitmap> {
  const { video } = options;

  const canvas = document.createElement("canvas");
  canvas.width = CUT_WIDTH;
  canvas.height = CUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("captureRawCut: 2D canvas context unavailable");
  }

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const v = coverCrop(
      video.videoWidth,
      video.videoHeight,
      CUT_WIDTH,
      CUT_HEIGHT,
    );
    ctx.save();
    ctx.translate(CUT_WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, v.sx, v.sy, v.sw, v.sh, 0, 0, CUT_WIDTH, CUT_HEIGHT);
    ctx.restore();
  }

  return await createImageBitmap(canvas);
}

/**
 * Compose video + frame into a 576×720 RGBA ImageBitmap. The video step
 * is mirrored (matches the live preview); the frame PNG is drawn at
 * normal orientation so its text/artwork stays correct.
 * Throws if a 2D rendering context can't be acquired.
 */
export async function captureCut(
  options: CaptureCutOptions,
): Promise<ImageBitmap> {
  const { video, frameImg } = options;

  const canvas = document.createElement("canvas");
  canvas.width = CUT_WIDTH;
  canvas.height = CUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("captureCut: 2D canvas context unavailable");
  }

  // Step 1 — draw the live video frame, mirrored to match the preview,
  // cover-fit. The scale/translate is scoped between save/restore so the
  // frame draw below stays unflipped.
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const v = coverCrop(
      video.videoWidth,
      video.videoHeight,
      CUT_WIDTH,
      CUT_HEIGHT,
    );
    ctx.save();
    ctx.translate(CUT_WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, v.sx, v.sy, v.sw, v.sh, 0, 0, CUT_WIDTH, CUT_HEIGHT);
    ctx.restore();
  }

  // Step 2 — overlay the frame PNG, cover-fit (identical to LiveOverlay).
  if (frameImg.complete && frameImg.naturalWidth > 0) {
    const f = coverCrop(
      frameImg.naturalWidth,
      frameImg.naturalHeight,
      CUT_WIDTH,
      CUT_HEIGHT,
    );
    ctx.drawImage(frameImg, f.sx, f.sy, f.sw, f.sh, 0, 0, CUT_WIDTH, CUT_HEIGHT);
  }

  return await createImageBitmap(canvas);
}
