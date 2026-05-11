# Critic Consensus Review — Y2K Photobooth Plan

**Plan reviewed:** `.omc/plans/y2k-photobooth-plan.md`
**Spec source:** `.omc/specs/deep-interview-y2k-photobooth.md` (ambiguity 9%, PASSED)
**Architect verdict:** ITERATE
**Mode:** `--consensus`
**Reviewer role:** Critic (final quality gate)

---

## Verdict

**ITERATE** — plan is structurally competent and ships in 8 days, but it has the 5 Architect-flagged issues plus 4 additional gaps independently surfaced. Architect's verdict was correct; rubber-stamping is not warranted, but rejection would be over-rotation — the bones are sound.

---

## Pre-commitment Predictions vs Findings

Predicted likely problem areas before reading in detail:
1. Idle-timer state-gating — **Architect found, confirmed.**
2. Tunnel env-var build-time vs runtime — **Architect found, confirmed.**
3. Mirror policy unspecified — **Architect found, confirmed.**
4. Aspect-ratio reconciliation between mockup and spec — **Architect found, confirmed (sheet-mockup.png is 720×1800 RGB, aspect 0.4 vs spec aspect 0.45 — different aspects, not just different scales).**
5. Per-cut data type contract (`ImageBitmap` vs `Blob`) — **Independently surfaced; not flagged by Architect.**
6. Accessibility / countdown contrast — **Independently surfaced.**
7. Mid-event crash recovery — **Independently surfaced.**
8. `public/captures/` cleanup intent — **Independently surfaced.**
9. Concurrent capture / DPR crop alignment — **Architect mentioned, but I escalate DPR to CRITICAL.**

---

## Quality Scorecard

| # | Criterion | Score | Justification |
|---|-----------|-------|---------------|
| 1 | Principle-Option consistency | **2/5** | Principle 4 ("event-day reliability") is contradicted by Risk #7's own escape hatch ("fall back to Option B if HMR breaks camera") — recommended option's mitigation is "switch stacks." |
| 2 | Fair alternatives treatment | **3/5** | A vs B is dimensionally fair; A's pros lean on "spec recommendation + familiarity" (authority arguments). C correctly invalidated with hard math (QR Version 40 ≈ 2.9 KB). |
| 3 | Risk mitigation clarity | **3/5** | Risks 1–4, 6 are concrete. Risk 5 ("tunnel drops") relies on a 60-sec restart procedure that is broken by the build-time env-var bug. Risk 7 mitigation is a stack swap, not a fix. |
| 4 | Testable acceptance criteria | **4/5** | All 11 ACs map to milestones in §3. AC#11 only manual-tested. AC#3 (transparent pink) has no automated visual diff — acceptable for one-event MVP. |
| 5 | Verification steps concreteness | **4/5** | Manual smoke checklist in §5 is operator-grade. Missing: mid-event crash procedure and ngrok-URL-change re-verification (which is impossible without rebuild given the env-var bug). |
| 6 | Scope discipline | **5/5** | §6 enumerates plan-internal scope cuts beyond spec Non-Goals. No spec requirement dropped. No scope creep. |
| 7 | File-level concreteness | **4/5** | Most files named with absolute paths and responsibilities. M4→M5 type handoff is implicit (`ImageBitmap`). No `lib/types.ts`. UUIDv4 collision/atomicity not discussed. M5's "math finalized in implementation" hides a real decision. |
| 8 | Effort estimation realism | **3/5** | Single "MEDIUM" badge. No per-milestone hours. M2+M3+M4+M5+M8 are non-trivial and the Architect-required additions inflate them. No buffer reserved for T-24h smoke test in §5. |

**Sub-criteria scoring < 4 — required revisions:**
- **#1 Principle consistency**: Replace Risk #7's "fall back to Option B" with an in-stack fix (lock to `next start`, never `next dev` for camera testing; `dynamic = 'force-dynamic'` on `/api/captures`).
- **#2 Fair alternatives**: Re-rank Option A vs B with the same evaluation dimensions (cold-start time, RSC/cache risk, dev-mode HMR risk, time-to-ship). "Spec recommendation" is not architecture.
- **#3 Risk mitigation clarity**: Risk 5 must be revised in lockstep with Architect Synthesis #1 (server-derived public URL via Host header). Risk 7 must be replaced with an in-stack mitigation OR the stack changed to Option B.
- **#8 Effort estimation**: Add concrete day-budget per milestone. Add T-3day, T-1day, T-day-of checkpoints. Reserve a half-day buffer.

---

## Critical Revisions Required

1. **(M7 + M6) Replace `NEXT_PUBLIC_TUNNEL_ORIGIN` with server-derived origin from request `Host` header.** Plan line 210 — build-time inlining means rebuild-on-tunnel-restart, which directly invalidates Risk #5's "60-second restart procedure." Architect's Synthesis #1 is the right fix.

2. **(M2 + M4) Add explicit selfie-mirror policy.** Plan is silent. Add `MIRROR_PREVIEW = true` constant in `lib/frames.ts`, CSS `transform: scaleX(-1)` on `<video>`, matching `ctx.translate(720,0); ctx.scale(-1,1)` before video draw in `captureCut`, then reset transform before drawing the frame PNG.

3. **(M5) Resolve sheet-mockup vs spec aspect mismatch BEFORE M5 starts.** Independently verified: `sheet-mockup.png` is 720×1800 (aspect 0.4) vs spec 1080×2400 (aspect 0.45). These are *different aspects*. Plan's "math finalized in implementation" hides a visual-fidelity decision. Lock cell math (`540×600` cells, `720×900` cuts → cropped or letterboxed) in `lib/sheet-composer.test.ts` before any pixels are drawn. Either re-export the mockup at 1080×2400 or formally document that the mockup is illustrative only.

4. **(M8) State-gate the idle timer.** Plan line 222 wires the timer globally; firing during countdown will eject mid-session users. Gate to states `{idle, qr-display}` only. Pass current state into the hook and `clearTimeout` on every transition into `{countdown, flash, preview, composing}`.

5. **(M2 + M8) Expand camera lifecycle for 4 events.** Plan only mentions "clean up MediaStream on unmount." Add handlers for `visibilitychange` (tab hidden/visible), `MediaStreamTrack.onended` (another tab stole the camera), `permissions.query({name:'camera'})` (revoke detection), `navigator.mediaDevices.ondevicechange` (USB webcam unplug).

6. **(M2 + M4) DPR / source-vs-displayed crop alignment specification.** [Independently surfaced; promoted to CRITICAL.] Plan's "cover-fit math" needs a concrete spec: displayed `<video>` element's CSS `object-fit: cover` clip must match `drawImage`'s sx/sy/sw/sh exactly. On a Retina/HiDPI laptop, mismatch causes user's preview alignment to differ from captured cut — visible UX bug guaranteed. Add explicit pixel-math comment to `captureCut` referencing the DOM-displayed crop.

---

## Additional Gaps Not Flagged by Architect

1. **No shared `Cut` / per-cut data-type contract.** [MAJOR] M4 returns `Promise<ImageBitmap>` (line 158) with comment "or `toBlob` if we want disk." M5 takes `ImageBitmap[]` (line 174). State machine in M3 holds an array. No `lib/types.ts` or interface declaration for `Cut { index, bitmap, capturedAt, frameId }`. **Fix:** Add explicit `lib/types.ts` with `Cut`, `Session`, `OutputSheet` interfaces matching the spec's Ontology (spec lines 113–125). *Mitigated by:* one-dev single-sprint code typically shakes out implicit types within first integration test.

2. **No mid-event crash / restart procedure.** [MAJOR] README (M9) covers cold boot and post-event teardown but not "Node process died at 2pm with 30 people in line." Whether `pm2`-style auto-restart is in scope or operator just runs `npm start` again — unaddressed. *Mitigated by:* operator likely knows to run `npm start` again, but undocumented for non-author operators. **Fix:** Add a "if the booth crashes" subsection to M9 README with explicit recovery steps and a note that previously-saved PNGs in `public/captures/` survive the restart (so previously-handed-out QRs still resolve).

3. **No accessibility considerations.** [MINOR] Spec doesn't require WCAG. M3 says "huge centered numeral with Y2K glow" — no contrast ratio, no minimum font size. Diverse event attendees may have low vision or color-vision deficiency. **Fix:** State minimum countdown text size (~30vh) and contrast (≥4.5:1 against the camera feed via solid background or text shadow). *Mitigated by:* event-day, short-duration, non-mandatory.

4. **No explicit cleanup decision for `public/captures/`.** [MINOR] Risk #6 says disk fine; spec line 38 says "결과 유효 기간: 노트북/터널 살아 있는 동안" justifies keeping all files. Plan never explicitly states the design intent. **Fix:** Add to §6: "captured PNGs persist for entire event lifetime; no per-session cleanup; post-event manual `rm -rf` covered in M9 teardown." *Mitigated by:* Risk #6's disk math is correct.

5. **`captureCut` resolution loss / sheet sharpness.** [MINOR] M4 draws video into 720×900 canvas; M5 downscales each cut to 540×600. Per-cut resolution is 540×600 — user's *face* is <0.4MP. **Fix:** Pre-event smoke test should include "zoom in to a face on the saved PNG; is it sharp enough to share?" *Mitigated by:* spec doesn't mandate per-cut resolution; 540×600 adequate for phone viewing.

6. **No collision/atomicity discussion for `public/captures/{uuid}.png`.** [MINOR] M6 uses UUIDv4 (1 in 10^36 collision probability — fine). But there's no atomic write strategy: a partial write + immediate fetch = corrupted PNG. **Fix:** Write to `{uuid}.png.tmp` then `fs.rename` (atomic on same filesystem). 2 lines in `app/api/captures/route.ts`.

---

## What's Strong (don't churn on this)

- **§6 (Out of Scope)** is exemplary: distinguishes spec Non-Goals from plan-internal cuts. No invented goals.
- **§3 (AC → Implementation Map)** is the right level of detail and traceable.
- **Option C invalidation via QR Version 40 ≈ 2.9 KB math** is the kind of concrete invalidation that justifies recommending Option A over B at all.
- **Per-cut timing budget in M3** (3.9s × 7 = 27s, headroom to 90s) is exemplary plan discipline.
- **Manual smoke checklist in §5** is operator-grade — a junior dev could execute it on event day.
- **Non-recommendation of XState** (line 142) is a correct anti-over-engineering call given the linear state graph.
- **`lib/frames.ts` as single source of truth** (Principle 5) is the right architectural call and is honored consistently across milestones.
- **Spec compliance** — all 11 acceptance criteria mapped to at least one milestone with primary files. No spec requirement was dropped.
- **M0 explicit "starts from empty repo" note** (line 79) catches the most-common rubber-stamp failure.

---

## Multi-Perspective Notes

- **Executor**: With the Architect's 5 fixes + Critic's #6 (DPR) + the type contract (#1 in additional gaps), a junior dev can execute. Without those, M4↔M5 type handoff and DPR alignment will produce confused questions. Effort estimation needs day-budgets per milestone.
- **Stakeholder**: Plan delivers the spec's MVP. Hits all 11 ACs. Scope is appropriate for one event. Vanity metrics absent — measurable success criteria everywhere. Solid.
- **Skeptic**: The "recommendation by spec authority" reasoning for Option A (§1.Recommendation) is the weakest argument in the plan. Spec line 29 explicitly lists Next.js *or* SPA+static as equivalents. The Architect's antithesis on this point is correct: if Risk #7 needs an Option-B escape hatch, why is Option A the recommendation? Either commit to Option A with an in-stack mitigation, or pivot.

---

## Verdict Justification

Operated in **THOROUGH** mode (escalation criteria not met — 6 CRITICAL/MAJOR is below the systemic-issue threshold). One Architect-flagged item (DPR/crop alignment) was promoted from MAJOR to CRITICAL because it produces a guaranteed visible UX bug on Retina laptops.

**Realist Check applied:**
- Critical revisions #1–#6 retained at CRITICAL because each will fail visibly on event day in front of attendees.
- Added gap #1 (`Cut` type contract) downgraded to MAJOR — *Mitigated by:* implicit types typically resolve in first integration test for one-dev code.
- Added gap #2 (mid-event crash) retained as MAJOR — *Mitigated by:* operator likely knows to restart, but undocumented for non-author operators.
- Added gap #3 (accessibility) downgraded to MINOR — *Mitigated by:* spec doesn't require WCAG; event is short-duration.
- Added gap #4 (cleanup hook) downgraded to MINOR — *Mitigated by:* Risk #6's disk math is correct.
- Added gap #5 (resolution loss) downgraded to MINOR — *Mitigated by:* 540×600 adequate for phone viewing.
- Added gap #6 (atomic write) downgraded to MINOR — *Mitigated by:* the read-after-write window is small and a corrupted-PNG retry from the user's QR scan is recoverable.

**To upgrade to APPROVE:** Fix Architect's 5 CRITICALs + Critic's CRITICAL #6 (DPR/crop spec) + add `lib/types.ts` (additional gap #1). The remaining items are polish/nice-to-have for an 8-day single-event sprint.

---

## Open Questions (unscored)

- Is a CSS-only QR feasible? **Verified: no.** QR codes require deterministic dot-matrix rendering with Reed-Solomon error correction; `qrcode` npm dep is correct.
- Should the booth pre-warm camera on the start screen? Spec AC#1 mandates user-gesture (시작 클릭). Plan respects this.
- Does `<video autoPlay muted playsInline>` work in Chromium kiosk mode without `--autoplay-policy=no-user-gesture-required`? Likely yes in recent Chromium, but worth a runbook note.
- Is the operator on event day the same person who built the booth? Affects how much the README needs to spell out (e.g., the mid-event crash recovery).

---

## Ralplan Summary Row

- **Principle/Option Consistency**: **Fail** — Risk #7's mitigation contradicts Principle 4.
- **Alternatives Depth**: **Pass-with-reservations** — A/B compared on weak common dimensions; C invalidated with hard math.
- **Risk/Verification Rigor**: **Pass-with-reservations** — Risk 5 + 7 mitigations need rework; smoke checklist is solid.
- **Deliberate Additions (if required)**: N/A — `--consensus` did not specify deliberate-mode pre-mortem requirement; plan does not include a separate pre-mortem section, only forward risks.

---

## References

- `.omc/specs/deep-interview-y2k-photobooth.md:29` — spec lists Next.js *or* SPA+static as equivalents.
- `.omc/specs/deep-interview-y2k-photobooth.md:34` — output PNG mandated 1080×2400.
- `.omc/specs/deep-interview-y2k-photobooth.md:113-125` — Ontology with `Cut`, `Session`, `OutputSheet` entities (no shared types in plan).
- `.omc/plans/y2k-photobooth-plan.md:73` — Risk #7 self-flags HMR+camera incompatibility with Option B as fallback.
- `.omc/plans/y2k-photobooth-plan.md:158-162` — `captureCut` returns `ImageBitmap`; type contract not formalized.
- `.omc/plans/y2k-photobooth-plan.md:174` — `composeSheet` takes `ImageBitmap[]`; coupled to M4 implicitly.
- `.omc/plans/y2k-photobooth-plan.md:178-183` — sheet-composer cell math left "to implementation"; mockup mismatch unaddressed.
- `.omc/plans/y2k-photobooth-plan.md:210` — `NEXT_PUBLIC_TUNNEL_ORIGIN` build-time inline issue.
- `.omc/plans/y2k-photobooth-plan.md:222` — idle timer not state-gated.
- `/Users/a1111/Desktop/ozcoding-pd09-booth/sheet-mockup.png` — independently verified 720×1800 RGB.
- `/Users/a1111/Desktop/ozcoding-pd09-booth/burger.png` — independently verified 720×900 RGBA.
- `/Users/a1111/Desktop/ozcoding-pd09-booth/title-card.png` — independently verified 720×900 **RGB** (no alpha; passthrough fine but worth noting).

---

## Iteration 1 Re-review

**Mode:** `--consensus` re-review (1/5)
**Plan version reviewed:** Revision 1 (`y2k-photobooth-plan.md` lines 1–523)
**Architect verdict on same revision:** ITERATE (2 blockers)
**Date:** 2026-05-06

---

### Verdict

**ITERATE** — Architect's two blockers are independently confirmed with hard arithmetic. Five of six original CRITICALs land cleanly; one (DPR/cover-crop) is PARTIAL because the helper *contract* is correct but the *fixture numbers* are wrong. A third blocker uncovered by independent simulation: the frame-PNG draw in `captureCut` non-uniformly stretches the frame by 12% (frame aspect 0.800 vs cut canvas aspect 0.900). Three optional gaps from the user's checklist remain unaddressed.

---

### Verification of prior 6 critical revisions

| # | Revision | Status | Evidence |
|---|----------|--------|----------|
| 1 | M6/M7 server-derived publicUrl | **PASS** | Lines 254–273: `X-Forwarded-Host` priority, `X-Forwarded-Proto` resolution, atomic `.tmp.png` → `fs.rename` (line 263). `lib/public-url.ts` deleted (line 287). |
| 2 | M2+M4 selfie-mirror policy | **PASS** | Line 122 (`MIRROR_PREVIEW = true`), line 188 ("captured cut is **un-mirrored**"), test at line 198 (red pixel stays red — load-bearing regression guard). |
| 3 | M5 sheet-aspect resolution | **PARTIAL** | Spec-wins decision is sound (line 213). Cell math (508×576) is internally consistent and asserted in tests. **But:** plan calls 540×600 → 508×576 a "lossless ratio" (line 222) — verified false: H=0.9407, V=0.9600, ~2% non-uniform compression. |
| 4 | M8 idle-timer state-gating | **PASS** | Lines 161–164 gate to `{idle, qr-display, camera-priming-error}`; tests at 432–433 explicitly negate `countdown\|flash\|preview\|composing`. |
| 5 | M2+M8 camera-lifecycle 4 events | **PASS** | Lines 132–136 enumerate all four events with concrete recovery + user-visible state. `permissions.query` polling on focus is the right call vs. flaky `change` event. |
| 6 | M2+M4 DPR / cover-crop spec | **PARTIAL→FAIL** | Pure helper `lib/cover-crop-math.ts` contract correct (line 141). **Test fixtures wrong** (lines 201–203): see "Architect's blockers" below. |

### Verification of 4 additional Critic gaps

| # | Gap | Status | Evidence |
|---|-----|--------|----------|
| 1 | Shared `lib/types.ts` (Cut/Session/OutputSheet) | **PASS** | Lines 333–378 add full type module with `MIRROR_PREVIEW`, `Frame`, `Cut`, `SessionState`, `OutputSheet`, `CaptureRecord`. Cross-referenced from every milestone (line 380). |
| 2 | Mid-event crash recovery (M9) | **PASS** | Lines 320–321 add explicit "Crash recovery (NEW)" subsection: kill `next start`, `npm run kiosk` again, surviving PNGs note. |
| 3 | `public/captures/` cleanup intent | **PASS** | Risk #6 line 414 explicitly cites spec line 38; §6 implicit; M9 teardown line 324 covers post-event `rm -rf`. |
| 4 | Atomic write for PNGs | **PASS** | Line 263: `.tmp.png` → `fs.rename`. Concurrent-reader semantics documented. |

---

### Confirmation of Architect's two blockers (independent computation)

**Blocker A — Cover-crop fixture arithmetic (M4):** **CONFIRMED.**

Computed from first principles using `scale = max(dstW/srcW, dstH/srcH); sw = dstW/scale; sh = dstH/scale; sx = (srcW-sw)/2; sy = (srcH-sh)/2`:

| Test | Plan asserts | Correct | Verdict |
|------|--------------|---------|---------|
| 1280×720 → 540×600 | `sx=387, sy=0, sw=506, sh=720` | `sx=316, sy=0, sw=648, sh=720` | Plan WRONG |
| 720×720 → 540×600 | `sx=0, sy=36, sw=720, sh=648` | `sx=36, sy=0, sw=648, sh=720` | Plan WRONG (axes inverted) |
| 540×600 → 540×600 | identity | identity | OK |

The Architect's published correction (sx=316, sw=648, sh=720) is arithmetically right. Plan-as-written would encode a wrong contract: helper would produce a cover-fit for some other destination aspect, and live preview alignment would not match captured cuts on day one.

**Blocker B — Aspect-chain stretch (M4 + M5):** **CONFIRMED.**

Three different aspects in the chain:
- Cut canvas: 540×600, aspect **0.900**
- Cell on sheet: 508×576, aspect **0.882** (∆ 2%)
- Frame PNG native: 720×900, aspect **0.800** (∆ 12.5% from cut)

Two non-uniform stretches:
1. **Cut → cell** (M5 line 222 `drawImage(cuts[i], 0, 0, 508, 576)`): horizontal scale 0.9407, vertical 0.9600 → **~2% horizontal squash on every face**. Plan line 222 calls this "lossless ratio" — independently verified false.
2. **Frame → cut canvas** (M4 line 195 `drawImage(frameImg, 0, 0, 540, 600)`): horizontal scale 540/720=0.750, vertical 600/900=0.667 → **~12% non-uniform stretch on the frame artwork**. The face-hole drawn at frame's native coordinates lands at the wrong relative position on the captured cut. The live preview (which sees the frame at its CSS-rendered aspect) and the saved cut see DIFFERENT face-hole geometry.

Severity: blocker B-2 is more severe than B-1. A 12% non-uniform stretch on Y2K artwork is grossly visible (Tamagotchi screen squashed to an ellipse, mic stretched to a baton). And the live↔saved alignment mismatch reintroduces the very bug Critic #6 was meant to prevent.

---

### Recommended concrete fix for the aspect chain

Pick **one** of three paths, lock before M4 starts:

**Path A (RECOMMENDED) — collapse to one aspect end-to-end (0.800, frame-native).** Cell becomes 480×600 (480/600=0.800), cut canvas becomes 480×600 native, frame draws 1:1-aspect into cut. Sheet recompute with cell 480×600:
- Cell width 480, 2 cols, gutters: total = 24·2 + 16 + 480·2 = 1024. Slack = 1080−1024 = 56 → bump margin to 24+28=52, OR keep 24 and grow gutter to 72. Cleanest: cell 484×605 with margin 24, gutter 16 → still 0.800 aspect → 24·2 + 16 + 484·2 = 1032 (slack 48). Pick exact integers in test fixture.
- Cell height 600, 4 rows, gutters: 24·2 + 16·3 + 600·4 = 2496 → exceeds 2400. So aspect 0.800 cells DO NOT fit in 1080×2400 portrait at 4 rows × 2 cols. **Path A is infeasible without dropping a row or shrinking width drastically.** Discard.

**Path B — keep cells 0.900 aspect AND letterbox the frame inside the cut canvas.** Cut canvas stays 540×600. Frame is drawn at uniform-cover-fit INSIDE 540×600 with the face-hole axis preserved. With frame aspect 0.800 < cut aspect 0.900, frame must be drawn at 540 wide × 675 tall (uniform scale 0.75), which exceeds canvas height 600 → contradiction. Alternative: scale frame to fit height (600 tall × 480 wide, scale 0.667), letterbox 30px each side. This preserves frame aspect but shrinks usable face-hole region by 11% horizontal. **Functional but cuts Y2K bling visibly.**

**Path C (PRACTICAL) — re-author or pad the frame PNGs to 0.900 aspect, adjust cell math to 0.900 native.** Two sub-options:
- **C1 (operator):** in `scripts/preprocess-frames.ts`, pad every 720×900 frame to 800×900 transparent canvas (top-left aligned face-hole preserved at the same pixel offset, just transparent margin added). New frame aspect 800/900 = 0.889 — close to cell 0.882 → ~1% horizontal shimmy, below perceptual threshold. Cell can stay 508×576, OR resize to 512×576 (aspect 0.889) for exact match: 24·2 + 16 + 512·2 = 1088 → just over 1080. Drop margin to 20: 20·2 + 16 + 512·2 = 1080. Exact fit.
- **C2 (cleanest):** make cell exactly 540×608 (aspect 0.888) and pad frame to 540×608 once in preprocessing. 24·2 + 16 + 540·2 = 1144 → exceeds 1080. So cell 480×540 (0.888): 24·2 + 16 + 480·2 = 1024 (slack 56), and 24·2 + 16·3 + 540·4 = 2256 (slack 144). Fits, but cells are smaller.

**Cleanest landing:** **C1 with cell 512×576 and outer margin 20.** Frame PNG padded once at preprocess time to 800×900 (aspect 0.889), cut canvas 512×576 (aspect 0.889), cell 512×576. End-to-end one aspect 0.889 with sub-1% residual. M4 draws video into 512×576 with cover-fit; M4 draws frame into 512×576 with uniform scale (no stretch, alpha preserves face hole at correct coords). M5 draws cuts into cell 1:1.

Recomputed cell origins for **margin 20, gutter 16, cell 512×576:**
- col0: x=20, col1: x=20+512+16=548
- row0: y=20, row1: y=612, row2: y=1204, row3: y=1796
- Bounds: x_max+W=548+512=1060 ≤ 1080 ✓; y_max+H=1796+576=2372 ≤ 2400 ✓

Lock these numbers in `__tests__/grid-math.test.ts` and `lib/cover-crop-math.test.ts` before M4 begins.

---

### Other checklist items

1. **Test directory convention** — **STILL INCONSISTENT.** Plan mixes `lib/cover-crop-math.test.ts` (line 200), `lib/capture.test.ts` (line 197), `lib/session-machine.test.ts` (line 432) with `__tests__/grid-math.test.ts` (lines 236, 393, 431). Vitest accepts both, but mixing creates split-brain coverage reports. **Fix:** pick `lib/*.test.ts` co-located convention (more idiomatic for Next.js + Vitest); move `__tests__/grid-math.test.ts` → `lib/sheet-composer.test.ts` (the file already mentions both names parenthetically at line 236, so resolution is one rename).

2. **Degenerate `Host` header silent fallback** — **STILL UNADDRESSED.** Plan line 259 says "the QR still encodes a relative-resolved URL via the client's `window.location.origin`. Documented." On the kiosk, that origin is `http://localhost:3000` — unreachable from a phone. Silent fallback hides the failure from the operator. **Fix:** API route should detect missing/loopback host and return HTTP 503 with a structured `{ error: "TUNNEL_HOST_MISSING" }`; client renders a blocker banner ("터널이 끊겼습니다 — ngrok URL 확인 후 새로고침"). Operator notices in <5s instead of handing out broken QRs for 10 minutes.

3. **AC manual-verification runbook section** — **PARTIAL.** §6 Test Plan "Manual smoke (T-24h)" (lines 441–452) covers most ACs operationally, but is not indexed against AC#1–#11. **Fix:** Add a small table to M9 README: `| AC# | How to verify on event day | Pass criterion |`, one row per spec AC. ~10 minutes to draft, doubles as the operator's pre-doors checklist.

---

### What's now genuinely solid

- Server-derived `publicUrl` resolution chain (X-Forwarded-Host → host → degenerate fallback) is correctly ordered and atomic-write semantics are sound.
- Mirror policy locked with a falsifiable test that fails specifically on the regression class.
- Idle-timer state-gating excludes all session-active states correctly.
- Camera lifecycle table is concrete, browser-API-faithful, and addresses the four real-world failure modes.
- `lib/types.ts` (lines 333–378) gives every milestone a shared contract — eliminates the implicit `ImageBitmap` type drift between M3, M4, M5.
- Crash-recovery subsection (M9 lines 320–321) is operator-grade.
- §6 Out of Scope's "No `next dev` at the event" + "No build-time env vars" lines 470–471 lock Principle 4 in place across the document.
- Risk #7 mitigation is now in-stack (production-mode + `dynamic = 'force-dynamic'`); the stack-swap escape hatch is gone.
- Five of the six original critical revisions are clean PASSes.

---

### Required changes for APPROVE

1. **Fix cover-crop test fixtures** (M4) with correct arithmetic — Architect's numbers, or a tolerance-based recomputation.
2. **Resolve aspect-chain stretch** (M4 + M5) by Path C1: pad frames to 800×900 in preprocessing, lock cell to 512×576, cut canvas to 512×576, margin 20, gutter 16 — OR explicitly accept and document residual squash with measured magnitudes (cut→cell ~2%, frame→cut ~12%) plus a UX-acceptability sign-off note.
3. **Pick one test directory convention** (`lib/*.test.ts` recommended).
4. **Fail loud on degenerate host** (M6) instead of silent localhost fallback.
5. **Add AC-by-AC manual-verification table** in M9 README.

After these, plan is APPROVE-ready. None require architectural rework; total ~2 hours of plan-edit time.


---

## Iteration 2 Re-review

**Mode:** `--consensus` re-review (2/5)
**Plan version reviewed:** Revision 2/v3 (`y2k-photobooth-plan.md` lines 1–614)
**Architect verdict on same revision:** APPROVE (with 3 non-blocking minors)
**Date:** 2026-05-06

---

### Verdict

**APPROVE** — All math independently verified from first principles. All polish items land cleanly. Architect's three non-blocking minors are correctly classified as non-blocking; none rises to event-day-reliability hazard. Plan is ready for `start-work` with one strongly-recommended one-line follow-up captured below.

---

### Math Verification (independent recomputation)

Formula applied: `scale = max(dstW/srcW, dstH/srcH); sw = dstW/scale; sh = dstH/scale; sx = (srcW-sw)/2; sy = (srcH-sh)/2` for dest = 512×576.

| # | Source | scale | sw | sh | sx | sy | Plan claim | Verdict |
|---|--------|-------|------|------|------|------|------------|---------|
| 1 | 1280×720 | max(0.4, 0.8)=**0.8** | 640.0 | 720.0 | 320.0 | 0.0 | sx=320 sy=0 sw=640 sh=720 | **PASS** |
| 2 | 720×1280 | max(0.7111, 0.45)=**0.7111** | 720.0 | 810.0 | 0.0 | 235.0 | sx=0 sy=235 sw=720 sh=810 | **PASS** |
| 3 | 720×720 | max(0.7111, 0.8)=**0.8** | 640.0 | 720.0 | 40.0 | 0.0 | sx=40 sy=0 sw=640 sh=720 | **PASS** |
| 4 | 2560×1440 | max(0.2, 0.4)=**0.4** | 1280.0 | 1440.0 | 640.0 | 0.0 | sx=640 sy=0 sw=1280 sh=1440 | **PASS** |
| 5 | 512×576 (identity) | **1.0** | 512.0 | 576.0 | 0.0 | 0.0 | identity | **PASS** |

All 5 fixtures arithmetically correct. Iteration-1 cover-crop blocker fully resolved.

**Aspect chain:**
- Width: `2·20 + 16 + 2·512 = 40 + 16 + 1024 = 1080` ✓
- Height: `20 + 3·16 + 4·576 + 28 = 20 + 48 + 2304 + 28 = 2400` ✓
- Frame uniformity: `800/512 = 1.5625` vs `900/576 = 1.5625` — identical to machine precision (residual = 0.0, not 1e-9). Zero shear.
- Cover-crop produces exact integers for all 5 fixtures (no sub-pixel residuals at all on this destination size). Better than spec'd.

**End-to-end aspect chain:** confirmed uniform 0.640× scale on frame draw, uniform 0.800× scale on cover-cropped video. All photographic content runs at aspect 0.8889 with zero non-uniform stretch. Aspect chain blocker fully resolved.

---

### Polish Verification

**3. Test directory consistency — PASS.**
`grep -n "__tests__" plan-v3` returns exactly 3 hits at lines 86, 271, 555. All three are explicit *negations* ("**No `__tests__/` directory**"). Vitest config (line 86) restricts to `lib/**/*.test.ts` and `scripts/**/*.test.ts`. Convention is locked end-to-end. No stale references.

**4. 503 error plumbing — PASS with one nit (see below).**
Full chain verified end-to-end:
- M6 route returns 503 with `{error:'tunnel-public-host-unavailable'}` (line 312).
- Korean banner copy is plain and operator-actionable: "터널 공개 호스트를 확인할 수 없습니다 — ngrok 상태와 새로고침 후 다시 시도하세요" (lines 297, 329). Tells operator both the cause (tunnel) AND two actions (check ngrok status, refresh) in plain Korean.
- `tunnel-host-error` is a first-class state in `SessionState` union (line 430).
- `TunnelHostUnavailableError` exported from `lib/types.ts` (line 446).
- Session-machine test asserts the transition (line 508).
- M9 README has a dedicated "Tunnel host failure recovery" subsection (line 366).
- **State-machine exit path:** Banner has retry button (line 329) — implicit transition back to a working state (presumably `idle` or back to compose retry). The plan does NOT explicitly document the exit transition in the state graph (line 159–163). **NIT only**: the retry button's target state is implied but not pinned. Won't break event day; should be specified in M3's reducer for completeness.

**5. AC-by-AC verification table — PASS.**
M9 §"Pre-event smoke test (T-24h)" is an 11-row table (lines 378–389). Counted independently: AC#1 through AC#11, no gaps, no off-by-one. Each row has Steps / Expected / Pass criterion.
- Self-contained for a non-dev event volunteer? **Mostly yes.** AC#7 row asks operator to "open the booth's running terminal/log" — requires terminal literacy. AC#11 row references gitignored vs on-disk persistence — developer-flavored.
- Realist check: the actual event-day operator IS the dev who set up `npm run kiosk` and `ngrok`, so they already have terminal access. For a true non-dev volunteer, AC#7 and AC#11 would need rewording, but that's not the actual ops profile. Acceptable.

---

### Updated Quality Scorecard (8 criteria)

| # | Criterion | Score | One-sentence justification |
|---|-----------|-------|----------------------------|
| 1 | Principle-Option consistency | **5/5** | Risk #7's stack-swap escape hatch is gone; mitigation is in-stack (`next start` only, `dynamic = 'force-dynamic'`); Principle 4 held end-to-end. |
| 2 | Fair alternatives | **5/5** | A vs B compared on real dimensions; C invalidated with QR-Version-40 math; aspect Paths A/B/C1 all enumerated with hard math for invalidation/selection. |
| 3 | Risk mitigation clarity | **5/5** | All 11 risks have concrete in-stack mitigations; Risk #5 (tunnel drop) and #11 (aspect stretch) explicitly resolved with named files and tests. |
| 4 | Testable acceptance criteria | **5/5** | All 11 ACs map to milestones AND to the M9 smoke-table rows; cover-crop, mirror, frame-uniformity, cell-origin, and 503 path all asserted in unit tests. |
| 5 | Verification steps concreteness | **5/5** | Cover-crop fixtures derived from first principles; AC-indexed manual smoke; 503 path tested via fetch; mirror-invariant load-bearing pixel test. |
| 6 | Scope discipline | **5/5** | §6 enumerates plan-internal cuts beyond spec Non-Goals; no scope creep across 3 revisions. |
| 7 | File-level concreteness | **5/5** | `lib/types.ts` shared contract; every milestone names absolute file paths; ImageBitmap/Blob/error types pinned. |
| 8 | Effort estimation realism | **4/5** | Per-milestone day-budgets present (S/M with day estimates); total ~8 days matches event timeline; one-developer assumption embedded but reasonable. Half-day buffer not explicitly reserved — minor. |

**No criterion < 4. No blocking quality concern.**

---

### On Architect's 3 Non-Blocking Minors

**Minor 1 — `tunnel-host-error` not in idle-timer eligible set.**
- *Hidden-deadlock risk on event day?* **No.** The banner has a retry button (line 329), so the operator is never trapped. But the question is: should the booth auto-reset to `idle` after 30s in `tunnel-host-error` when no operator is watching?
- **Argument for adding:** if the operator is away from the kiosk (lunch, restroom) and the booth lands in `tunnel-host-error` mid-session, a 30s auto-reset frees the next user from a stuck-banner state.
- **Argument against:** auto-resetting hides the failure — the next user gets a working booth, takes 7 cuts, then the same 503 fires again. Better to FREEZE on the banner so the operator notices when they return.
- **Verdict:** the architect's read ("probably desired behavior — don't silently re-arm a broken booth") is correct. A line in `lib/idle-timer.ts` or M3 reducer JSDoc — "tunnel-host-error: idle timer suppressed by design; manual retry only" — eliminates ambiguity. **Pass-through with one-line JSDoc note recommended; not blocking.**

**Minor 2 — Asymmetric 20/28 vs symmetric 24/24.**
- Independently verified `24 + 3·16 + 4·576 + 24 = 2400` ✓ — both options are exact integer fits.
- 8px asymmetry at 2400px = 0.33%, below human perceptual threshold for symmetry (Weber fraction ~3%).
- Which honors `title-card.png` better? Cannot determine without rendering both — title card sits in the bottom-right cell, so a 28px (vs 20px) bottom margin gives the title card slightly more breathing room from the sheet edge. Marginally favors the 20/28 choice for the title-bearing cell.
- **Verdict:** aesthetic preference, not reliability. **Pass-through; not blocking.** Could be flipped to 24/24 in 30 seconds with no other code changes if the team prefers; defer to designer/operator visual review.

**Minor 3 — No pre-M0 prerequisites gate (Node ≥20, sharp on Apple Silicon).**
- *Critical for build success?* **Likely no, but the failure mode is annoying.** `sharp` ships native binaries via `@img/sharp-darwin-arm64` for Apple Silicon since v0.33+; `npm install` resolves automatically. Node 20+ is required by Next.js 15 (hard fail at install, surfaces immediately). Risk surface is small; modern macs hit this path automatically.
- **However:** if the event laptop is a 2020 Intel MacBook running Node 18 (LTS-but-not-Next-15-supported), `npm install` fails late with confusing errors. A 5-line pre-flight in M9 saves a 15-minute event-day debugging session.
- **Verdict:** low-probability footgun, but the cost of mitigation is trivial (5 lines in M9 README). **Pass-through; not blocking** because the failure would surface during M0 setup (well before event day), not during the event itself. Catch it then, no event-day risk.

**None of the 3 minors meaningfully threaten event-day reliability.** Architect's classification is correct.

---

### Anything Else Missing

1. **Tunnel-host-error retry transition** (mentioned above) — banner has retry button, but the state-machine action it dispatches isn't named in M3's action list (line 176). Should be a `TUNNEL_RETRY` action that transitions back to `composing` (to retry upload) or to `idle` (to abandon session). One-line addition. *Severity: minor; non-blocking.*

2. **Title-card aspect exception not in Architect's APPROVE list but worth re-flagging.** Title card is 720×900 (aspect 0.800), drawn into 512×576 cell (aspect 0.889). Plan acknowledges this with "title is text-on-pink, no faces, accept the 11% non-uniform stretch" (line 268, follow-up at line 588). The "ONE aspect ratio end-to-end" claim (line 248) is therefore "ONE aspect ratio on photographic content; title card is the documented exception." Minor truthiness wobble in marketing language; substance is correct. **Non-blocking.**

3. **No automated visual diff for AC#3 (transparent pink area).** Spec AC#3 ("핑크 원 영역은 투명") is verified only via manual smoke-table row 3. An automated test could assert `alpha=0` at known frame coordinates after preprocessing, but the M1 test (line 112) already does this for a fixture PNG. Net coverage is adequate. **Non-blocking.**

4. **No acceptance test for the `next start` 5-back-to-back-sessions camera-stability claim** (Risk #7 mitigation, line 490). Smoke checklist covers it manually (line 531) but no automated harness. For an MVP, manual is acceptable. **Non-blocking.**

---

### Final ADR Completeness

**YES — complete.**

| Section | Present | Substance |
|---------|---------|-----------|
| Decision | Yes (562) | Stack + production-mode + atomic write + 800×900 padding + ngrok |
| Drivers | Yes (564) | 5 named, each maps to a constraint |
| Alternatives | Yes (566–571) | 5 enumerated (Option B, Option C, Path A, Path B, Path C1) with hard invalidation reasons |
| Why chosen | Yes (573) | Maps to Principle 4 + tunnel-rebuild hazard + uniform aspect; "no stack-swap escape hatch" |
| Consequences | Yes (575–581) | 6 named, each accepted explicitly |
| Follow-ups | Yes (583–588) | 5 named (cloudflared, --kiosk, frame-pack, localhost guard, title-card re-author) |

ADR is stronger than typical — alternatives invalidate both stack AND aspect alternatives, giving the recommendation a falsifiable footing.

---

### Final Verdict

**APPROVE.** All blocker math (cover-crop + aspect chain + cell origins) independently verified from first principles. All polish items (test convention, fail-loud 503 plumbing, AC-indexed smoke table) land cleanly. Quality scorecard 5/5 on 7 criteria, 4/5 on the 8th (effort buffer). No criterion <4. Architect's three minors are correctly non-blocking; the tunnel-host-error idle-timer question deserves one JSDoc line in M3 but is not a deadlock risk because the banner has a retry button.

**Recommended one-line follow-up** (can be added during `start-work` M3): document tunnel-host-error idle-timer behavior in `lib/session-machine.ts` JSDoc (suppress idle reset by design, manual retry only) and add a `TUNNEL_RETRY` action.

**Consensus:** Critic and Architect both APPROVE iteration 2. Ready for `/oh-my-claudecode:start-work y2k-photobooth-plan`.

