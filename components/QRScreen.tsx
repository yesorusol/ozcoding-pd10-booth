"use client";

/**
 * components/QRScreen.tsx — Result screen rendered during phase=qr-display.
 *
 * Shows the tunnel-public-URL as a QR code (encoded via the `qrcode` npm
 * package), a small inline preview of the composed sheet PNG, and a
 * "다음 사용자" button that returns to the idle screen (per AC#9).
 * The plaintext URL fallback was removed for a cleaner kiosk look —
 * modern Korean smartphones auto-detect QR codes from the camera.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Bubble } from "./Bubble";
import { COPY } from "@/lib/copy";

export interface QRScreenProps {
  /** Tunnel-derived URL the QR encodes; phones scanning it download the PNG. */
  publicUrl: string;
  /** Optional in-memory blob URL for the inline sheet preview. */
  sheetBlobUrl?: string | null;
  /** Fired by the "다음 사용자" button. */
  onNext: () => void;
}

export function QRScreen({ publicUrl, sheetBlobUrl, onNext }: QRScreenProps) {
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

  return (
    <div
      data-testid="qr-screen"
      className="flex flex-col items-center gap-3 p-3 text-cabinet-frame"
    >
      <h2 className="font-marquee text-3xl">{COPY.result.headline}</h2>
      <Bubble size="md">{COPY.result.subline}</Bubble>

      {/* Result hero: the composed sheet is the focal point. The QR sits
          alongside it, small but still scannable from arm's length on a
          modern phone (~160px on the kiosk display). Order is reversed
          from the previous layout — photo first, QR second. */}
      <div className="flex flex-wrap items-center justify-center gap-5">
        {publicUrl ? (
          // Use the just-uploaded public URL as the preview source — robust to
          // the blob URL lifecycle and matches what the QR resolves to. The
          // `sheetBlobUrl` prop is kept for ThemedFlow compatibility but no
          // longer required on this screen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicUrl}
            alt="합성된 시트 미리보기"
            data-testid="sheet-preview"
            className="max-h-[440px] rounded-md border-2 border-cabinet-frame bg-white shadow-soft sm:max-h-[560px]"
          />
        ) : null}

        <div className="flex flex-col items-center gap-2">
          <div className="rounded-md border-2 border-cabinet-frame bg-white p-1.5 shadow-soft">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt={`QR code for ${publicUrl}`}
                data-testid="qr-image"
                className="block h-[140px] w-[140px] sm:h-[160px] sm:w-[160px]"
              />
            ) : (
              <div
                data-testid="qr-loading"
                className="flex h-[140px] w-[140px] animate-pulse items-center justify-center bg-gray-200 sm:h-[160px] sm:w-[160px]"
              >
                <span className="font-pixel text-xs text-cabinet-frame/60">
                  QR 생성 중...
                </span>
              </div>
            )}
          </div>
          <p className="font-body text-[11px] text-cabinet-frame/70">
            폰 카메라로 스캔
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        data-testid="next-user-btn"
        className="mt-1 rounded-full border-2 border-cabinet-frame bg-btn-yellow px-8 py-3 font-marquee text-2xl text-cabinet-frame shadow-soft transition active:translate-y-px"
      >
        {COPY.result.nextUserButton}
      </button>
    </div>
  );
}
