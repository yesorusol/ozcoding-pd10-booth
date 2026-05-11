# Plan v1: ModeSelect UI parity

Source spec: `.omc/specs/deep-interview-modeselect-parity.md` (Ambiguity 9.4%, PASSED)
Reference screen: `app/themed/page.tsx` (lines 25–73 — DO NOT modify)
Target files (3 total): `components/ModeSelect.tsx`, `components/ModeSelect.test.tsx`, `lib/copy.ts`

---

## RALPLAN-DR Summary

### Principles (3-5)

1. **Visual rhyme over visual reinvention.** The kiosk flow is `/` → `/themed` → `/booth`. If `/` and `/themed` share font, banner color, list rhythm, and pill geometry, the eye reads them as a single device. Therefore: copy themed's tokens verbatim, do not "improve" them.
2. **Single source of truth for copy.** All KR+EN strings flow through `lib/copy.ts` so a content edit is one-file. No string lives inline in the component.
3. **Behavior comes from existing primitives.** `BoothMode` already exists in `lib/booth-mode.ts`; `next/link` already handles navigation; `useState` already covers selection. No new abstractions, no new dependencies.
4. **Tests assert structure and contract, not pixels.** New test cases verify class-token presence on the selected/unselected rows and the computed `href` on the pill — they do not snapshot full DOM trees and do not screenshot.
5. **Inert content above interactive content.** The banner is non-interactive (decorative `<section>`); the rows are buttons; the pill is the single navigational anchor. This matches the kiosk muscle memory established by themed.

### Decision Drivers (top 3)

1. **Pill className verbatim parity.** The 시작 pill at `app/themed/page.tsx:62-70` defines the exact rounded/sized/colored anchor that ModeSelect must mirror. Any deviation reads as a different button. Driver weight: highest — it's the most visible shared element.
2. **Routing without navigation regression.** `/themed` and `/booth?mode=normal` are pre-existing routes consumed downstream by `parseBoothMode`. Whatever pattern we pick for selection-to-href mapping must not break the existing 152-test baseline (which presumably covers route resolution). Driver weight: high.
3. **No-scroll fit inside `<ScaleToFit><CabinetChrome>`** at kiosk viewport. Three zones (banner / list-of-2 / pill) plus the chrome's own padding (`px-5 py-4 sm:px-6 sm:py-5`). Themed already fits with banner + 7-item list + pill, so 2 items is strictly less content — but spacing tokens must still be conservative. Driver weight: medium.

### Viable Options (>=2 with bounded pros/cons)

**Option A — Faithful 3-zone mirror with row `<button>` elements + single bottom `<Link>`** (RECOMMENDED)

Component shape:
- `<div data-testid="mode-select" className="flex flex-col gap-3 sm:gap-4">` (mirrors themed's outer `gap-3 sm:gap-4` at `app/themed/page.tsx:27`).
- Banner `<section data-testid="mode-select-headline">` with KR + EN paragraphs (token-identical to `app/themed/page.tsx:28-38`).
- `<ol data-testid="mode-list">` with two `<li>` children, each containing a `<button type="button" data-testid="mode-row-{themed|normal}">` that owns the click handler.
- Bottom `<Link data-testid="mode-start" href={selected === "themed" ? "/themed" : "/booth?mode=normal"}>` with the verbatim pill className from `app/themed/page.tsx:66`.
- Selection state: `const [selected, setSelected] = useState<BoothMode>("themed");`.

Pros:
- Full structural parity — same DOM rhythm as themed (`<section>` + `<ol>` + bottom nav), so the visual rhyme principle is satisfied automatically.
- Buttons inside an ordered list keep semantic meaning ("an ordered choice list with two options"); screen readers announce position.
- The pill is the only navigational anchor → `next/link` prefetch fires once, not twice.
- Test surface is small: assert class tokens, assert `href`, assert click-flips-selection.

Cons:
- Slightly more JSX than option B (need explicit `<button>` plus aria-pressed handling).
- The `<ol>` semantic is mildly editorialized — themed uses `<ol>` for an ordered 7-item flow; here the order between themed and normal is editorial, not procedural. Mitigation: same ordering convention used by spec, indices `[1]`/`[2]` are explicitly called out, so `<ol>` is defensible.

**Option B — `<Link>`-as-row (each row is a navigation), select-on-hover/visit, drop the bottom pill**

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

**Diff intent**:
- `headline` → renamed to `headlineKr` (semantic rename; same string would have been wrong tone, also replaced with the question form).
- `headline` value `"모드를 선택해주세요"` → `"어떤 부스로 갈까요?"` (Round 3 banner choice = B).
- `headlineEn` added: `"Pick your photobooth!"` (Round 3 banner choice = B).
- `themedSub` → renamed to `themedTitleEn`; value `"테마 7컷 챌린지"` → `"Themed 7-cut"` (Round 3 item-sub choice = A).
- `normalSub` → renamed to `normalTitleEn`; value `"추억의 폴라로이드 4컷"` → `"Polaroid 4-cut"` (Round 3 item-sub choice = A).
- `startButton: "시작"` added (mirrors `COPY.idle.startButton`).
- `themedTitle` and `normalTitle` strings unchanged.
- Comment block (`// 모드 선택 화면 — ...`) updated to "모드 선택 화면 (3-zone) — `/`에 노출되는 banner / list / 시작 화면".

**Verification for this step**: `npx tsc --noEmit` should still pass — but there will be compile errors in `ModeSelect.tsx` until Step 2 ships, so run tsc only after both step 1 and step 2 are written. Do NOT commit between step 1 and step 2.

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
 *   │   ╭─ 시작  → ─╮          │
 *   └────────────────────────┘
 *
 * Default selection is `themed`; tapping a row swaps the highlight.
 * The 시작 pill is always enabled and links to /themed or /booth?mode=normal
 * based on the current selection.
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
    testId: "mode-row-themed",
  },
  {
    mode: "normal",
    index: 2,
    titleKr: COPY.modeSelect.normalTitle,
    titleEn: COPY.modeSelect.normalTitleEn,
    href: "/booth?mode=normal",
    testId: "mode-row-normal",
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
        className="grid grid-cols-1 gap-2 px-2 sm:gap-2.5"
      >
        {MODE_ROWS.map((row) => {
          const isSelected = selected === row.mode;
          return (
            <li key={row.mode}>
              <button
                type="button"
                data-testid={row.testId}
                data-selected={isSelected ? "true" : "false"}
                aria-pressed={isSelected}
                onClick={() => setSelected(row.mode)}
                className={
                  isSelected
                    ? "flex w-full items-baseline gap-2 rounded-sm border-2 border-cabinet-frame bg-marquee-yellow px-3 py-2 text-left shadow-soft transition active:translate-y-px sm:py-2.5"
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
- Outer `flex flex-col gap-3 ... sm:gap-4` → matches `app/themed/page.tsx:27`.
- Banner classes → verbatim copy of `app/themed/page.tsx:30` (border, bg, padding, shadow).
- Banner KR `<p>` classes → verbatim copy of `app/themed/page.tsx:32`.
- Banner EN `<p>` classes → verbatim copy of `app/themed/page.tsx:35`.
- Row `[N]` index span → verbatim copy of `app/themed/page.tsx:46-47`.
- Row KR title → verbatim copy of `app/themed/page.tsx:50`.
- Row EN sub → verbatim copy of `app/themed/page.tsx:53`.
- Selected-row `bg-marquee-yellow border-2 border-cabinet-frame` → from spec Constraints "Selected row".
- Unselected-row `bg-crt-cream border border-cabinet-frame` → from spec Constraints "Unselected row".
- 시작 pill className → verbatim copy of `app/themed/page.tsx:66` (h-12 / min-w-10rem / rounded-full / bg-btn-yellow / font-marquee / shadow-soft / active:translate-y-px / active:shadow-y2k-sm and the responsive `sm:h-14 md:h-16 sm:text-2xl md:text-3xl`).
- Pill arrow `<span aria-hidden className="text-xl sm:text-2xl">→</span>` → verbatim from `app/themed/page.tsx:69`.

**Behavior matrix**:
| User action | State change | Visible result |
|---|---|---|
| Initial mount | `selected = "themed"` | Themed row: `bg-marquee-yellow border-2`. Normal row: `bg-crt-cream border`. Pill href: `/themed`. |
| Tap normal row | `selected = "normal"` | Normal row gets `bg-marquee-yellow border-2`; themed row reverts. Pill href flips to `/booth?mode=normal`. |
| Tap themed row (when normal was selected) | `selected = "themed"` | Highlight flips back. Pill href flips back to `/themed`. |
| Tap 시작 pill | (no state change) | Navigate via `next/link` to current `startHref`. |

### Step 3: Update `components/ModeSelect.test.tsx`

**File**: `/Users/a1111/Desktop/ozcoding-pd09-booth/components/ModeSelect.test.tsx` (full rewrite — three old tests replaced)

**Stale assertions to remove**:
- `screen.getByText(COPY.modeSelect.headline)` — key is gone.
- `screen.getByText(COPY.modeSelect.themedSub)` / `normalSub` — keys are gone.
- `getByTestId("mode-card-themed")` / `mode-card-normal` — testIds are gone.
- The `card.tagName === "A"` assertions — rows are now `<button>`, not `<a>`.

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
    const themedRow = screen.getByTestId("mode-row-themed");
    const normalRow = screen.getByTestId("mode-row-normal");
    expect(themedRow).toHaveTextContent("[1]");
    expect(themedRow).toHaveTextContent(COPY.modeSelect.themedTitle);
    expect(themedRow).toHaveTextContent(COPY.modeSelect.themedTitleEn);
    expect(normalRow).toHaveTextContent("[2]");
    expect(normalRow).toHaveTextContent(COPY.modeSelect.normalTitle);
    expect(normalRow).toHaveTextContent(COPY.modeSelect.normalTitleEn);
  });

  it("themed is the default selection on mount", () => {
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-row-themed");
    const normalRow = screen.getByTestId("mode-row-normal");
    expect(themedRow).toHaveAttribute("data-selected", "true");
    expect(themedRow).toHaveAttribute("aria-pressed", "true");
    expect(themedRow.className).toMatch(/bg-marquee-yellow/);
    expect(themedRow.className).toMatch(/border-2/);
    expect(normalRow).toHaveAttribute("data-selected", "false");
    expect(normalRow).toHaveAttribute("aria-pressed", "false");
    expect(normalRow.className).toMatch(/bg-crt-cream/);
    expect(normalRow.className).not.toMatch(/border-2/);
  });

  it("tapping the normal row swaps the highlight to normal", async () => {
    const user = userEvent.setup();
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-row-themed");
    const normalRow = screen.getByTestId("mode-row-normal");
    await user.click(normalRow);
    expect(normalRow).toHaveAttribute("data-selected", "true");
    expect(normalRow.className).toMatch(/bg-marquee-yellow/);
    expect(normalRow.className).toMatch(/border-2/);
    expect(themedRow).toHaveAttribute("data-selected", "false");
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
    await user.click(screen.getByTestId("mode-row-normal"));
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

**Test count**: 7 tests (replaces the 3 in the current file). Net +4 tests against the 152 baseline → expected post-change suite size: **156 tests**.

**Dependency note**: `userEvent` should already be available — confirm with `grep -l "@testing-library/user-event" components/*.test.tsx` during Step 4. If absent in the workspace, fall back to `fireEvent.click()` from `@testing-library/react`. (The two tests that use `user.click` would each become `fireEvent.click(row)` synchronous, dropping the `async` keyword.)

### Step 4: Verification

Run in this order from `/Users/a1111/Desktop/ozcoding-pd09-booth`:

1. **TypeScript check**: `npx tsc --noEmit` → must be clean. (Catches any leftover reference to `COPY.modeSelect.headline` / `themedSub` / `normalSub` elsewhere in the repo.)
2. **Pre-flight grep for stale references** (sanity, before running tests):
   `grep -rn "modeSelect\.headline\b\|modeSelect\.themedSub\|modeSelect\.normalSub\|mode-card-themed\|mode-card-normal" --include="*.ts" --include="*.tsx" .` → expect zero matches.
3. **Unit tests**: `npm test -- --run` → expect **156 green** (152 baseline + 4 net-new ModeSelect tests; the 3 old ModeSelect tests are replaced 1:1 by 3 of the 7 new ones, so net is +4).
4. **Visual smoke** (parallel-able with #1-#3 if you want):
   - `npm run dev`
   - Navigate to `http://localhost:3000` → confirm:
     - Yellow banner shows both `어떤 부스로 갈까요?` and `Pick your photobooth!`.
     - Two rows: `[1] 도전 챌린지 / Themed 7-cut` and `[2] 폴라로이드(일반) / Polaroid 4-cut`.
     - On load, the themed row is highlighted yellow with thick border; normal row is cream with thin border.
     - Tap the normal row → highlight flips visibly.
     - 시작 pill at the bottom, rounded, yellow, with `→` arrow; tapping navigates to `/themed` (default) or `/booth?mode=normal` (after selecting normal).
   - Place `/` and `/themed` side-by-side in two browser tabs → confirm shared font/color/border tokens.
   - At kiosk-target viewport → confirm no scrollbar inside `<CabinetChrome>`.

---

## Risks & Migration Notes

- **Risk: Other files reference the renamed copy keys.** Mitigation: Step 4 pre-flight grep catches all `modeSelect.headline`, `modeSelect.themedSub`, `modeSelect.normalSub` references repo-wide before running tests. Currently only `components/ModeSelect.tsx` and `components/ModeSelect.test.tsx` use them, but the grep is the safety net.
- **Risk: `useState` requires `"use client"`.** Mitigation: directive is at the top of the new `ModeSelect.tsx` (already there in the current file too). `app/page.tsx` is a server component that renders `<ModeSelect />`; the boundary is clean because `ModeSelect` is the client component itself.
- **Risk: `<button>`-inside-`<li>`-inside-`<ol>` accessibility.** Mitigation: standard pattern; `aria-pressed` carries the toggle state. Screen readers announce "List with 2 items, button [1] 도전 챌린지, pressed".
- **Risk: `userEvent` not in deps.** Mitigation: Step 3 includes a `fireEvent` fallback. Verify dependency presence before writing tests.
- **Risk: Banner color saturation makes selected row hard to distinguish (both yellow).** Mitigation: the `border-2` weight change provides a second visual channel; identical to themed's pattern. If kiosk operators report low contrast at viewing angle, that's a follow-up token change (not a Plan v1 concern).
- **Risk: Two sequential `bg-marquee-yellow` zones (banner + selected row) read as one big yellow block.** Mitigation: `gap-3 sm:gap-4` between them + `border-2` ring on selected row breaks the block visually. Themed achieves the same with banner→list separation.
- **Migration note: No data migration. No SSR/hydration concerns** beyond the existing `"use client"` boundary. No localStorage / cookies / URL state.

---

## ADR (Architecture Decision Record)

**Decision**: Replace ModeSelect's 2-card layout with a 3-zone (banner / `<ol>` of 2 indexed `<button>` rows / bottom 시작 `<Link>` pill) layout that mirrors `app/themed/page.tsx`'s structure verbatim, with `themed` as the default selection and the 시작 pill always enabled.

**Drivers**:
1. Visual continuity with themed (cited as "shape unnatural" in current state — fixed by structural mirroring, not just copy changes).
2. Bilingual KR+EN copy parity with themed (eliminates the "monolingual mode-select" tone mismatch flagged in spec Round 3).
3. Kiosk muscle memory: two consecutive screens with the same banner-list-pill rhythm reduce cognitive load on first-time users at the booth.

**Alternatives considered**:
- **Card polish only** (themed look-and-feel applied to the existing 2-card grid). Rejected at spec Round 1: cards have no bottom anchor, so the 시작-pill rhythm cannot be reproduced. This was the literal complaint that triggered the spec.
- **Hybrid (cards + START button)**. Rejected at spec Round 1: still keeps the card metaphor, which is structurally different from themed's list-of-rows. Doubles the visual primitives.
- **Link-as-row, no bottom pill** (Option B above). Rejected because it violates the explicit Round-2 resolution and removes the 시작 pill that the acceptance criteria depend on.

**Why chosen**: Option A is the only path that satisfies all four acceptance criteria simultaneously (unit tests, visual parity, no-scroll, routing preserved) without re-opening any decision the deep-interview converged on. Token reuse is high (every className traces to a specific themed line), so implementation risk is low and review is mostly a token-diff check.

**Consequences**:
- (+) `/` and `/themed` become visually unified — eye reads them as one device.
- (+) Bilingual copy is now consistent across the whole pre-booth flow.
- (+) New `[N]` indexing convention is reusable if a third mode is added (just append `[3]` row + key in `MODE_ROWS`).
- (-) Slightly more JSX (button + handler + state) than the prior 2-card version. Acceptable: the file is still under 100 lines.
- (-) `<button>`-inside-`<li>` plus a sibling `<Link>` means the focus order is row1 → row2 → pill (instead of card1 → card2). For touch kiosks this is a non-issue; for keyboard users it's actually a clearer flow.
- (-) Tests now depend on Tailwind class strings appearing in `className`. If a future refactor renames `bg-marquee-yellow` → `bg-banner-yellow`, the regex assertions will need updating. Mitigation: tests import the class fragments as expected substrings, not full classNames.

**Follow-ups**:
- If a third booth mode is ever added, generalize `MODE_ROWS` from 2 entries to N — the JSX already maps.
- Consider extracting the verbatim 시작-pill className into a shared `lib/styles.ts` constant so themed and ModeSelect share a single source. Out of scope for v1 to keep the 3-file constraint.
- If kiosk operators report touch-area too small on the rows, increase `py-2 sm:py-2.5` to `py-3 sm:py-4` — pure token tweak, no structural change.

---

## Acceptance Criteria (inherited from spec)

- [ ] Unit tests green (152 baseline + revised `components/ModeSelect.test.tsx` → 156 total).
- [ ] Visual parity: identical font (`font-marquee`/`font-body`), banner color (`bg-marquee-yellow`), pill color (`bg-btn-yellow`), border tokens (`border-cabinet-frame`), and pill geometry (`rounded-full` + `h-12 sm:h-14 md:h-16` + `min-w-[10rem]`) with `/themed`.
- [ ] No scroll inside `<CabinetChrome>` at kiosk-target viewport.
- [ ] Routing: 시작 pill `href === "/themed"` when themed selected; `href === "/booth?mode=normal"` when normal selected.
- [ ] Default selection on mount: themed row carries `bg-marquee-yellow border-2`; normal row carries `bg-crt-cream border`.
- [ ] No icons added; only `[1]` / `[2]` brackets as leading sigils.
- [ ] No changes to any file outside the 3 listed targets.

---

## Architect Review v1

### Steelman of Option B (Link-as-row, no bottom pill)
On a touch kiosk where every action is a single tap, "select then 시작" is two taps for the same outcome — pure friction. Option B collapses that to one tap, eliminates `useState`, eliminates the `"use client"` boundary (the component could remain a server component), and removes the dual-yellow-zone tension entirely (only the banner is yellow). The bilingual KR+EN copy parity and banner-anchor visual rhyme can be preserved without needing a bottom pill — themed's pill exists because themed has 7 read-only items and no other navigational target; the home screen's rows are *themselves* navigational targets, so a redundant pill is actually less honest about what the rows are.

### Tradeoff tensions found

1. **Plan violates its own "3 files only" scope.** `app/page.test.tsx:14-15` calls `screen.getByTestId("mode-card-themed")` and `getByTestId("mode-card-normal")`. The plan deletes both testIds in `components/ModeSelect.tsx:34,47`. After plan execution that test will throw, but `app/page.test.tsx` is not in the target list (plan line 5, line 442 acceptance criterion "No changes to any file outside the 3 listed targets"). The Step-4 grep at plan line 376 *would* catch it but the plan still claims a 4th-file edit is unnecessary. The 156-test arithmetic at plan line 366 (152 baseline + 4 net-new) is also wrong — `app/page.test.tsx` will go from 2 passing to 1 passing + 1 failing, so the real expected count is 156 only after `app/page.test.tsx` is also revised.

2. **Banner-vs-selected-row dual-yellow contrast.** Both the banner (plan line 188) and the selected row (plan line 214) use `bg-marquee-yellow` with `border-cabinet-frame`. Themed avoids this collision because its banner is yellow but its 7 list rows have *no* background fill at all — only text. Here, the banner sits directly above a yellow row separated by `gap-3 sm:gap-4`. The `border-2` weight differential is the only signal distinguishing "banner" from "selected option," and at kiosk viewing distance the `border` vs `border-2` delta is ~1px. Risk note at plan line 398 acknowledges this but defers it to a follow-up; for a screen whose entire purpose is "make selection legible," that deferral is the wrong call.

3. **`<ol>` semantics drift from themed.** Themed's `<ol>` at `app/themed/page.tsx:40` lists 7 sequentially-executed capture frames — a true ordered procedure. The plan's `<ol>` at line 198 wraps two *parallel alternatives*. Screen readers announcing "list with 2 items, item 1, item 2" implies ordering that doesn't exist. `<ul>` (or `role="radiogroup"` with `role="radio"` rows since this is a single-select toggle) is semantically more honest. Plan line 44 acknowledges "mildly editorialized" but defends with "indices `[1]`/`[2]` are explicitly called out" — that's a visual sigil, not an ordering claim.

### Concrete refinements

1. **Add `app/page.test.tsx` as a 4th target file.** Replace the two stale testId assertions with `getByTestId("mode-row-themed")` / `getByTestId("mode-row-normal")`. Update plan line 5, line 366 (test count math), line 442 acceptance criterion, and Step 4 verification to reflect 4 files. Without this, Step 4 verification at plan line 377 will fail.
2. **Optional: switch `<ol>` to `role="radiogroup"` with `<button role="radio" aria-checked={isSelected}>` rows.** This matches the actual select-then-시작 semantics and is more accurate than `aria-pressed` on a toggle (the rows are mutually exclusive, not independently toggleable). One-line change at plan line 198 plus role/aria swap at lines 209-210.
3. **Optional: bump selected-row signal beyond `border-2`.** Either thicken to `border-[3px]` or add `ring-2 ring-cabinet-frame ring-offset-1 ring-offset-crt-cream` so the contrast against the adjacent yellow banner survives at kiosk distance. Mitigates tension #2.

### Verdict

**ITERATE** — The plan is structurally sound and faithfully executes the spec, but it under-scopes the file list: `app/page.test.tsx:14-15` references the deleted testIds and must be revised in the same change, otherwise Step 4 verification fails. Refinement #1 is mandatory; #2 and #3 are quality recommendations.
