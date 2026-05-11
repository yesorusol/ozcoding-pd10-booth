"use client";

/**
 * components/CutPreview.tsx — 700ms hold rendered as a child of <LiveOverlay>
 * after a shutter fires, before advancing to the next countdown.
 *
 * Mounted INSIDE LiveOverlay's children slot, so the underlying frame PNG +
 * paused <video> are already on screen. This component only adds a soft scrim
 * + a green ✓ glyph + a "찰칵! N/총컷수" speech bubble — it does NOT redraw
 * the frame (doing so caused a visible double-image with mismatched object-fit
 * during M3 testing).
 *
 * M4 hand-off: the bitmap-rendering step lives in LiveOverlay (it'll swap the
 * live <video> for the captured <canvas>/<img> during preview phase). This
 * component stays presentational.
 */

import { Bubble } from "./Bubble";
import { COPY } from "@/lib/copy";

export interface CutPreviewProps {
  /** 0-based index for the badge ("찰칵! N/총컷수"). */
  cutIndex: number;
  total: number;
}

export function CutPreview({ cutIndex, total }: CutPreviewProps) {
  return (
    <div
      data-testid="cut-preview"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30"
    >
      <span
        aria-hidden
        className="font-marquee text-9xl text-bubble-green-deep"
        style={{
          WebkitTextStroke: "4px #0c1b3d",
          textShadow: "4px 4px 0 #0c1b3d",
        }}
      >
        ✓
      </span>
      <Bubble size="md">
        <span className="font-pixel">
          {COPY.booth.previewBadge}{" "}
          <span className="text-cabinet-frame/70">
            {cutIndex + 1}/{total}
          </span>
        </span>
      </Bubble>
    </div>
  );
}
