# Normal-Mode Plan v1 — 폴라로이드(일반) 모드 + 모드 선택 온보딩

> Spec source: `.omc/specs/deep-interview-normal-mode.md` (Ambiguity 17.9%, threshold passed)
> Pipeline stage: Planner output for ralplan consensus loop. Architect / Critic will review next.
> Author: Planner agent (`oh-my-claudecode:planner`), 2026-05-08
> Mode: **SHORT** consensus (justified in §1.4)

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (5)
1. **Themed-mode regression risk = zero.** The 7-cut themed flow is a fixed event-day commitment (event 2026-05-14). Every plan choice MUST preserve the existing 104-test green baseline and the existing /booth UX byte-for-byte when the user picks "도전 챌린지".
2. **Two modes share one chrome.** `CabinetChrome` + `ScaleToFit` wrap every screen — mode selection, themed booth, and normal booth — so the cabinet aesthetic is invariant across the kiosk.
3. **Overlay PNG is the source of truth for polaroid layout.** Polaroid borders, stickers, characters, and the `♡ OZCODINGG PD09 ♡` caption are baked into `public/overlays/normal.png`. Code never draws polaroid decoration; it only fills 4 cell rects under the alpha-cut overlay.
4. **State machine is parameterized, not forked.** One reducer with `TOTAL_CUTS` injected as a parameter; we do not duplicate the camera/countdown/flash/preview/compositing/qr-display lifecycle.
5. **Mode-aware capture, not mode-aware *cut*.** The cut data structure (576×720 ImageBitmap) is the same in both modes; only the *post-cut compositor* differs. That keeps `useCamera`, capture timing, and upload pipeline untouched.

### 1.2 Decision Drivers (top 3)
1. **Brownfield regression surface.** 104 tests, an existing reducer keyed to `TOTAL_CUTS = 7`, and a `BoothPage` whose every effect references `CAPTURE_FRAMES`. The mode delta has to thread through narrowly without rewriting these files.
2. **Designer asset workflow.** `public/overlays/normal.png` and the 4-cell coordinate set in `lib/normal-layout.ts` are user-supplied (not yet delivered). The plan must let engineering proceed in parallel with a **mock overlay + mock coordinates** so the designer is never on the critical path for code merges.
3. **Event date 2026-05-14 (6 days out).** Optimize for least-risk routing/state-machine change. Avoid any refactor (e.g., turning `BoothPage` into a generic mode shell that breaks themed mode) unless it's strictly required.

### 1.3 Viable Options (3 considered, 1 chosen)

#### Option A — Route split: `app/booth/themed/page.tsx` + `app/booth/normal/page.tsx`
- **Pros:** Each mode has its own page module; themed mode page is the *current* `app/booth/page.tsx` moved verbatim → trivial to prove zero regression. Normal mode page is a fresh file that imports shared hooks.
- **Cons:** Duplicates the BoothPage scaffolding (camera lifecycle effect, frame-image preload effect, state machine wiring). Two 200-LOC files instead of one 240-LOC file. Future bug fixes to camera/state plumbing must be done twice.
- **Complexity cost:** medium (mostly mechanical copy + diverge).
- **Regression risk:** very low — themed page byte-for-byte preserved.

#### Option B — Query-param mode: `/booth?mode=themed|normal` in one BoothPage
- **Pros:** Single page module; mode read once via `useSearchParams()`; reducer + lifecycle + useCamera shared. Spec §"모드 분기 전략" explicitly recommends this. Keeps all camera/state plumbing in one file → bug fixes propagate to both modes for free.
- **Cons:** All conditional branches (compositor choice, frame-img preload, overlay rendering, `TOTAL_CUTS`, captureCut signature) live inline → more `if (mode === "normal")` branches in one file. Harder to A/B regression-test purely by file diff.
- **Complexity cost:** low–medium (need to thread `mode` through ~5 useEffects).
- **Regression risk:** medium-low — every conditional must default to themed-mode behavior. Mitigated by `mode` defaulting to `"themed"` when query param absent (and by snapshot-test on themed-mode rendering).

#### Option C — State-machine-level mode parameterization
- **Pros:** Mode lives inside the reducer state itself; phase transitions react to `mode`. Theoretically the cleanest model.
- **Cons:** Forces invasive changes to `session-machine.ts` (and its 50+ tests). Reducer has no business knowing the difference between themed and normal cuts — the mode delta is a *render* and *compositor* concern, not a state-transition concern. Pure cost, no benefit.
- **Complexity cost:** high.
- **Regression risk:** **high** — touches the most-tested file in the repo.
- **Verdict:** **Invalidated.** State-machine doesn't change between modes (same phases, same transitions, just different `TOTAL_CUTS`). Parameterizing `TOTAL_CUTS` as a reducer-init arg is a 5-line change; rewriting the reducer is wasted blast radius.

#### Decision: **Option B (query-param mode)** — with one accommodation
- Why B over A: spec recommends it; preserves single-source-of-truth for camera/state plumbing for the 6 days remaining before the event. The duplication cost in A is real and compounds across bug fixes.
- Accommodation: A `BoothMode` constant pack in `lib/booth-mode.ts` centralizes everything that diverges between modes (`totalCuts`, `sheetSize`, `frameSrcResolver`, `compositor`). Branches in `BoothPage` then read `MODE_CONFIG[mode]` rather than scattered `if mode === ...` checks → reduces the regression-risk gap with A.

### 1.4 Risk Tier — SHORT mode justified
The work touches:
- Routing (new `/` mode-select, reroute themed entry to `/booth?mode=themed`).
- State machine (parameterize `TOTAL_CUTS`).
- Capture (make `frameImg` optional in `captureCut`).
- New compositor (`overlay-composer.ts`, no existing equivalent).

It does **not** touch:
- Auth, sessions, secrets, PII, or destructive data ops.
- Public APIs (`/api/captures` is unchanged).
- Database / storage migration.
- Production config / deploy / infra.

Pre-event refactor with tight test coverage is borderline but not deliberate-tier. Selecting **SHORT consensus**. If Architect or Critic flags an unforeseen blast-radius (e.g., useCamera mode-coupling), we can promote to deliberate in revision.

---

## 2. Implementation Plan

### 2.1 File-level changes

#### NEW
| Path | Purpose |
|---|---|
| `lib/booth-mode.ts` | `BoothMode = "themed" \| "normal"`, `MODE_CONFIG` registry (totalCuts, sheetSize, compositorRef), `parseBoothMode(searchParams)` helper with safe default. |
| `lib/normal-layout.ts` | 4 polaroid cell rects (`x, y, w, h, rotationDeg`) + canvas dims (1080×1440) + overlay path (`/overlays/normal.png`) + background fill color. |
| `lib/overlay-composer.ts` | `composeOverlaySheet({ cuts, overlayImg, background })` → 1080×1440 PNG Blob. |
| `components/ModeSelect.tsx` | Two-card mode-select UI rendered inside the cabinet shell. Routes to `/booth?mode=themed` or `/booth?mode=normal` via Next.js `<Link>`. |
| `lib/normal-layout.test.ts` | Coordinate sanity tests (0 ≤ x+w ≤ 1080, 0 ≤ y+h ≤ 1440). |
| `lib/overlay-composer.test.ts` | Unit test: 4 ImageBitmaps + overlay HTMLImageElement → 1080×1440 PNG, alpha overlay drawn last, 4 cell areas non-empty. |
| `lib/booth-mode.test.ts` | `parseBoothMode` falls back to "themed" on missing/invalid param. |
| `components/ModeSelect.test.tsx` | Both cards render; clicks route to correct hrefs. |
| `app/booth/__tests__/booth-page-mode.test.tsx` | (new file) Booth page renders themed flow when `?mode=themed` (or absent), and normal flow when `?mode=normal` — snapshots that overlay `<img>` is absent in normal mode. |
| `public/overlays/normal.png` | **Designer-supplied asset.** During engineering, replaced by a **mock checkerboard overlay PNG** (see §2.7). |

#### MODIFIED
| Path | Change |
|---|---|
| `app/page.tsx` | Replace `IdleScreen` body with `<ModeSelect />`. Keep `<ScaleToFit><CabinetChrome>` shell. The current 7-cut menu component is *removed from `/`* per spec Open Item #4 resolution (see §2.6). |
| `app/booth/page.tsx` | (a) Read `mode` from `useSearchParams()` (default `"themed"`). (b) Use `MODE_CONFIG[mode].totalCuts` instead of imported `TOTAL_CUTS` (rename the import call site to `cfg.totalCuts`). (c) Wrap component in a `<Suspense>` boundary required by `useSearchParams()` in App Router. (d) Skip `frameImg` in `captureCut` call when `mode === "normal"`. (e) In compositing branch, dispatch to `MODE_CONFIG[mode].compose(...)`. (f) In render, suppress overlay frame `<img>` (LiveOverlay's `frameSrc`) when `mode === "normal"` — pass empty/transparent placeholder or branch to a "clean camera" wrapper. (g) `onNextUser` still routes to `/`. |
| `lib/session-machine.ts` | Make `TOTAL_CUTS` accept an injected value: export `createInitialState(totalCuts)` and `createReducer(totalCuts)` factories that close over the cut count. Keep the existing `TOTAL_CUTS = 7` and `initialState` / `reducer` exports as **defaults using 7** so existing tests pass unchanged. |
| `lib/capture.ts` | Change `CaptureCutOptions.frameImg` to `frameImg?: HTMLImageElement`. When omitted, skip step 2 (overlay draw) and return the un-mirrored video-only 576×720 ImageBitmap. |
| `lib/copy.ts` | Add `COPY.modeSelect = { headline, themedCard: {title, subtitle}, normalCard: {title, subtitle} }`. Korean primary, English secondary, matching existing style. |
| `lib/types.ts` | (Optional) Re-export `BoothMode` for convenience. No structural change to `Cut` (still 576×720). |
| `components/LiveOverlay.tsx` | (If needed) Allow `frameSrc` to be optional / hidden via `hideFrameOverlay` prop. Default false → themed mode unchanged. |

#### DELETED
None. The current `IdleScreen` body becomes dead code inside `app/page.tsx` and is removed in the same commit. No file deletions.

### 2.2 Route structure decision (chosen: Option B)
- `/` → mode-select screen (new). NOT a redirect; renders `<ModeSelect/>` directly.
- `/booth?mode=themed` → existing 7-cut themed flow. Default if `mode` is missing/invalid.
- `/booth?mode=normal` → new 4-cut polaroid flow.
- Both modes' `onNextUser` button returns to `/` (mode-select), not back into themed idle.

### 2.3 State machine changes
Inject `TOTAL_CUTS` per session:
- Factory pattern: `createReducer(totalCuts: number)` returns the existing reducer with the constant captured. `createInitialState(totalCuts)` likewise (only `phase`, `cutIndex`, `countdown`, `cuts` are unaffected by the cut count itself; the only place `TOTAL_CUTS` is read is the `PREVIEW_DONE` branch).
- Existing top-level `TOTAL_CUTS`, `initialState`, `reducer` exports remain (default 7) so `session-machine.test.ts` and any importers stay green without edits.
- `BoothPage` switches from `import { reducer } from ...` to `const reducer = useMemo(() => createReducer(cfg.totalCuts), [cfg.totalCuts])`.

### 2.4 Capture path
- `captureCut({ video, frameImg })` → `captureCut({ video, frameImg? })`.
- Themed mode: pass `frameImg` (current behavior preserved).
- Normal mode: omit `frameImg`. The output is a 576×720 ImageBitmap of un-mirrored, cover-fit video pixels only — no overlay artwork — exactly what the polaroid compositor needs to clip into 4 rotated cells.
- No new `captureNormalCut` function. One function, one optional input. Existing 18 tests in `capture.test.ts` keep passing because `frameImg` is still provided in their cases.

### 2.5 Compositor
**`lib/overlay-composer.ts`** (new):
```ts
export interface OverlayComposeOptions {
  cuts: ReadonlyArray<{ index: number; imageBitmap: ImageBitmap }>;  // exactly 4
  overlayImg: HTMLImageElement;          // 1080x1440 alpha PNG
  background?: string;                   // default "#FFF8EC" cream (overridable)
}
export async function composeOverlaySheet(opts: OverlayComposeOptions): Promise<Blob>
```
Pseudocode:
1. Validate `cuts.length === 4`. Reject otherwise.
2. Create canvas 1080×1440, get 2D ctx (throw if null — mirrors `composeSheet`).
3. `ctx.fillStyle = background; ctx.fillRect(0, 0, 1080, 1440)`.
4. For each cell coord `c = NORMAL_CELLS[i]` paired with `cuts[i].imageBitmap`:
   - `ctx.save()`
   - Translate to cell center, rotate by `c.rotationDeg`, translate back.
   - Cover-fit the 576×720 ImageBitmap into the cell's `(c.w, c.h)` rect at `(c.x, c.y)` using existing `coverCrop` helper.
   - `ctx.restore()`
5. Draw `overlayImg` at `(0, 0, 1080, 1440)` 1:1 (alpha cells let the photos show through; polaroid borders/stickers/caption sit on top).
6. `canvas.toBlob(..., "image/png")` → resolve.

**`lib/normal-layout.ts`** (new):
```ts
export const NORMAL_SHEET_W = 1080;
export const NORMAL_SHEET_H = 1440;
export const NORMAL_BACKGROUND = "#FFF8EC";  // tweak per overlay
export const NORMAL_OVERLAY_SRC = "/overlays/normal.png";
export interface NormalCellRect {
  x: number; y: number; w: number; h: number; rotationDeg: number;
}
export const NORMAL_CELLS: ReadonlyArray<NormalCellRect> = [
  // Mock placeholder — designer to replace with real values
  { x:  90, y:  90, w: 420, h: 525, rotationDeg: -4 },
  { x: 570, y: 110, w: 420, h: 525, rotationDeg:  3 },
  { x:  90, y: 770, w: 420, h: 525, rotationDeg:  2 },
  { x: 570, y: 750, w: 420, h: 525, rotationDeg: -3 },
] as const;
```
The 4×(420×525) rectangles fit easily inside 1080×1440 (see §2.9 math). Designer replaces these and rotation values when delivering the overlay.

### 2.6 Mode-select page (and existing idle screen fate)
- `<ModeSelect/>` lives in `components/ModeSelect.tsx`. It renders inside `app/page.tsx` (replacing the current 7-cut menu body). Uses `<CabinetChrome fill={false}>` shell.
- Layout: spec Open Item #2 left as design decision. Default to **two stacked cards centered**, each card showing mode name (large), short subtitle (small), and a 시작 affordance. Cards link via `<Link href="/booth?mode=themed">` and `<Link href="/booth?mode=normal">`.
- **Existing idle screen fate (Spec Open Item #4):** removed from `/`. Choose **option (b) from spec**: themed-mode card routes directly to `/booth?mode=themed` — no intermediate idle. Rationale: the 7-cut menu's purpose was to set expectations for the themed cuts, but those expectations now belong on the *card* itself in mode-select. Adding a second screen between mode-select and booth means three taps before camera, which is bad kiosk UX. **The 7-cut menu copy migrates into the themed card subtitle and into the booth's existing `Bubble`/tagline UI (already shows tagline per cut).**
  - This decision is reversible later by re-introducing `/themed-idle/page.tsx` if the team wants the old menu back; the plan explicitly does NOT delete `IdleScreen` JSX from git history.
  - **Surfaced for confirmation** in §5 Open Items.

### 2.7 Asset workflow (designer asset not yet delivered)
- `public/overlays/normal.png` is missing during engineering. Plan compensates with a **mock-overlay step**:
  1. **Mock asset:** check in a placeholder `public/overlays/normal.png` as a 1080×1440 PNG with 4 transparent rectangles at the `NORMAL_CELLS` coords and visible black borders + a placeholder "♡ MOCK OVERLAY ♡" caption rendered on the opaque area. This proves the pipeline end-to-end without designer involvement.
  2. **Generation:** generate the mock once via a small Node script (`scripts/make-mock-overlay.ts`) that uses `node-canvas` or via a one-off in the test setup; if `node-canvas` install is too heavy, hand-author the PNG with a sketch tool and commit. **Recommended: Node script in `scripts/`, runnable via `npm run mock:overlay`, output gitignored except for the committed mock.** Architect to refine.
  3. **Real asset swap:** when designer delivers the real PNG, replace the file at the same path. No code change needed.
  4. **Coordinate swap:** designer also delivers the 4-cell coords. Update `NORMAL_CELLS` constants. The `lib/normal-layout.test.ts` bounds test catches accidental out-of-range values.
  5. **Feature flag option (rejected):** we considered an `OMC_ENABLE_NORMAL_MODE` env flag to hide the normal card from mode-select until assets are ready. **Rejected** because the mock-overlay path makes the feature demoable without it, and a feature flag adds branching surface for the event-day code freeze. If the designer slips past 2026-05-13, switch the normal card to a "Coming soon" disabled state in `ModeSelect` (5-line change).

### 2.8 Caption typo (spec Open Item #1)
- Spec resolution: caption text is baked into the overlay PNG; code never renders it.
- Therefore **the typo question (`OZCODINGG` vs `OZCODING`) is a designer-only decision**, not a code decision.
- Plan response: mention this in `.omc/plans/open-questions.md` and require the designer's PNG to be the canonical source. Engineering does NOT block on this. If the typo is discovered post-delivery, the fix is: re-export PNG. Zero code churn.

### 2.9 Cut-count parameterization & 1080×1440 fit-math
Spec confirms NormalCut is 576×720 (same aspect as themed). Question: do four 576×720-aspect cuts fit in a 1080×1440 sheet?

- Each cell is **420 × 525** in the mock layout (see `NORMAL_CELLS`). Aspect = 0.8 — **identical** to the 576×720 cut aspect (also 0.8). So cuts scale uniformly into cells with no distortion (same property `composeSheet` already exploits).
- Layout fit:
  - `2 × 420 + (1080 − 2×420) gaps = 840 + 240` → 240px horizontal slack split across left/right margin and center gutter. With margin 90 + gutter 60 + margin 90: 90+420+60+420+90 = 1080 ✓.
  - `2 × 525 + (1440 − 2×525) gaps = 1050 + 390` → 390px vertical slack: top margin 90 + bottom margin 90 + middle gutter 210 → fits with room to spare for rotation overflow (cells rotated ±4° at 525 tall extend ~36px past bbox; the 210px center gutter absorbs this comfortably).
  - Designer will tune. Mock just needs to *not crash compositor*.
- Cut-count parameter wiring: `MODE_CONFIG.themed.totalCuts = 7`, `MODE_CONFIG.normal.totalCuts = 4`. `BoothPage` reads `cfg.totalCuts` once and passes it to `createReducer` and to the per-cut frame resolver.

### 2.10 Acceptance criteria mapping

| Spec AC | Plan step delivering it |
|---|---|
| `/`로 진입 시 모드 선택 화면 | §2.6 (`<ModeSelect/>` replaces IdleScreen body in `app/page.tsx`) |
| 도전 챌린지 회귀 100% | §2.3 (factory pattern preserves default exports) + §2.7 (themed mode is the default `?mode` value) + §3 ADR Consequences (regression-test gate) |
| 폴라로이드 4컷 진입 | §2.2 (route), §2.4 (capture omits frameImg) |
| 카메라 권한 거부 → 모드 선택 복귀 | `BoothPage` already routes to `/` on RESET; mode-select now lives at `/`. Verify in §4 e2e. |
| 폴라로이드 모드: 카메라 위에 overlay `<img>` 없음 | §2.1 `LiveOverlay.hideFrameOverlay` prop or branch in `BoothPage` render. |
| 5초 카운트다운 → 플래시 → 미리보기 4번 반복 | §2.3 (reducer's PREVIEW_DONE → countdown loop honors injected `totalCuts`) |
| 카메라 스트림 끊기지 않음 | §2.4 (no useCamera changes; lifecycle 동일) |
| 합성 결과 PNG 1080×1440 | §2.5 (canvas dims locked) + §4 unit test |
| 4개 사진 영역이 좌표/회전대로 배치 | §2.5 (NORMAL_CELLS rotation translate-rotate-translate) |
| 오버레이 PNG 알파 합성 | §2.5 step 5 (overlay drawn last) |
| 검은 픽셀/빈 알파 아님 | §4 unit test: assert avg luminance in cell areas ≠ 0 |
| 합성 시간 ≤ 7컷 모드 | §2.5 (4 drawImage + 1 overlay = 5 ops vs themed 7+1 = 8 ops; trivially ≤) |
| `/api/captures` 업로드 + QR 표시 | §2.1 — uploadSheet/QRScreen unchanged |
| QR 화면 1080×1440 미리보기 깨짐 없음 | `QRScreen` uses `<img>` with intrinsic aspect — no change needed |
| 처음으로 돌아가기 → 모드 선택 | §2.2 |
| `lib/overlay-composer.ts` 단위 테스트 | §4.2 |
| `lib/normal-layout.ts` 좌표 유효 | §4.2 |
| 모드 선택 페이지 렌더 테스트 | §4.2 |
| 도전 챌린지 회귀 테스트 (104개 통과) | §4.1 |

---

## 3. ADR

### Decision
Add normal mode as a **query-parameter branch on `/booth`** (Option B), backed by a `MODE_CONFIG` registry in `lib/booth-mode.ts`. Replace the current `/` idle screen with a 2-card `<ModeSelect/>`. Keep the session reducer single-source via a `createReducer(totalCuts)` factory. Add a new `lib/overlay-composer.ts` for 1080×1440 polaroid sheet composition; reuse the existing capture/upload/QR pipeline.

### Drivers
1. Brownfield regression risk — preserve the 104-test green baseline on themed mode.
2. Designer asset on critical path — engineering must work in parallel.
3. Event date 2026-05-14 — minimize blast radius.

### Alternatives considered
- **Option A (route split):** rejected — duplicates BoothPage scaffolding; doubles maintenance for camera/state plumbing during the pre-event week.
- **Option C (reducer-level mode):** invalidated — state transitions are mode-agnostic; mode is a render+compositor concern, not a state concern. Touching the most-tested file adds risk for no benefit.

### Why chosen
Option B threads the smallest, most-localized change set: 1 reducer factory, 1 captureCut optional param, 1 new compositor, 1 new mode-select component, 1 query-param read in BoothPage. The `MODE_CONFIG` indirection keeps inline branching contained and makes both modes' behavior diff-able from a single config table. Mock-overlay workflow (§2.7) decouples engineering from designer delivery.

### Consequences
- (+) Themed mode regression surface is limited to: `app/page.tsx` body change, `BoothPage` reading `cfg.totalCuts` instead of constant, `captureCut` accepting optional `frameImg`. All three are covered by existing tests with the optional-param defaults.
- (+) `lib/session-machine.ts` keeps its current public surface (default `reducer`, default `TOTAL_CUTS = 7`); `session-machine.test.ts` does not change.
- (−) `BoothPage` gains 4–5 mode-aware branches. Mitigated by `MODE_CONFIG` registry. Future modes (if any) reuse the same plumbing.
- (−) `useSearchParams()` in App Router requires wrapping `BoothPage` in `<Suspense>` (Next.js 15 quirk). One-time setup cost.
- (−) Mock overlay must be generated and committed. ~30 LOC script + a 1080×1440 PNG.

### Follow-ups
- Designer delivery of `public/overlays/normal.png` + the 4-cell coordinate table → updates `NORMAL_CELLS`.
- Caption typo confirmation (`OZCODINGG` vs `OZCODING`) in the delivered PNG.
- Decide whether themed-mode users still want the 7-cut menu (current decision: removed from `/`, migrated to themed card subtitle). Re-introducing it is a non-breaking 1-screen addition.
- Confirm `MarqueeSign` / cabinet-shell text for mode-select header (`COPY.modeSelect.headline` value).
- Future: if a third mode is added, the `MODE_CONFIG` registry already supports it.

---

## 4. Verification & Test Plan

### 4.1 Regression suite (must keep passing — 104 tests)
- `lib/session-machine.test.ts` (no edits — defaults preserved).
- `lib/capture.test.ts` (`frameImg` still passed in tests; optional param doesn't change calling tests).
- `lib/sheet-composer.test.ts` (no changes — themed compositor untouched).
- `lib/upload-sheet.test.ts` (untouched).
- `lib/use-camera.test.ts` (untouched).
- `lib/cover-crop-math.test.ts` (untouched; new compositor reuses it).
- `lib/captures-server.test.ts` (untouched — server route unchanged).
- `components/LiveOverlay.test.tsx` (default `hideFrameOverlay=false` keeps current behavior; add one new case for `hideFrameOverlay=true`).
- `components/CameraDeniedBanner.test.tsx` (untouched).
- `components/QRScreen.test.tsx` (untouched).

### 4.2 New tests
1. **`lib/normal-layout.test.ts`** — assert each cell's `x ≥ 0`, `x + w ≤ 1080`, `y ≥ 0`, `y + h ≤ 1440`, `−15 ≤ rotationDeg ≤ 15`.
2. **`lib/overlay-composer.test.ts`** — using jsdom + `OffscreenCanvas` shim (or extend the mock used in `sheet-composer.test.ts`):
   - 4 mock ImageBitmaps (solid red, green, blue, yellow) + 1 mock overlayImg (transparent rectangles at `NORMAL_CELLS` coords).
   - Output blob has `type === "image/png"`.
   - Output canvas dims === 1080×1440.
   - Sample pixel at center of each cell: should be the cut's solid color (proves cut was drawn).
   - Sample pixel in opaque overlay region: should be overlay color (proves overlay drawn last on top).
   - `cuts.length !== 4` → rejects.
3. **`lib/booth-mode.test.ts`** — `parseBoothMode(undefined) === "themed"`, `parseBoothMode("xyz") === "themed"`, `parseBoothMode("normal") === "normal"`, `parseBoothMode("themed") === "themed"`.
4. **`components/ModeSelect.test.tsx`** — renders both card titles; clicking themed card has `href="/booth?mode=themed"`; clicking normal card has `href="/booth?mode=normal"`.
5. **`app/booth/__tests__/booth-page-mode.test.tsx`** — render BoothPage with `?mode=themed` (snapshot has frame `<img>` per `LiveOverlay`); render with `?mode=normal` (snapshot has no frame `<img>`). Mock `useCamera` and `useSearchParams`.
6. **`app/__tests__/page-mode-select.test.tsx`** (rename existing if needed) — `/` renders `<ModeSelect/>`, no longer renders the 7-frame menu.

### 4.3 Canvas/jsdom mocking strategy
- Reuse the existing `sheet-composer.test.ts` mocking pattern: stub `HTMLCanvasElement.prototype.getContext` to return a recording 2D mock; stub `canvas.toBlob` to call back synchronously with a fake Blob; stub `createImageBitmap`. Apply the same shim file to the new compositor test.

### 4.4 Manual / e2e smoke (kiosk hardware, day-of-event prep)
- `/` → mode-select renders inside cabinet shell.
- Click 도전 챌린지 → /booth → 7 cuts → QR → "처음으로" → back to mode-select.
- Click 폴라로이드 → /booth → camera shows clean (no character overlay) → 4 cuts → QR shows polaroid sheet preview → "처음으로" → mode-select.
- Deny camera permission on either path → CameraDeniedBanner → retry → permission flow → returns to live booth.

---

## 5. Open Items / Follow-ups

1. **Spec Open Item #1 — caption typo:** OZCODINGG vs OZCODING. **Resolution:** designer-only decision (caption is baked into PNG). Recorded in `.omc/plans/open-questions.md`.
2. **Spec Open Item #2 — mode-select layout:** two-card centered (recommended) vs two-button row. **Default in plan:** two-card centered. Designer/UX may override before merge.
3. **Spec Open Item #3 — cell coords:** designer provides with overlay PNG; mock placeholder values committed; will be replaced.
4. **Spec Open Item #4 — existing idle screen fate:** plan picks **option (b)**: idle screen body removed from `/`; themed card routes directly to `/booth?mode=themed`. **Surface for user confirmation before code starts** — this is a UX contract change.
5. **Spec Open Item #5 — regression CI gate:** 104 existing tests must pass on the merge commit; add to CI as a hard gate.
6. **Mock-overlay generation script** — author or hand-author? Pick one before §2.7 lands.
7. **`<Suspense>` boundary placement** for `useSearchParams()` in `app/booth/page.tsx` — confirm Next.js 15 idiom in Architect review.
8. **`MODE_CONFIG` registry shape** — exact type for `compose(...)` (signature differs between sheet-composer and overlay-composer in cut count). Architect to recommend a discriminated-union vs adapter approach.

---

## Architect Review (round 1)

### Steelman antithesis

**The strongest case against Option B: route-split (Option A) is materially safer for a brownfield kiosk shipping in 6 days, and the plan undersells its costs in one specific way that the codebase actually exposes.**

The plan dismisses A on "duplicates BoothPage scaffolding → doubled maintenance for camera/state plumbing." But in this codebase, "BoothPage scaffolding" is ~240 LOC dominated by *themed-mode-specific* effects — `frameImagesRef` preloads `FRAMES` (8 themed assets, `app/booth/page.tsx:86-95`), the flash effect *requires* `CAPTURE_FRAMES[state.cutIndex]` and a `frameImg` (`app/booth/page.tsx:128-162`), the compositing effect requires `TITLE_FRAME` (`app/booth/page.tsx:185-221`), and the render uses `LiveOverlay` always wired to a `frameSrc`. With Option B, *every one of those effects must learn `if (mode === "normal")`* — that is 4–5 inline branches across the most timing-sensitive code in the app. The plan lists this in §1.3 cons but treats `MODE_CONFIG` indirection as adequate mitigation; it is not, because the issue is not the branching style but the *number of moving parts in one effect graph during the most untested week of the project*.

Option A pays the duplication cost once, but: (1) themed `app/booth/themed/page.tsx` is byte-for-byte the current file moved → the existing 104 tests verify it without change of any kind, no `mode = "themed"` default branch to defend; (2) `app/booth/normal/page.tsx` is a *fresh* 100–140 LOC file that imports `useCamera` + a normal-only flash effect + a normal-only compositing effect — no `if mode` anywhere. Future bug fixes "have to be done twice" only for the *shared* parts (camera, state machine), and those already live in `lib/use-camera.ts` and `lib/session-machine.ts` — i.e. they are already extracted. The duplication is in BoothPage's **glue layer**, which is exactly where mode-specific glue belongs.

Additionally: the plan's Option B requires wrapping BoothPage in `<Suspense>` to use `useSearchParams()` (App Router 14+ rule). This is a non-trivial regression risk. Today `app/booth/page.tsx` is a single client component with no Suspense boundary; existing snapshot/render tests in `app/booth/__tests__/` will need updates because mounting under `<Suspense>` changes test setup. With Option A, **themed mode never reads `useSearchParams()`** — no Suspense wrap, no test churn, zero risk to the green baseline. The plan claims "themed mode regression surface limited to 3 changes" but those 3 changes still mutate the file under test for 100% of its existing tests. With A, `app/booth/themed/page.tsx` is *unchanged*.

The honest reframe: Option B optimizes for codebase elegance after the event; Option A optimizes for risk *during* the 6-day pre-event window. For a one-shot kiosk that runs for a single day, the elegance optimization is paying a real risk premium for value the project will likely never realize.

If this argument is rejected, the still-valid hybrid is: **keep the current `app/booth/page.tsx` exactly as-is for themed, add `app/booth/normal/page.tsx` for normal**, and put `<ModeSelect/>` at `/`. That is a strict subset of Option A's work and yields zero diff against `session-machine.test.ts`, `capture.test.ts`, or any existing booth page test.

### Tradeoff tension

**The `MODE_CONFIG.compose(...)` registry is presented as type-safe but cannot be, because the two compositors have structurally different inputs.**

`composeSheet` (`lib/sheet-composer.ts:69-71`) takes `{ cuts: ReadonlyArray<Cut>, titleCardImg: HTMLImageElement, background? }` and requires *exactly 7 cuts identified by frameId*. The proposed `composeOverlaySheet` takes `{ cuts: ReadonlyArray<{index, imageBitmap}>, overlayImg: HTMLImageElement, background? }` and requires *exactly 4 cuts identified by index*. These are not unifiable behind a single `compose(...)` signature without one of three concessions:

1. **Discriminated union per call site** — `BoothPage` does `if (mode === "themed") { compose({ cuts, titleCardImg }) } else { compose({ cuts, overlayImg }) }`. The registry indirection collapses to a switch — i.e., the `MODE_CONFIG` "single-source-of-truth" is fictional.
2. **Lowest-common-denominator adapter** — `compose(cuts, modeAssets)` with `modeAssets` opaque. TypeScript can no longer prove themed mode actually has a `titleCardImg`; you've replaced compile-time safety with runtime cast.
3. **Per-mode bound thunks** — store `() => Promise<Blob>` partially applied at the call site. Now the registry doesn't centralize anything; the call site builds the closure with the right inputs anyway.

The plan explicitly flags this in Open Item #8 but treats it as a detail. It is not — it determines whether `MODE_CONFIG` is genuinely a discriminated-union providing exhaustiveness checking (Option B's main selling point over Option A in §1.3) or just a config struct with a dispatch switch in `BoothPage`. If it's the latter, the architectural premise of B over A weakens significantly, because the supposed "config-table-driven" elegance does not exist.

The real choice is: (a) accept that `BoothPage` will have an explicit `if (mode === ...)` switch around `compose`, in which case Option A's "explicit branch per page" is honestly just the same switch promoted to the routing layer; or (b) push mode-specific concerns into the route, where TypeScript naturally separates them.

### Synthesis / proposed change

A concrete, narrowly-scoped revision that captures the strongest argument from each side without rewriting the plan:

**Adopt Option B for routing/state-machine reuse, but split the compositing-and-render concerns into mode-specific subcomponents.** Specifically:

1. Keep `/booth?mode=themed|normal` and `MODE_CONFIG` for `totalCuts`, `sheetSize`, and the *list* of mode-specific assets.
2. Replace the proposed `MODE_CONFIG[mode].compose(...)` with two narrowly-typed components: `<ThemedFlow cuts={...} />` and `<NormalFlow cuts={...} />`, each owning its own preload-effect, its own compositing-effect, and its own `LiveOverlay`-vs-clean-camera render branch. `BoothPage` switches between them once on `mode`.
3. The shared layer is `useCamera` + `createReducer(totalCuts)` + the camera-priming/error/QR-display rendering. That is all that *should* be shared.
4. This eliminates the `frameImg?` optional in `captureCut` — `ThemedFlow` calls `captureCut({ video, frameImg })`; `NormalFlow` calls a tiny new `captureRawCut({ video })` that is 30 LOC of the existing function with the frame draw step removed. **Two named functions are clearer than one function with optional behavior**, and `lib/capture.test.ts` does not need to grow a "frameImg-omitted" test path.
5. Suspense boundary: only required if `useSearchParams()` is read inside `BoothPage`. Read it instead in a tiny `app/booth/page.tsx` server-component-friendly wrapper that selects the flow component, which is the App Router idiomatic pattern.

This synthesis preserves Option B's "single page, single state machine, single camera" benefit while eliminating Option A's duplication tax and the registry's broken type-safety story. Net delta from the current plan: replace `MODE_CONFIG.compose` + inline branches in `BoothPage` with two flow subcomponents; demote `frameImg?: HTMLImageElement` back to required and add `captureRawCut`.

If this is unacceptable, the fallback recommendation is to switch to Option A with `<ModeSelect/>` at `/`. Anything is preferable to landing the unenforceable `MODE_CONFIG.compose` shape in production code.

### Soundness checklist

- [x] **App Router `useSearchParams` + Suspense:** Plan acknowledges it (§3 Consequences) but the recommended idiom is to read `useSearchParams()` in a small client wrapper that renders `<Suspense fallback={...}><BoothPageInner mode={mode}/></Suspense>`, *not* to wrap `BoothPage` itself. Otherwise the Suspense boundary forces re-architecture of the existing camera-priming overlay UX (the fallback would flash). Plan should specify the wrapper layout.
- [ ] **Type system honesty for `MODE_CONFIG[mode].compose(...)`:** As argued above, this cannot be type-safe across the two compositors' divergent input shapes without a discriminated union *and* a switch at the call site. Plan should pick one of: (a) discriminated union + explicit switch (drop "registry" framing), (b) per-mode flow components (synthesis above), or (c) accept runtime cast and document it. Currently flagged as open item #8 but treated as an implementation detail; it is an architectural decision.
- [x] **State machine `TOTAL_CUTS` parameterization:** Verified clean. The constant is referenced exactly twice — `session-machine.ts:36` (definition) and `session-machine.ts:147` (`PREVIEW_DONE` branch). Importers outside the file are `app/booth/page.tsx:40` (UI display) and `session-machine.test.ts` (tests use literal 7 indirectly via `initialState`). Factory pattern with default `7` export is sound; `session-machine.test.ts` does not reference `TOTAL_CUTS` literal in a way that breaks.
- [ ] **Test isolation for new compositor:** Plan §4.3 says "reuse the existing `sheet-composer.test.ts` mocking pattern." Confirmed `lib/sheet-composer.test.ts` stubs `getContext`/`toBlob`/`createImageBitmap`. But the new compositor uses `ctx.save/restore/translate/rotate` (§2.5 step 4) which the current canvas mock likely does not record. The test for "cells drawn at rotated coordinates" cannot be asserted under the existing stub without extending it. Plan should explicitly call out that `vitest.setup.ts` (currently 1 line: `import "@testing-library/jest-dom"`) needs a richer canvas-context mock recording transform-matrix state.
- [x] **Asset/dev workflow with mock overlay PNG:** Viable. The mock-overlay strategy in §2.7 is sound: pipeline-end-to-end testable without the designer. One refinement — the plan's recommendation to author a Node script using `node-canvas` is overkill for a 1080×1440 PNG with 4 transparent rects; a 30-line standalone HTML file the dev opens once and saves the canvas as PNG is faster and avoids the `node-canvas` install (which can be a 5-minute setup tax with native build deps). Recommend pivoting to "hand-author or in-browser scratch page; commit the PNG; do not ship a script."
- [ ] **Open Items resolution — #4 (idle screen fate) blocks coding, agreed:** Plan §2.6 picks option (b) (kill idle, themed card → `/booth?mode=themed` directly) with explicit user-confirmation flag. Concur this is a UX contract change requiring sign-off before code merges. Recommend the ralplan loop hold here until user confirms; the rest of the plan is implementable without this answer (themed flow works either way), so it is technically a parallelizable open item, but the `<ModeSelect/>` copy and routing decision rests on it.
- [x] **Open Items #1, #2, #3, #5, #6, #7:** All correctly classified as non-blocking or designer-supplied. #1 (caption) is pure asset, not code. #2 (layout) is design polish. #3 (cell coords) has working mock placeholders. #5 (CI gate) is operational. #6 (script vs hand-author) is the §2.7 refinement above. #7 (Suspense) addressed in checklist item 1.
- [x] **`captureCut` `frameImg?` optional:** Mechanically clean (`lib/capture.ts:38, 70-78`). The conditional `if (frameImg.complete && frameImg.naturalWidth > 0)` already gracefully handles a missing frame today; making the field optional is a 1-line change. Synthesis above prefers a separate `captureRawCut` for clarity; not blocking.
- [x] **`onNextUser` returns to `/`:** Verified `app/booth/page.tsx:243` already routes to `/`. With `/` becoming mode-select, this is correct without any code change in `BoothPage`'s navigation.

### Verdict

**REVISE — Planner must address these before Critic:**

1. **Resolve the `MODE_CONFIG.compose` type-safety question** (Open Item #8) explicitly in the plan body, not deferred. Either adopt the synthesis (per-mode flow components) or drop the "registry" framing in favor of a documented dispatch switch.
2. **Specify the Suspense boundary placement** (Open Item #7) — wrap an inner component, not `BoothPage` itself, to avoid disturbing the existing camera-priming overlay.
3. **Get explicit user confirmation on Open Item #4** (idle screen removal at `/`) before Critic — UX contract change.
4. **Extend canvas mock plan in §4.3** to record transform-matrix state for the rotated-cell assertions, or accept that "cells at correct rotation" is only verifiable in the e2e/manual smoke pass.

These are scoped, actionable revisions — the plan's overall direction is sound; the residual issues are real but bounded. With the synthesis adopted, this is a green-light plan.
