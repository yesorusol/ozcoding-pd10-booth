/**
 * lib/types.ts — Shared TypeScript types, interfaces, and runtime constants
 * used across every milestone of the OZCODING PD09 photobooth.
 *
 * Design notes:
 * - `tunnel-host-error` is an idle-timer eligible state (per consensus follow-up):
 *   the operator must fix ngrok before the session can proceed, so auto-reset
 *   after 30s of inactivity is safe and desirable.
 * - All ImageBitmap fields are nullable because capture may be in-flight or
 *   not yet started.
 */

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

/** Identifier for each of the 7 character frames plus the title card. */
export type FrameId =
  | "burger"
  | "ramen"
  | "tamagotchi"
  | "teeth"
  | "mic"
  | "cosplay"
  | "waiter"
  | "title-card";

export interface Frame {
  id: FrameId;
  /** Public URL relative to /, e.g. "/frames/processed/burger.png" */
  src: string;
  /** Short Korean display name shown in countdown banner ("컷 N: 햄버거"). */
  label: string;
  /** Short English caption — paired under `label` in the kiosk numbered list. */
  labelEn: string;
  /** Korean tagline shown in the speech bubble during the cut (1 line). */
  tagline: string;
  /** Position in the 4×2 sheet grid, 0..7. Title-card is fixed at 7. */
  gridIndex: number;
}

// ---------------------------------------------------------------------------
// Cut
// ---------------------------------------------------------------------------

/** Single captured cut (in-memory; never persisted server-side as raw cut) */
export interface Cut {
  index: number; // 0..6
  frameId: Exclude<FrameId, "title-card">;
  /** Captured 512x576 RGBA canvas (or its dataURL) — un-mirrored. */
  imageBitmap: ImageBitmap | null;
  capturedAt: number;
}

// ---------------------------------------------------------------------------
// Session state machine
// ---------------------------------------------------------------------------

/** Session state machine states */
export type SessionState =
  | "idle"
  | "camera-priming"
  | "camera-priming-error"
  | "tunnel-host-error"
  | "prep"
  | "countdown"
  | "flash"
  | "preview"
  | "compositing"
  | "qr-display"
  | "uploading"
  | "upload-error";

/**
 * Idle-timer eligible states (state-gated reset).
 * The 30s no-interaction timer fires RESET only when the current state is in
 * this set. `tunnel-host-error` is included because the operator must fix
 * ngrok before proceeding — auto-reset surfaces the start screen so the next
 * user is not blocked indefinitely.
 */
export const IDLE_TIMER_ELIGIBLE_STATES: ReadonlySet<SessionState> = new Set([
  "idle",
  "qr-display",
  "camera-priming-error",
  "tunnel-host-error",
]);

// ---------------------------------------------------------------------------
// Output sheet
// ---------------------------------------------------------------------------

/**
 * Final composite sheet metadata.
 *
 * NOTE (2026-05-07): the original plan locked cells at 512×576 (aspect 0.889)
 * to match an 800×900 frame PNG. With the LiveOverlay revision that aligns to
 * the 720×900 native artwork aspect (0.8), M4's cut canvas + M5's cell math
 * must follow suit. Concrete numbers below (460×575 cells, 70/20/20 layout)
 * are verified to fit 1080×2400 exactly:
 *   width  = 2*460 + 2*70 + 1*20 = 1080
 *   height = 4*575 + 2*20 + 3*20 = 2400
 */
export interface OutputSheet {
  width: 1080;
  height: 2400;
  cellWidth: 460;
  cellHeight: 575;
  marginX: 70;
  marginYTop: 20;
  marginYBottom: 20;
  gutter: 20;
  /** PNG blob URL (browser side) or absolute path (server side) */
  pngUrl: string;
}

// ---------------------------------------------------------------------------
// Capture record
// ---------------------------------------------------------------------------

/** Server-side capture record returned by POST /api/captures */
export interface CaptureRecord {
  id: string; // uuid
  publicUrl: string; // absolute URL the QR points to
  /** ISO timestamp */
  createdAt: string;
  /** Bytes on disk for monitoring */
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Custom error class thrown when public host header is missing.
 * Thrown by `lib/upload-sheet.ts` when the server returns HTTP 503
 * with body `{"error":"tunnel-public-host-unavailable"}`.
 */
export class TunnelHostUnavailableError extends Error {
  constructor() {
    super("tunnel-public-host-unavailable");
    this.name = "TunnelHostUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Mirror policy
// ---------------------------------------------------------------------------

/**
 * Mirror policy: TRUE on preview <video> (selfie convention),
 * FALSE on captured canvas (saved photo is un-mirrored so text reads correctly).
 *
 * Applied as CSS `transform: scaleX(-1)` on the <video> element only.
 * `captureCut` in lib/capture.ts must NOT apply ctx.scale(-1, 1).
 */
export const MIRROR_PREVIEW = true as const;
