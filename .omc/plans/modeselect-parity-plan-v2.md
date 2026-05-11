# Plan v2: ModeSelect UI parity

Source spec: `.omc/specs/deep-interview-modeselect-parity.md` (Ambiguity 9.4%, PASSED)
Reference screen: `app/themed/page.tsx` (lines 25-73 — DO NOT modify)
Predecessor: `.omc/plans/modeselect-parity-plan-v1.md` (Architect verdict: ITERATE)
Target files (4 total): `components/ModeSelect.tsx`, `components/ModeSelect.test.tsx`, `lib/copy.ts`, `app/page.test.tsx`

---

## Changes from v1 (the 3 deltas the next reviewer should diff first)

1. **4th target file added: `app/page.test.tsx`.** v1 declared 3 targets; Architect flagged that `app/page.test.tsx:14-15` references `mode-card-themed` / `mode-card-normal` testids that v1 deletes from `components/ModeSelect.tsx`. **Resolution chosen: keep the existing `mode-card-themed` and `mode-card-normal` testid names on the new selection rows** (least-invasive — `app/page.test.tsx` becomes a *no-op* update; only the test description string `"renders the ModeSelect with both cards"` is reworded for honesty since the rows are no longer literally cards). The testid is just a hook; it does not need to match the DOM tag. This collapses the v1 row-testid rename (`mode-row-themed` / `mode-row-normal`) back to the existing convention. Test count math: 152 baseline -> +4 net new in `ModeSelect.test.tsx`, 0 net change in `app/page.test.tsx` -> **156 expected**.

2. **Dual-yellow disambiguation tactic chosen.** v1 risk-deferred the banner-vs-selected-row contrast collision (both `bg-marquee-yellow` separated only by `border` vs `border-2`). v2 resolves it by **changing the selected row's background to `bg-btn-yellow`** — the same token used by the 시작 pill at `app/themed/page.tsx:66`. Rationale: this creates a deliberate "this row matches the action button" rhyme — the user sees "the highlighted row is what 시작 will fire," which is exactly the cognitive model we want. It also removes the banner-vs-row color collision entirely (banner = `bg-marquee-yellow`, selected row = `bg-btn-yellow`, unselected row = `bg-crt-cream` -> three visually distinct fills). Border stays `border-cabinet-frame border-2` as a secondary signal. No inner ring needed; the color delta does the work. The other v1-considered options (leading `●` dot, inset ring) are rejected as either redundant (color delta is already strong) or noisy (an extra glyph competes with the `[N]` index sigil).

3. **`<ol>` -> `role="radiogroup"` + `role="radio"` semantics.** v1's `<ol>` plus `aria-pressed` modeled the rows as independently-toggleable buttons inside an ordered procedure. They are neither: they are mutually-exclusive alternatives in a single-select group. v2 keeps the `<ol>` element (so the visual `[N]` indexing convention reads cleanly as ordered list markers to sighted users) but **adds `role="radiogroup" aria-label={COPY.modeSelect.headlineKr}`** to the container, **swaps each row's `aria-pressed={isSelected}` to `role="radio" aria-checked={isSelected}`**, and adds `aria-required="true"` on the radiogroup since the kiosk always has a selection. The visual `<ol>` element survives because radiogroup is an ARIA role, not an element — `role="radiogroup"` overrides the implicit `list` role for AT, while sighted users keep the ordered-list semantics in source.

---

## RALPLAN-DR Summary

### Principles (3-5)

1. **Visual rhyme over visual reinvention.** The kiosk flow is `/` -> `/themed` -> `/booth`. If `/` and `/themed` share font, banner color, list rhythm, and pill geometry, the eye reads them as a single device. Therefore: copy themed's tokens verbatim, do not "improve" them.
2. **Single source of truth for copy.** All KR+EN strings flow through `lib/copy.ts` so a content edit is one-file. No string lives inline in the component.
3. **Behavior comes from existing primitives.** `BoothMode` already exists in `lib/booth-mode.ts`; `next/link` already handles navigation; `useState` already covers selection. No new abstractions, no new dependencies.
4. **Tests assert structure and contract, not pixels.** New test cases verify class-token presence on the selected/unselected rows and the computed `href` on the pill — they do not snapshot full DOM trees and do not screenshot.
5. **Inert content above interactive content.** The banner is non-interactive (decorative `<section>`); the rows are radios; the pill is the single navigational anchor. This matches the kiosk muscle memory established by themed.

### Decision Drivers (top 3)

1. **Pill className verbatim parity.** The 시작 pill at `app/themed/page.tsx:62-70` defines the exact rounded/sized/colored anchor that ModeSelect must mirror. Any deviation reads as a different button. Driver weight: highest — it's the most visible shared element.
2. **Routing without navigation regression.** `/themed` and `/booth?mode=normal` are pre-existing routes consumed downstream by `parseBoothMode`. Whatever pattern we pick for selection-to-href mapping must not break the existing 152-test baseline (which covers route resolution and `app/page.test.tsx`'s testid contract). Driver weight: high.
3. **No-scroll fit inside `<ScaleToFit><CabinetChrome>`** at kiosk viewport. Three zones (banner / list-of-2 / pill) plus the chrome's own padding (`px-5 py-4 sm:px-6 sm:py-5`). Themed already fits with banner + 7-item list + pill, so 2 items is strictly less content — but spacing tokens must still be conservative. Driver weight: medium.

### Viable Options (>=2 with bounded pros/cons)

**Option A — Faithful 3-zone mirror with row `<button role="radio">` elements + single bottom `<Link>`** (RECOMMENDED)

Component shape:
- `<div data-testid="mode-select" className="flex flex-col gap-3 sm:gap-4">` (mirrors themed's outer `gap-3 sm:gap-4` at `app/themed/page.tsx:27`).
- Banner `<section data-testid="mode-select-headline">` with KR + EN paragraphs (token-identical to `app/themed/page.tsx:28-38`).
- `<ol data-testid="mode-list" role="radiogroup" aria-label={COPY.modeSelect.headlineKr} aria-required="true">` with two `<li>` children, each containing a `<button type="button" role="radio" aria-checked={isSelected} data-testid="mode-card-{themed|normal}">` that owns the click handler.
- Bottom `<Link data-testid="mode-start" href={selected === "themed" ? "/themed" : "/booth?mode=normal"}>` with the verbatim pill className from `app/themed/page.tsx:66`.
- Selection state: `const [selected, setSelected] = useState<BoothMode>("themed");`.
- Selected-row fill: `bg-btn-yellow border-2 border-cabinet-frame` (matches the 시작 pill's `bg-btn-yellow` for action-rhyme). Unselected-row fill: `bg-crt-cream border border-cabinet-frame`. Banner stays `bg-marquee-yellow`.

Pros:
- Full structural parity — same DOM rhythm as themed (`<section>` + `<ol>` + bottom nav), so the visual rhyme principle is satisfied automatically.
- Three distinct fill tokens (banner yellow / button yellow / cream) eliminate the v1 dual-yellow ambiguity.
- `role="radiogroup"` + `role="radio"` matches the actual select-from-N-alternatives semantics; AT users hear "radio group, themed, selected, 1 of 2" instead of "list, button pressed".
- The pill is the only navigational anchor -> `next/link` prefetch fires once, not twice.
- Test surface is small: assert class tokens, assert `href`, assert click-flips-selection, assert `aria-checked` toggles.
- `app/page.test.tsx` continues to pass without test-body edits (testids preserved).

Cons:
- Slightly more JSX than option B (need explicit `<button>` plus role/aria-checked handling).
- Two yellows still appear on screen (banner + selected row + pill = 3 yellow zones), but they are now three *different* yellows, not two of the same. Mitigation already in plan; documented in Risks below.

**Option B — `<Link>`-as-row (each row is a navigation), select-on-tap, drop the bottom pill**

Component shape:
- Same banner.
- Each list row is `<Link href={...}>` and the bottom pill is omitted.
- "Selection state" becomes implicit (whichever row the user taps navigates immediately).

Pros:
- Less JSX, less state, no explicit handler wiring.
- One fewer interactive element on screen.

Cons (DEAL-BREAKERS):
- **Violates the spec's Round-2 resolution explicitly** ("select-then-시작 with default=themed; pill always enabled"). The spec relitigates this in Assumptions Resolved row 2 ("Click goes immediately on card tap").
- Loses the bottom pill anchor — which is the entire reason the user called the current screen "shape unnatural" (Round 1).
- Removes visual parity with themed (themed has a bottom pill; option B has none).
- Cannot satisfy acceptance criterion "시작 pill href === `/themed` when themed selected; `/booth?mode=normal` when normal selected" — there is no pill.

**Chosen: A** — Option B is invalidated by spec Rounds 1 and 2 and by the explicit acceptance criterion that mentions the 시작 pill href. Option A is the only structurally compliant path.

> Note on alternatives invalidation: The spec's deep-interview converged at Round 2 with stability ratio 100% on the select-then-시작 model and the 3-zone shape. Re-opening that decision here would re-introduce ambiguity the interview already closed.

---

## Implementation Steps

### Step 1: Update `lib/copy.ts` `COPY.modeSelect` block

**File**: `/Users/a1111/Desktop/ozcoding-pd09-booth/lib/copy.ts:29-35`

**Old block** (current `lib/copy.ts:29-35`):
```ts
modeSelect: {
  headline: "모드를 선택해주세요",
  themedTitle: "도전 챌린지",
  themedSub: "테마 7컷 챌린지",
  normalTitle: "폴라로이드(일반)",
  normalSub: "추억의 폴라로이드 4컷",
},
```

**New block**:
```ts
modeSelect: {
  /** 노란 배너 한국어 헤드라인 — 어떤 부스를 고를지 묻는 톤 */
  headlineKr: "어떤 부스로 갈까요?",
  /** 노란 배너 영문 헤드라인 */
  headlineEn: "Pick your photobooth!",
  /** [1] 행: 테마 모드 한국어 라벨 */
  themedTitle: "도전 챌린지",
  /** [1] 행: 테마 모드 영문 짧은 카테고리 라벨 */
  themedTitleEn: "Themed 7-cut",
  /** [2] 행: 폴라로이드 모드 한국어 라벨 */
  normalTitle: "폴라로이드(일반)",
  /** [2] 행: 폴라로이드 모드 영문 짧은 카테고리 라벨 */
  normalTitleEn: "Polaroid 4-cut",
  /** 시작 핀 라벨 (themed.idle.startButton과 동일 단어) */
  startButton: "시작",
},
```

**Diff intent** (unchanged from v1):
- `headline` -> renamed to `headlineKr`; value `"모드를 선택해주세요"` -> `"어떤 부스로 갈까요?"` (Round 3 banner choice = B).
- `headlineEn` added: `"Pick your photobooth!"` (Round 3 banner choice = B).
- `themedSub` -> renamed to `themedTitleEn`; value `"테마 7컷 챌린지"` -> `"Themed 7-cut"` (Round 3 item-sub choice = A).
- `normalSub` -> renamed to `normalTitleEn`; value `"추억의 폴라로이드 4컷"` -> `"Polaroid 4-cut"` (Round 3 item-sub choice = A).
- `startButton: "시작"` added (mirrors `COPY.idle.startButton`).
- `themedTitle` and `normalTitle` strings unchanged.

**Verification for this step**: `npx tsc --noEmit` should still pass — but there will be compile errors in `ModeSelect.tsx` until Step 2 ships, so run tsc only after Step 1 + Step 2 are both written. Do NOT commit between steps 1 and 2.

### Step 2: Rewrite `components/ModeSelect.tsx`

**File**: `/Users/a1111/Desktop/ozcoding-pd09-booth/components/ModeSelect.tsx` (full replacement)

**New shape** (`use client` directive required because of `useState`):

```tsx
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
 * unselected row uses `bg-crt-cream`. The banner above stays `bg-marquee-yellow`.
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
      className="flex flex-col gap-3 text-cabinet-frame sm:gap-4"
    >
      <section
        data-testid="mode-select-headline"
        className="rounded-sm border border-cabinet-frame bg-marquee-yellow px-3 py-2.5 text-center shadow-soft sm:py-3"
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
        className="grid grid-cols-1 gap-2 px-2 sm:gap-2.5"
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
                    ? "flex w-full items-baseline gap-2 rounded-sm border-2 border-cabinet-frame bg-btn-yellow px-3 py-2 text-left shadow-soft transition active:translate-y-px sm:py-2.5"
                    : "flex w-full items-baseline gap-2 rounded-sm border border-cabinet-frame bg-crt-cream px-3 py-2 text-left shadow-soft transition active:translate-y-px sm:py-2.5"
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

      <div data-testid="mode-select-nav" className="mt-1 flex justify-center">
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
```

**Token provenance** (every className token traces to themed):
- Outer `flex flex-col gap-3 ... sm:gap-4` -> matches `app/themed/page.tsx:27`.
- Banner classes -> verbatim copy of `app/themed/page.tsx:30` (border, bg, padding, shadow).
- Banner KR `<p>` classes -> verbatim copy of `app/themed/page.tsx:32`.
- Banner EN `<p>` classes -> verbatim copy of `app/themed/page.tsx:35`.
- Row `[N]` index span -> verbatim copy of `app/themed/page.tsx:46-47`.
- Row KR title -> verbatim copy of `app/themed/page.tsx:50`.
- Row EN sub -> verbatim copy of `app/themed/page.tsx:53`.
- Selected-row `bg-btn-yellow border-2 border-cabinet-frame` -> `bg-btn-yellow` token reused from `app/themed/page.tsx:66` (the 시작 pill's fill); `border-2` is the only non-themed-derived token, justified as the spec-mandated selection signal.
- Unselected-row `bg-crt-cream border border-cabinet-frame` -> `bg-crt-cream` is the standing background-of-the-CRT-slot token; consistent with components/CabinetChrome.tsx conventions.
- 시작 pill className -> verbatim copy of `app/themed/page.tsx:66` (h-12 / min-w-10rem / rounded-full / bg-btn-yellow / font-marquee / shadow-soft / active:translate-y-px / active:shadow-y2k-sm and the responsive `sm:h-14 md:h-16 sm:text-2xl md:text-3xl`).
- Pill arrow `<span aria-hidden className="text-xl sm:text-2xl">→</span>` -> verbatim from `app/themed/page.tsx:69`.

**Behavior matrix**:

| User action | State change | Visible result |
|---|---|---|
| Initial mount | `selected = "themed"` | Themed row: `bg-btn-yellow border-2`, `aria-checked="true"`. Normal row: `bg-crt-cream border`, `aria-checked="false"`. Pill href: `/themed`. |
| Tap normal row | `selected = "normal"` | Normal row gets `bg-btn-yellow border-2`, `aria-checked="true"`. Themed row reverts to `bg-crt-cream border`. Pill href flips to `/booth?mode=normal`. |
| Tap themed row (when normal was selected) | `selected = "themed"` | Highlight flips back. Pill href flips back to `/themed`. |
| Tap 시작 pill | (no state change) | Navigate via `next/link` to current `startHref`. |

### Step 3: Update `components/ModeSelect.test.tsx`

**File**: `/Users/a1111/Desktop/ozcoding-pd09-booth/components/ModeSelect.test.tsx` (full rewrite — three old tests replaced)

**Stale assertions to remove**:
- `screen.getByText(COPY.modeSelect.headline)` — key is gone (renamed to `headlineKr`).
- `screen.getByText(COPY.modeSelect.themedSub)` / `normalSub` — keys are gone (renamed to `themedTitleEn` / `normalTitleEn`).
- The `card.tagName === "A"` assertions — rows are now `<button role="radio">`, not `<a>`.

**Note**: testids `mode-card-themed` / `mode-card-normal` are *retained* (per Change-from-v1 #1) so existing assertions referencing those testids do not need rename.

**New test suite**:

```tsx
/**
 * components/ModeSelect.test.tsx — 3-zone mode picker render + selection + routing.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeSelect } from "./ModeSelect";
import { COPY } from "@/lib/copy";

describe("ModeSelect — 3-zone layout", () => {
  it("renders banner with both KR and EN headlines", () => {
    render(<ModeSelect />);
    const banner = screen.getByTestId("mode-select-headline");
    expect(banner).toHaveTextContent(COPY.modeSelect.headlineKr);
    expect(banner).toHaveTextContent(COPY.modeSelect.headlineEn);
  });

  it("renders both indexed list rows with [N] + KR + EN", () => {
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-card-themed");
    const normalRow = screen.getByTestId("mode-card-normal");
    expect(themedRow).toHaveTextContent("[1]");
    expect(themedRow).toHaveTextContent(COPY.modeSelect.themedTitle);
    expect(themedRow).toHaveTextContent(COPY.modeSelect.themedTitleEn);
    expect(normalRow).toHaveTextContent("[2]");
    expect(normalRow).toHaveTextContent(COPY.modeSelect.normalTitle);
    expect(normalRow).toHaveTextContent(COPY.modeSelect.normalTitleEn);
  });

  it("rows are exposed as ARIA radios inside a radiogroup", () => {
    render(<ModeSelect />);
    const list = screen.getByTestId("mode-list");
    expect(list).toHaveAttribute("role", "radiogroup");
    expect(screen.getByTestId("mode-card-themed")).toHaveAttribute("role", "radio");
    expect(screen.getByTestId("mode-card-normal")).toHaveAttribute("role", "radio");
  });

  it("themed is the default selection on mount", () => {
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-card-themed");
    const normalRow = screen.getByTestId("mode-card-normal");
    expect(themedRow).toHaveAttribute("aria-checked", "true");
    expect(themedRow).toHaveAttribute("data-selected", "true");
    expect(themedRow.className).toMatch(/bg-btn-yellow/);
    expect(themedRow.className).toMatch(/border-2/);
    expect(normalRow).toHaveAttribute("aria-checked", "false");
    expect(normalRow).toHaveAttribute("data-selected", "false");
    expect(normalRow.className).toMatch(/bg-crt-cream/);
    expect(normalRow.className).not.toMatch(/border-2/);
  });

  it("tapping the normal row swaps the highlight to normal", async () => {
    const user = userEvent.setup();
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-card-themed");
    const normalRow = screen.getByTestId("mode-card-normal");
    await user.click(normalRow);
    expect(normalRow).toHaveAttribute("aria-checked", "true");
    expect(normalRow.className).toMatch(/bg-btn-yellow/);
    expect(normalRow.className).toMatch(/border-2/);
    expect(themedRow).toHaveAttribute("aria-checked", "false");
    expect(themedRow.className).toMatch(/bg-crt-cream/);
  });

  it("시작 pill href === /themed when themed selected (default)", () => {
    render(<ModeSelect />);
    const start = screen.getByTestId("mode-start");
    expect(start.tagName).toBe("A");
    expect(start.getAttribute("href")).toBe("/themed");
  });

  it("시작 pill href === /booth?mode=normal after selecting normal", async () => {
    const user = userEvent.setup();
    render(<ModeSelect />);
    await user.click(screen.getByTestId("mode-card-normal"));
    const start = screen.getByTestId("mode-start");
    expect(start.getAttribute("href")).toBe("/booth?mode=normal");
  });

  it("시작 pill is always enabled (no disabled state)", () => {
    render(<ModeSelect />);
    const start = screen.getByTestId("mode-start");
    expect(start).not.toHaveAttribute("aria-disabled", "true");
    expect(start.getAttribute("href")).toBeTruthy();
  });
});
```

**Test count**: 8 tests in `ModeSelect.test.tsx` (replaces the 3 in the current file). Net **+5** tests against the 152 baseline. `app/page.test.tsx` does not change net test count (still 2 tests, both still passing). Expected post-change suite size: **152 + 5 = 157 tests**.

> Note on the test-count anchor: v1 claimed 156. v2 adds the new "rows are exposed as ARIA radios inside a radiogroup" test (delta +1) because the role swap is a contract change worth asserting. New target = **157**. If running the suite reveals the actual baseline is not 152, take the actual baseline + 5 as the new target and update this number before handing off to executor.

**Dependency note**: `userEvent` should already be available — confirm with `grep -l "@testing-library/user-event" components/*.test.tsx` during Step 5. If absent in the workspace, fall back to `fireEvent.click()` from `@testing-library/react`. (The two tests that use `user.click` would each become `fireEvent.click(row)` synchronous, dropping the `async` keyword.)

### Step 4: Touch up `app/page.test.tsx` (test description only, no assertion edits)

**File**: `/Users/a1111/Desktop/ozcoding-pd09-booth/app/page.test.tsx`

The two assertions at `app/page.test.tsx:14-15` (`getByTestId("mode-card-themed")` and `getByTestId("mode-card-normal")`) **stay as-is** because v2 retains those testid names on the new selection rows. The only change is to update the `it(...)` description string at `app/page.test.tsx:11` for honesty — the rows are no longer literally cards.

**Old block** (current `app/page.test.tsx:10-22`):
```tsx
describe("HomePage (`/`)", () => {
  it("renders the ModeSelect with both cards", () => {
    render(<HomePage />);
    expect(screen.getByTestId("mode-select")).toBeInTheDocument();
    expect(screen.getByTestId("mode-card-themed")).toBeInTheDocument();
    expect(screen.getByTestId("mode-card-normal")).toBeInTheDocument();
  });

  it("does NOT render the legacy themed 7-cut menu", () => {
    render(<HomePage />);
    expect(screen.queryByTestId("frame-menu")).toBeNull();
  });
});
```

**New block**:
```tsx
describe("HomePage (`/`)", () => {
  it("renders the ModeSelect with themed and normal mode rows", () => {
    render(<HomePage />);
    expect(screen.getByTestId("mode-select")).toBeInTheDocument();
    expect(screen.getByTestId("mode-card-themed")).toBeInTheDocument();
    expect(screen.getByTestId("mode-card-normal")).toBeInTheDocument();
  });

  it("does NOT render the legacy themed 7-cut menu", () => {
    render(<HomePage />);
    expect(screen.queryByTestId("frame-menu")).toBeNull();
  });
});
```

**Diff**: line 11 only — `"renders the ModeSelect with both cards"` -> `"renders the ModeSelect with themed and normal mode rows"`. All assertions unchanged. Test count unchanged (still 2 tests, both passing).

> Why this is more than just a comment change: `it(...)` descriptions are part of the test-suite contract surface; future readers grepping for "card" in test descriptions will land here. The new ModeSelect is a list-of-radios, not a card grid, and leaving the description stale invites future confusion. The cost is one string edit; the benefit is contract honesty.

> Why we kept the testids instead of renaming them: renaming `mode-card-*` -> `mode-row-*` (v1's approach) would have required edits in two test files plus the component, *plus* an additional Step-4 grep sweep to make sure no other consumer references the old names. Keeping the testid name preserves the existing public contract; the testid is a stable hook, not a description of DOM shape. This was the path of least invasiveness Architect explicitly endorsed ("the simplest path is to keep the existing `mode-card-*` testid names on the new `<button>` rows").

### Step 5: Verification

Run in this order from `/Users/a1111/Desktop/ozcoding-pd09-booth`:

1. **TypeScript check**: `npx tsc --noEmit` -> must be clean. (Catches any leftover reference to `COPY.modeSelect.headline` / `themedSub` / `normalSub` elsewhere in the repo.)
2. **Pre-flight grep for stale references** (sanity, before running tests):
   `grep -rn "modeSelect\.headline\b\|modeSelect\.themedSub\|modeSelect\.normalSub" --include="*.ts" --include="*.tsx" .` -> expect zero matches.
   `grep -rn "mode-card-themed\|mode-card-normal" --include="*.ts" --include="*.tsx" .` -> expect 4 matches (component declarations + ModeSelect.test.tsx + app/page.test.tsx); these are intentional.
   `grep -rn "mode-row-themed\|mode-row-normal" --include="*.ts" --include="*.tsx" .` -> expect zero matches (we did not introduce these new names; this guards against accidental v1-leftover code).
3. **Unit tests**: `npm test -- --run` -> expect **152 baseline + 5 net-new = 157 green**. (`ModeSelect.test.tsx`: 8 tests replacing 3 = +5 net. `app/page.test.tsx`: 2 -> 2 = 0 net. Total: +5.)
4. **Visual smoke** (parallel-able with #1-#3 if you want):
   - `npm run dev`
   - Navigate to `http://localhost:3000` -> confirm:
     - Yellow banner shows both `어떤 부스로 갈까요?` and `Pick your photobooth!`.
     - Two rows: `[1] 도전 챌린지 / Themed 7-cut` and `[2] 폴라로이드(일반) / Polaroid 4-cut`.
     - On load, the themed row is highlighted with the **same yellow as the 시작 pill** (`bg-btn-yellow`), with thick border. Normal row is cream with thin border. Banner is its own marquee yellow above.
     - Tap the normal row -> highlight flips visibly; the eye should also flick to the 시작 pill since they now share fill color.
     - 시작 pill at the bottom, rounded, yellow, with `→` arrow; tapping navigates to `/themed` (default) or `/booth?mode=normal` (after selecting normal).
   - Place `/` and `/themed` side-by-side in two browser tabs -> confirm shared font/banner/pill tokens.
   - At kiosk-target viewport -> confirm no scrollbar inside `<CabinetChrome>`.
   - Accessibility smoke: with VoiceOver / NVDA, focus the radiogroup -> expect "radio group, themed, selected, 1 of 2" (or AT-equivalent). Tab to 시작 -> expect "시작, link".

---

## Risks & Migration Notes

- **Risk: Other files reference the renamed copy keys.** Mitigation: Step 5 pre-flight grep catches all `modeSelect.headline`, `modeSelect.themedSub`, `modeSelect.normalSub` references repo-wide before running tests. Currently only `components/ModeSelect.tsx` and `components/ModeSelect.test.tsx` use them.
- **Risk: `useState` requires `"use client"`.** Mitigation: directive is at the top of the new `ModeSelect.tsx` (already there in the current file). `app/page.tsx` is a server component that renders `<ModeSelect />`; the boundary is clean because `ModeSelect` is the client component itself.
- **Risk: `<button role="radio">`-inside-`<li>`-inside-`<ol role="radiogroup">` accessibility.** Mitigation: ARIA explicitly permits roles to override implicit element semantics. `role="radiogroup"` overrides `<ol>`'s implicit `list` role; the `<li>` wrappers become presentation-only for AT, while sighted source-readers retain the visual ordered-list semantics. Pattern is documented in WAI-ARIA Authoring Practices.
- **Risk: `userEvent` not in deps.** Mitigation: Step 3 includes a `fireEvent` fallback. Verify dependency presence in Step 5 before writing tests.
- **Risk: Three yellow zones on screen simultaneously (banner + selected row + 시작 pill).** Mitigation: banner uses `bg-marquee-yellow` (a true saturated yellow), selected row + pill use `bg-btn-yellow` (the action-yellow). The intentional rhyme between selected row and pill is the *signal*, not noise — it cues the user that the selected row determines what 시작 will fire. The banner's distinct fill prevents collision. If kiosk operators report the row-pill rhyme is too tight (e.g., they want the row visually cooler than the action), a follow-up token tweak (selected row -> `bg-btn-yellow/80`) is a one-line change.
- **Risk: Keyboard navigation in the radiogroup is not implemented.** ARIA convention is arrow keys for radio navigation; we wire only Tab + Click. For a touch kiosk this is acceptable (no keyboard); for desktop developer testing, Tab still works because `<button>`s are focusable. Mitigation: a follow-up could add an `onKeyDown` handler to the radiogroup that maps Up/Down to selection swap. Out of scope for v2 — kiosk has no keyboard, and the QA goal is touch behavior.
- **Migration note: No data migration. No SSR/hydration concerns** beyond the existing `"use client"` boundary. No localStorage / cookies / URL state.

---

## ADR (Architecture Decision Record)

**Decision**: Replace ModeSelect's 2-card layout with a 3-zone (banner / `<ol role="radiogroup">` of 2 indexed `<button role="radio">` rows / bottom 시작 `<Link>` pill) layout that mirrors `app/themed/page.tsx`'s structure verbatim, with `themed` as the default selection, the 시작 pill always enabled, and the selected row sharing the `bg-btn-yellow` fill of the action pill (not the banner's `bg-marquee-yellow`) so the selection-to-action rhyme is visible.

**Drivers**:
1. Visual continuity with themed (cited as "shape unnatural" in current state — fixed by structural mirroring, not just copy changes).
2. Bilingual KR+EN copy parity with themed (eliminates the "monolingual mode-select" tone mismatch flagged in spec Round 3).
3. Kiosk muscle memory: two consecutive screens with the same banner-list-pill rhythm reduce cognitive load on first-time users at the booth.
4. Selection legibility at kiosk viewing distance — three distinct fill tokens (banner yellow, button yellow, cream) carry stronger signal than v1's two-yellows-with-border-weight-delta.
5. AT honesty — single-select-from-N is exactly what `role="radiogroup"` was designed for, and the rows are mutually exclusive, not independently toggleable.

**Alternatives considered**:
- **Card polish only** (themed look-and-feel applied to the existing 2-card grid). Rejected at spec Round 1: cards have no bottom anchor, so the 시작-pill rhythm cannot be reproduced. This was the literal complaint that triggered the spec.
- **Hybrid (cards + START button)**. Rejected at spec Round 1: still keeps the card metaphor, which is structurally different from themed's list-of-rows. Doubles the visual primitives.
- **Link-as-row, no bottom pill** (Option B above). Rejected because it violates the explicit Round-2 resolution and removes the 시작 pill that the acceptance criteria depend on.
- **Plan v1 with `bg-marquee-yellow border-2` selected row + `aria-pressed`** (the immediately preceding plan). Superseded by v2: dual-yellow contrast was too weak at kiosk distance, and `aria-pressed` mismodeled the mutually-exclusive selection as independent toggle state.
- **Dual-yellow disambiguation via leading `●` dot or inset `ring`** (considered for v2). Rejected because the color delta from `bg-marquee-yellow` -> `bg-btn-yellow` already does the work without adding a new visual primitive; the extra glyph or ring would compete with the `[N]` index sigil that already serves as the row-locator.
- **Rename testids to `mode-row-*`** (v1's path). Rejected for v2 in favor of keeping `mode-card-*` testids: less invasive (no test-body assertion edits in `app/page.test.tsx`), preserves the public test hook contract, and the testid is a stable identifier, not a DOM-shape description.

**Why chosen**: Option A with the v2 refinements is the only path that satisfies all five acceptance criteria simultaneously (unit tests, visual parity, no-scroll, routing preserved, selection legibility) without re-opening any decision the deep-interview converged on. Token reuse remains high (every className token traces to a specific themed line, except `border-2` which is the spec-mandated selection signal). The four-file scope (component, copy, two test files) closes the v1 gap that Architect flagged, and the `bg-btn-yellow` selection fill plus `role="radiogroup"`/`aria-checked` resolve the two non-blocking findings.

**Consequences**:
- (+) `/` and `/themed` become visually unified — eye reads them as one device.
- (+) Bilingual copy is now consistent across the whole pre-booth flow.
- (+) Selected row and 시작 pill share `bg-btn-yellow` -> "the highlighted row is what 시작 will fire" reads instantly.
- (+) Three fill tokens (banner yellow / button yellow / cream) eliminate dual-yellow contrast risk.
- (+) `role="radiogroup"` + `role="radio"` matches the actual select-from-N-alternatives semantics; AT users hear "radio group, 1 of 2".
- (+) New `[N]` indexing convention is reusable if a third mode is added (just append `[3]` row + key in `MODE_ROWS`).
- (+) `app/page.test.tsx` does not need assertion edits (testids retained); only one test description string is updated.
- (-) Slightly more JSX (button + handler + state + role/aria) than the prior 2-card version. Acceptable: the file is still under 110 lines.
- (-) Three yellow zones on screen simultaneously. Mitigated by distinct token fills, but a follow-up could damp the selected row to `bg-btn-yellow/80` if operators report the row-pill rhyme is too tight.
- (-) Tests now depend on Tailwind class strings appearing in `className`. If a future refactor renames `bg-btn-yellow` -> `bg-action-yellow`, the regex assertions will need updating. Mitigation: tests import the class fragments as expected substrings, not full classNames.
- (-) Keyboard arrow-key navigation for the radiogroup is not implemented; only Tab + Click. Acceptable for touch kiosk. See Risks for future-work note.

**Follow-ups**:
- If a third booth mode is ever added, generalize `MODE_ROWS` from 2 entries to N — the JSX already maps.
- Consider extracting the verbatim 시작-pill className into a shared `lib/styles.ts` constant so themed and ModeSelect share a single source. Out of scope for v2 to keep the file count tight.
- If kiosk operators report touch-area too small on the rows, increase `py-2 sm:py-2.5` to `py-3 sm:py-4` — pure token tweak, no structural change.
- If desktop QA needs arrow-key selection in the radiogroup, add a `onKeyDown` handler that maps Up/Down to selection swap.
- If the `bg-btn-yellow` selected-row + `bg-btn-yellow` pill rhyme reads as too-strong on kiosk hardware, damp to `bg-btn-yellow/80` for the row.

---

## Acceptance Criteria (inherited from spec; v2 updated)

- [ ] Unit tests green (152 baseline + 5 net-new in `ModeSelect.test.tsx` + 0 net in `app/page.test.tsx` -> **157 total**).
- [ ] Visual parity: identical font (`font-marquee`/`font-body`), banner color (`bg-marquee-yellow`), pill color (`bg-btn-yellow`), border tokens (`border-cabinet-frame`), and pill geometry (`rounded-full` + `h-12 sm:h-14 md:h-16` + `min-w-[10rem]`) with `/themed`.
- [ ] No scroll inside `<CabinetChrome>` at kiosk-target viewport.
- [ ] Routing: 시작 pill `href === "/themed"` when themed selected; `href === "/booth?mode=normal"` when normal selected.
- [ ] Default selection on mount: themed row carries `bg-btn-yellow border-2` and `aria-checked="true"`; normal row carries `bg-crt-cream border` and `aria-checked="false"`.
- [ ] Selection signal uses three distinct fills (banner `bg-marquee-yellow`, selected row `bg-btn-yellow`, unselected row `bg-crt-cream`); no two adjacent visual zones share a fill.
- [ ] Row container exposes `role="radiogroup"`; each row exposes `role="radio"` with `aria-checked` reflecting selection state.
- [ ] No icons added; only `[1]` / `[2]` brackets as leading sigils.
- [ ] No changes to any file outside the 4 listed targets.
- [ ] Existing testids `mode-card-themed`, `mode-card-normal`, `mode-select` are preserved on the new DOM (so `app/page.test.tsx` continues to pass without assertion edits).

---

## Architect Re-Review v2

**Verdict: APPROVE.** All three v1 findings resolved; new concerns are non-blocking.

### v1 findings → v2 resolution check

1. **(BLOCKER) `app/page.test.tsx` 4th-target.** RESOLVED at v2 lines 6, 12, 411-455. Plan adds the file as 4th target, but elects the *less-invasive* path — keep `mode-card-themed`/`mode-card-normal` testids on the new `<button role="radio">` rows so existing assertions at `app/page.test.tsx:14-15` pass unchanged. Only line 11's description string is reworded. I verified by re-reading `/Users/a1111/Desktop/ozcoding-pd09-booth/app/page.test.tsx` — the proposed scope is genuine and minimal. Endorsed.

2. **Dual-yellow contrast.** RESOLVED at v2 lines 14, 46, 156, 487. Selected row swaps to `bg-btn-yellow`; banner stays `bg-marquee-yellow`. Confirmed via `tailwind.config.ts:18,33`: marquee=`#ffe21d`, btn=`#ffd84d`. Hex delta ~5% lightness — narrower than ideal in isolation, BUT they are non-adjacent (separated by `gap-3 sm:gap-4` and the cream unselected row sits between them when normal is selected). More importantly, the row→pill *rhyme* (selected row matches action pill) is the actual signal; the row→banner *contrast* is secondary. Net: the dual-yellow ambiguity is replaced by an intentional dual-yellow rhyme. Acceptable.

3. **`<ol>` semantics.** RESOLVED at v2 lines 16, 43, 223-227, 485. `role="radiogroup"` + `aria-label` + `aria-required="true"` on the `<ol>`; each row gets `role="radio"` + `aria-checked`. ARIA role override of an HTML element's implicit role is permitted (WAI-ARIA 1.2 §5.4); `<li>` becomes presentation for AT, sighted source-readers retain ordered-list semantics. No conflict.

### New concerns introduced by v2

- **Test count math.** v2 says 152 + 5 = **157** (line 405, 466, 538). v1 said 156. v2 adds the new "rows are exposed as ARIA radios" test (+1 over v1's plan). Internally consistent: 8 new ModeSelect tests − 3 deleted = +5 net; `app/page.test.tsx` net 0. Math checks out. Plan also includes a self-correction clause at line 407 ("if actual baseline ≠ 152, take actual + 5") — appropriately defensive.
- **Stale assertions in `ModeSelect.test.tsx`.** Confirmed via grep: current file at lines 13/15/17/22/29 references `COPY.modeSelect.headline`/`themedSub`/`normalSub` and uses `mode-card-*` testids. v2 lines 306-311 explicitly enumerate the stale assertions to remove and the rewrite is a full replacement, so no silent breakage risk.
- **`<button role="radio">` keyboard navigation gap.** Acknowledged at line 488 as out-of-scope for touch kiosk. Acceptable.
- **No naming collisions.** New tests use distinct `it(...)` strings; no duplicate descriptions inside the suite.

### Approval

The v2 plan is structurally sound, addresses every v1 finding with cited line numbers, and introduces no new blockers. Critic may proceed.

---

## Critic Evaluation v2

**VERDICT: APPROVE**

**Per-dimension assessment**:

1. **Principle-option consistency (PASS)**: 5 principles map cleanly onto Option A. "Single source of truth for copy" → Step 1 keeps every string in `lib/copy.ts`; "Behavior from existing primitives" → reuses `BoothMode` (verified at `lib/booth-mode.ts:14`), `next/link`, `useState`. No principle violated.

2. **Fair alternative treatment (PASS)**: Option B steelmanned with concrete pros (less JSX/state, fewer interactive elements) before rejection on substantive grounds — spec Round 2 resolution + acceptance criterion #4. Rejection rests on facts, not opinion.

3. **Risk mitigation clarity (PASS)**:
   - Test-count anchor: Verified empirically — `grep -cE "^\s*(it|test)\(" *.test.*` across 19 files sums to **exactly 152**. Plan's 152→157 math correct (3 ModeSelect tests deleted, 8 added, app/page.test.tsx unchanged).
   - `bg-btn-yellow` (#ffd84d) vs `bg-marquee-yellow` (#ffe21d): ~5% lightness delta is narrow but reframed as intentional rhyme (selected row = action pill). Cream unselected row separates banner from selected when normal is picked. Escape hatch (`bg-btn-yellow/80`) noted.
   - `"use client"` directive: Confirmed at top of new ModeSelect.tsx and current file.

4. **Testable acceptance criteria (PASS)**: All 5 spec acceptance criteria mapped to concrete tests; class-token assertions use substring regex (`/bg-btn-yellow/`, `/border-2/`).

5. **Concrete verification steps (PASS)**: Step 5 provides executable checklist: `npx tsc --noEmit`, three `grep -rn` commands, `npm test -- --run`, visual smoke checklist with observable conditions.

6. **Brittleness (ACCEPTABLE)**: Class-substring tests acknowledged as tradeoff in ADR Consequences. `@testing-library/user-event ^14` confirmed in package.json.

**Specific blocking concerns**: NONE.

**Minor non-blocking notes for executor**:
- Plan line 464 says "expect 4 matches" for the modeSelect grep — actual will be 6 (2 component + 2 ModeSelect.test.tsx + 2 app/page.test.tsx). Treat as "non-zero, all in 3 expected files" rather than literal 4.
- `userEvent` fallback note at line 409 is dead code (dep is confirmed present). Harmless; executor can skip the conditional.

**Ready for execution.**
