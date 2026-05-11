"use client";

/**
 * components/CameraDeniedBanner.tsx — Fallback UI shown when the camera is
 * unavailable. Renders Korean instructions tailored to the failure mode plus
 * a retry button. Copy lives in `lib/copy.ts`.
 */

import type { CameraStatus } from "@/lib/use-camera";
import { COPY } from "@/lib/copy";
import { Bubble } from "./Bubble";

type DeniedStatus = Extract<CameraStatus, "denied" | "no-device" | "ended">;

export interface CameraDeniedBannerProps {
  status: DeniedStatus;
  onRetry: () => void;
}

export function CameraDeniedBanner({ status, onRetry }: CameraDeniedBannerProps) {
  const { headline, detail } = COPY.cameraDenied[status];
  return (
    <div
      role="alert"
      data-testid="camera-denied-banner"
      data-status={status}
      className="mx-auto flex max-w-xl flex-col items-center gap-5 p-6 text-center"
    >
      <Bubble size="lg" tail>
        <h2 className="text-3xl">{headline}</h2>
        <p className="mt-3 text-lg font-normal">{detail}</p>
      </Bubble>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-cabinet-frame bg-btn-yellow px-8 py-3 font-marquee text-2xl text-cabinet-frame shadow-soft active:translate-y-px"
      >
        {COPY.cameraDenied.retryButton}
      </button>
    </div>
  );
}
