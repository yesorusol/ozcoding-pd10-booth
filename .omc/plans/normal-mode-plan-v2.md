# Normal-Mode Plan v2 — 폴라로이드(일반) 모드 + 모드 선택 온보딩

> Spec source: `.omc/specs/deep-interview-normal-mode.md` (Ambiguity 17.9%, threshold passed)
> Pipeline stage: Planner v2 — Architect v1 returned **REVISE**, this revision incorporates the synthesis.
> Author: Planner agent (`oh-my-claudecode:planner`), 2026-05-08
> Mode: **SHORT** consensus (unchanged — see v1 §1.4)
> v1 source of truth: `.omc/plans/normal-mode-plan-v1.md` (untouched)

**v1 → v2 delta (1-line):** v1 used a unified `MODE_CONFIG.compose()` registry; Architect showed this can't be made type-safe across different cut counts (7 vs 4) and output sizes (1080×2400 vs 1080×1440). v2 splits rendering and compositing into `<ThemedFlow>` and `<NormalFlow>` subcomponents that each call their own typed compositor directly; `BoothPage` becomes a thin coordinator and a tiny `BoothPageRouter` wrapper isolates the `useSearchParams()` Suspense boundary.

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (5)
1. **Themed-mode regression risk = zero.** The 7-cut themed flow is a fixed event-day commitment (event 2026-05-14). Every plan choice MUST preserve the existing 104-test green baseline.
2. **Two modes share one chrome.** `CabinetChrome` + `ScaleToFit` wrap every screen.
3. **Overlay PNG is the source of truth for polaroid layout.** Borders, stickers, characters, and caption are baked into `public/overlays/normal.png`.
4. **State-machine plumbing is shared; render and compositor are not.** One `createReducer(totalCuts)` factory + one `useCamera` hook shared across modes; everything mode-specific (preload effects, flash compositing, render branches, sheet compositor) lives inside per-mode subcomponents.
5. **Type honesty over registry elegance.** No `compose(...)` discriminated-union gymnastics. Each flow component imports its compositor directly with full TypeScript narrowing.

### 1.2 Decision Drivers (top 3)
1. **Brownfield regression surface** — preserve the 104-test green baseline byte-for-byte where possible.
2. **Designer asset on critical path** — `public/overlays/normal.png` + 4-cell coordinates are user-supplied; engineering must work in parallel via mock.
3. **Event date 2026-05-14 (6 days out)** — minimize blast radius; any refactor must not destabilize the themed flow.

### 1.3 Viable Options

#### Option A — Pure route split (`app/booth/themed/page.tsx` + `app/booth/normal/page.tsx`)
- **Pros:** themed page is current file moved verbatim → zero diff against existing tests.
- **Cons:** duplicates camera lifecycle wiring (~80 LOC of useCamera + reducer setup) across two files; bug fixes to camera/state plumbing must propagate to both.
- **Regression risk:** very low.

#### Option B-prime — Thin coordinator + per-mode flow subcomponents (CHOSEN)
- Architecture:
  - `app/booth/page.tsx` becomes a thin **`BoothPageRouter`** that reads `?mode` via `useSearchParams()` (wrapped in a route-level `<Suspense>`) and renders either `<ThemedFlow/>` or `<NormalFlow/>`.
  - `<ThemedFlow/>` and `<NormalFlow/>` each own: their own preload effect, their own flash/capture effect, their own compositing effect, and their own render tree. Each imports its compositor directly (`composeSheet` vs `composeOverlaySheet`).
  - **Shared layer**: `useCamera`, `createReducer(totalCuts)`, the `<CabinetChrome>` + `<ScaleToFit>` shell, the camera-priming/error/QR-display rendering helpers (extracted to `components/booth-shared/` if reused).
- **Pros:** TypeScript narrows compositor inputs naturally — no optional params, no registry casts, no exhaustiveness gaming. Themed compositing effect is moved as-is into `<ThemedFlow/>`, keeping its existing test coverage. `useSearchParams()` Suspense boundary is isolated to the Router wrapper, leaving Flow components Suspense-free. Mode-specific bug surface is visually separated.
- **Cons:** introduces 3 new component files; existing `app/booth/page.tsx` body migrates into `<ThemedFlow/>` (mechanical move, not rewrite).
- **Regression risk:** low — themed effects logic is moved, not modified. Existing booth-page tests will need to import the new `<ThemedFlow/>` for direct render or run via `<BoothPageRouter mode="themed"/>`; both paths are mechanical.

#### Option C — State-machine-level mode parameterization
- **Invalidated** (same reasoning as v1): reducer doesn't change between modes; mode is a render+compositor concern, not a state-transition concern. Touching the most-tested file adds risk for no benefit.

#### v1's Option B (unified `MODE_CONFIG.compose`)
- **Invalidated** by Architect: themed compositor takes 7 cuts + `titleCardImg` → 1080×2400; normal takes 4 cuts + `overlayImg` → 1080×1440. Cannot be unified without a runtime cast or a switch at every call site, defeating the registry's purpose.

#### Decision: **Option B-prime**
- Captures Option B's "single shared state machine + camera" benefit without the broken `MODE_CONFIG.compose` type-safety story.
- Captures Option A's "themed effects moved verbatim, no inline `if (mode === 'normal')` branches in the most timing-sensitive code" benefit without duplicating the camera/reducer wiring.

### 1.4 Risk Tier — SHORT mode (unchanged from v1 §1.4)
No auth, no sessions, no PII, no DB, no public API change. Pre-event refactor with tight test coverage; if Critic flags unforeseen blast-radius, promote to deliberate in revision.

---

## 2. Implementation Plan

### 2.1 File-level changes (deltas vs v1 highlighted)

#### NEW (v2 introduces 3 component files; rest matches v1)
| Path | Purpose | Delta vs v1 |
|---|---|---|
| `components/ThemedFlow.tsx` | Owns all themed-mode-specific logic: `frameImagesRef` preload, flash/captureCut effect (uses `CAPTURE_FRAMES[state.cutIndex]`), compositing effect calling `composeSheet({ cuts, titleCardImg })`, render with `<LiveOverlay frameSrc=...>`, `cutIndex/total` HUD. Receives shared services via props (`videoRef`, `cameraStatus`, `cameraStart/Stop/Restart`, `dispatchToParent` or its own reducer instance). | **NEW in v2.** |
| `components/NormalFlow.tsx` | Owns all normal-mode-specific logic: overlay PNG preload, flash effect calling new `captureRawCut({ video })`, compositing effect calling `composeOverlaySheet({ cuts, overlayImg })`, render with **clean** camera (no `<LiveOverlay frameSrc>` — uses a stripped-down camera viewport component or `<LiveOverlay frameSrc={undefined}>` only if a `hideFrameOverlay` prop is added). | **NEW in v2.** |
| `components/BoothPageRouter.tsx` | Thin client wrapper: reads `mode` via `useSearchParams()`, falls back to `"themed"` on missing/invalid, returns `<ThemedFlow/>` or `<NormalFlow/>`. This is the ONLY component that calls `useSearchParams()` so the Suspense boundary is contained. | **NEW in v2.** |
| `lib/booth-mode.ts` | `BoothMode = "themed" \| "normal"`, `parseBoothMode(searchParams)`, `MODE_CONFIG` containing **only data**: `{ totalCuts, sheetSize, displayName, route }`. **No `compose()` field.** Each Flow imports its compositor directly. | **Changed in v2:** dropped the `compose` registry function. |
| `lib/normal-layout.ts` | 4 polaroid cell rects + canvas dims + overlay path + background fill. | Same as v1. |
| `lib/overlay-composer.ts` | `composeOverlaySheet({ cuts: ReadonlyArray<{ index: number; imageBitmap: ImageBitmap }>, overlayImg: HTMLImageElement, background? })` → 1080×1440 PNG Blob. **Imported only by `<NormalFlow/>`**. | Same shape as v1; just no longer plumbed through a registry. |
| `components/ModeSelect.tsx` | Two-card mode-select UI. Routes via `<Link href="/booth?mode=themed">` and `<Link href="/booth?mode=normal">`. | Same as v1. |
| `lib/normal-layout.test.ts` | Coordinate sanity tests. | Same as v1. |
| `lib/overlay-composer.test.ts` | Unit test for new compositor. | Same as v1. |
| `lib/booth-mode.test.ts` | `parseBoothMode` fallback tests. | Same as v1. |
| `components/ModeSelect.test.tsx` | Card render + routing. | Same as v1. |
| `components/ThemedFlow.test.tsx` | Render test: confirms preload of `FRAMES`, themed compositing path, `<LiveOverlay frameSrc>` present. Mock `useCamera` and the reducer factory. | **NEW in v2.** |
| `components/NormalFlow.test.tsx` | Render test: confirms overlay PNG preload, no `<LiveOverlay frameSrc>` (clean camera), normal compositing path called. | **NEW in v2.** |
| `components/BoothPageRouter.test.tsx` | Suspense-pattern test: renders without error during `searchParams` resolution; `?mode=themed` mounts `<ThemedFlow/>`, `?mode=normal` mounts `<NormalFlow/>`, missing/invalid falls back to themed. | **NEW in v2.** |
| `public/overlays/normal.png` | Designer-supplied (mock during eng). | Same as v1. |

#### MODIFIED
| Path | Change | Delta vs v1 |
|---|---|---|
| `app/page.tsx` | Replace `IdleScreen` body with `<ModeSelect/>`. Keep `<ScaleToFit><CabinetChrome>` shell. | Same as v1. |
| `app/booth/page.tsx` | Becomes a 5–10 line wrapper: a route-level `<Suspense fallback={<PrimingSkeleton/>}>` around `<BoothPageRouter/>`. The current 240-LOC body migrates verbatim into `<ThemedFlow/>` (themed-only branches kept) plus `<NormalFlow/>` (normal-only logic). | **Changed in v2:** previously v1 made BoothPage thread `mode` through ~5 useEffects with inline `if (mode === "normal")` branches; v2 splits it into the Router + two Flow components. |
| `lib/session-machine.ts` | Add `createInitialState(totalCuts)` and `createReducer(totalCuts)` factories. **Keep the existing `TOTAL_CUTS = 7`, `initialState`, and `reducer` exports unchanged** (defaults using 7) so `session-machine.test.ts` and `app/booth/page.tsx`'s migrated themed code continue to compile. Add named re-exports `THEMED_CUTS = 7` and `NORMAL_CUTS = 4` for explicit consumers. The body of the existing `reducer` becomes `export const reducer = createReducer(TOTAL_CUTS)`. | **Clarified in v2:** the factory pattern is purely additive — no breaking change to existing exports. |
| `lib/capture.ts` | **Keep `captureCut` signature exactly as today** (`{ video, frameImg }` both required). **Add a new sibling function** `captureRawCut({ video }): Promise<ImageBitmap>` that performs only step 1 (cover-fit video draw, un-mirrored) and returns the 576×720 ImageBitmap. `<NormalFlow/>` calls `captureRawCut`; `<ThemedFlow/>` continues to call `captureCut`. **No optional `frameImg`**. | **Changed in v2:** v1 made `frameImg` optional; Architect rejected this as a sloppy signature. v2 adds a clean second function. |
| `lib/copy.ts` | Add `COPY.modeSelect`. | Same as v1. |
| `lib/types.ts` | (Optional) Re-export `BoothMode`. | Same as v1. |
| `components/LiveOverlay.tsx` | **Unchanged** — `<NormalFlow/>` either uses a different camera viewport component or wraps `<LiveOverlay/>` with the existing API but doesn't pass a `frameSrc` prop. To avoid touching a tested component, **`<NormalFlow/>` builds a small inline `<CleanCameraViewport/>`** (same `<video>` element with cover-fit; no `<img>` overlay) rather than mutating `LiveOverlay`. | **Changed in v2:** v1 added a `hideFrameOverlay` prop to `LiveOverlay` (touches tested file). v2 keeps `LiveOverlay` byte-identical. |

#### DELETED
None. v1's "current `IdleScreen` body becomes dead code" still applies — the JSX is removed inside `app/page.tsx`, no file deletions.

### 2.2 Route structure
- `/` → `<ModeSelect/>` (new).
- `/booth?mode=themed` → `<BoothPageRouter/>` → `<ThemedFlow/>` (default if `?mode` is missing or invalid).
- `/booth?mode=normal` → `<BoothPageRouter/>` → `<NormalFlow/>`.
- `onNextUser` in both Flow components routes to `/`.

### 2.3 State machine — `createReducer(totalCuts)` factory pattern
**Confirmed grounded in `lib/session-machine.ts`** (the constant is referenced exactly twice: line 36 definition, line 147 in the `PREVIEW_DONE` branch). Implementation:

```ts
// lib/session-machine.ts (after change)
export const TOTAL_CUTS = 7;          // KEPT — backwards-compatible default for themed
export const THEMED_CUTS = 7;
export const NORMAL_CUTS = 4;

export function createInitialState(totalCuts: number): SessionMachineState { /* same shape, totalCuts unused at init */ }
export function createReducer(totalCuts: number): typeof reducer {
  return (state, action) => {
    // identical body, but PREVIEW_DONE branch reads `totalCuts` instead of TOTAL_CUTS
  };
}

// Defaults preserved so existing tests/imports do not break:
export const initialState = createInitialState(TOTAL_CUTS);
export const reducer = createReducer(TOTAL_CUTS);
```

- `<ThemedFlow/>` does `const reducer = useMemo(() => createReducer(THEMED_CUTS), [])` (or imports the default `reducer` for byte-equivalence with the current themed code).
- `<NormalFlow/>` does `const reducer = useMemo(() => createReducer(NORMAL_CUTS), [])`.
- **Tests importing `TOTAL_CUTS` directly:** verified — `session-machine.test.ts` references `initialState` and the `reducer` export but does not pin `TOTAL_CUTS` literal in a way that breaks under the factory. `app/booth/page.tsx:40` imports `TOTAL_CUTS` for HUD display (`total={TOTAL_CUTS}` at line 278); this code migrates into `<ThemedFlow/>` and continues to use the default `TOTAL_CUTS` export. **No existing test edits required**; `<ThemedFlow/>` reads from the unchanged default export.

### 2.4 Capture path — split `captureCut` and `captureRawCut`
**Grounded in `lib/capture.ts:34-39, 45-81`.**

- `captureCut({ video, frameImg })` — unchanged (required `frameImg`). `<ThemedFlow/>` calls this; existing `capture.test.ts` keeps passing without edits.
- `captureRawCut({ video })` — new sibling, ~25 LOC. Does step 1 only: `coverCrop` + `drawImage(video, ...)` → `createImageBitmap(canvas)`. Returns 576×720. Same mirror policy (un-mirrored). Throws on null 2D context.
- `<NormalFlow/>`'s flash-effect calls `captureRawCut` and stores the bitmap on a `Cut` with `frameId: "normal-{i}"` (or removes `frameId` for normal cuts; `<NormalFlow/>` doesn't need frameId since `composeOverlaySheet` keys by `cuts[i].index`).
- New test `lib/capture.test.ts` gains 2 cases for `captureRawCut` (returns 576×720, no frame draw step).

### 2.5 Compositor — direct import, no registry
- `lib/overlay-composer.ts` exports `composeOverlaySheet({ cuts, overlayImg, background? }): Promise<Blob>`.
- `<NormalFlow/>`'s compositing effect imports it directly:
  ```ts
  import { composeOverlaySheet } from "@/lib/overlay-composer";
  // ...
  const blob = await composeOverlaySheet({ cuts: state.cuts, overlayImg: overlayImgRef.current });
  ```
- `<ThemedFlow/>`'s compositing effect continues to import `composeSheet` directly (verbatim from current `app/booth/page.tsx:185-221`).
- **No `MODE_CONFIG.compose` field. No discriminated union. No runtime cast.** TypeScript narrows each compositor's input type at the import site.

### 2.6 Suspense boundary placement
- `app/booth/page.tsx` (5-line wrapper):
  ```tsx
  import { Suspense } from "react";
  import { BoothPageRouter } from "@/components/BoothPageRouter";
  import { PrimingSkeleton } from "@/components/PrimingSkeleton"; // tiny shell-only fallback
  export default function BoothPage() {
    return <Suspense fallback={<PrimingSkeleton/>}><BoothPageRouter/></Suspense>;
  }
  ```
- `<BoothPageRouter/>` (client component) calls `useSearchParams()` and dispatches to `<ThemedFlow/>` or `<NormalFlow/>`.
- **Flow components are Suspense-free** — they render `<CabinetChrome>` + camera + state machine without any `useSearchParams()` hook. This satisfies Architect's concern that the existing camera-priming overlay UX must not flash a Suspense fallback.
- `PrimingSkeleton` is a static `<CabinetChrome>` shell with no camera; it renders only during the (tiny) searchParams-resolution moment, never during camera-priming itself.

### 2.7 Mode-select page + idle-screen fate
Same as v1 §2.6 — option (b): idle 7-cut menu removed from `/`; themed card routes directly to `/booth?mode=themed`. **Surfaced for user confirmation** (carry-forward from v1 Open Item #4).

### 2.8 Asset workflow
Same as v1 §2.7 — mock overlay PNG. Architect's refinement adopted: hand-author or in-browser scratch HTML page rather than `node-canvas` script (avoids native-build install tax).

### 2.9 Caption typo
Same as v1 §2.8 — designer-only decision (caption baked into PNG).

---

## 3. ADR

### Decision
Add normal mode via **query-parameter routing on `/booth`**, with a **thin `<BoothPageRouter/>` wrapper** isolating the `useSearchParams()` Suspense boundary, and **per-mode `<ThemedFlow/>` / `<NormalFlow/>` subcomponents** that each own their preload, flash/capture, and compositing effects + render tree. Shared layer: `useCamera` + `createReducer(totalCuts)` factory + `<CabinetChrome>` shell. Replace `/` idle screen with `<ModeSelect/>`. Capture path splits into `captureCut` (themed, unchanged) + `captureRawCut` (normal, new). Add `lib/overlay-composer.ts`. **No `MODE_CONFIG.compose` registry.**

### Drivers
1. Brownfield regression risk — preserve 104-test green baseline.
2. Designer asset on critical path — engineering parallelizes via mock.
3. Event date 2026-05-14 — minimize blast radius.

### Alternatives considered
- **Pure Option A (route split):** simpler regression isolation, but duplicates camera/reducer/cabinet-shell wiring across two ~140-LOC page modules. Rejected because the duplication compounds across future bug fixes during the pre-event week.
- **v1's unified `MODE_CONFIG.compose` registry (Option B as drafted in v1):** rejected because the two compositors have structurally different inputs (7 cuts + `titleCardImg` → 1080×2400 vs 4 cuts + `overlayImg` → 1080×1440). No genuinely type-safe unification exists; every alternative collapses to a switch at the call site, a runtime cast, or per-mode bound thunks that defeat the registry's purpose.
- **Option C (reducer-level mode):** invalidated — state transitions are mode-agnostic.

### Why chosen
Option B-prime is the smallest blast-radius design that simultaneously: (a) keeps `useCamera`/reducer/cabinet-shell single-source; (b) preserves themed timing-sensitive effects byte-for-byte (they migrate as-is into `<ThemedFlow/>`); (c) keeps each compositor's TypeScript input narrowing intact via direct imports; (d) localizes the App Router Suspense quirk to one tiny wrapper; (e) leaves `lib/capture.ts`'s existing function signatures untouched.

### Consequences
- **(+)** Themed effect graph is unchanged in spirit — moved into `<ThemedFlow/>` verbatim. Existing tests targeting `app/booth/page.tsx` either keep passing as integration tests through `<BoothPageRouter mode="themed"/>` or migrate trivially to direct `<ThemedFlow/>` rendering.
- **(+)** `lib/session-machine.ts` keeps its current public surface (default `reducer`, `TOTAL_CUTS = 7`); `session-machine.test.ts` does not change. Factory pattern is additive.
- **(+)** `lib/capture.ts` grows by one sibling function; existing `captureCut` and its 18 tests are untouched.
- **(+)** `LiveOverlay.tsx` is byte-identical — `<NormalFlow/>` uses a small inline `<CleanCameraViewport/>` instead.
- **(−)** Three new component files (`ThemedFlow`, `NormalFlow`, `BoothPageRouter`). The existing `app/booth/page.tsx` body is migrated, not deleted.
- **(−)** Mock overlay must be generated and committed; ~30-line hand-authored or in-browser scratch HTML.

### Follow-ups
- Designer delivery of `public/overlays/normal.png` + 4-cell coordinates.
- Caption typo confirmation (`OZCODINGG` vs `OZCODING`).
- User confirmation on idle-screen removal at `/` (UX contract change).
- Decide naming of the Suspense wrapper (`BoothPageRouter` proposed; alternative `BoothModeRouter`).
- Default mode policy when `?mode` is absent or unknown — plan defaults to `"themed"`; confirm acceptable.
- Confirm `MarqueeSign` / cabinet-shell text for mode-select header (`COPY.modeSelect.headline`).

---

## 4. Verification & Test Plan

### 4.1 Themed regression suite (must keep passing — 104 tests)
- `lib/session-machine.test.ts` — **no edits** (defaults preserved).
- `lib/capture.test.ts` — **no edits** (`captureCut` signature unchanged); +2 new cases for `captureRawCut`.
- `lib/sheet-composer.test.ts` — **no edits** (themed compositor untouched).
- `lib/upload-sheet.test.ts` — untouched.
- `lib/use-camera.test.ts` — untouched.
- `lib/cover-crop-math.test.ts` — untouched (new compositor reuses it).
- `lib/captures-server.test.ts` — untouched.
- `components/LiveOverlay.test.tsx` — **untouched** (v2 does not modify LiveOverlay, unlike v1).
- `components/CameraDeniedBanner.test.tsx` — untouched.
- `components/QRScreen.test.tsx` — untouched.
- `app/booth/__tests__/*` (existing booth page tests) — these may need their setup updated to render via `<BoothPageRouter mode="themed"/>` or directly `<ThemedFlow/>`. **Migration is mechanical** (change one import, no logic change). If snapshot diffs appear, they should be limited to component-tree wrapping (e.g., `<Suspense>` boundary in dom).

### 4.2 New tests
1. `lib/normal-layout.test.ts` — coordinate bounds.
2. `lib/overlay-composer.test.ts` — 4 mock ImageBitmaps + 1 mock overlayImg → 1080×1440 PNG; cell-area pixel sampling; rejects on `cuts.length !== 4`.
3. `lib/booth-mode.test.ts` — `parseBoothMode` fallback to `"themed"` on missing/invalid; `MODE_CONFIG` data-only shape.
4. `components/ModeSelect.test.tsx` — both cards render; correct `<Link href>` per card.
5. `components/ThemedFlow.test.tsx` — preload of `FRAMES`; themed compositing path invoked; `<LiveOverlay frameSrc>` present in render. Mock `useCamera`, mock `composeSheet`.
6. `components/NormalFlow.test.tsx` — overlay PNG preload; clean camera viewport (no `frameSrc` `<img>`); `composeOverlaySheet` invoked. Mock `useCamera`, mock `composeOverlaySheet`.
7. `components/BoothPageRouter.test.tsx` — **Suspense-pattern test**: render under `<Suspense fallback="loading">`; `?mode=themed` → `<ThemedFlow/>` mounted; `?mode=normal` → `<NormalFlow/>`; `?mode=` absent → `<ThemedFlow/>` (default fallback); `?mode=garbage` → `<ThemedFlow/>` (invalid fallback). No render error during searchParams resolution.
8. `app/__tests__/page-mode-select.test.tsx` — `/` renders `<ModeSelect/>`, no longer renders 7-frame menu.

### 4.3 Canvas/jsdom mocking strategy (Architect's checklist item flagged)
- The existing `vitest.setup.ts` is `@testing-library/jest-dom` only; the canvas mock used in `sheet-composer.test.ts` is local-to-file. Architect noted that asserting "cells drawn at correct rotation" requires recording transform-matrix state.
- **Plan response:** the `overlay-composer.test.ts` unit test asserts pixel-level outcomes (sample center of each cell after rotation translation) but does **not** assert intermediate transform-matrix calls. Rotation correctness is verified at the pixel level (cell A's color appears at the rotated center coordinate). If that proves untestable under a stub, fall back to a richer canvas mock in a new `tests/canvas-mock.ts` helper that records `save/restore/translate/rotate` calls and exposes them for assertion. Decision deferred to implementation; flagged as a follow-up risk not a blocker.
- **Mock overlay PNG strategy** for jsdom + dev: in tests, `overlayImg` is a stubbed `HTMLImageElement` with `naturalWidth = 1080`, `naturalHeight = 1440`, `complete = true` and a known fill color. In dev, `public/overlays/normal.png` is the hand-authored mock with 4 transparent rectangles.

### 4.4 Manual / e2e smoke
Same as v1 §4.4.

---

## 5. Open Items / Follow-ups

Carried forward from v1 (unresolved):
1. **Caption typo (Spec Open Item #1):** `OZCODINGG` vs `OZCODING` — designer-only decision.
2. **Mode-select layout (Spec Open Item #2):** two-card centered (default) vs two-button row.
3. **Cell coordinates + rotation angles (Spec Open Item #3):** designer to deliver.
4. **Idle-screen fate (Spec Open Item #4):** plan picks option (b); UX contract change — **user confirmation required before code starts.**
5. **Regression CI gate (Spec Open Item #5):** confirm CI blocks merge if any of 104 tests fail.
6. **Mock-overlay generation:** Architect's refinement adopted — hand-author or in-browser scratch HTML; do not ship a Node script.

New in v2:
7. **Naming of the Suspense wrapper component.** Plan proposes `<BoothPageRouter/>`. Alternatives: `<BoothModeRouter/>`, `<BoothShell/>`. Architect/Critic preference welcome.
8. **Default mode when `?mode` is absent or unknown.** Plan defaults to `"themed"` (preserves current `/booth` URL contract). Confirm acceptable; alternative is a redirect to `/`.
9. **Canvas transform-matrix mocking** for `overlay-composer.test.ts` rotation assertions — pixel-level vs call-recording approach. Decision deferred to implementation.
10. **Migration of existing `app/booth/__tests__/*` tests** to render via `<BoothPageRouter mode="themed"/>` or `<ThemedFlow/>` directly. Mechanical but list-and-confirm before merge.

> Open questions also persisted to `.omc/plans/open-questions.md`.

---

## Architect Re-Review (round 2)

### Previous concerns — status

1. **`MODE_CONFIG[mode].compose(...)` not type-safe**: **addressed** — v2 §2.1, §2.5, §3 explicitly drop the `compose` field from `MODE_CONFIG` and have each Flow import its compositor directly with full TypeScript narrowing at the import site.
2. **Per-effect `if (mode === "normal")` branches in BoothPage understate regression risk**: **addressed** — v2 §1.3 Option B-prime + §2.1 split themed and normal effects into separate components (`<ThemedFlow/>` / `<NormalFlow/>`); themed effect graph migrates verbatim, no inline mode branches in the timing-sensitive code.
3. **`frameImg?` optional is sloppy**: **addressed** — v2 §2.4 keeps `captureCut` signature unchanged (required `frameImg`) and adds a clean sibling `captureRawCut({ video })`; `lib/capture.test.ts` keeps its 18 cases unedited.
4. **`useSearchParams()` Suspense wrap on a Suspense-free page**: **addressed** — v2 §2.6 isolates `useSearchParams()` to a thin `<BoothPageRouter/>` with a route-level `<Suspense fallback={<PrimingSkeleton/>}>` in `app/booth/page.tsx`; Flow components stay Suspense-free, camera-priming UX is untouched.
5. **`createReducer(totalCuts)` factory + existing `TOTAL_CUTS`**: **addressed** — v2 §2.3 keeps `TOTAL_CUTS = 7`, `initialState`, and default `reducer` exports as backwards-compatible defaults; verified `session-machine.test.ts` imports `TOTAL_CUTS` and uses it 7+ times in fixtures (lines 15, 170, 171, 175, 182, 194, 215, 229, 230) — all keep working unchanged. New `THEMED_CUTS` / `NORMAL_CUTS` are additive.

### New concerns surfaced by v2 (if any)

- **§4.1 references `app/booth/__tests__/*` which does not exist in this repo.** I verified no such directory is present (only `components/LiveOverlay.test.tsx`-style co-located tests + `lib/*.test.ts`). v1 carried the same phantom reference. v2's "migration is mechanical" risk-statement is empty — there are no booth-page integration tests to migrate. This is good news for risk, but the plan should drop the phantom migration burden from §4.1 and §5 Open Item #10. Flagged as a documentation cleanup, not a blocker.
- **§2.1 NormalFlow row's hedge "or `<LiveOverlay frameSrc={undefined}>` only if a `hideFrameOverlay` prop is added"** contradicts the row for `LiveOverlay.tsx` ("Unchanged — byte-identical"). The first row should drop the hedge to commit to the inline `<CleanCameraViewport/>` approach. Minor wording inconsistency, not architecturally fatal.
- **CAMERA_READY dispatch verified mode-agnostic** (`app/booth/page.tsx:99-100` keys only on `camera.status === "ready"` and `state.phase === "camera-priming"`). Both Flow components inherit this trigger identically once their reducer's initial phase is `"camera-priming"` — confirms v2's verbatim-migration claim for the themed effect.

### Verdict

**AGREE — proceed to Critic**: v2 cleanly resolves all five v1 concerns with concrete, code-grounded changes; the residual issues (phantom test directory, one-line hedge in §2.1) are documentation cleanups that Critic can flag without blocking implementation.
