# Plan: PD09 D-4 Stability Hardening (v2)

**Status:** Iteration 2 — supersedes v1 (returned ITERATE by Critic with 9 required changes).
**Spec:** `/Users/a1111/Desktop/ozcoding-pd09-booth/.omc/specs/deep-interview-pd09-d4-stability.md`
**Today:** 2026-05-10. **Event:** 2026-05-14. **Calendar budget:** 4 working days.
**Posture:** Verify-and-tighten on already-shipped infra; minimum-fix on real gaps; freeze-first.

---

## RALPLAN-DR Summary

### Principles (5)
1. **Freeze-first.** Anything not on the verified gap-list is out of scope. No new routes, no new env flags, no new state nodes unless the existing reducer cannot express the recovery.
2. **Preserve user data across recovery.** `state.cuts` and `sheetBlobUrl` MUST survive any retry path. This is the spec line 55 invariant and the v1 critical bug.
3. **Verify before building.** Spec lanes were drafted before code audit; ground truth shows ~70% of L1 and L2 infra is already shipped. Re-baseline as VERIFY before patching.
4. **Serial > parallel without git.** No `.git` in repo → file-cp backups only → no concurrent multi-file edits across lanes. One lane lands per day.
5. **Perceptual responsiveness.** Operator-facing retry must complete fast enough to feel like one action: total backoff ≤ ~7s typical, ≤ 30s hard cap (spec line 52).

### Decision Drivers (top 3)
| Rank | Driver | Weight |
|------|--------|--------|
| 1 | Zero regression to 159 passing tests | Highest |
| 2 | Recovery preserves `state.cuts` (spec line 55) | Highest |
| 3 | 4-day calendar with no parallelism safety net | High |

### Options Considered
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. Verify-and-tighten + RETRY_UPLOAD action (chosen)** | Honors freeze-first; fixes critical bug; smallest diff; aligns with shipped infra | Requires reducer change + onRetry branch split | **CHOSEN** |
| B. Greenfield scaffold (v1 plan) | Comprehensive | Re-implements ~70% of shipped code; risks regressing 159 tests; ignores `tunnel-host-error` already in union | **Rejected** (factual errors) |
| C. Pure documentation freeze, no code changes | Zero regression risk | Critical bug at `*Flow.tsx` onRetry destroys state.cuts → fails spec line 55 acceptance | **Rejected** (does not meet AC) |

### Decision
**Option A.** Targeted reducer extension (`RETRY_UPLOAD`) + onRetry branch split + retry helper around `uploadSheet` + sheetBlobUrl-fallback UI inside the existing `tunnel-host-error` screen. Audit, document, and probe-test the camera/leak lanes before deciding to patch.

---

## ADR — PD09 D-4 Stability Hardening

| Field | Value |
|-------|-------|
| **Decision** | Add `RETRY_UPLOAD` action preserving `state.cuts`; wrap `uploadSheet` in 3-attempt exponential backoff (1s/2s/4s, 30s safety cap); reuse cached `sheetBlobUrl` as fullscreen fallback inside existing `tunnel-host-error` screen; treat L1 + L3 as audit/probe-first, patch only on confirmed gap. |
| **Drivers** | (1) spec line 55 cuts-preservation invariant; (2) 4-day budget + no git; (3) ~70% of v1 "build" items already shipped. |
| **Alternatives considered** | B (greenfield) rejected — factually wrong about shipped surface; C (docs-only) rejected — leaves the cuts-destroying bug unfixed. |
| **Why chosen** | Smallest viable diff that closes the critical bug; respects freeze-first; serializable across 4 days. |
| **Consequences** | Reducer Action union grows by one variant (`RETRY_UPLOAD`). `*Flow.tsx` onRetry forks by errorKind. Test count grows by 6–8. No new routes, no new env, no new components. |
| **Follow-ups** | Post-event: hoist tunnel-retry helper into a generic `withBackoff(fn, schedule)` if other call sites appear; add Playwright e2e for the retry flow once event traffic data informs flake budget. |

---

## 4-Day Phased Schedule (revised — Day 2 serialized)

| Day | Date | Lane(s) | Deliverable | Slip-Trigger |
|-----|------|---------|-------------|--------------|
| **Day 1** | 5/10 (today) | L3 audit + L1 sleep/wake probe + Rollback drill | `.omc/research/d4-leak-audit.md` (first pass), probe verdict, drill log | Audit surfaces reducer-level leak → invoke slip rule |
| **Day 2** | 5/11 | **L2 only** (serial) | `RETRY_UPLOAD` action + retry helper + onRetry branch split + sheetBlobUrl-fallback UI inside existing `tunnel-host-error` screen + 6–8 tests | Tests fail → no Day 3 patches; debug-only |
| **Day 3** | 5/12 | L1 verify-tighten (only if Day-1 probe failed) + L3 minimum-fix (only if audit found gap) | Documented patch(es), updated audit doc, 159 still pass | Slip → Day 4 mixed |
| **Day 4** | 5/13 | L4 smoke on real kiosk laptop + `.omc/research/d4-kiosk-runbook.md` | 1h continuous run log, lighting matrix ✓, network matrix ✓ | — |
| **Day-Of** | 5/14 | Pre-event 30-min checklist | Operator runbook signoff | — |

### Slip Rule (codified)
**If** Day-1 audit identifies a leak requiring reducer changes (vs. cleanup-only), **then** the freeze date moves from end-of-Day-3 to end-of-Day-4-mixed. Day 4 becomes "smoke + last patches", Day 5 (5/14 morning) reduces to pre-event checklist only. **Trigger condition explicit:** any required edit to `lib/session-machine.ts` reducer cases beyond the `RETRY_UPLOAD` addition. Mechanical cleanup (URL.revokeObjectURL, ImageBitmap.close, observer.disconnect) does NOT trigger slip — those land Day 3 as planned.

---

## Per-Lane Implementation Detail

### Lane 1 — Camera Retry / Device Recovery (verify-and-tighten)

**(a) Already shipped — VERIFY ONLY (no code edits):**
| Item | Location | Verification |
|------|----------|--------------|
| `tunnel-host-error` in SessionState union | `lib/types.ts:65` | Read assertion in audit doc |
| `IDLE_TIMER_ELIGIBLE_STATES` includes `tunnel-host-error` | `lib/types.ts:81-86` | Read assertion |
| `CameraErrorKind` modeled | `lib/session-machine.ts:49` | Read assertion |
| `errorKind` field on state | `lib/session-machine.ts:60` | Read assertion |
| `restart()` exposed by `useCamera` | `lib/use-camera.ts:104-107` | Read assertion |
| `visibilitychange` + `wasReadyRef` recovery | `lib/use-camera.ts:111-138` | **Day-1 sleep/wake probe (≤30 min, see below)** |
| `devicechange` listener wired | `lib/use-camera.ts:141-150` | Read assertion (currently log-only — accept as-is) |
| `CameraDeniedBanner` Korean copy | `components/CameraDeniedBanner.tsx` | Read assertion |

**(b) Net-new work — CONDITIONAL on Day-1 probe failure:**
- **Day-1 sleep/wake real-device probe** (≤30 min, mandatory):
  - Open booth in dev mode on the actual kiosk laptop.
  - Close lid → wait 60s → reopen → observe whether camera reattaches via existing `wasReadyRef` path or sticks black.
  - Record verdict in `.omc/research/d4-leak-audit.md` under "L1 sleep/wake probe".
- **If probe passes:** L1 collapses to documentation-only — no code changes. Move scenario checklist to L4 runbook.
- **If probe fails:** scope minimum patch on Day 3. Likely candidate: convert `devicechange` log-only handler at `lib/use-camera.ts:141-150` to call `restart()` when `wasReadyRef.current === true`. Single-function change, ≤10 lines.

**Strikethrough — DO NOT BUILD (already shipped, contra v1):** ~~tunnel-host-error state~~, ~~restart()~~, ~~visibilitychange recovery~~, ~~devicechange listener~~, ~~errorKind field~~, ~~IDLE_TIMER_ELIGIBLE_STATES update~~.

---

### Lane 2 — Tunnel Retry / Upload Recovery (the real work)

**(a) Already shipped — VERIFY ONLY:**
| Item | Location | Verification |
|------|----------|--------------|
| `tunnel-host-error` state | `lib/types.ts:65` | ✓ |
| `COMPOSE_FAIL_TUNNEL → tunnel-host-error` transition | `lib/session-machine.ts:180-183` | ✓ |
| `TunnelHostUnavailableError` parsed from API 503 | `lib/upload-sheet.ts:23-33` | ✓ |
| `TunnelHostUnavailableError` exported | `lib/types.ts:139-144` | ✓ |
| `TunnelErrorScreen` Korean UI rendering | `components/ThemedFlow.tsx:273-274, 342-360`; `components/NormalFlow.tsx:288-289, 405-423` | ✓ |
| `sheetBlobUrl` cached at flow level | `components/ThemedFlow.tsx:60`; `components/NormalFlow.tsx:55` | ✓ |

**(b) Net-new work — Day 2:**

| Step | File | Function-level change | Acceptance |
|------|------|----------------------|------------|
| 1 | `lib/session-machine.ts` (Action union ~line 78–90) | Add `\| { type: "RETRY_UPLOAD" }` variant. | Type-checks. |
| 2 | `lib/session-machine.ts` (reducer, after `COMPOSE_FAIL_TUNNEL` case) | Add `RETRY_UPLOAD` case: guard `state.phase === "tunnel-host-error"`; return `{ ...state, phase: "compositing", errorKind: undefined }`. **Critical:** spread `state`, do NOT spread `baseInitial`. Preserves `state.cuts`, `state.cutIndex`, `state.publicUrl` (undefined here anyway). | Reducer test passes. |
| 3 | New helper `lib/upload-sheet-retry.ts` (or extend `lib/upload-sheet.ts`) | Wrap `uploadSheet(blob)` with 3-attempt exponential backoff: 1s, 2s, 4s (cumulative 7s typical). Hard 30s deadline (spec line 52). Only retry on `TunnelHostUnavailableError`; rethrow other errors immediately. | Unit test asserts max-attempts and non-tunnel error exit. |
| 4 | `components/ThemedFlow.tsx:209-213` and `components/NormalFlow.tsx:228-232` | Split `onRetry` by `state.phase`: `if (state.phase === "tunnel-host-error") dispatch({ type: "RETRY_UPLOAD" })` else current `RESET + START + camera.restart()` path (camera-priming-error branch unchanged). | onRetry test: themed `state.cuts.length === 7` survives; normal `state.cuts.length === 4` survives. |
| 5 | Wire compositing useEffect to call new retry helper instead of bare `uploadSheet` | Same files, compositing effect | Network test (mocked) confirms retry invoked. |
| 6 | Inside existing `TunnelErrorScreen` (in both `ThemedFlow.tsx` and `NormalFlow.tsx`) | When `publicUrl` unavailable, render fullscreen `<img src={sheetBlobUrl} />` (already cached at flow level) with caption "QR이 안 떨어지면 사진을 직접 보여주세요". No new route, no env flag. | Visual: blob URL renders; caption present in DOM test. |

**Strikethrough — DO NOT BUILD (replaced):** ~~`NEXT_PUBLIC_TUNNEL_DISABLED` env~~, ~~new `/local-capture` route~~, ~~`<TunnelErrorScreen>` Korean UI from scratch~~ (already shipped).

---

### Lane 3 — Session / Memory Leak Audit (audit-first, minimum-fix)

**Day 1 — Audit only (no code edits):**

| Item | Verification | Notes |
|------|--------------|-------|
| `sheetBlobUrl` revoke on RESET | Trace from `*Flow.tsx` reducer dispatch → useEffect cleanup | Spec AC line 59 |
| In-flight `ImageBitmap.close` on cancellation | Per Architect: `components/ThemedFlow.tsx:128-131` already closes | Regression-lock in tests |
| `ScaleToFit` ResizeObserver disconnect | `components/ScaleToFit.tsx:69-77` already disconnects | ✓ |
| `LiveOverlay` ResizeObserver | **Does NOT use ResizeObserver** (per ground truth) — strike from v1 list | Plan v1 was wrong |
| `useCamera` MediaStream/videoRef cleanup | `lib/use-camera.ts` audit pass | Read-only |
| prep/countdown/flash/preview/compositing setTimeout cleanup | Per phase, audit useEffect return functions | Read-only |

**Output:** `.omc/research/d4-leak-audit.md` with one row per item: shipped ✓ / fixed-needed / not-applicable.

**Day 3 — Minimum patches (only if audit found gaps):**
- Cleanup-only (URL.revokeObjectURL, ImageBitmap.close, observer.disconnect, clearTimeout). No reducer changes.
- 50-session/50MB heap measurement deferred to **L4 manual on real hardware with DevTools**, captured in `.omc/research/d4-leak-audit.md`. Not part of automated test suite.

---

### Lane 4 — Environment Smoke Test (Day 4)

- Real kiosk laptop, 1h continuous run, ≥10 sessions.
- Lighting matrix: fluorescent / window-backlit / dim — ≥1 capture each.
- Network matrix: venue WiFi + LTE tether — ngrok URL issuance both.
- Manual DevTools heap snapshot at session 1, 25, 50 → record delta in `.omc/research/d4-leak-audit.md`.
- Output: `.omc/research/d4-kiosk-runbook.md` (browser, sleep settings, brightness, camera permission, tunnel restart script, operator quick-reference).

---

## Test Strategy (~6-8 tests)

| # | Test | Lane | File (suggested) | Asserts |
|---|------|------|-------------------|---------|
| 1 | `RETRY_UPLOAD` preserves `state.cuts.length` (themed=7) | L2 | `lib/__tests__/session-machine.retry.test.ts` | After `tunnel-host-error → RETRY_UPLOAD → compositing`, `state.cuts.length === 7` |
| 2 | `RETRY_UPLOAD` preserves `state.cuts.length` (normal=4) | L2 | same | Same with totalCuts=4 |
| 3 | `RETRY_UPLOAD` clears `errorKind` and sets phase=`compositing` | L2 | same | Phase + errorKind invariants |
| 4 | tunnel-retry helper respects 3-attempt max | L2 | `lib/__tests__/upload-sheet-retry.test.ts` | Mock 503 thrice → throws; mock 503 twice + ok → resolves |
| 5 | tunnel-retry helper exits immediately on non-tunnel error | L2 | same | Mock generic Error → throws on first attempt |
| 6 | `URL.revokeObjectURL` called on RESET cleanup path | L3 | `components/__tests__/flow-cleanup.test.tsx` | Spy on revokeObjectURL; dispatch RESET; assert called with cached blob URL |
| 7 | `ImageBitmap.close` called on cancellation (regression-lock) | L3 | same | Per Architect ref `ThemedFlow.tsx:128-131`; spy assertion |
| 8 | onRetry branches correctly by `state.phase` | L2 | `components/__tests__/onretry-branch.test.tsx` | tunnel-host-error → RETRY_UPLOAD dispatched; camera-priming-error → RESET path |

**Total target:** 6–8 tests. Existing 159 must continue to pass. Heap measurement is **manual** on Day 4, not in the suite.

**Cut from v1:** ~~50-session JS-driven heap test~~ → moved to L4 manual DevTools.

---

## Rollback / Freeze Plan

**No `.git` available** → all rollback uses `cp` snapshots.

### Day-1 Rollback Drill (≤15 min, before any L2 patch)
1. Pick one safe target file: `lib/copy.ts`.
2. `cp lib/copy.ts .omc/backups/pre-l2/copy.ts.snapshot`.
3. Mutate the file (e.g., add a sentinel comment, or change a string).
4. `cp .omc/backups/pre-l2/copy.ts.snapshot lib/copy.ts` to restore.
5. Run `npm test` → confirm 159/159 still pass.
6. Log result in `.omc/research/d4-leak-audit.md` under "Rollback drill".

### Per-Day Snapshot Protocol (Day 2 onward)
- Before any edit, `cp -R` the touched files into `.omc/backups/pre-l<N>-<YYYYMMDD>/`.
- After edit, run `npm test` immediately.
- If any test that previously passed now fails: restore from snapshot, re-test to 159/159 baseline, then diagnose.

### Freeze Triggers
- End of Day 3 (or end of Day 4 mixed if slip rule fires): no further code edits.
- Day 5 morning: pre-event checklist only — restart kiosk, verify camera permission, verify tunnel, run 1 dry session.

---

## Acceptance Criteria Mapping

| Spec AC | Plan coverage |
|---------|---------------|
| L1 — permission denied recovery (line 45) | Already shipped (`CameraDeniedBanner`); L4 manual scenario checklist confirms |
| L1 — USB camera reconnect (line 46) | Already shipped (`devicechange` log-only + `restart()`); Day-1 probe + L4 scenario |
| L1 — tab focus release (line 47) | Already shipped (`visibilitychange` + `wasReadyRef`); L4 scenario |
| L1 — sleep/wake (line 48) | **Day-1 probe verdict**; conditional Day-3 patch |
| L1 — scenario checklist documented (line 49) | L4 runbook |
| L2 — 3-attempt backoff ≤30s (line 52) | New retry helper, 1s/2s/4s (≤7s typical, 30s cap) |
| L2 — Korean operator copy (line 53) | Already shipped (`TunnelErrorScreen`) |
| L2 — operator 1-tap retry (line 54) | onRetry branch dispatches `RETRY_UPLOAD` |
| **L2 — `state.cuts` + `sheetBlobUrl` survive retry (line 55)** | **Critical:** `RETRY_UPLOAD` action preserves both; tests #1, #2; sheetBlobUrl reused as fallback UI |
| L3 — 50 sessions / 50MB stable (line 58) | Day-4 manual DevTools heap measurement |
| L3 — RESET cleanup of blob/ImageBitmap (line 59) | Test #6, #7; conditional Day-3 patch |
| L3 — observers/timers cleanup (line 60) | Audit Day 1; conditional Day-3 patch |
| L3 — `.omc/research/d4-leak-audit.md` (line 61) | Day 1 deliverable |
| L4 — 1h kiosk run (line 64) | Day 4 |
| L4 — lighting matrix (line 65) | Day 4 |
| L4 — network matrix (line 66) | Day 4 |
| L4 — runbook (line 67) | Day 4 deliverable |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Day-1 audit finds reducer-level leak | Low | High (slip) | Slip rule codified; Day 4 becomes mixed |
| `RETRY_UPLOAD` test exposes existing reducer bug | Low | Medium | Snapshot + restore; revert to 159/159 baseline before diagnosing |
| Sleep/wake probe fails | Medium | Medium | Day-3 minimum patch on `devicechange` handler (≤10 lines) |
| Backoff exceeds operator patience (>30s) | Low | Medium | Hard 30s cap; total typical 7s |
| `sheetBlobUrl` fallback UI looks broken on small viewport | Low | Low | Reuse existing `TunnelErrorScreen` layout; just swap inner content |
| No git → accidental edit loss | Medium | High | Per-day `cp -R` snapshots; rollback drill Day 1 |
| Real-kiosk smoke run reveals network failure | Medium | High | LTE tether backup in matrix; runbook documents both |

---

## Iteration 2 Changelog (v1 → v2)

| # | Required Change (Critic) | v2 Resolution |
|---|--------------------------|---------------|
| **1** | Re-baseline L1 + L2 as verify-and-tighten | L1 and L2 sections now have explicit (a) shipped-verify table and (b) net-new work table. Strike-list documents removed scope: tunnel-host-error state, restart(), visibilitychange, devicechange, errorKind, IDLE_TIMER_ELIGIBLE_STATES, TunnelErrorScreen Korean UI. |
| **2** | Add `RETRY_UPLOAD` action preserving `state.cuts` | L2 step 1+2 add the Action variant with `...state` spread (not `...baseInitial`). onRetry branch split (step 4) only forks the `tunnel-host-error` case; `camera-priming-error` keeps RESET path. Tests #1, #2, #3, #8 lock the invariant. Ships **Day 2** before any other L2 work. |
| **3** | Drop env + `/local-capture` route; reuse cached `sheetBlobUrl` inside existing TunnelErrorScreen | L2 step 6 renders fullscreen `<img src={sheetBlobUrl} />` with caption "QR이 안 떨어지면 사진을 직접 보여주세요" inside the **already-shipped** `TunnelErrorScreen` when `publicUrl` is missing. **Zero new routes, zero new env.** Restores Principle 1 (Freeze-first). |
| **4** | Serialize Day 2 | Schedule rewritten: Day 2 = L2 only (no parallel L1). Day 3 = L1 verify-tighten (only if probe gap) + L3 minimum-fix. |
| **5** | Cut tests to ~6–8 stable regression | Test table now has exactly 8 tests, all focused on regression-locks. Heap test moved to Day-4 manual DevTools in `.omc/research/d4-leak-audit.md`. |
| **6** | Explicit Day-3 slip plan | Slip rule codified in schedule section: trigger = any reducer edit beyond RETRY_UPLOAD; effect = Day 4 mixed, Day 5 checklist-only. Mechanical cleanup does NOT trigger. |
| **7** | Day-1 sleep/wake probe (≤30 min) | L1 (b) describes lid-close → reopen probe on real kiosk. Pass → L1 collapses to docs-only. Fail → Day-3 patch on `devicechange` log-only handler. |
| **8** | Codify backoff schedule | L2 step 3 specifies 1s/2s/4s (cumulative 7s typical), 8–10s perceptual ceiling, 30s absolute hard cap (spec line 52). Tradeoff documented in RALPLAN-DR Principle 5. |
| **9** | Specify rollback drill | Rollback section adds Day-1 ≤15-min drill on `lib/copy.ts`: snapshot → mutate → restore via `cp` → run `npm test` → confirm 159/159. Logged in audit doc. |

---

## Plan Summary

**Plan saved to:** `/Users/a1111/Desktop/ozcoding-pd09-booth/.omc/plans/pd09-d4-stability-v2.md`

**Scope:**
- 1 reducer action (`RETRY_UPLOAD`), 1 retry helper, 2 onRetry branch splits, 1 fallback UI swap inside existing screen
- 6–8 regression-lock tests
- 3 research docs: leak audit, kiosk runbook, (rollback drill log inline in leak audit)
- Estimated complexity: **LOW** (reducer + 1 helper + UI fork)

**Key Deliverables:**
1. `RETRY_UPLOAD` reducer action that preserves `state.cuts` (closes critical bug, spec line 55)
2. Tunnel-upload retry helper (3 attempts, exponential backoff, 30s cap)
3. `sheetBlobUrl` fallback rendered inside existing `TunnelErrorScreen` (no new routes)
4. Leak audit doc + kiosk runbook
5. Rollback drill verified before any L2 edit

**Consensus mode:** RALPLAN-DR (Principles 5, Drivers 3, Options 3 with explicit invalidation), ADR (Decision/Drivers/Alternatives/Why/Consequences/Follow-ups). DELIBERATE addenda not required (4-day brownfield stabilization, not high-risk architecture).

---

## Consensus Status (Final)

| Iteration | Architect | Critic |
|---|---|---|
| 1 (v1) | APPROVE_WITH_CHANGES | ITERATE (9 required changes) |
| 2 (v2) | **STRONG_APPROVE** | **APPROVE** |

Plan v2 is consensus-approved and ready for execution.

## Executor Handoff Annotations (post-consensus polish — apply during implementation)

These three notes were surfaced by Architect+Critic on v2. None blocks approval; all are absorbable into Day-2/3 execution work.

1. **Test #6 spy target.** v2 line 161 reads "URL.revokeObjectURL called on RESET cleanup path" — actual revoke path lives in `onNextUser` at `components/ThemedFlow.tsx:215-221` and `components/NormalFlow.tsx:234-240` (NOT the `RESET` reducer dispatch). The intent (assert revoke is called with the cached blob URL during user-completion cleanup) is unambiguous. Executor: attach the vitest spy to `onNextUser` invocation, not the `RESET` dispatch. The implicit unmount-on-route-change cleanup at `ThemedFlow.tsx:203-207` / `NormalFlow.tsx:222-226` is the secondary path; either is acceptable as long as the test exercises a real revoke trigger.

2. **`RETRY_UPLOAD` reducer — defensive `publicUrl: undefined`.** v2 step 2 (line 111) returns `{ ...state, phase: "compositing", errorKind: undefined }`. The `...state` spread already yields `publicUrl: undefined` on the tunnel-fail branch (publicUrl is only set on `COMPOSE_DONE` at `lib/session-machine.ts:178`, never reached on this path). Executor: add explicit `publicUrl: undefined` for grep-ability and future-proofing — it costs nothing and prevents a silent regression if a future reducer change populates publicUrl elsewhere.

3. **Document `sheetBlobUrl` retry-overwrite in leak audit.** When `RETRY_UPLOAD` re-enters compositing, the useEffect at `ThemedFlow.tsx:165-201` / `NormalFlow.tsx:184-220` re-runs, calls `composeSheet`/`composeOverlaySheet` again, and calls `setSheetBlobUrl(blobUrl)` (overwriting the prior URL). The cleanup useEffect at `ThemedFlow.tsx:203-207` / `NormalFlow.tsx:222-226` revokes via dependency-array close-over — net no leak, BUT the implicit-revoke pattern is non-obvious. Executor: add one row to `.omc/research/d4-leak-audit.md` stating "sheetBlobUrl retry-overwrite is implicitly handled by cleanup-on-change useEffect" so a future contributor doesn't accidentally regress this by changing the deps array.
