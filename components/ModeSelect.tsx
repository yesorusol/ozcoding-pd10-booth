"use client";

/**
 * components/ModeSelect.tsx — 3-zone mode picker rendered at `/`.
 *
 * Layout mirrors `app/themed/page.tsx`:
 *   ┌── 노란 배너 (KR + EN) ──┐
 *   │ [1] 도전 챌린지         │
 *   │ [2] 폴라로이드(일반)     │
 *   │   ╭─ 시작  → ─╮         │
 *   └────────────────────────┘
 *
 * Default selection is `themed`; tapping a row swaps the highlight.
 * The 시작 pill is always enabled and links to /themed or /booth?mode=normal
 * based on the current selection.
 *
 * The selected row uses `bg-btn-yellow` to rhyme with the 시작 pill below it
 * — visually communicating "this row matches the action button." The
 * unselected row uses `bg-crt-cream`. The banner above uses `bg-bubble-grad`.
 * Three distinct fill tokens prevent the dual-yellow collision flagged in v1.
 *
 * Semantics: the row container is an ARIA radiogroup; each row is a radio
 * with `aria-checked`. The visual `<ol>` element is preserved for sighted
 * source-readers but `role="radiogroup"` overrides the implicit list role
 * for assistive tech, since these are mutually-exclusive alternatives, not
 * an ordered procedure.
 *
 * Wrapped externally by ScaleToFit + CabinetChrome — this component
 * only paints inside the CRT slot.
 */

import Link from "next/link";
import { useState } from "react";
import { COPY } from "@/lib/copy";
import type { BoothMode } from "@/lib/booth-mode";

const MODE_ROWS: ReadonlyArray<{
  mode: BoothMode;
  index: number;
  titleKr: string;
  titleEn: string;
  href: string;
  testId: string;
}> = [
  {
    mode: "themed",
    index: 1,
    titleKr: COPY.modeSelect.themedTitle,
    titleEn: COPY.modeSelect.themedTitleEn,
    href: "/themed",
    // testid retained from pre-v2 component so app/page.test.tsx
    // continues to pass without being touched in test-body assertions.
    testId: "mode-card-themed",
  },
  {
    mode: "normal",
    index: 2,
    titleKr: COPY.modeSelect.normalTitle,
    titleEn: COPY.modeSelect.normalTitleEn,
    href: "/booth?mode=normal",
    testId: "mode-card-normal",
  },
];

export function ModeSelect() {
  const [selected, setSelected] = useState<BoothMode>("themed");
  const startHref =
    selected === "themed" ? "/themed" : "/booth?mode=normal";

  return (
    <div
      data-testid="mode-select"
      className="flex h-full flex-col gap-3 text-cabinet-frame sm:gap-4"
    >
      <section
        data-testid="mode-select-headline"
        className="rounded-sm border border-cabinet-frame bg-bubble-grad px-3 py-2.5 text-center shadow-soft sm:py-3"
      >
        <p className="font-marquee text-base text-cabinet-frame sm:text-xl md:text-2xl">
          {COPY.modeSelect.headlineKr}
        </p>
        <p className="font-body text-xs font-bold text-cabinet-frame sm:text-base md:text-lg">
          {COPY.modeSelect.headlineEn}
        </p>
      </section>

      <ol
        data-testid="mode-list"
        role="radiogroup"
        aria-label={COPY.modeSelect.headlineKr}
        aria-required="true"
        className="grid grid-cols-1 gap-3 px-2 sm:gap-3.5"
      >
        {MODE_ROWS.map((row) => {
          const isSelected = selected === row.mode;
          return (
            <li key={row.mode}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={row.testId}
                data-selected={isSelected ? "true" : "false"}
                onClick={() => setSelected(row.mode)}
                className={
                  isSelected
                    ? "flex w-full items-baseline gap-2 rounded-sm border border-cabinet-frame bg-btn-yellow px-3 py-3 text-left shadow-soft transition active:translate-y-px sm:py-4"
                    : "flex w-full items-baseline gap-2 rounded-sm border border-cabinet-frame bg-crt-cream px-3 py-3 text-left shadow-soft transition active:translate-y-px sm:py-4"
                }
              >
                <span className="font-marquee text-base text-cabinet-frame sm:text-lg">
                  [{row.index}]
                </span>
                <span className="leading-tight">
                  <span className="block font-body text-sm font-bold text-cabinet-frame sm:text-base">
                    {row.titleKr}
                  </span>
                  <span className="block font-body text-xs text-cabinet-frame/75 sm:text-sm">
                    {row.titleEn}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div data-testid="mode-select-nav" className="mt-auto flex justify-center">
        <Link
          href={startHref}
          data-testid="mode-start"
          aria-label={COPY.modeSelect.startButton}
          className="flex h-12 min-w-[10rem] items-center justify-center gap-2 rounded-full border border-cabinet-frame bg-btn-yellow px-8 font-marquee text-xl text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm sm:h-14 sm:text-2xl md:h-16 md:text-3xl"
        >
          <span>{COPY.modeSelect.startButton}</span>
          <span aria-hidden className="text-xl sm:text-2xl">→</span>
        </Link>
      </div>
    </div>
  );
}
