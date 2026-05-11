/**
 * lib/sticker-composer.ts — Burns purikura stickers into a base sheet image.
 *
 * Input: the polaroid template blob produced by `composeOverlaySheet` plus a
 * list of `PlacedStickerInstance` from the user's editor session.
 * Output: a new PNG blob with the base sheet on the bottom and each sticker
 * drawn at its xPct/yPct position. Each character is its own transparent
 * PNG (no sprite-sheet bbox), so we just `drawImage` the whole asset, scaled
 * to the configured fraction of canvas width while preserving aspect ratio.
 */

import {
  CHARACTER_STICKERS,
  EMOJI_STICKERS,
  type PlacedStickerInstance,
} from "@/lib/sticker-assets";

const CHAR_SIZE_FRAC = 0.2;
const EMOJI_SIZE_FRAC = 0.14;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) =>
      reject(new Error(`failed to load image ${src}: ${String(e)}`));
    img.src = src;
  });
}

interface ComposeStickersInput {
  /** The base sheet image blob (output of composeOverlaySheet). */
  baseBlob: Blob;
  /** Stickers placed by the user in the editor. */
  stickers: PlacedStickerInstance[];
}

/**
 * Composite stickers on top of a base sheet image and return a new blob.
 * If stickers is empty, the base blob is returned unchanged for efficiency.
 */
export async function composeStickersOnto({
  baseBlob,
  stickers,
}: ComposeStickersInput): Promise<Blob> {
  if (stickers.length === 0) return baseBlob;

  const baseUrl = URL.createObjectURL(baseBlob);
  let baseImg: HTMLImageElement | null = null;
  try {
    baseImg = await loadImage(baseUrl);

    const canvas = document.createElement("canvas");
    canvas.width = baseImg.naturalWidth;
    canvas.height = baseImg.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CanvasRenderingContext2D not available");

    // Pixel-art crispness for character stickers.
    ctx.imageSmoothingEnabled = false;

    // 1. Base sheet
    ctx.drawImage(baseImg, 0, 0);

    // 2. Preload all unique character images in parallel
    const uniqueSources = new Set<string>();
    for (const s of stickers) {
      if (s.kind === "character") {
        const asset = CHARACTER_STICKERS.find((c) => c.id === s.assetId);
        if (asset) uniqueSources.add(asset.src);
      }
    }
    const sourceImages = new Map<string, HTMLImageElement>();
    await Promise.all(
      Array.from(uniqueSources).map(async (src) => {
        sourceImages.set(src, await loadImage(src));
      })
    );

    // 3. Draw each sticker in placement order (z-index = array index)
    const charBaseSize = canvas.width * CHAR_SIZE_FRAC;
    const emojiSize = canvas.width * EMOJI_SIZE_FRAC;

    for (const s of stickers) {
      const cx = (s.xPct / 100) * canvas.width;
      const cy = (s.yPct / 100) * canvas.height;
      const rad = (s.rotationDeg * Math.PI) / 180;

      if (s.kind === "character") {
        const asset = CHARACTER_STICKERS.find((c) => c.id === s.assetId);
        if (!asset) continue;
        const img = sourceImages.get(asset.src);
        if (!img) continue;
        const w0 = img.naturalWidth;
        const h0 = img.naturalHeight;
        // Match the editor: width anchored to charBaseSize, height auto.
        const drawW = charBaseSize;
        const drawH = (charBaseSize * h0) / w0;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);
        ctx.scale(s.scale, s.scale);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } else {
        const emoji = EMOJI_STICKERS.find((e) => e.id === s.emojiId);
        if (!emoji) continue;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);
        ctx.scale(s.scale, s.scale);
        ctx.imageSmoothingEnabled = true;
        ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji.emoji, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.restore();
      }
    }

    // 4. Export
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob returned null"));
        },
        "image/png"
      );
    });
  } finally {
    URL.revokeObjectURL(baseUrl);
  }
}
