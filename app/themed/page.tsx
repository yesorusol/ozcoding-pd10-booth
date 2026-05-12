/**
 * app/themed/page.tsx — Themed-mode pre-screen.
 *
 * Hosts the bilingual headline + 7-cut menu + 시작 button that previously
 * lived at `/`. The 시작 link still points at `/booth` (which defaults
 * to themed mode via `parseBoothMode`).
 */

import Link from "next/link";
import { CabinetChrome } from "@/components/CabinetChrome";
import { ScaleToFit } from "@/components/ScaleToFit";
import { COPY } from "@/lib/copy";
import { CAPTURE_FRAMES } from "@/lib/frames";

export default function ThemedHomePage() {
  return (
    <ScaleToFit>
      <CabinetChrome fill={false}>
        <IdleScreen />
      </CabinetChrome>
    </ScaleToFit>
  );
}

function IdleScreen() {
  return (
    <div className="flex h-full flex-col gap-3 text-cabinet-frame sm:gap-4">
      <section
        data-testid="screen-headline"
        className="rounded-sm border border-cabinet-frame bg-bubble-grad px-3 py-2.5 text-center shadow-soft sm:py-3"
      >
        <p className="font-marquee text-base text-cabinet-frame sm:text-xl md:text-2xl">
          {COPY.idle.headlineKr}
        </p>
        <p className="font-body text-xs font-bold text-cabinet-frame sm:text-base md:text-lg">
          {COPY.idle.headlineEn}
        </p>
      </section>

      <ol
        data-testid="frame-menu"
        className="grid grid-cols-2 gap-x-6 gap-y-2 px-2 sm:gap-x-8 sm:gap-y-2.5"
      >
        {CAPTURE_FRAMES.map((frame, i) => (
          <li key={frame.id} className="flex items-baseline gap-2">
            <span className="font-marquee text-base text-cabinet-frame sm:text-lg">
              [{i + 1}]
            </span>
            <div className="leading-tight">
              <div className="font-body text-sm font-bold text-cabinet-frame sm:text-base">
                {frame.label}
              </div>
              <div className="font-body text-xs text-cabinet-frame/75 sm:text-sm">
                {frame.labelEn}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div data-testid="screen-nav" className="mt-auto flex justify-center">
        <Link
          href="/booth"
          data-testid="nav-start"
          aria-label={COPY.idle.startButton}
          className="flex h-12 min-w-[10rem] items-center justify-center gap-2 rounded-full border border-cabinet-frame bg-btn-yellow px-8 font-marquee text-xl text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm sm:h-14 sm:text-2xl md:h-16 md:text-3xl"
        >
          <span>{COPY.idle.startButton}</span>
          <span aria-hidden className="text-xl sm:text-2xl">→</span>
        </Link>
      </div>
    </div>
  );
}
