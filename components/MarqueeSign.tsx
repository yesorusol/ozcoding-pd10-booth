"use client";

/**
 * components/MarqueeSign.tsx — Top-of-cabinet sign plate.
 *
 * Layout (top → bottom):
 *   • Bold headline + suffix (plain text, no oval — reference-matching)
 *   • Bright green stripe with Korean subtitle
 *   • Thin English subtitle line
 * Plate has 4 corner screws.
 */

import { COPY } from "@/lib/copy";

export function MarqueeSign() {
  const { headline, headlineSuffix, subtitleKr, subtitleEn } = COPY.marquee;
  return (
    <div
      data-testid="marquee-sign"
      className="relative mx-auto w-full max-w-[520px] rounded-md border border-cabinet-frame bg-gradient-to-b from-white to-[#eaeaea] px-4 pb-2 pt-2.5 shadow-soft sm:px-5 sm:pb-2.5 sm:pt-3"
    >
      <Screw className="left-2 top-2" />
      <Screw className="right-2 top-2" />
      <Screw className="left-2 bottom-2" />
      <Screw className="right-2 bottom-2" />

      {/* Headline row */}
      <div
        data-testid="marquee-headline-row"
        className="flex items-baseline justify-center gap-3 whitespace-nowrap"
      >
        <span
          data-testid="marquee-headline"
          className="font-marquee text-2xl text-cabinet-frame sm:text-3xl md:text-4xl"
        >
          {headline}
        </span>
        <span className="font-marquee text-2xl text-cabinet-frame sm:text-3xl md:text-4xl">
          {/* Black Han Sans 숫자가 letters보다 cap-height가 낮아 'PD10'에서
              '10'이 작아 보임 → letter/digit 분리하고 digits만 1.15em로 키움. */}
          {(() => {
            const match = headlineSuffix.match(/^([^\d]*)(\d+.*)$/);
            if (!match) return headlineSuffix;
            const [, letters, digits] = match;
            return (
              <>
                {letters}
                <span className="text-[1.15em] leading-none">{digits}</span>
              </>
            );
          })()}
        </span>
      </div>

      {/* Korean subtitle stripe */}
      <div
        data-testid="marquee-subtitle-kr"
        className="mx-auto mt-2 max-w-[88%] rounded-sm bg-marquee-stripe py-0.5 text-center font-body text-xs font-medium tracking-wide text-cabinet-frame sm:py-1 sm:text-sm md:text-base"
      >
        {subtitleKr}
      </div>

      {/* English subtitle */}
      <div
        data-testid="marquee-subtitle-en"
        className="mt-1 text-center font-body text-[10px] font-bold tracking-[0.2em] text-cabinet-frame sm:text-xs"
      >
        {subtitleEn}
      </div>
    </div>
  );
}

function Screw({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-1.5 w-1.5 rounded-full bg-[#a0a0a0] ${className}`}
    />
  );
}
