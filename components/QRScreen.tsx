"use client";

/**
 * components/QRScreen.tsx — Result screen rendered during phase=qr-display.
 *
 * Two-step result UX:
 *   1. "photo" step — the composed sheet fills the screen as the hero so
 *      the user can confirm the shot before committing to a QR. CTA is a
 *      yellow "QR 만들기" button that advances to the QR step.
 *   2. "qr" step — the photo shrinks to a side-by-side companion of a
 *      small (~120px) scannable QR, with "처음으로 돌아가기" as the primary
 *      CTA. Normal-mode callers can pass `challengeHref` to attach the
 *      blue funnel link below the yellow button.
 *
 * The QR image is generated eagerly via `qrcode` so it's ready by the
 * time the user taps "QR 만들기". The plaintext URL fallback was removed
 * for a cleaner kiosk look — modern Korean smartphones auto-detect QR
 * codes from the camera.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Bubble } from "./Bubble";
import { COPY } from "@/lib/copy";

export interface QRScreenProps {
  /** Tunnel-derived URL the QR encodes; phones scanning it download the PNG. */
  publicUrl: string;
  /** Optional in-memory blob URL for the inline sheet preview. */
  sheetBlobUrl?: string | null;
  /** Fired by the "처음으로 돌아가기" button on the QR step. */
  onNext: () => void;
  /** When set, renders a "챌린지 사진 도전 →" Link on the QR step. */
  challengeHref?: string;
  /** Test escape hatch — start at the QR step instead of "photo". */
  initialStep?: "photo" | "qr";
}

export function QRScreen({
  publicUrl,
  sheetBlobUrl: _sheetBlobUrl,
  onNext,
  challengeHref,
  initialStep = "photo",
}: QRScreenProps) {
  const [step, setStep] = useState<"photo" | "qr">(initialStep);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!publicUrl) return;
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((src: string) => {
        if (!cancelled) setQrSrc(src);
      })
      .catch((err: unknown) => {
        console.error("QR generation failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const subline =
    step === "photo"
      ? "사진이 잘 나왔는지 확인해 보세요"
      : COPY.result.subline;

  return (
    <div
      data-testid="qr-screen"
      className="flex flex-col items-center gap-3 p-3 text-cabinet-frame"
    >
      <h2 className="font-marquee text-3xl">{COPY.result.headline}</h2>
      <Bubble size="sm" className="mb-1">{subline}</Bubble>

      {step === "photo" ? (
        // Photo-first hero — full-size composed sheet, no QR yet.
        // Capped lower than the original since themed mode's 4-row × 2-col
        // portrait sheet (aspect ~0.4) gets uncomfortably tall otherwise.
        publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicUrl}
            alt="합성된 시트 미리보기"
            data-testid="sheet-preview"
            className="max-h-[340px] rounded-md border-2 border-cabinet-frame bg-white object-contain shadow-soft"
          />
        ) : null
      ) : (
        // QR step — large standalone QR, no photo. Photo lives only on
        // the photo step so the QR screen reads as a single, clear
        // "scan me" affordance.
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-md border-2 border-cabinet-frame bg-white p-3 shadow-soft">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt={`QR code for ${publicUrl}`}
                data-testid="qr-image"
                className="block h-[240px] w-[240px] sm:h-[280px] sm:w-[280px]"
              />
            ) : (
              <div
                data-testid="qr-loading"
                className="flex h-[240px] w-[240px] animate-pulse items-center justify-center bg-gray-200 sm:h-[280px] sm:w-[280px]"
              >
                <span className="font-pixel text-sm text-cabinet-frame/60">
                  QR 생성 중...
                </span>
              </div>
            )}
          </div>
          <p className="text-center font-body text-xs text-cabinet-frame/70">
            폰 카메라로 스캔
          </p>
        </div>
      )}

      {step === "photo" ? (
        <button
          type="button"
          onClick={() => setStep("qr")}
          data-testid="make-qr-btn"
          className="mt-1 rounded-full border-2 border-cabinet-frame bg-btn-yellow px-10 py-3 font-marquee text-xl tracking-wide text-cabinet-frame shadow-soft transition active:translate-y-px"
        >
          QR 만들기
        </button>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            data-testid="next-user-btn"
            className="flex h-14 w-72 items-center justify-center rounded-full border-2 border-cabinet-frame bg-btn-yellow py-3 font-marquee text-xl tracking-wide text-cabinet-frame shadow-soft transition active:translate-y-px"
          >
            {COPY.result.nextUserButton}
          </button>
          {challengeHref ? (
            <Link
              href={challengeHref}
              data-testid="challenge-funnel-button"
              className="flex h-14 w-72 items-center justify-center gap-2 rounded-full border-2 border-cabinet-frame bg-btn-blue py-3 font-marquee text-xl tracking-wide text-white shadow-soft transition active:translate-y-px"
            >
              <span>챌린지 사진 도전</span>
              <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
