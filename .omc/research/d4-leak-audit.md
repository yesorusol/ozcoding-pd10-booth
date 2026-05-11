# D-4 Leak Audit & Day-1 Drills

**Started:** 2026-05-10
**Spec:** `.omc/specs/deep-interview-pd09-d4-stability.md`
**Plan:** `.omc/plans/pd09-d4-stability-v2.md`
**Event:** 2026-05-14 (D-4)

---

## 1. Rollback Drill (Plan v2 §Rollback, ≤15min)

**Goal:** Verify cp-based snapshot/restore preserves byte-identity and 159/159 baseline.

**Procedure executed:**

| Step | Command | Result |
|---|---|---|
| 1. Snapshot | `mkdir -p .omc/backups/pre-l2 && cp lib/copy.ts .omc/backups/pre-l2/copy.ts.snapshot` | Both files 8041 bytes |
| 2. Baseline test | `npm test` | **159/159 ✅** (2.17s) |
| 3. Mutation | Prepended `// DRILL_MARKER_2026_05_10 — rollback drill mutation (will be removed)` to `lib/copy.ts` | diff confirms: `1d0` |
| 4. Restore | `cp .omc/backups/pre-l2/copy.ts.snapshot lib/copy.ts` | — |
| 5. Post-restore diff | `diff lib/copy.ts .omc/backups/pre-l2/copy.ts.snapshot` | empty (byte-identical) |
| 6. Post-restore byte-count | `wc -c lib/copy.ts .omc/backups/pre-l2/copy.ts.snapshot` | 8041 / 8041 |
| 7. Post-restore test | `npm test` | **159/159 ✅** (2.51s) |

**Verdict:** PASS. Rollback procedure works without git. Per-day backup protocol (`.omc/backups/pre-l{1,2,3}/`) is operational.

---

## 2. L1 Sleep/Wake Probe (Plan v2 §Lane 1 (b), ≤30min)

**Status:** NOT YET EXECUTED — requires user physical interaction with kiosk laptop.

**Procedure (when run):**
1. Start dev server: `npm run dev`
2. Navigate to `/themed`, advance to camera-priming → live state.
3. **Close laptop lid for 60 seconds.**
4. Reopen laptop.
5. Observe within 5 seconds:
   - Does live feed resume automatically? (`wasReadyRef` recovery at `lib/use-camera.ts:111-138` triggered?)
   - Or does it stall on the last frame?
   - Or does `errorKind` flip to `'ended'` and show `CameraDeniedBanner`?
6. If banner appears, click `다시 시도`. Does `camera.restart()` recover the feed within 5s?

**Verdict (to fill):**
- [ ] PASS — `wasReadyRef` recovery covers macOS lid-close → no code change needed; document in L4 runbook only.
- [ ] FAIL — recovery missed; scope ≤10-line patch on `devicechange` handler at `lib/use-camera.ts:141-150` for Day 3.

**Browser/OS context (fill in):**
- Browser: ___
- OS version: ___
- Camera (built-in / USB): ___

---

## 3. L3 Read-Only Audit Findings

**Status:** IN PROGRESS — running concurrent grep + manual code-walk.

### Identified leak surfaces (initial enumeration; expand as audit progresses)

| Surface | File:Line | Cleanup Status | Notes |
|---|---|---|---|
| `sheetBlobUrl` revoke on unmount | `components/ThemedFlow.tsx:203-207`, `components/NormalFlow.tsx:222-226` | ✅ already revokes via `URL.revokeObjectURL` | Closure captures prior URL when `sheetBlobUrl` changes |
| `sheetBlobUrl` revoke on `onNextUser` | `components/ThemedFlow.tsx:215-221`, `components/NormalFlow.tsx:234-240` | ✅ already revokes explicitly | Resets state to null after revoke |
| `sheetBlobUrl` orphan on RETRY_UPLOAD overwrite | `ThemedFlow.tsx:181`, `NormalFlow.tsx:200` | ⚠️ implicit — relies on cleanup-on-change | When retry runs, `setSheetBlobUrl(newUrl)` triggers prior URL revoke via cleanup useEffect dep-array close-over. **Net: no leak, but non-obvious.** Document so future contributor doesn't break this by changing deps. |
| `ImageBitmap.close()` on capture cancellation | `ThemedFlow.tsx:128-131` | ✅ closes on cancelled-branch | |
| `ResizeObserver` disconnect | `components/ScaleToFit.tsx:69-77` | ✅ disconnects in useEffect cleanup | Only `ResizeObserver` in tree |
| `ResizeObserver` in `LiveOverlay` | `components/LiveOverlay.tsx:1-124` | N/A | Pure CSS aspect-ratio; no observer used (Plan v1 was wrong) |
| `MediaStream.getTracks().stop()` on unmount | `lib/use-camera.ts` | TBD — needs deeper read | |
| Phase timer `setTimeout` clears (prep/countdown/flash/preview/compositing) | `*Flow.tsx` | TBD — needs deeper read | |
| `frameImagesRef` Map of `HTMLImageElement` references | `*Flow.tsx` | TBD — does it leak across sessions? | |
| `idle-timer` event listener cleanup | TBD | TBD | |

(More findings will be added as the audit progresses.)

---

## 4. L4 Smoke Runbook Skeleton

**Status:** NOT YET CREATED. Will live at `.omc/research/d4-kiosk-runbook.md` (separate file).

---

## 5. Day-1 Time Log

| Time | Activity | Duration |
|---|---|---|
| Step 1 (drill) start | Snapshot + baseline | — |
| Step 1 complete | Restore + post-test 159/159 | ~5min (vs 15min budget) |
| Step 2 (probe) | NOT YET RUN — awaits user physical action | — |
| Step 3 (L3 audit) | Initial enumeration above; deeper read pending | ongoing |
| Step 4 (L4 runbook) | Pending | — |
