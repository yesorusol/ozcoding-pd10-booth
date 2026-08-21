/**
 * app/frame-select/page.tsx — Frame candidate picker.
 *
 * Sits between onboarding's 시작하기 and the booth flow: onboarding stays a
 * plain intro (headline + step list), and the actual "후보1 vs 후보2" choice
 * lives here as its own screen. Each card both picks the overlay frame and
 * starts the flow in one tap — the choice rides in `?frame=` so this stays
 * a server component with no client state.
 */

import Image from "next/image";
import Link from "next/link";
import { CabinetChrome } from "@/components/CabinetChrome";
import { ScaleToFit } from "@/components/ScaleToFit";
import { COPY } from "@/lib/copy";

export default function FrameSelectPage() {
  return (
    <ScaleToFit>
      <CabinetChrome fill={false}>
        <FrameSelectScreen />
      </CabinetChrome>
    </ScaleToFit>
  );
}

function FrameSelectScreen() {
  return (
    <div
      data-testid="frame-select"
      className="flex h-full flex-col gap-4 text-cabinet-frame sm:gap-6"
    >
      <section
        data-testid="frame-select-headline"
        className="rounded-sm border border-cabinet-frame bg-bubble-grad px-4 py-3 text-center shadow-soft sm:py-4"
      >
        <p className="font-marquee text-lg text-cabinet-frame sm:text-2xl md:text-3xl">
          {COPY.frameSelect.headlineKr}
        </p>
        <p className="font-body text-sm font-bold text-cabinet-frame sm:text-lg md:text-xl">
          {COPY.frameSelect.headlineEn}
        </p>
      </section>

      <div
        data-testid="frame-select-nav"
        className="flex flex-1 items-center justify-center gap-4 sm:gap-6"
      >
        <FrameCard
          testId="frame-select-clover"
          href="/booth?mode=normal&frame=clover"
          src="/overlays/normal-frame-clover.png"
          index={1}
          label="클로버"
          alt="클로버 테두리의 크림색 4컷 프레임"
        />
        <FrameCard
          testId="frame-select-green"
          href="/booth?mode=normal&frame=green"
          src="/overlays/normal-frame-green.png"
          index={2}
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
  index: number;
  label: string;
  alt: string;
}

function FrameCard({ testId, href, src, index, label, alt }: FrameCardProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-label={`후보 ${index} ${label} 프레임으로 시작하기`}
      className="flex flex-1 flex-col items-center gap-2 rounded-sm border border-cabinet-frame bg-btn-yellow px-3 py-4 text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm sm:px-4"
    >
      <span className="font-marquee text-sm text-cabinet-frame/75 sm:text-base">
        후보 {index}
      </span>
      <Image
        src={src}
        alt={alt}
        width={140}
        height={187}
        className="w-full max-w-[9.5rem] rounded-sm border border-cabinet-frame bg-crt-cream sm:max-w-[11rem]"
      />
      <span className="font-marquee text-base sm:text-lg">{label}</span>
    </Link>
  );
}
