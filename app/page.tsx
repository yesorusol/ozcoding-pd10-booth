/**
 * app/page.tsx — Onboarding pre-screen.
 *
 * Mirrors `/themed` 's structure (yellow headline banner / [N] step list /
 * 시작 버튼 row) so the cabinet proportions match. Each frame card both picks
 * the overlay frame and starts the flow in one tap — the choice rides in
 * `?frame=` so this page stays a server component with no client state.
 */

import Image from "next/image";
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
      className="flex h-full flex-col gap-4 text-cabinet-frame sm:gap-6"
    >
      <section
        data-testid="onboarding-headline"
        className="rounded-sm border border-cabinet-frame bg-bubble-grad px-4 py-3 text-center shadow-soft sm:py-4"
      >
        <p className="font-marquee text-lg text-cabinet-frame sm:text-2xl md:text-3xl">
          {COPY.onboarding.headlineKr}
        </p>
        <p className="font-body text-sm font-bold text-cabinet-frame sm:text-lg md:text-xl">
          {COPY.onboarding.headlineEn}
        </p>
      </section>

      <ol
        data-testid="onboarding-steps"
        className="grid grid-cols-1 gap-x-6 gap-y-3 px-2 sm:gap-y-4"
      >
        {COPY.onboarding.steps.map((step, i) => (
          <li key={step.titleKr} className="flex items-baseline gap-3">
            <span className="font-marquee text-lg text-cabinet-frame sm:text-xl md:text-2xl">
              [{i + 1}]
            </span>
            <div className="leading-tight">
              <div className="font-body text-base font-bold text-cabinet-frame sm:text-lg md:text-xl">
                {step.titleKr}
              </div>
              <div className="font-body text-sm text-cabinet-frame/75 sm:text-base">
                {step.titleEn}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div
        data-testid="onboarding-nav"
        className="mt-auto flex items-stretch justify-center gap-3 sm:gap-4"
      >
        <FrameCard
          testId="onboarding-start-clover"
          href="/booth?mode=normal&frame=clover"
          src="/overlays/normal-frame-clover.png"
          label="클로버"
          alt="클로버 테두리의 크림색 4컷 프레임"
        />
        <FrameCard
          testId="onboarding-start-green"
          href="/booth?mode=normal&frame=green"
          src="/overlays/normal-frame-green.png"
          label="모카모카"
          alt="초록·분홍 모카모카 4컷 프레임"
        />
      </div>
    </div>
  );
}

interface FrameCardProps {
  testId: string;
  href: string;
  src: string;
  label: string;
  alt: string;
}

function FrameCard({ testId, href, src, label, alt }: FrameCardProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-label={`${label} 프레임으로 ${COPY.onboarding.startButton}`}
      className="flex flex-col items-center gap-2 rounded-sm border border-cabinet-frame bg-btn-yellow px-3 py-3 text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm sm:px-4"
    >
      <Image
        src={src}
        alt={alt}
        width={96}
        height={128}
        className="rounded-sm border border-cabinet-frame bg-crt-cream"
      />
      <span className="font-marquee text-base sm:text-lg">{label}</span>
    </Link>
  );
}
