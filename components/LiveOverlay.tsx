"use client";

/**
 * components/LiveOverlay.tsx — Renders the mirrored live camera preview with
 * the active frame PNG layered on top, a "컷 N/총컷수" badge in the top-left,
 * and a Bubble tagline at the bottom for the active frame's copy.
 *
 * Mirror policy:
 *   - Live <video> receives CSS transform: scaleX(-1) (selfie convention).
 *   - captureCut in lib/capture.ts mirrors the video draw with a matching
 *     translate + scale(-1,1) so the saved cut matches what the user saw.
 *     The frame PNG is drawn unflipped at the same scope.
 *
 * Aspect chain (re-locked 2026-05-07 to match the frame artwork natively):
 *   - The container CSS aspect ratio is 720:900 (== 0.8) — the same aspect as
 *     the original frame artwork (raw PNGs are 720×900). M1 still pads frames
 *     to 800×900 (40px transparent each side) so the artwork sits centered;
 *     `object-fit: cover` on the <img> within a 0.8-aspect container clips
 *     those 40px transparent columns exactly. No artwork is lost.
 *   - M4's per-cut canvas should likewise run at 0.8 aspect so the saved cut
 *     matches what the user saw. (The plan-locked 512×576 = 0.889 aspect is
 *     superseded; M4 should pick a 0.8-aspect cut canvas, e.g. 576×720.)
 *
 * Camera fit:
 *   - <video> is sized by CSS to fill the 0.8-aspect container with
 *     `object-fit: cover` — a centered crop of the source 1280×720 stream.
 *     Both the frame and the video use the same fit, so the frame's face
 *     hole stays aligned with the user's face at any responsive width.
 */

import type { CSSProperties, ReactNode, RefObject } from "react";
import { Bubble } from "./Bubble";

export interface LiveOverlayProps {
  /** Ref to the <video> element. Bound by the parent that owns useCamera. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Frame PNG src, e.g. "/frames/processed/burger.png". */
  frameSrc: string;
  /** Korean label for the active frame, used as <img alt>. */
  frameAlt?: string;
  /** Optional one-line tagline rendered in a Bubble at the bottom of the frame. */
  tagline?: string;
  /** 0-based current cut index (badge renders cutIndex + 1). */
  cutIndex: number;
  /** Total cuts in the session (typically 7). */
  total: number;
  /** Overlay slot — used by /booth to mount Countdown / CutPreview / Flash. */
  children?: ReactNode;
}

const containerStyle: CSSProperties = {
  aspectRatio: "720 / 900",
};

const videoStyle: CSSProperties = {
  transform: "scaleX(-1)",
  objectFit: "cover",
};

const frameStyle: CSSProperties = {
  // Frame PNG is 800×900 (artwork 720×900 + 40px transparent each side from
  // M1). With `object-fit: cover` inside a 720:900 container, the 40px
  // transparent columns are exactly clipped and the 720-wide artwork fills
  // the container edge-to-edge with no letterboxing or content loss.
  objectFit: "cover",
  pointerEvents: "none",
};

export function LiveOverlay({
  videoRef,
  frameSrc,
  frameAlt = "",
  tagline,
  cutIndex,
  total,
  children,
}: LiveOverlayProps) {
  const cutLabel = `컷 ${cutIndex + 1}/${total}`;
  return (
    <div
      data-testid="live-overlay"
      className="relative mx-auto h-full max-h-full max-w-full overflow-hidden rounded-xl bg-black"
      style={containerStyle}
    >
      <video
        ref={videoRef}
        data-testid="live-overlay-video"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full"
        style={videoStyle}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameSrc}
        alt={frameAlt}
        aria-hidden={frameAlt === "" ? true : undefined}
        data-testid="live-overlay-frame"
        className="absolute inset-0 h-full w-full"
        style={frameStyle}
      />

      {/* Cut counter badge — top-left, oval-y2k Bubble */}
      <div className="absolute left-3 top-3" data-testid="live-overlay-badge">
        <Bubble size="sm" role="status" ariaLive="polite">
          {cutLabel}
        </Bubble>
      </div>

      {/* Tagline bubble — bottom-center, only when provided */}
      {tagline ? (
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-3">
          <Bubble size="md" tail data-testid="live-overlay-tagline-wrap">
            <span data-testid="live-overlay-tagline">{tagline}</span>
          </Bubble>
        </div>
      ) : null}

      {/* Overlay slot — Countdown / Flash / CutPreview / Compositing */}
      {children}
    </div>
  );
}
