/**
 * app/page.tsx — Onboarding pre-screen.
 *
 * Mirrors `/themed` 's structure (yellow headline banner / [N] step list /
 * 시작 button) so the cabinet proportions match. The 시작하기 button
 * funnels into the polaroid 4-cut + sticker editor at /booth?mode=normal.
 */

import Link from "next/link";
import { CabinetChrome } from "@/components/CabinetChrome";
import { ScaleToFit } from "@/components/ScaleToFit";
import { COPY } from "@/lib/copy";

export default function HomePage() {
  return (
    <ScaleToFit>
      <CabinetChrome fill={false}>
        <OnboardingScreen />
      </CabinetChrome>
    </ScaleToFit>
  );
}

function OnboardingScreen() {
  return (
    <div
      data-testid="onboarding"
      className="flex h-full flex-col gap-3 text-cabinet-frame sm:gap-4"
    >
      <section
        data-testid="onboarding-headline"
        className="rounded-sm border border-cabinet-frame bg-bubble-grad px-3 py-2.5 text-center shadow-soft sm:py-3"
      >
        <p className="font-marquee text-base text-cabinet-frame sm:text-xl md:text-2xl">
          {COPY.onboarding.headlineKr}
        </p>
        <p className="font-body text-xs font-bold text-cabinet-frame sm:text-base md:text-lg">
          {COPY.onboarding.headlineEn}
        </p>
      </section>

      <ol
        data-testid="onboarding-steps"
        className="grid grid-cols-1 gap-x-6 gap-y-2 px-2 sm:gap-y-2.5"
      >
        {COPY.onboarding.steps.map((step, i) => (
          <li key={step.titleKr} className="flex items-baseline gap-2">
            <span className="font-marquee text-base text-cabinet-frame sm:text-lg">
              [{i + 1}]
            </span>
            <div className="leading-tight">
              <div className="font-body text-sm font-bold text-cabinet-frame sm:text-base">
                {step.titleKr}
              </div>
              <div className="font-body text-xs text-cabinet-frame/75 sm:text-sm">
                {step.titleEn}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div data-testid="onboarding-nav" className="mt-auto flex justify-center">
        <Link
          href="/booth?mode=normal"
          data-testid="onboarding-start"
          aria-label={COPY.onboarding.startButton}
          className="flex h-11 items-center justify-center gap-2 rounded-full border border-cabinet-frame bg-btn-yellow px-7 font-marquee text-lg text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm sm:h-12 sm:px-8 sm:text-xl"
        >
          <span>{COPY.onboarding.startButton}</span>
          <span aria-hidden className="text-lg sm:text-xl">→</span>
        </Link>
      </div>
    </div>
  );
}
