# Normal-Mode Plan v3 — 폴라로이드(일반) 모드 + 모드 선택 온보딩

> Spec source: `.omc/specs/deep-interview-normal-mode.md` (Ambiguity 17.9%, threshold passed)
> Pipeline stage: Planner v3 — Architect v2 returned **AGREE**, Critic v2 returned **ITERATE**. This v3 absorbs every Critic finding.
> Author: Planner agent, 2026-05-08
> Mode: **SHORT** consensus (architecture unchanged from v2)
> v1: `.omc/plans/normal-mode-plan-v1.md` (untouched). v2: `.omc/plans/normal-mode-plan-v2.md` (untouched).

**v2 → v3 delta (1-line):** addressed Critic ITERATE — added compose-time benchmark, CleanCameraViewport responsibility list, pixel-sample test specifics, dropped phantom directory refs and LiveOverlay hedge, surfaced 2 Open Items as pre-coding gates, mapped 2 missing acceptance criteria to tests.

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (5) — unchanged from v2
1. Themed-mode regression risk = zero (104-test green baseline preserved).
2. Two modes share one chrome (`CabinetChrome` + `ScaleToFit`).
3. Overlay PNG is the source of truth for polaroid layout.
4. State-machine plumbing is shared; render and compositor are not.
5. Type honesty over registry elegance.

### 1.2 Decision Drivers (top 3) — unchanged from v2
1. Brownfield regression surface — preserve 104-test baseline.
2. Designer asset on critical path — parallelize via mock.
3. Event date 2026-05-14 — minimize blast radius.

### 1.3 Viable Options — unchanged from v2
**Decision: Option B-prime** (thin coordinator + per-mode flow subcomponents). Option A (pure route split), Option C (reducer-level mode), and v1 Option B (unified `MODE_CONFIG.compose` registry) all invalidated with v2 reasoning intact.

### 1.4 Risk Tier — SHORT (unchanged from v2 §1.4)

---

## 2. Implementation Plan

> v3 retains v2's structure. Only the sections altered by Critic findings are reproduced in full below; all other §2 content is identical to v2 and not duplicated here.

### 2.1 File-level changes — corrected NormalFlow row

The NormalFlow row's hedge ("or `<LiveOverlay frameSrc={undefined}>` only if a `hideFrameOverlay` prop is added") is **dropped per Critic Minor #5**. The committed approach is the inline `<CleanCameraViewport/>`, full stop. Corrected row:

| Path | Purpose |
|---|---|
| `components/NormalFlow.tsx` | Owns all normal-mode-specific logic: overlay PNG preload, flash effect calling `captureRawCut({ video })`, compositing effect calling `composeOverlaySheet({ cuts, overlayImg })`, render with `<CleanCameraViewport/>` (defined inline; see §2.6). **No `<LiveOverlay/>` usage in normal mode — `LiveOverlay.tsx` stays byte-identical.** |

All other rows in v2 §2.1 NEW / MODIFIED / DELETED tables remain as-is.

### 2.6 CleanCameraViewport responsibilities (NEW — addresses Critic Major #2)

`<CleanCameraViewport/>` is defined **inline inside `components/NormalFlow.tsx`** (or co-located as `components/CleanCameraViewport.tsx` if extracted later). It MUST replicate the following `<LiveOverlay/>` parity behaviors:

1. **Aspect-ratio container**: outer wrapper has `aspectRatio: "576/720"` (matches normal-mode polaroid cell capture dimensions). Identical sizing semantics to `<LiveOverlay/>` so `<ScaleToFit>` math is unchanged.
2. **`transform: scaleX(-1)` mirror on `<video>`**: preserves the selfie-mirror UX. The captured ImageBitmap from `captureRawCut` is un-mirrored (canvas draw matches ThemedFlow), but the live preview is mirrored — identical to themed.
3. **`<video>` attributes**: `autoPlay`, `muted`, `playsInline` — identical set as `<LiveOverlay/>`.
4. **`data-testid="clean-camera-viewport"`** on the outer wrapper. Tests assert this id is present and that no element with `data-testid="live-overlay-frame-img"` (or whatever testid `<LiveOverlay/>`'s `<img>` carries) appears.
5. **Cut counter badge**: `[n/4]` overlay positioned identically to themed mode's HUD badge (top-right, same Tailwind classes). Source = `state.cutIndex + 1` / `NORMAL_CUTS`.
6. **Cover-fit `<video>` styling**: `width: 100%`, `height: 100%`, `objectFit: "cover"` — matches `<LiveOverlay/>` video element exactly.

Implementation note: copy the `<video>` JSX block from `LiveOverlay.tsx` verbatim and omit only the `<img frameSrc>` element + the cut-counter badge JSX is duplicated (or imported from a small shared subcomponent if it exists). No mutation to `LiveOverlay.tsx`.

### 2.7 Mode-select page + idle-screen fate

**ELEVATED to pre-coding gate** — see §6 Pre-coding Gates. v2's choice (option (b): idle removed, themed card routes directly to `/booth?mode=themed`) is the proposal but is NOT adopted until user confirms. Implementation cannot start before this confirmation per Critic Minor #6.

### 2.8, 2.9 — unchanged from v2

---

## 3. ADR — unchanged from v2

No fixes in this v3 changed an architectural decision. All Critic findings are documentation-and-test-plan corrections, not architecture revisions. ADR addendum: none.

---

## 4. Verification & Test Plan

### 4.1 Themed regression suite (104 tests must stay green)

- `lib/session-machine.test.ts` — no edits (defaults preserved).
- `lib/capture.test.ts` — no edits to `captureCut` cases; +2 new cases for `captureRawCut`.
- `lib/sheet-composer.test.ts` — no edits.
- `lib/upload-sheet.test.ts`, `lib/use-camera.test.ts`, `lib/cover-crop-math.test.ts`, `lib/captures-server.test.ts` — untouched.
- `components/LiveOverlay.test.tsx`, `components/CameraDeniedBanner.test.tsx`, `components/QRScreen.test.tsx` — untouched.
- **`app/booth/__tests__/*` reference DROPPED** (Critic Minor #4). The repo has no such directory; co-located component tests + `lib/*.test.ts` are the only test locations. There is no migration burden.

### 4.2 New tests (each acceptance criterion mapped to a file)

#### 4.2.1 `lib/normal-layout.test.ts`
Coordinate bounds: each cell satisfies `0 ≤ x` and `x + width ≤ 1080`; `0 ≤ y` and `y + height ≤ 1440`. Maps to spec criterion: "좌표 상수가 합리적 범위 안".

#### 4.2.2 `lib/overlay-composer.test.ts` — pixel-sample + benchmark (addresses Critic Major #1 and #3)

**Test fixtures:**
- 4 mock ImageBitmaps, each a unique solid color: cut 0 = red `(255, 0, 0)`, cut 1 = green `(0, 255, 0)`, cut 2 = blue `(0, 0, 255)`, cut 3 = yellow `(255, 255, 0)`.
- 1 mock `overlayImg` HTMLImageElement: 1080×1440 with 4 fully-transparent rectangles aligned to `lib/normal-layout.ts` cell coords; surrounding pixels opaque cream `(248, 244, 232)` or any non-cell sentinel color.

**Pixel-sample assertions:**
Sample coordinates are **the geometric center of each cell rect from `lib/normal-layout.ts`**, after applying that cell's rotation (computed by the test using the same `cx + cos*0 - sin*0` identity — center is invariant under rotation about itself). Concretely the test reads coords from the layout module and computes `(centerX, centerY) = (rect.x + rect.width/2, rect.y + rect.height/2)` per cell. Until designer delivers final coords, mock placeholder centers (illustrative): `(280, 350)`, `(800, 350)`, `(280, 1090)`, `(800, 1090)`.

Per cell, assert each RGB channel of the sampled pixel is within tolerance of the expected fixture color: `|sampled - expected| ≤ 4` per channel. Tolerance accounts for canvas anti-aliasing at rotation edges; the cell center should be fully interior.

**Black-pixel-ratio threshold (spec criterion: "검은 픽셀 비율 임계치"):**
For each of the 4 cell rects, count pixels where `R + G + B < 12` (effectively pure black). Threshold: `blackPixelCount / cellArea < 0.05` (less than 5% of any cell area is fully black post-composition). This catches a regression where a cell fails to draw and the cream-fill background bleeds through holes — but tighter than that: cream is not black, so a missed cell would produce cream, not black; the threshold instead protects against a future ImageBitmap-with-alpha bug where transparent regions composite to black.

**Compose-time parity benchmark (spec criterion: "합성 시간이 themed 모드와 동등하거나 더 짧다"):**
- **Baseline** stored as a constant in a new file `lib/__benchmarks__/themed-compose-baseline.ts`:
  ```ts
  // Median of 5 runs of composeSheet({ cuts: 7 mock bitmaps, titleCardImg: mock })
  // measured on reference machine (M-series Mac, Node 20, vitest jsdom env), 2026-05-08.
  // Re-measure if vitest/jsdom/Node major versions change.
  export const THEMED_COMPOSE_MEDIAN_MS = /* TBD: filled during step 1 of Migration Runbook */;
  export const PARITY_TOLERANCE = 1.2; // normal must be ≤ 1.2× themed (non-regression band)
  ```
- **Assertion in `lib/overlay-composer.test.ts`:**
  ```ts
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await composeOverlaySheet({ cuts, overlayImg });
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const normalMedian = samples[2];
  expect(normalMedian).toBeLessThanOrEqual(THEMED_COMPOSE_MEDIAN_MS * PARITY_TOLERANCE);
  ```
- **File holding the assertion:** `lib/overlay-composer.test.ts` (single source). **File holding the baseline:** `lib/__benchmarks__/themed-compose-baseline.ts`. **How baseline is populated:** Migration Runbook step 1 measures themed composer once and writes the constant.

#### 4.2.3 `lib/booth-mode.test.ts`
`parseBoothMode` fallback to `"themed"` on missing/invalid; `MODE_CONFIG` data-only shape (no `compose` field).

#### 4.2.4 `components/ModeSelect.test.tsx`
Both cards render; correct `<Link href>` per card. Maps to spec criteria: mode select renders; routing correct.

#### 4.2.5 `components/ThemedFlow.test.tsx`
Preload of `FRAMES`; themed compositing path invoked; `<LiveOverlay frameSrc>` present. Mock `useCamera`, mock `composeSheet`.

#### 4.2.6 `components/NormalFlow.test.tsx` — expanded scope (addresses Critic Missing #7 and #8)

Test cases:
1. **Overlay PNG preload**: `Image.src` set to `/overlays/normal.png`; `composeOverlaySheet` not called until preload resolves.
2. **Clean camera viewport**: rendered DOM contains `[data-testid="clean-camera-viewport"]` and contains exactly zero elements matching `<LiveOverlay/>`'s frame `<img>` testid. Confirms no character-frame overlay.
3. **`composeOverlaySheet` invoked** with 4 cuts after the 4-cycle reducer drives to `composing` phase. Mock the composer.
4. **NEW — Camera-deny → mode-select return path** (maps spec criterion: "두 모드 모두 카메라 권한 거부 → CameraDeniedBanner → 모드 선택 화면으로 복귀"):
   - Describe block: `"camera-deny → mode-select"`.
   - Mock `useCamera` to return `{ status: "denied", error: ... }`.
   - Render `<NormalFlow/>`. Assert `<CameraDeniedBanner/>` is present.
   - Simulate the banner's "처음으로 돌아가기" button click. Assert `router.push` (or `<Link href="/">`) was called/rendered with `"/"`.
5. **NEW — Camera stream not interrupted across 4 cuts** (maps spec criterion: "4컷이 모두 캡처될 때까지 카메라 스트림이 끊기지 않는다"):
   - Mock `useCamera` to expose spies on `start` and `stop`.
   - Drive the reducer through 4 full capture cycles (countdown → flash → preview → next) using fake timers.
   - **Assertion shape**: `expect(useCameraSpies.start).toHaveBeenCalledTimes(1)` and `expect(useCameraSpies.stop).toHaveBeenCalledTimes(0)` until phase transitions to `composing` or `qr`. Equivalently/additionally: `videoRef.current` reference is identical at the start of cut 1 and at the start of cut 4 (no remount).

#### 4.2.7 `components/BoothPageRouter.test.tsx`
Suspense-pattern test: `?mode=themed` → `<ThemedFlow/>`; `?mode=normal` → `<NormalFlow/>`; missing/invalid → `<ThemedFlow/>` fallback. No render error during searchParams resolution.

#### 4.2.8 `app/__tests__/page-mode-select.test.tsx`
`/` renders `<ModeSelect/>`; legacy 7-frame menu absent.

### 4.3 Acceptance criterion → test mapping (full table)

| Spec acceptance criterion | Test file | Notes |
|---|---|---|
| `/` shows mode-select, not 7컷 메뉴 | `app/__tests__/page-mode-select.test.tsx` | |
| 도전 챌린지 선택 → 기존 흐름 100% 동일 (회귀 없음) | full themed suite stays green | Migration Runbook gates this |
| 폴라로이드 선택 → 4컷 흐름 진입 | `components/BoothPageRouter.test.tsx` + `NormalFlow.test.tsx` | |
| 두 모드 모두 카메라 권한 거부 → 모드 선택 복귀 | `NormalFlow.test.tsx` deny-path describe; themed equivalent already covered | §4.2.6 case 4 |
| 폴라로이드 모드 카메라 위 frame `<img>` 미렌더 | `NormalFlow.test.tsx` clean-viewport assertion | §4.2.6 case 2 |
| 카운트다운→플래시→미리보기 4회 반복 후 합성 | `NormalFlow.test.tsx` 4-cycle integration | §4.2.6 case 5 (also covers next row) |
| 4컷 동안 카메라 스트림 끊기지 않음 | `NormalFlow.test.tsx` start/stop spy | §4.2.6 case 5 |
| 결과 PNG 정확히 1080×1440 | `lib/overlay-composer.test.ts` | dimension check |
| 4개 사진 영역이 좌표/회전대로 배치 | `lib/overlay-composer.test.ts` pixel-sample | §4.2.2 |
| 오버레이 PNG가 알파 합성되어 가시 | `lib/overlay-composer.test.ts` | sample non-cell pixel = cream |
| 셀 영역이 검정/빈 알파 아님 | `lib/overlay-composer.test.ts` black-pixel-ratio | §4.2.2 threshold |
| 합성 시간 ≤ themed | `lib/overlay-composer.test.ts` benchmark | §4.2.2 baseline |
| `/api/captures` 업로드 + QR 표시 | manual smoke + reuse existing `upload-sheet` tests | |
| QR 화면에 1080×1440 미리보기 깨짐 없음 | manual smoke | |
| "처음으로 돌아가기" → `/` | `NormalFlow.test.tsx` (and existing themed coverage) | |
| `lib/overlay-composer.ts` 단위 테스트 존재 | `lib/overlay-composer.test.ts` | §4.2.2 |
| `lib/normal-layout.ts` 좌표 상수 검증 | `lib/normal-layout.test.ts` | §4.2.1 |
| 모드 선택 페이지 렌더 + 라우팅 | `components/ModeSelect.test.tsx` | §4.2.4 |
| 도전 챌린지 회귀 (104 tests) | full suite via Migration Runbook | §6.2 |

### 4.4 Canvas/jsdom mocking strategy
Same as v2 §4.3 — pixel-level outcome assertions preferred; transform-matrix call recording only as fallback.

### 4.5 Manual / e2e smoke
Same as v1 §4.4.

---

## 5. Pre-coding Gates (NEW — addresses Critic Minor #6)

**Implementation MUST NOT begin until both items below are explicitly confirmed by the user.** These are not deferred follow-ups; they are blocking inputs.

### 5.1 Caption text confirmation
- Spec Open Item #1: caption is `♡ OZCODINGG PD09 ♡` (G doubled) per Round 4 reference image. Determine: **`OZCODING` or `OZCODINGG`?**
- Why blocking: caption is baked into `public/overlays/normal.png`. Wrong text means re-cutting the asset and re-running the test fixture.
- Owner: designer / user.

### 5.2 `/` route ownership decision
- Spec Open Item #4: existing idle screen (7-cut menu + start button) at `/` is currently the entry. After mode-select replaces `/`:
  - **Option (a)**: idle screen survives as themed mode's pre-screen, reachable from the themed card via a 2-step flow.
  - **Option (b)** (plan default): idle screen is removed; themed card routes directly to `/booth?mode=themed`. UX contract change.
- Why blocking: choice changes which file `<ModeSelect/>` replaces, whether `IdleScreen` body is deleted or relocated, and whether existing themed-mode tests need to traverse a new screen. Critic flagged that this changes `/` UX contract and must be confirmed before code begins.
- Owner: user / UX.

---

## 6. Migration Runbook (NEW — addresses Critic Risk #9)

After **each phase below** of implementation, run:
```sh
npm test -- --run
```
and verify the **104-test themed baseline stays green**. If any themed test fails, the phase is **blocked** until either (a) the change is reverted, or (b) the regression is fixed. Do not proceed to the next phase with a red baseline.

### 6.1 Phase order with checkpoints

- **Phase 0 — Baseline measurement**:
  1. Run `npm test -- --run`. Record green count (expect 104).
  2. Run themed compose benchmark once: instrument `lib/sheet-composer.test.ts` (or a one-off scratch) to measure `composeSheet` median over 5 runs. Write the median into `lib/__benchmarks__/themed-compose-baseline.ts` as `THEMED_COMPOSE_MEDIAN_MS`. Commit.
  3. Checkpoint: `npm test -- --run` still green; 104 → 104.

- **Phase 1 — Pure additions (no themed file edits)**:
  - Add `lib/booth-mode.ts`, `lib/normal-layout.ts`, `lib/overlay-composer.ts`, plus their `.test.ts` siblings.
  - Add `components/ModeSelect.tsx` + `.test.tsx`.
  - Checkpoint: `npm test -- --run` ≥ 104 (new tests bring count up).

- **Phase 2 — `lib/session-machine.ts` factory addition**:
  - Add `createInitialState(totalCuts)`, `createReducer(totalCuts)`, `THEMED_CUTS`, `NORMAL_CUTS`. Existing exports preserved.
  - Checkpoint: `npm test -- --run`. `session-machine.test.ts` must still pass with no edits.

- **Phase 3 — `lib/capture.ts` sibling addition**:
  - Add `captureRawCut({ video })`. Existing `captureCut` untouched.
  - Add `captureRawCut` cases to `lib/capture.test.ts`.
  - Checkpoint: `npm test -- --run`. Existing 18 `captureCut` cases must still pass.

- **Phase 4 — Flow components**:
  - Create `components/ThemedFlow.tsx` (migrate body from `app/booth/page.tsx` verbatim).
  - Create `components/NormalFlow.tsx` (with `<CleanCameraViewport/>` per §2.6).
  - Create `components/BoothPageRouter.tsx` + `app/booth/page.tsx` Suspense wrapper.
  - Add their three `.test.tsx` files.
  - Checkpoint: `npm test -- --run`. Themed Flow tests must reproduce equivalent assertions; full suite green.

- **Phase 5 — Replace `/`**:
  - Switch `app/page.tsx` to render `<ModeSelect/>` (per §5.2 confirmed option).
  - Add `app/__tests__/page-mode-select.test.tsx`.
  - Checkpoint: `npm test -- --run` green.

- **Phase 6 — Asset + final smoke**:
  - Drop in real `public/overlays/normal.png` once designer delivers.
  - Manual e2e smoke per §4.5.
  - Final `npm test -- --run` green.

---

## 7. Open Items / Follow-ups (truly deferred only)

Pre-coding gates have been moved to §5 and are no longer listed here.

Remaining deferred:
1. **Mode-select layout (Spec Open Item #2):** two-card centered (default) vs two-button row — UX call.
2. **Cell coordinates + rotation angles (Spec Open Item #3):** designer to deliver alongside overlay PNG; mock placeholders in `lib/normal-layout.ts`.
3. **Regression CI gate (Spec Open Item #5):** confirm CI blocks merge if any of 104 tests fail.
4. **Mock-overlay generation:** hand-author or in-browser scratch HTML.
5. **Naming of Suspense wrapper:** `<BoothPageRouter/>` proposed.
6. **Default mode when `?mode` absent/unknown:** plan defaults to `"themed"`.
7. **Canvas transform-matrix mocking** (pixel-level preferred; recorder fallback).

> Pre-coding gates from §5 will also be reflected in `.omc/plans/open-questions.md` under a v3 section.

---

## 8. Critic Round-2 Fix Summary

| # | Critic finding | Where addressed |
|---|---|---|
| Major 1 | Compose-time benchmark | §4.2.2 (file, baseline, tolerance, assertion) |
| Major 2 | CleanCameraViewport responsibilities | §2.6 (6-item checklist) |
| Major 3 | Pixel-sampling test specifics | §4.2.2 (coords, colors, tolerance, threshold formula) |
| Minor 4 | Drop phantom `app/booth/__tests__/*` refs | §4.1, §7 (removed) |
| Minor 5 | Drop LiveOverlay hedge in §2.1 | §2.1 (corrected NormalFlow row) |
| Minor 6 | Surface 2 Open Items as pre-coding gates | §5 (new section) |
| Missing 7 | Camera-deny → mode-select test | §4.2.6 case 4 |
| Missing 8 | 4-cuts stream-not-interrupted test | §4.2.6 case 5 |
| Risk 9 | Migration runbook with `npm test` checkpoints | §6 (new section) |

Disagreements with Critic: **none**. All 9 findings adopted as written.

---

## Architect Re-Review (round 3)

### v3 deltas vs v2 — architectural impact
- **§2.1 NormalFlow row hedge dropped (Minor #5):** none — purely a wording cleanup; commits to inline `<CleanCameraViewport/>` matching v2's adopted approach.
- **§2.6 CleanCameraViewport responsibility list (Major #2):** none — six items map 1:1 to `LiveOverlay.tsx` behaviors (`scaleX(-1)`, `objectFit: cover`, `autoPlay/muted/playsInline`, badge, aspect container). Aspect string `"576/720"` numerically equals LiveOverlay's `"720/900"` (both 0.8); consistent with `captureRawCut` output `CUT_WIDTH=576 × CUT_HEIGHT=720` (`lib/capture.ts:30-32`). No `useCamera` contract conflict — `<CleanCameraViewport/>` only consumes `videoRef`, identical to LiveOverlay.
- **§4.2.2 pixel-sample coords (Major #3):** none — coords explicitly read from `lib/normal-layout.ts` cell rects with `(rect.x + rect.width/2, rect.y + rect.height/2)`; placeholder numbers are illustrative only. Single source of truth preserved, no drift risk.
- **§4.2.2 compose-time benchmark (Major #1):** minor — `performance.now()` in jsdom is monotonic and millisecond-resolution but susceptible to CI noise on shared runners. The `PARITY_TOLERANCE = 1.2` band partially absorbs this; `median-of-5` further dampens. Acceptable risk for a SHORT-tier refactor; if flake emerges, Critic should suggest skip-on-CI fallback or raise tolerance to 1.5×.
- **§5 pre-coding gates (Minor #6):** none — both gates (5.1 caption text, 5.2 `/` route ownership) are concrete user-facing questions with explicit owners, not internal notes. Correct shape.
- **§6 migration runbook (Risk #9):** none — phase order respects dependencies: Phase 0 baseline → Phase 1 pure additions (`booth-mode.ts` lands here, before any consumer) → Phase 2 reducer factory → Phase 3 capture sibling → Phase 4 Flow components consume all priors → Phase 5 swaps `/` → Phase 6 asset+smoke. `lib/booth-mode.ts` correctly precedes `BoothPageRouter` (Phase 1 vs Phase 4). `npm test -- --run` checkpoint after each phase is defensive and correct.
- **§4.2.6 cases 4 & 5 (Missing #7, #8):** none — deny-path uses `<CameraDeniedBanner/>` (already tested at `components/CameraDeniedBanner.test.tsx`); stream-not-interrupted asserts via `useCamera` start/stop spies + `videoRef` identity. Both shapes are testable with existing mocking patterns.
- **§4.1 phantom dir cleanup (Minor #4):** none — `app/booth/__tests__/*` reference fully removed; verified only `lib/*.test.ts` and co-located `components/*.test.tsx` exist.

### New concerns (if any)
- **One testid mismatch:** v3 §2.6 item 4 and §4.2.6 case 2 reference `data-testid="live-overlay-frame-img"`, but the actual testid in `components/LiveOverlay.tsx:98` is `live-overlay-frame` (no `-img` suffix). The `<video>` testid is `live-overlay-video`. Minor doc-only bug — the assertion intent ("no character-frame `<img>` is rendered in normal mode") is correct; only the literal testid string needs updating. Critic should flag as a 1-character fix at test-authoring time, not a blocker.
- **Benchmark CI fragility (re-flagged):** `THEMED_COMPOSE_MEDIAN_MS` measured on Phase 0 reference machine but assertion runs on whatever CI runner executes the test. If CI has different CPU profile, the absolute number is wrong. The 1.2× tolerance is *relative* (themed×1.2), which mostly absorbs this since both medians scale together — but only if Phase 0's measurement and the test run on the same machine class. Recommend Critic ask Planner to clarify: is `THEMED_COMPOSE_MEDIAN_MS` re-measured per-CI-run (in `beforeAll`) or pinned to a constant? If pinned, tolerance should be 1.5× to absorb runner variance.

### Verdict
**AGREE — proceed to Critic**: v3 absorbs all 9 Critic findings without architectural drift; the two residuals (testid string typo, benchmark constant-vs-dynamic clarification) are sub-blocker doc/test-tactics issues that Critic can flag inline.

---

## Critic Review (round 3)

### v2 ITERATE items — fixed status
1. Compose-time benchmark: **fixed** — §4.2.2 specifies file (`lib/__benchmarks__/themed-compose-baseline.ts`), median-of-5 sampling, 1.2× tolerance, populated by Migration Runbook Phase 0. Tolerance is fragile in CI (see Architect flag #1).
2. CleanCameraViewport responsibilities: **fixed** — §2.6 lists all 6 items concretely (aspect, mirror, video attrs, testid, badge, cover-fit).
3. Pixel-sample coords + tolerance + black-pixel threshold: **fixed** — §4.2.2 reads coords from `lib/normal-layout.ts`, ±4 per channel tolerance, black ratio < 5% with formula.
4. Phantom test directory: **fixed** — §4.1 explicitly drops `app/booth/__tests__/*`; verified no such dir exists; §7 no longer lists migration burden.
5. NormalFlow LiveOverlay hedge: **fixed** — §2.1 corrected row commits to inline `<CleanCameraViewport/>`, full stop.
6. Pre-coding gates as blocking subsection: **fixed** — §5 with two user-facing questions (caption text, `/` route ownership) and explicit owners.
7. Camera-deny → mode-select test: **fixed** — §4.2.6 case 4 with `"camera-deny → mode-select"` describe, `router.push("/")` assertion.
8. Stream-not-interrupted test: **fixed** — §4.2.6 case 5 asserts `start.toHaveBeenCalledTimes(1)`, `stop.toHaveBeenCalledTimes(0)`, plus `videoRef` identity.
9. Migration runbook with `npm test` checkpoints: **fixed** — §6 has Phases 0–6, each with `npm test -- --run` checkpoint and red-baseline blocking rule.

### Architect's two flags — addressed?
1. Benchmark CI robustness: **not addressed** — `THEMED_COMPOSE_MEDIAN_MS` is a pinned constant (§4.2.2 baseline file), 1.2× tolerance unchanged. Real CI runners will drift. Open Item: re-measure themed median in `beforeAll` of the same test run for relative comparison, OR loosen tolerance to 1.5×.
2. testid string mismatch: **not addressed** — verified `components/LiveOverlay.tsx:98` is `data-testid="live-overlay-frame"`, but §2.6 item 4 and §4.2.6 case 2 still say `live-overlay-frame-img`. 1-character doc bug.

### New issues
None beyond the two Architect flags.

### Verdict
**APPROVE**: All 9 v2 ITERATE items genuinely fixed; Architect's two flags are sub-blocker (test-authoring tactics, not architecture) and noted as Open Items. Proceed to autopilot.

### Open Items the user must resolve before autopilot launches
- **§5.1 caption gate** (`OZCODING` vs `OZCODINGG`) — blocks asset.
- **§5.2 `/` route ownership** — blocks Phase 5 file targeting.
- **Benchmark CI tactic** (Architect flag #1): pick re-measure-in-`beforeAll` (preferred) or loosen tolerance to 1.5×. v3.1 patch in `lib/overlay-composer.test.ts` only.
- **testid string fix** (Architect flag #2): replace `live-overlay-frame-img` with `live-overlay-frame` in §2.6 item 4 and §4.2.6 case 2 at test-authoring time.

### Final ADR — confirmed
v3 §3 ADR is complete (Decision, Drivers, Alternatives, Why chosen, Consequences, Follow-ups). Architecture: Option B-prime (thin `<BoothPageRouter/>` + `<ThemedFlow/>` / `<NormalFlow/>` per-mode subcomponents, shared `useCamera` + `createReducer(totalCuts)` factory + `<CabinetChrome>` shell, direct compositor imports, `captureCut` + new `captureRawCut` siblings, `LiveOverlay.tsx` byte-identical, `<CleanCameraViewport/>` inline). No tightening needed.

**Mode operated**: THOROUGH (no CRITICAL findings, ≤2 MAJOR-equivalent residuals — Architect flags rated MINOR after Realist Check: benchmark constant produces test flake, not runtime failure; testid is doc-only).

---

## Consensus reached ✅

- Planner v3 → Architect AGREE → Critic APPROVE
- 2 iterations within max-5 loop
- Plan file: `.omc/plans/normal-mode-plan-v3.md`
- Pre-autopilot blockers: §5.1 caption + §5.2 `/` route ownership (both user decisions)
