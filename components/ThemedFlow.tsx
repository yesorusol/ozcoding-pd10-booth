"use client";

/**
 * components/ThemedFlow.tsx — Themed (7-cut character-frame) booth flow.
 *
 * Pipeline:
 *   camera-priming → prep → countdown → flash → preview → (×7 cuts)
 *     → compositing (produces bare sheet; defers upload)
 *     → sticker editor (StickerEditor on the composed sheet)
 *     → re-composite (burn stickers in via composeStickersOnto)
 *     → upload + qr-display
 *
 * Background palette: the user-chosen `BackgroundChoice` fills the whole
 * sheet, so the outer frame + inter-cell gutters + cell 7 all wear the
 * same surface and read as one connected "window frame" around the
 * 7 captured photos.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BoothSideRail } from "@/components/BoothSideRail";
import { CabinetChrome } from "@/components/CabinetChrome";
import { LiveOverlay } from "@/components/LiveOverlay";
import { Countdown } from "@/components/Countdown";
import { CutPreview } from "@/components/CutPreview";
import { CameraDeniedBanner } from "@/components/CameraDeniedBanner";
import { QRScreen } from "@/components/QRScreen";
import { Bubble } from "@/components/Bubble";
import { ScaleToFit } from "@/components/ScaleToFit";
import { StickerEditor } from "@/components/StickerEditor";

import { useCamera, type CameraStatus } from "@/lib/use-camera";
import { CAPTURE_FRAMES, FRAMES } from "@/lib/frames";
import { COPY } from "@/lib/copy";
import {
  createInitialState,
  createReducer,
  THEMED_CUTS,
  THEMED_COUNTDOWN_START,
  TOTAL_CUTS,
  FLASH_MS,
  PREVIEW_MS,
  PREP_MS,
  type CameraErrorKind,
} from "@/lib/session-machine";
import { captureCut } from "@/lib/capture";
import {
  composeSheet,
  preloadAllSheetBackgrounds,
  SHEET_WIDTH,
  SHEET_HEIGHT,
  DEFAULT_SHEET_BACKGROUND,
} from "@/lib/sheet-composer";
import { composeStickersOnto } from "@/lib/sticker-composer";
import { uploadSheet } from "@/lib/upload-sheet";
import { TunnelHostUnavailableError, type Cut } from "@/lib/types";
import type { PlacedStickerInstance } from "@/lib/sticker-assets";
import type { BackgroundChoice } from "@/lib/background-assets";

type DeniedStatus = Extract<CameraStatus, "denied" | "no-device" | "ended">;

function cameraErrorKindFor(status: CameraStatus): CameraErrorKind | null {
  if (status === "denied") return "denied";
  if (status === "no-device") return "no-device";
  if (status === "ended") return "ended";
  return null;
}

const themedReducer = createReducer(THEMED_CUTS, THEMED_COUNTDOWN_START);

export function ThemedFlow() {
  const router = useRouter();
  const camera = useCamera();
  const [state, dispatch] = useReducer(themedReducer, undefined, () => ({
    ...createInitialState(THEMED_CUTS),
    phase: "camera-priming" as const,
  }));

  const frameImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // Bare composed sheet (pre-sticker). Held while the editor is open.
  const baseBlobRef = useRef<Blob | null>(null);
  // Display URL for whatever's currently shown in editor / QR screen.
  const [sheetBlobUrl, setSheetBlobUrl] = useState<string | null>(null);
  // Editor visibility. True after compositing succeeds, false after 완료.
  const [editorOpen, setEditorOpen] = useState(false);
  // Final-composite-and-upload in progress (after 완료 click).
  const [finalizing, setFinalizing] = useState(false);
  // User's selected sheet background (fills frame + cell 7).
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundChoice>(DEFAULT_SHEET_BACKGROUND);

  // Warm pattern images so the first re-compose after a swatch tap is instant.
  useEffect(() => {
    preloadAllSheetBackgrounds();
  }, []);

  useEffect(() => {
    camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = frameImagesRef.current;
    for (const frame of FRAMES) {
      if (!map.has(frame.id)) {
        const img = new Image();
        img.src = frame.src;
        map.set(frame.id, img);
      }
    }
  }, []);

  useEffect(() => {
    if (camera.status === "ready" && state.phase === "camera-priming") {
      dispatch({ type: "CAMERA_READY" });
      return;
    }
    const errorKind = cameraErrorKindFor(camera.status);
    if (!errorKind) return;
    if (errorKind === "ended" && state.phase !== "camera-priming") {
      dispatch({ type: "CAMERA_LOST" });
    } else {
      dispatch({ type: "CAMERA_DENIED", kind: errorKind });
    }
  }, [camera.status, state.phase]);

  useEffect(() => {
    if (state.phase !== "prep") return;
    const t = setTimeout(() => dispatch({ type: "PREP_DONE" }), PREP_MS);
    return () => clearTimeout(t);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "countdown") return;
    const t = setTimeout(() => {
      if (state.countdown > 1) {
        dispatch({ type: "TICK" });
      } else {
        dispatch({ type: "COUNTDOWN_DONE" });
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.countdown]);

  useEffect(() => {
    if (state.phase !== "flash") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      const frame = CAPTURE_FRAMES[state.cutIndex];
      const frameImg = frameImagesRef.current.get(frame.id);
      const video = camera.videoRef.current;

      let imageBitmap: ImageBitmap | null = null;
      if (video && frameImg) {
        try {
          imageBitmap = await captureCut({ video, frameImg });
        } catch (err) {
          console.error("captureCut failed:", err);
        }
      }
      if (cancelled) {
        imageBitmap?.close();
        return;
      }

      const cut: Cut = {
        index: state.cutIndex,
        frameId: frame.id as Cut["frameId"],
        imageBitmap,
        capturedAt: Date.now(),
      };
      dispatch({ type: "CAPTURE_DONE", cut });
    }, FLASH_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [state.phase, state.cutIndex, camera.videoRef]);

  useEffect(() => {
    if (state.phase !== "preview") return;
    const t = setTimeout(() => dispatch({ type: "PREVIEW_DONE" }), PREVIEW_MS);
    return () => clearTimeout(t);
  }, [state.phase]);

  useEffect(() => {
    const v = camera.videoRef.current;
    if (!v) return;
    if (state.phase === "preview" || state.phase === "flash") {
      v.pause();
    } else if (camera.status === "ready") {
      void v.play().catch(() => {
        /* play() may reject when paused; ignore */
      });
    }
  }, [state.phase, camera.status, camera.videoRef]);

  // Compositing — produces the bare sheet, then opens the editor instead of
  // uploading right away.
  useEffect(() => {
    if (state.phase !== "compositing") return;
    if (baseBlobRef.current) return; // already composed; editor already open
    let cancelled = false;
    let blobUrl: string | null = null;
    (async () => {
      try {
        const blob = await composeSheet({
          cuts: state.cuts,
          background: selectedBackground,
        });
        if (cancelled) return;
        baseBlobRef.current = blob;
        blobUrl = URL.createObjectURL(blob);
        setSheetBlobUrl(blobUrl);
        setEditorOpen(true);
      } catch (err) {
        if (cancelled) return;
        console.error("compose failed:", err);
        dispatch({ type: "RESET" });
        router.push("/");
      }
    })();
    return () => {
      cancelled = true;
      // Don't revoke blobUrl here — editor still uses it. Cleanup happens
      // when the blob URL state is replaced or RESET fires.
    };
    // selectedBackground is intentionally read at first compose only —
    // later swatch taps go through onBackgroundChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.cuts, router]);

  // User picked a new sheet background → recompose preview.
  const onBackgroundChange = useCallback(
    async (next: BackgroundChoice) => {
      setSelectedBackground(next);
      try {
        const blob = await composeSheet({
          cuts: state.cuts,
          background: next,
        });
        baseBlobRef.current = blob;
        // The cleanup effect below revokes the previous URL when state
        // changes — do NOT revoke manually here (the inline pattern
        // double-fires under React 18 strict mode and can kill the new URL).
        setSheetBlobUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error("background recompose failed:", err);
      }
    },
    [state.cuts],
  );

  // Editor 완료 → burn stickers, upload, advance to qr-display.
  const onEditorComplete = useCallback(
    async (stickers: PlacedStickerInstance[]) => {
      const baseBlob = baseBlobRef.current;
      if (!baseBlob) return;
      setFinalizing(true);
      setEditorOpen(false);
      try {
        const finalBlob = await composeStickersOnto({ baseBlob, stickers });
        setSheetBlobUrl(URL.createObjectURL(finalBlob));
        const record = await uploadSheet(finalBlob);
        dispatch({ type: "COMPOSE_DONE", publicUrl: record.publicUrl });
      } catch (err) {
        if (err instanceof TunnelHostUnavailableError) {
          dispatch({ type: "COMPOSE_FAIL_TUNNEL" });
        } else {
          console.error("finalize failed:", err);
          dispatch({ type: "RESET" });
          router.push("/");
        }
      } finally {
        setFinalizing(false);
      }
    },
    [router],
  );

  const onEditorReset = useCallback(() => {
    if (sheetBlobUrl) {
      URL.revokeObjectURL(sheetBlobUrl);
      setSheetBlobUrl(null);
    }
    baseBlobRef.current = null;
    setEditorOpen(false);
    dispatch({ type: "RESET" });
    router.push("/");
  }, [router, sheetBlobUrl]);

  useEffect(() => {
    return () => {
      if (sheetBlobUrl) URL.revokeObjectURL(sheetBlobUrl);
    };
  }, [sheetBlobUrl]);

  const onRetry = useCallback(() => {
    if (sheetBlobUrl) {
      URL.revokeObjectURL(sheetBlobUrl);
      setSheetBlobUrl(null);
    }
    baseBlobRef.current = null;
    setEditorOpen(false);
    dispatch({ type: "RESET" });
    dispatch({ type: "START" });
    void camera.restart();
  }, [camera, sheetBlobUrl]);

  const onNextUser = useCallback(() => {
    if (sheetBlobUrl) {
      URL.revokeObjectURL(sheetBlobUrl);
      setSheetBlobUrl(null);
    }
    baseBlobRef.current = null;
    router.push("/");
  }, [router, sheetBlobUrl]);

  const safeCutIndex = Math.min(state.cutIndex, TOTAL_CUTS - 1);
  const activeFrame = CAPTURE_FRAMES[safeCutIndex];

  // EDITOR — full-screen take-over while the user decorates the composite.
  if (editorOpen && sheetBlobUrl) {
    return (
      <StickerEditor
        photoSrc={sheetBlobUrl}
        aspectRatio={SHEET_WIDTH / SHEET_HEIGHT}
        background={selectedBackground}
        onBackgroundChange={onBackgroundChange}
        showPatterns={false}
        onComplete={onEditorComplete}
        onReset={onEditorReset}
      />
    );
  }

  // FINALIZING — brief loader while we burn stickers + upload.
  if (finalizing) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-crt-cream">
        <Bubble size="lg">{COPY.booth.compositingHeadline}</Bubble>
        <p className="font-pixel text-lg text-cabinet-frame">{COPY.booth.compositingSub}</p>
      </main>
    );
  }

  const isCabinetPhase =
    state.phase === "camera-priming-error" ||
    state.phase === "tunnel-host-error" ||
    (state.phase === "qr-display" && Boolean(state.publicUrl));

  if (!isCabinetPhase) {
    return (
      <main className="relative flex h-screen w-screen items-stretch overflow-hidden bg-crt-cream">
        <BoothSideRail position="left" />
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <LiveOverlay
            videoRef={camera.videoRef}
            frameSrc={activeFrame.src}
            frameAlt={activeFrame.label}
            tagline={state.phase === "countdown" || state.phase === "flash" ? activeFrame.tagline : undefined}
            cutIndex={safeCutIndex}
            total={TOTAL_CUTS}
          >
            {state.phase === "camera-priming" ? <PrimingOverlay /> : null}
            {state.phase === "prep" ? <PrepOverlay /> : null}
            {state.phase === "flash" ? <FlashOverlay /> : null}
            {state.phase === "preview" ? (
              <CutPreview cutIndex={safeCutIndex} total={TOTAL_CUTS} />
            ) : null}
            {state.phase === "compositing" ? <CompositingOverlay /> : null}
          </LiveOverlay>
          {state.phase === "countdown" ? (
            <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6 md:left-8 md:top-8">
              <Countdown seconds={state.countdown} />
            </div>
          ) : null}
        </div>
        <BoothSideRail position="right" />
      </main>
    );
  }

  return (
    <ScaleToFit>
      <CabinetChrome fill={false} notesItems={COPY.notes.itemsThemed}>
        {state.phase === "camera-priming-error" && state.errorKind ? (
          <div className="flex min-h-[24rem] items-center justify-center">
            <CameraDeniedBanner
              status={(state.errorKind === "unknown" ? "ended" : state.errorKind) as DeniedStatus}
              onRetry={onRetry}
            />
          </div>
        ) : state.phase === "tunnel-host-error" ? (
          <TunnelErrorScreen onRetry={onRetry} />
        ) : (
          <QRScreen
            publicUrl={state.publicUrl!}
            sheetBlobUrl={sheetBlobUrl}
            onNext={onNextUser}
          />
        )}
      </CabinetChrome>
    </ScaleToFit>
  );
}

function PrimingOverlay() {
  return (
    <div
      data-testid="priming-overlay"
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white"
    >
      <Bubble size="lg">{COPY.booth.primingHeadline}</Bubble>
      <p className="font-pixel text-lg">{COPY.booth.primingSub}</p>
    </div>
  );
}

function FlashOverlay() {
  return (
    <div
      aria-hidden
      data-testid="flash-overlay"
      className="absolute inset-0 bg-white"
      style={{ animation: "boothFlash 200ms ease-out forwards" }}
    />
  );
}

function CompositingOverlay() {
  return (
    <div
      data-testid="compositing-overlay"
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 text-white"
    >
      <Bubble size="lg">{COPY.booth.compositingHeadline}</Bubble>
      <p className="font-pixel text-lg">{COPY.booth.compositingSub}</p>
    </div>
  );
}

function PrepOverlay() {
  const [tick, setTick] = useState(3);
  useEffect(() => {
    if (tick <= 1) return;
    const t = setTimeout(() => setTick((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [tick]);
  return (
    <div
      data-testid="prep-overlay"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-white"
    >
      <p className="font-marquee text-5xl font-bold">{COPY.booth.prepHeadline}</p>
      <p className="font-body text-xl">{COPY.booth.prepSub}</p>
      <p className="text-sm opacity-70">{COPY.booth.prepHint}</p>
      <Countdown seconds={tick} />
    </div>
  );
}

function TunnelErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 p-6 text-center">
      <Bubble size="lg">
        <p>외부 공유 주소를 만들지 못했습니다.</p>
        <p className="mt-2 text-base font-normal">
          ngrok 또는 cloudflared 터널을 다시 켠 뒤 시도해주세요.
        </p>
      </Bubble>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-cabinet-frame bg-btn-yellow px-8 py-3 font-marquee text-2xl text-cabinet-frame shadow-soft active:translate-y-px"
      >
        다시 시도
      </button>
    </div>
  );
}
