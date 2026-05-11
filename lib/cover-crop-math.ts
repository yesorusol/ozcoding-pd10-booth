/**
 * lib/cover-crop-math.ts — Pure helper that computes the drawImage source rect
 * (sx, sy, sw, sh) such that the resulting draw matches CSS `object-fit: cover`
 * from a source video into a target canvas.
 *
 * Usage:
 *   const { sx, sy, sw, sh } = coverCrop(video.videoWidth, video.videoHeight, 512, 576);
 *   ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dstW, dstH);
 */

export interface CoverCropResult {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Compute drawImage source rect for object-fit: cover.
 *
 * The draw call: ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dstW, dstH)
 * yields the same crop as CSS object-fit: cover would render.
 *
 * @param srcW source width in raw pixels (e.g. video.videoWidth)
 * @param srcH source height in raw pixels (e.g. video.videoHeight)
 * @param dstW destination width (target canvas)
 * @param dstH destination height (target canvas)
 *
 * Notes on DPR: pass RAW pixel dimensions for srcW/srcH (videoWidth/Height
 * are already in raw pixels regardless of devicePixelRatio). The destination
 * canvas backing-store should match dstW/dstH; do NOT scale by DPR here.
 */
export function coverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CoverCropResult {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    throw new RangeError(
      `coverCrop: all dimensions must be > 0 (got ${srcW}x${srcH} → ${dstW}x${dstH})`,
    );
  }
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  const sx = (srcW - sw) / 2;
  const sy = (srcH - sh) / 2;
  return { sx, sy, sw, sh };
}
