---
name: ModeSelect UI parity with themed screen
description: Re-skin ModeSelect to mirror /themed's 3-zone shape (banner → indexed list → 시작 pill) using identical design tokens, with select-then-시작 interaction and bilingual KR+EN copy
type: spec
---

# Deep Interview Spec: ModeSelect UI parity with /themed

## Metadata
- Interview ID: modeselect-parity-2026-05-09
- Rounds: 4
- Final Ambiguity Score: **9.4%** (threshold: 20%) — PASSED
- Type: brownfield
- Generated: 2026-05-09
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.96 | 0.35 | 0.336 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.92 | 0.25 | 0.230 |
| Context Clarity | 0.85 | 0.15 | 0.128 |
| **Total Clarity** | | | **0.906** |
| **Ambiguity** | | | **0.094** |

## Goal

Restyle `components/ModeSelect.tsx` so the home screen (`/`) matches the visual rhythm and design tokens of the themed selection screen (`app/themed/page.tsx`) exactly. The current 2-card design feels "shape unnatural" because it lacks themed's 3-zone anchor (banner → list → 시작 pill button) and is monolingual. Mirror themed's structure with a select-then-confirm interaction so the user's eye reads the two screens as part of the same kiosk flow.

### Final Layout (3-zone, mirrors themed)

```
┌──────── 노란 배너 (bg-marquee-yellow) ────────┐
│ 어떤 부스로 갈까요?                            │
│ Pick your photobooth!                          │
└────────────────────────────────────────────────┘

[1] 도전 챌린지        [2] 폴라로이드(일반)
    Themed 7-cut           Polaroid 4-cut
    ▪ selected (default)   ▫
    bg-marquee-yellow      bg-crt-cream
    border-2 cabinet-frame border cabinet-frame

         ╭──── 시작  → ────╮  ← rounded-full pill
         ╰──────────────────╯    bg-btn-yellow
                                 font-marquee
                                 always-enabled
```

### Selection model
- **Default**: `themed` is pre-selected on initial mount.
- **Tap a row**: switch the selected mode; the row's bg flips to `bg-marquee-yellow` and border thickens to `border-2`. The other row reverts to `bg-crt-cream` + 1px `border`.
- **Tap 시작 pill**: navigate to the route for the currently-selected mode. The pill is **always enabled** (no disabled state).
- **No icons**: leading sigil is `[N]` only (matches themed's `[1]/[2]/.../[7]` style exactly).

### Copy strings (`lib/copy.ts`)

`COPY.modeSelect` becomes:
```typescript
modeSelect: {
  headlineKr: "어떤 부스로 갈까요?",     // was: headline "모드를 선택해주세요"
  headlineEn: "Pick your photobooth!",   // NEW
  themedTitle: "도전 챌린지",
  themedTitleEn: "Themed 7-cut",          // NEW (was: themedSub "테마 7컷 챌린지")
  normalTitle: "폴라로이드(일반)",
  normalTitleEn: "Polaroid 4-cut",        // NEW (was: normalSub "추억의 폴라로이드 4컷")
  startButton: "시작",                    // NEW (matches COPY.idle.startButton wording)
}
```

## Constraints

- **Tone tokens (must use)**:
  - Banner: `rounded-sm border border-cabinet-frame bg-marquee-yellow shadow-soft` + `font-marquee` (KR) + `font-body font-bold` (EN), exact same `px-3 py-2.5 sm:py-3` paddings as themed banner.
  - List rows: `font-marquee` for the `[N]` index, `font-body font-bold` for KR title, `font-body text-cabinet-frame/75` for EN sub. Match themed's `text-base sm:text-lg` index size and `text-sm sm:text-base` label size.
  - Selected row: `bg-marquee-yellow border-2 border-cabinet-frame`. Unselected row: `bg-crt-cream border border-cabinet-frame`.
  - 시작 pill: `flex h-12 sm:h-14 md:h-16 min-w-[10rem] items-center justify-center gap-2 rounded-full border border-cabinet-frame bg-btn-yellow px-8 font-marquee text-xl sm:text-2xl md:text-3xl text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm` — verbatim from `app/themed/page.tsx:62-70`.

- **No scroll**: must fit inside `<ScaleToFit><CabinetChrome>` inner area (`px-5 py-4 sm:px-6 sm:py-5`) at kiosk-target viewport without producing a scrollbar.

- **Routing preserved**: 시작 navigates to `/themed` when `themed` selected and `/booth?mode=normal` when `normal` selected. No new routes.

- **No new emojis or SVG icons**: leading `[N]` brackets only, matching themed.

- **Test parity**: existing 152-test baseline must remain green. The current `components/ModeSelect.test.tsx` will be updated to assert the new structure (banner KR+EN, list rows with `[N]` + KR + EN, selection state class swap, 시작 pill href routing per selection).

## Non-Goals

- No keyboard navigation work (kiosk uses touch).
- No animation beyond existing `active:translate-y-px` micro-press.
- No new routes; no relocating the screen.
- No icon set / SVG additions.
- No changes to `app/themed/page.tsx` itself — it is the reference, not a target.
- No COPY changes to `COPY.idle` (themed screen copy stays as-is).

## Acceptance Criteria

- [ ] **Unit tests green**: existing 152-test baseline + revised `components/ModeSelect.test.tsx` covering:
  - Banner renders both KR (`어떤 부스로 갈까요?`) and EN (`Pick your photobooth!`) lines.
  - Both list rows render with `[1]` / `[2]` indices, KR title, and EN sub.
  - On mount, themed row has `bg-marquee-yellow` and `border-2`; normal row has `bg-crt-cream` and 1px `border`.
  - Tapping the normal row swaps the styling.
  - 시작 pill href === `/themed` when themed selected; `/booth?mode=normal` when normal selected.
- [ ] **Visual parity**: when `/` and `/themed` are placed side-by-side, they share identical font families (`font-marquee`/`font-body`), banner color (`marquee-yellow`), button color (`btn-yellow`), border styling, and pill geometry (`rounded-full` + `h-12/14/16` responsive).
- [ ] **No scroll inside cabinet**: at the project's kiosk-target viewport, ScaleToFit + CabinetChrome inner area accommodates the full ModeSelect content without scrollbars.
- [ ] **Routing preserved**: 시작 button navigates to the correct route per selected mode; no regressions to existing routes.

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 2-card pattern is salvageable | Round 1: themed has banner→list→pill; cards-only lacks the bottom pill anchor → reads as "shape unnatural" | Adopt 3-zone mirror; replace cards with indexed list rows |
| Click goes immediately on card tap | Round 2: themed has read-only menu + explicit 시작 button, so kiosk muscle-memory expects "select then 시작" | Select-then-시작 with default=`themed`; pill always enabled |
| EN copy is optional decoration | Round 3: themed uses bilingual KR+EN consistently across header and every menu item; monolingual mode-select is the visible "tone mismatch" | Add `headlineEn`, `themedTitleEn`, `normalTitleEn` keys; replace headline KR with the themed-style "어떤 부스로 갈까요?" question form |
| Icons might be needed for visual richness | Round 3: themed has zero icons — only `[N]` brackets carry the visual rhythm | No icons; `[N]` sigil only |
| Sub-text was a description ("테마 7컷 챌린지") | Round 3: themed sub-EN strings are short categorical labels ("Mouth explorer", "Burger time") | Switch sub strings to short EN categorical: "Themed 7-cut" / "Polaroid 4-cut" |

## Technical Context

### Files to modify

| File | Change |
|------|--------|
| `components/ModeSelect.tsx` | Rewrite JSX to 3-zone (banner / list of 2 rows / 시작 pill); add `useState<BoothMode>('themed')` for selection; replace `<Link>`-on-card with row click handlers + a single bottom `<Link>` whose `href` is computed from selection. |
| `lib/copy.ts` | `COPY.modeSelect` block: rename `headline` → `headlineKr`, add `headlineEn`; rename `themedSub`/`normalSub` → `themedTitleEn`/`normalTitleEn` with new shorter strings; add `startButton: "시작"`. |
| `components/ModeSelect.test.tsx` | Update assertions to match new structure (banner KR+EN, two indexed rows with EN subs, selection state class swap, conditional 시작 href). |

### Files NOT to touch

- `app/themed/page.tsx` — reference, untouched.
- `app/page.tsx` — keeps `<ScaleToFit><CabinetChrome><ModeSelect/></CabinetChrome></ScaleToFit>` as-is.
- `components/CabinetChrome.tsx`, `components/ScaleToFit.tsx`, `components/Bubble.tsx` — no changes.
- `tailwind.config.ts`, `app/globals.css` — all required tokens already exist.

### Reference: design-token mapping (from explore)

| Element | Tokens |
|---------|--------|
| Banner | `rounded-sm border border-cabinet-frame bg-marquee-yellow px-3 py-2.5 text-center shadow-soft sm:py-3` + KR `font-marquee text-base text-cabinet-frame sm:text-xl md:text-2xl` + EN `font-body text-xs font-bold text-cabinet-frame sm:text-base md:text-lg` |
| Row index `[N]` | `font-marquee text-base text-cabinet-frame sm:text-lg` |
| Row KR title | `font-body text-sm font-bold text-cabinet-frame sm:text-base` |
| Row EN sub | `font-body text-xs text-cabinet-frame/75 sm:text-sm` |
| Row selected | `bg-marquee-yellow border-2 border-cabinet-frame` |
| Row unselected | `bg-crt-cream border border-cabinet-frame` |
| 시작 pill | `flex h-12 sm:h-14 md:h-16 min-w-[10rem] items-center justify-center gap-2 rounded-full border border-cabinet-frame bg-btn-yellow px-8 font-marquee text-xl sm:text-2xl md:text-3xl text-cabinet-frame shadow-soft transition active:translate-y-px active:shadow-y2k-sm` |

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| ModeSelectScreen | core | banner, list, startPill | renders inside `<ScaleToFit><CabinetChrome>` at `/` |
| ModeBanner | supporting | headlineKr, headlineEn | top zone of ModeSelectScreen |
| ModeListItem | core | index `[N]`, titleKr, titleEn, selectedState | 2 instances inside ModeSelectScreen |
| StartPillButton | supporting | label `시작`, arrow `→`, computedHref | bottom zone; href derived from current SelectionState |
| SelectionState | supporting | currentMode: BoothMode | local state of ModeSelectScreen; default `themed` |
| BoothMode | core (existing) | "themed" \| "normal" | from `lib/booth-mode.ts`; SelectionState's value type |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 6 | 6 | 0 | 0 | N/A (first round) |
| 2 | 6 | 0 | 0 | 6 | 100% |
| 3 | 6 | 0 | 0 | 6 | 100% |
| 4 | 6 | 0 | 0 | 6 | 100% |

Domain model converged at Round 2 and held stable through Round 4.

## Interview Transcript

<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1 — Layout pattern
**Q (Goal):** themed의 3-zone(배너→리스트→시작버튼)을 어떻게 따라갈까? Options A=3-zone mirror, B=card polish only, C=hybrid (cards + START).
**A:** A — 3-zone mirroring.
**Ambiguity:** 41% (Goal 0.75, Constraints 0.50, Criteria 0.30, Context 0.85)

### Round 2 — Selection model
**Q (Goal+Constraints):** 행 선택과 시작 버튼 트리거 방식은? Options A=select-then-시작 (default themed, always-enabled pill), B=one-tap, C=disabled until pick.
**A:** A — select-then-시작 with default=themed.
**Ambiguity:** 26% (Goal 0.88, Constraints 0.78, Criteria 0.45, Context 0.85)

### Round 3 — EN copy strings
**Q (Goal):** EN 보조 라벨 톤? Options A=직접적 동의어 ("Themed 7-cut"/"Polaroid 4-cut"), B=따뜻한 활기 튀니니 ("Take the challenge!"/"Make a memory!"), C=단순 컷 수 안내 ("7 themed cuts"/"4 polaroid cuts"). Banner choice independent.
**A:** Banner = B (`어떤 부스로 갈까요?` / `Pick your photobooth!`); item subs = A (`Themed 7-cut` / `Polaroid 4-cut`).
**Ambiguity:** 21% (Goal 0.96, Constraints 0.80, Criteria 0.50, Context 0.85)

### Round 4 — Acceptance criteria
**Q (Criteria):** "잘 끝났다" 판단 기준? Multi-select: unit tests green, visual parity with themed, no-scroll inside cabinet, routing preserved.
**A:** All four selected.
**Ambiguity:** 9.4% — THRESHOLD PASSED ✓
</details>
