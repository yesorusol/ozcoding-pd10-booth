# Architect Consensus Review — Y2K Photobooth Plan

**Plan reviewed:** `.omc/plans/y2k-photobooth-plan.md`
**Spec source:** `.omc/specs/deep-interview-y2k-photobooth.md` (ambiguity 9%, PASSED)
**Mode:** `--consensus` (steelman antithesis required, not rubber-stamp)
**Reviewer role:** Architect

---

## Verdict

**ITERATE** — plan is fundamentally sound and will likely ship a working booth, but it has **5 concrete gaps** (selfie mirroring, sheet aspect mismatch with the supplied mockup, camera lifecycle in dev/HMR, idle-reset vs. mid-session-leave semantics, and `NEXT_PUBLIC_TUNNEL_ORIGIN` requiring a rebuild) that should be fixed before `start-work`. None are stack-changing; all are spec-traceable corrections inside existing milestones.

---

## Steelman Antithesis (strongest case against the current plan)

**Next.js 15 App Router is over-architected for what is actually a single-page client-rendered kiosk + one file-write endpoint.** The plan justifies Option A on "spec recommendation" and "familiarity," but neither is a real architectural reason — the spec explicitly enumerates "Next.js dev/start *or* a single SPA + static server" as equivalents (spec line 29). On event day, the booth will run on `next start` (or worse, `next dev`) for ~6 hours straight on a single laptop. App Router brings RSC payload generation, route caching, dynamic-segment middleware, dev-mode HMR, and a fetch wrapper that monkey-patches caching — none of which the kiosk uses, all of which can fail in non-obvious ways. The plan's Risk #7 ("Next.js dev-mode HMR breaking the camera stream") already concedes this is a known footgun, and its mitigation is "fall back to Option B" — which means the plan is recommending the option whose own author flags as needing an escape hatch. A 60-line `Bun.serve` or Express handler + Vite is genuinely simpler, has zero RSC/cache surface, and the lib/* files (`capture.ts`, `sheet-composer.ts`, `session-machine.ts`) are framework-agnostic anyway.

**Second antithesis: the plan's storage path `public/captures/{uuid}.png` is hostile to `next dev` and fragile under `next start`.** Files written into `public/` while the dev server is running are not picked up by the dev-time static handler reliably (Next.js builds a manifest of `public/` at boot in some modes), and in `next start` they are served, but the build pipeline assumes `public/` is immutable build input. The plan never specifies *which* command runs at the event (the README in M9 says `npm run build && npm start`, but Risk #7 implies dev-mode is also tested). Under `next start`, freshly-written PNGs in `public/captures/` *are* served by the static handler — but this is undocumented behavior that has changed across Next.js majors, and there is no test in the plan that exercises "write file at T0, fetch via tunnel at T0+2s."

**Third antithesis: `NEXT_PUBLIC_TUNNEL_ORIGIN` is baked at build time, not read at runtime.** Any env var prefixed `NEXT_PUBLIC_` is inlined into the client bundle during `next build`. M7's `lib/public-url.ts` reads `process.env.NEXT_PUBLIC_TUNNEL_ORIGIN`, which means **every time the operator restarts ngrok and gets a new free-tier hostname, they must re-run `npm run build`** — a 30–60s rebuild during a live event. The README runbook (M9) glosses over this. The fallback to `window.location.origin` will yield `http://localhost:3000` on the kiosk, which a phone cannot reach.

---

## Real Tradeoff Tensions (named explicitly)

1. **Selfie mirror tension (preview ↔ saved cut).** Modern browsers do **not** auto-mirror `<video>` from a user-facing camera; UX convention is to mirror the *preview* (CSS `transform: scaleX(-1)`) so the user sees themselves naturally, but capture the *un-mirrored* pixels so saved photos read correctly (text on shirts, etc.). The plan's M2 (`LiveOverlay.tsx`) and M4 (`captureCut`) are silent on this. If the team mirrors the video element with CSS, M4's `drawImage(video,…)` will *not* inherit that mirror — they'll get an un-mirrored saved cut behind a mirrored preview, and the user's left/right will swap between live and result. If they apply `ctx.scale(-1, 1)` to the canvas, the *frame PNG* will overlay correctly only if mirrored consistently. This is a 5-line decision but unaddressed; a real Y2K photobooth absolutely mirrors the preview (purikura convention).

2. **Sheet aspect mismatch with `sheet-mockup.png`.** The supplied `sheet-mockup.png` is **720×1800 (2:5 aspect)**, but the plan locks the output to **1080×2400 (9:20 aspect)** per spec. M5's note "must visually compare against `sheet-mockup.png`" cannot be satisfied: scaling 720×1800 up to 1080×2400 changes aspect from 1:2.5 to ~1:2.22. Either (a) the mockup is wrong and 1080×2400 is canonical, (b) the cell math in M5 (`540×600` cells, fitting `720×900` cuts at 540×675 with crop) needs to match the mockup exactly. The plan's "math finalized in implementation" hand-wave hides a real risk: cells will look noticeably squashed or letterboxed and not match the reference. This is a tension between **spec output dimension** (1080×2400, AC#6) and **designer reference** (720×1800).

3. **Idle-reset vs. user-still-shooting tension.** M8's idle-timer is "30s no-interaction" → `RESET`. But the entire 7-cut session is a *no-user-interaction* sequence (auto-countdown). After clicking 시작, the user is just standing there for ~27s of countdowns. If the idle timer is wired naively (no mouse/keyboard for 30s → reset), it will fire mid-session if the user finishes the camera-priming click before 시작 was clicked, or simply because nobody touches the kiosk after pressing 시작. The plan does not specify the idle-timer's *gating* — it must be gated to states `idle` and `qr-display` only, never `countdown`/`flash`/`preview`/`composing`. Easy fix, but unaddressed.

4. **PNG quality vs. tunnel transfer time.** Spec mandates PNG (lossless), 1080×2400. A 1080×2400 RGBA PNG with photographic content is typically 1.5–4 MB. Over a free-tier ngrok session (often rate-limited to ~5 Mbps egress) shared by N attendees scanning QRs simultaneously, a 3 MB download is 5–10s of phone-side waiting. The plan's Risk #6 only addresses *disk* growth, not *transfer* latency under concurrent load. Acceptance criterion #10 (≤90s per session) covers booth-side timing but the *user's perceived wait* extends until the phone download finishes. A pragmatic synthesis: composite at full quality but emit a `progressive PNG` or accept that the spec is PNG-mandatory and document the transfer cost.

5. **`NEXT_PUBLIC_*` build-time env vs. runtime tunnel hostname.** Already covered above — the strict tension is "operator wants a single command" vs. "Next.js inlines NEXT_PUBLIC_* at build time." Runtime resolution (server-only env + a `/api/config` endpoint, or reading `Host` header server-side and including it in the QR payload via a server component) sidesteps this entirely.

---

## Synthesis Recommendations (concrete, file-level)

1. **`lib/public-url.ts` (M7) — make tunnel origin runtime-resolved, not build-time.**
   Replace `NEXT_PUBLIC_TUNNEL_ORIGIN` with a server-side endpoint. Have `app/api/captures/route.ts` (M6) inspect the incoming request's `Host` header and return `{ id, url, publicUrl: \`https://\${host}/captures/\${id}.png\` }`. Client uses the returned `publicUrl` for the QR. Eliminates the rebuild-on-tunnel-restart footgun entirely. **No new dependencies, fewer moving parts, more robust.**

2. **`components/LiveOverlay.tsx` (M2) + `lib/capture.ts` (M4) — make mirror policy explicit.**
   Add a single constant `MIRROR_PREVIEW = true` in `lib/frames.ts`. Apply CSS `transform: scaleX(-1)` to `<video>` only. In `captureCut`, call `ctx.translate(720, 0); ctx.scale(-1, 1)` *before* drawing video so the saved cut matches what the user saw. Then reset transform before drawing the frame PNG. 8 lines of code; fixes a guaranteed event-day "why is my photo flipped?" complaint.

3. **`lib/sheet-composer.ts` (M5) — drive cell math from the mockup, not from spec output.**
   Either (a) confirm `sheet-mockup.png` is illustrative and the cell math should be exactly `cellW=540, cellH=600` with each 720×900 cut letterboxed (top/bottom 30px gutters yields 540×675 cropped → choose centered crop), or (b) replace `sheet-mockup.png` with a re-export at 1080×2400 before M5 starts. Add `lib/sheet-composer.test.ts` cases that assert cell `(x,y,w,h)` for indices 0–7 explicitly. **Decide before M5, not "in implementation."**

4. **`lib/idle-timer.ts` (M8) — gate by state.**
   Idle timer should only run while machine state is in `{idle, qr-display, camera-priming}`. Pass current state into the hook and `clearTimeout` on every state transition into `{countdown, flash, preview, composing}`. One-line fix in the timer's `useEffect` deps.

5. **`app/booth/page.tsx` + `lib/camera.ts` — explicit camera lifecycle for 4 events.**
   Document and implement: (a) `visibilitychange` → release stream when tab hidden, re-acquire on visible; (b) `MediaStreamTrack.onended` → handle "another tab stole the camera" by routing to `CameraDeniedBanner`; (c) `permissions.query({name:'camera'})` → detect revoke; (d) `navigator.mediaDevices.ondevicechange` → handle USB webcam unplug. The plan's M2/M8 mention "clean up MediaStream on unmount" only — that's insufficient.

6. **Re-examine Option B as the actual recommendation.** Given that Risk #7 already exists, that lib/* is framework-portable, and that the storage path's `public/captures/` interaction with Next.js is undocumented territory, **Vite + Bun.serve is the lower-risk choice for an 8-day kiosk-only build**. If the team prefers Next.js for familiarity, lock to **`next start` only** (never `next dev` for any rehearsal that involves the camera) and add a Risk #7 mitigation that is *not* "fall back to a different stack."

---

## Risk Gaps (that the Planner missed)

1. **macOS `App Nap` / display sleep mid-event.** Risk list does not mention OS-level power management. A laptop on battery with default settings will dim the display after 2 minutes idle and may suspend Chrome tabs (Energy Saver throttling). M9's runbook should include `caffeinate -dimsu &` (macOS) or equivalent.

2. **Browser autoplay / camera permission persistence across `localhost` vs. tunnel origin.** Camera permissions in Chrome are per-origin. Granting permission for `localhost:3000` does *not* grant it for `https://abc.ngrok-free.app`. The kiosk renders at `localhost`, so permissions there are fine; but if the operator opens the booth via the tunnel URL by mistake (or for testing), they'll re-prompt. Runbook should pin the kiosk to `localhost` and say so.

3. **DPR (device pixel ratio) compositing offset.** The plan never discusses high-DPR displays. If the kiosk laptop is a Retina/HiDPI screen, `<video>` and `<img>` will render at logical pixels but `canvas.drawImage(video, …)` reads from the *underlying* media stream (1280×720), not from the displayed surface. So compositing is fine — but the **preview alignment** the user sees may not match the captured cut if the CSS sizing does not preserve the source aspect. Need explicit `object-fit: cover` + matching `drawImage` sx/sy/sw/sh in `captureCut`. The plan says "cover-fit math" but doesn't specify it cross-checks the DOM-displayed crop.

4. **No fallback for phones without a built-in QR reader.** Older Android phones, some KakaoTalk-only users, etc. Pragmatic mitigation: render the short URL *as text* below the QR (e.g., "abc.ngrok-free.app/c/xyz"). Two lines in `QRScreen.tsx`.

5. **No rate-limit / size guard collision.** M6 rejects "non-PNG or >10 MB" — fine. But there is no guard against a malicious tunnel visitor `POST`ing arbitrary 9 MB PNGs and filling the disk. Easy mitigation: require a session cookie or one-shot upload token issued by the same browser session that started the booth. Or: bind the route to `localhost`-origin requests only (since the kiosk is the only legitimate caller).

6. **Concurrent sessions while the previous QR is still being scanned.** If user A finishes, scans QR, walks away. User B clicks 시작 30s later. User A's phone is still downloading. Plan never addresses whether `RESET` revokes user A's URL (it doesn't — files persist in `public/captures/`). This is **correct** for the spec ("결과 유효 기간: 노트북/터널 살아 있는 동안") but should be explicitly noted, because the obvious-feeling implementation of "wipe captures on reset" would *break* the spec.

---

## Required Revisions (before `start-work`)

1. **M7: Replace `NEXT_PUBLIC_TUNNEL_ORIGIN` with server-derived `publicUrl` from `Host` header in M6's response.** Eliminates the rebuild-on-tunnel-restart hazard. (See Synthesis #1.)
2. **M2 + M4: Add explicit selfie-mirror policy and implement consistently across preview and capture.** (See Synthesis #2.)
3. **M5: Resolve the 720×1800 mockup vs. 1080×2400 spec aspect mismatch *before* implementation; lock cell math in `sheet-composer.test.ts`.** (See Synthesis #3.)
4. **M8: State-gate the idle timer so it never fires during `countdown`/`flash`/`preview`/`composing`.** (See Synthesis #4.)
5. **M2 + M8: Expand camera-lifecycle handling to cover `visibilitychange`, `MediaStreamTrack.onended`, `permissions` revoke, and `devicechange`.** (See Synthesis #5.)

## Optional Improvements

1. **Reconsider Option B (Vite + Bun.serve).** Same outcome, fewer moving parts, no `public/` write-while-running ambiguity, no RSC. Decision can be deferred to M0.5 (run a 1-hour Vite spike, abandon if it doesn't pay off).
2. **Add `caffeinate -dimsu` (or equivalent) instruction to M9 runbook** to prevent display sleep.
3. **Render the short URL as text below the QR in `QRScreen.tsx`** as a no-QR-app fallback.
4. **Localhost-bind the API route or session-token-gate uploads** to prevent a tunnel visitor from filling the disk.
5. **Add a mid-session "Walk away?" affordance** — soft 5s prompt during preview frames that asks if the user is still there, before the hard 30s reset, only in `qr-display` state.
6. **Pin Chromium to `localhost:3000/booth`** in the kiosk launch script (M9), not the tunnel URL, to keep camera permissions stable.

---

## Principle Violations (deliberate mode)

- **Principle 4 ("Event-day reliability over polish") — partial violation.** The plan's choice of Option A while simultaneously documenting Risk #7 ("Next.js dev-mode HMR breaks camera") and offering "fall back to Option B" as the mitigation contradicts Principle 4. *Severity: medium.* The mitigation should be inside the chosen stack, not a stack swap.
- **Principle 3 ("Client-side compositing is the source of truth") — held.** No violations.
- **Principle 5 ("Single static asset path") — held.** Frame metadata in `lib/frames.ts` is correct.
- **Principle 1 ("Local-first, zero cloud dependency") — held.** ngrok is operator-run, not a hosted dependency.

---

## References

- `.omc/specs/deep-interview-y2k-photobooth.md:29` — spec lists Next.js *or* SPA+static as equivalents (Option A is not mandated).
- `.omc/specs/deep-interview-y2k-photobooth.md:34` — output PNG mandated 1080×2400.
- `.omc/specs/deep-interview-y2k-photobooth.md:58` — AC#7 hard-requires public URL (correctly invalidates Option C in plan).
- `.omc/plans/y2k-photobooth-plan.md:73` — Risk #7 acknowledges HMR+camera incompatibility with Option B as fallback (self-flagged).
- `.omc/plans/y2k-photobooth-plan.md:210` — `NEXT_PUBLIC_TUNNEL_ORIGIN` build-time inline issue.
- `.omc/plans/y2k-photobooth-plan.md:142` — `useReducer` choice (adequate; XState would be over-engineering — agreed with plan).
- `.omc/plans/y2k-photobooth-plan.md:178–183` — sheet-composer cell math left "to implementation"; mockup mismatch unaddressed.
- `.omc/plans/y2k-photobooth-plan.md:222` — idle timer not state-gated.
- `/Users/a1111/Desktop/ozcoding-pd09-booth/sheet-mockup.png` — verified 720×1800 RGB; mismatches plan's 1080×2400 target.
- `/Users/a1111/Desktop/ozcoding-pd09-booth/{burger,ramen,tamagotchi,teeth,mic,cosplay,waiter}.png` — verified 720×900 RGBA; chroma-key may be a no-op (plan's M1 self-detects this correctly).

---

## Iteration 1 Re-review

**Mode:** `--consensus` re-review pass (1/5)
**Plan version reviewed:** Revision 1 (`y2k-photobooth-plan.md` lines 1–523)
**Date:** 2026-05-06

---

### Verdict

**ITERATE** — five of six required revisions land cleanly, but the M4/M5 numeric specs contain two real arithmetic errors that will cause failing unit tests on day one of M4 and a slightly squashed face in every saved sheet. Both are 30-minute fixes inside existing milestones; no architectural rework needed. After those two number-corrections the plan is APPROVE-ready.

---

### Per-finding verification (6 line items)

1. **Server-derived public URL** — **PASS.** Plan §M6 lines 256–273 read `X-Forwarded-Host` first, fall back to `host`, and resolve protocol via `X-Forwarded-Proto` with a sound ngrok-implies-HTTPS heuristic. Atomic `.tmp.png` → `fs.rename` is correct (line 263). Degenerate-host fallback (line 259) hands off to `window.location.origin` on the client, which is acceptable.

2. **Selfie mirror policy** — **PASS.** Plan §M2 lines 121–123 and §M4 lines 188, 197–198 lock CSS-only mirroring with `MIRROR_PREVIEW = true` constant. The unit test at line 198 (`pixel (10,0) red stays red`) genuinely catches the regression: if a future contributor adds `ctx.scale(-1, 1)` to `captureCut`, pixel (10,0) becomes blue (the stub's right-edge color) and the test fails. Testable, specific, and load-bearing.

3. **Sheet aspect resolution** — **PARTIAL.** Locking output to 1080×2400 with mockup as reference-only (line 213) is correct. Cell-fit math (lines 215–227) is internally consistent and asserted in tests. **However:** M4 outputs cuts at 540×600 (aspect 0.9000) and M5 downscales them into 508×576 cells (aspect 0.8819). Plan line 222 calls this a "lossless ratio" — it is not. Horizontal scale factor 508/540 = 0.9407, vertical 576/600 = 0.9600. The face is compressed horizontally by ~2% relative to vertical — visible as subtly-squashed faces on every sheet. **Fix:** either (a) make cuts 508×576 directly in M4 (cleanest), or (b) make cells 508×564 with 32px row gutters (preserves 0.9), or (c) explicitly accept the ~2% non-uniform scale and document it. Plan must pick one.

4. **Idle-timer state-gating** — **PASS.** Lines 161–164 gate to `{idle, qr-display, camera-priming-error}`. The `error` state IS included (`camera-priming-error`). Excludes `composing` correctly. Test at line 432–433 explicitly asserts the timer never fires from `countdown | flash | preview | composing`. Coverage is complete.

5. **Camera lifecycle table** — **PASS.** Lines 132–136 enumerate 4 events with concrete recovery actions. All four are implementable with stable browser APIs (`document.visibilitychange`, `MediaStreamTrack.onended`, `permissions.query`, `navigator.mediaDevices.ondevicechange`). The `permissions.query` polling on focus (rather than `onchange`) is a sound choice — `permissions.query(...).addEventListener('change', …)` has Chrome inconsistency in kiosk mode. No hand-waving.

6. **DPR / cover-crop math (Critic finding #6)** — **FAIL.** The contract for `lib/cover-crop-math.ts` is correctly spec'd as a pure helper (line 141), and the test scaffold at lines 200–204 covers landscape/portrait/square cases. **However:** the asserted numbers in lines 201–203 are arithmetically wrong.
   - Test 1 (1280×720 → 540×600): plan asserts `sx=387, sy=0, sw=506, sh=720`. Correct values for `object-fit: cover` are `sx=316, sy=0, sw=648, sh=720`. (Source aspect 1.778 > dest aspect 0.900, so crop sides: `sw = srcH × dstW/dstH = 720 × 0.9 = 648`; `sx = (1280-648)/2 = 316`.) Plan's 506 number appears to be `srcH × dst_aspect_of_540×600_treated_as_landscape` — a confused derivation.
   - Test 2 (720×720 → 540×600): plan asserts `sx=0, sy=36, sw=720, sh=648`. Correct values are `sx=36, sy=0, sw=648, sh=720`. (Source aspect 1.0 > dest aspect 0.9, crop sides not top/bottom.) Plan inverted which axis to crop.
   - Test 3 (540×600 → 540×600): identity is correct.
   These wrong numbers will be implemented faithfully if the test is taken as the contract — the helper will produce `cover` for a different dest aspect than 540×600, and live preview alignment will not match captured cuts.

---

### New issues introduced by v2

1. **Cover-crop test fixtures contain wrong arithmetic** (covered as #6 above). Severity: blocking M4 acceptance.

2. **Cut-vs-cell aspect mismatch documented but not resolved** (covered as #3 above). Severity: medium — visible face distortion.

3. **Frame-PNG drawing in `captureCut` re-introduces the same DPR/cover question.** Plan line 195 says `ctx.drawImage(frameImg, 0, 0, 540, 600)` — frame is 720×900, dest is 540×600 (different aspect 0.8 vs 0.9). This stretches the frame non-uniformly: horizontal scale 540/720=0.75, vertical 600/900=0.667. The face hole drawn at 720×900 PNG coordinates will end up at the wrong relative position on the captured cut. This is a NEW bug introduced by locking the cut canvas to 540×600 in v2 (v1 used 720×900 cuts). **Fix:** either match cut canvas to frame native 720×900 and downscale once at sheet time, or apply consistent cover-fit on the frame as well.

4. **No Webpack/Turbopack mention for `next start` runtime stability.** Next 15 defaults to Turbopack for `next dev` only; `next start` always uses the production webpack build. This is fine but undocumented — a teammate could mistakenly invoke `next dev --turbo` in rehearsal and get inconsistent behavior. Minor doc add to M9.

---

### Remaining concerns (numbered, critical only)

1. **Fix cover-crop test arithmetic (M4).** Recompute the table-driven assertions for landscape/square sources or use a tolerance-based numeric check that recomputes from first principles. This is the single highest-priority blocker.

2. **Resolve cut/cell/frame aspect chain (M4 + M5).** Pick one of: (a) cuts 508×576 native, (b) cells 508×564 with 32px row gutters, (c) accept and document ~2% horizontal squash. Whichever path, M4's `captureCut` must apply consistent cover-fit to BOTH video AND the frame PNG so the face-hole alignment between live preview and saved cut is preserved.

---

### Optional polish (numbered, non-blocking)

1. **Document Turbopack vs webpack.** README M9 should add a one-line note: "`next dev` uses Turbopack; `next start` uses the webpack production build. Always test camera in `next start`."

2. **Production-mode-only stance is well-documented.** Principle 4 (line 19), Risk #7 (line 416), §6 Out of Scope (line 470), and ADR Consequences (line 492) all explicitly forbid `next dev` at the event. README runbook (M9 lines 318–320) reinforces this. The dev workflow for non-camera changes (CSS tweaks, copy edits) is implicitly preserved — `next dev` is forbidden only for "any rehearsal that touches the camera" (line 19), so a designer touching Tailwind classes can still HMR. This is a defensible stance and no contradiction between v1 and v2 was introduced.

3. **`next dev` HMR camera hazard reference.** Plan asserts this (line 19, line 416) but cites no public bug or repro. A line in M9 troubleshooting with a concrete symptom ("if you see `MediaStream ended unexpectedly` after a hot reload") would make the rule self-justifying for new operators.

4. **Tests directory inconsistency.** Plan mixes `lib/*.test.ts` (lines 197, 200, 432) and `__tests__/grid-math.test.ts` (lines 236, 393, 431). Pick one convention before M0.

5. **`degenerate host` fallback is silent.** M6 line 260 says the QR encodes a `window.location.origin` URL when no host header exists — but on the kiosk that origin is `http://localhost:3000`, which a phone cannot reach. Recommendation: when host is unresolvable, the API should return HTTP 503 with a banner so the operator notices — silent fallback to localhost is the worst of both.

---

### Summary

Plan v2 is materially better than v1. Five of six required revisions land cleanly (server-derived URL, mirror policy, idle-gating, camera lifecycle, principle-4 commitment to production-mode-only). Two arithmetic errors remain — the cover-crop test fixtures are wrong, and the cut→cell→frame aspect chain compresses faces by 2% horizontally. Both are 30-minute fixes inside M4 and M5. After those, this plan is APPROVE-ready. No new architectural risk has been introduced; the production-mode stance is consistently propagated through Principle 4, Risk #7, §6, ADR, and the README runbook with no v1↔v2 contradictions.

**Antithesis (steelman):** A reviewer arguing for APPROVE could correctly note that the 2% horizontal squash is below human perceptual threshold for non-side-by-side comparison, and the cover-crop test numbers are easy enough to fix in implementation that gating on them is pedantic. **Counter:** wrong test fixtures aren't a polish issue — they encode a wrong contract that will produce wrong runtime alignment between live preview and saved cuts (the very class of bug the test was added to prevent). Fix before `start-work`, not during.

---

## Iteration 2 Re-review

**Mode:** `--consensus` re-review pass (2/5)
**Plan version reviewed:** Revision 2 (`y2k-photobooth-plan.md` lines 1–614)
**Date:** 2026-05-06

---

### Verdict

**APPROVE** — both prior blockers are resolved with arithmetically correct numbers, all three polish items land cleanly, no v2/v3 contradictions remain, and the ADR is complete. Two minor nits below are non-blocking. Plan is ready for `start-work`.

---

### Cover-crop fixtures verification (5 fixtures, recomputed from first principles)

Formula applied: `scale = max(dstW/srcW, dstH/srcH); sw = dstW/scale; sh = dstH/scale; sx = (srcW-sw)/2; sy = (srcH-sh)/2` for dest = 512×576.

| # | Source | scale | sw | sh | sx | sy | Plan claim (line 213–217) | Verdict |
|---|--------|-------|------|------|------|------|---------------------------|---------|
| 1 | 1280×720 | max(0.4, 0.8) = **0.8** | 640 | 720 | 320 | 0 | sx=320, sy=0, sw=640, sh=720 | **PASS** |
| 2 | 720×1280 | max(0.7111, 0.45) = **0.7111** | 720 | 810 | 0 | 235 | sx=0, sy=235, sw=720, sh=810 | **PASS** |
| 3 | 720×720 | max(0.7111, 0.8) = **0.8** | 640 | 720 | 40 | 0 | sx=40, sy=0, sw=640, sh=720 | **PASS** |
| 4 | 2560×1440 | max(0.2, 0.4) = **0.4** | 1280 | 1440 | 640 | 0 | sx=640, sy=0, sw=1280, sh=1440 | **PASS** |
| 5 | 512×576 | max(1.0, 1.0) = **1.0** | 512 | 576 | 0 | 0 | identity (sw=512, sh=576, sx=0, sy=0) | **PASS** |

**Note on fixture 5:** the verification prompt computed `max(512/512, 576/512) = 1.125`, but that mixes axes (`dstH/srcW`). The plan's source for row 5 is **512×576** (not 512×512), so source aspect 0.8889 already matches dest aspect 0.8889 → genuine identity. Plan is correct; the prompt's expected-fail trap was based on a misread of the source dimensions.

All 5 fixtures arithmetically correct. The blocker from iteration 1 (v1 cover-crop fixtures asserted sx=387/sw=506 etc.) is fully resolved.

---

### Aspect-chain verification (Path C1, hop by hop)

| Hop | Input | Output | Operation | Scale | Verdict |
|-----|-------|--------|-----------|-------|---------|
| Source video → cover crop | 1280×720 (aspect 1.778) | 640×720 source rect (aspect 0.889) | crop only, no scale on pixels | n/a (crop) | OK |
| Cover-crop rect → cut canvas | 640×720 | 512×576 | uniform downscale | 0.800× both axes | OK |
| Frame PNG (padded) → cut canvas | 800×900 (aspect 0.889) | 512×576 (aspect 0.889) | uniform downscale | 0.640× both axes (512/800 = 576/900 = 0.640) | OK |
| Cut canvas → sheet cell | 512×576 | 512×576 | 1:1 placement | 1.000× | OK |
| Frame uniformity assertion | 800/512 = 1.5625 | 900/576 = 1.5625 | identical → no shear | residual <1e-9 | OK |

**End-to-end:** ONE aspect ratio (0.8889) on photographic content from cover-crop output through final cell placement. Zero non-uniform scale. Live preview (CSS `object-fit: cover` on 512:576 container) and saved cut (cover-crop math producing same crop) align pixel-faithfully.

**Cell math arithmetic (independently recomputed):**
- Width: `2·20 + 1·16 + 2·512 = 40 + 16 + 1024 = 1080` ✓
- Height: `20 + 3·16 + 4·576 + 28 = 20 + 48 + 2304 + 28 = 2400` ✓
- Cell origins: col0=20, col1=548; row0=20, row1=612, row2=1204, row3=1796 ✓
- Bottom edge: 1796 + 576 = 2372; 2400 - 2372 = 28 (matches margin_bottom) ✓

**On the asymmetric 20-top / 28-bottom:** Plan documents the choice at line 257 — the alternative `gutter=18, margin=20/20` falls 2px short. The asymmetry is mathematically forced by the integer-fit constraint at cell=576, not a typo. **Visual balance:** 8px difference at full 2400px height is 0.33% — well below human perceptual threshold for symmetry. The title card occupies cell 7 (bottom-right) with the same 28px margin below it as every other bottom-row cell. Acceptable.

**Alternative that fully balances:** `margin_top=24, row_gutter=16, margin_bottom=24` gives `24 + 48 + 2304 + 24 = 2400` ✓ — also exact-integer, fully symmetric. Either choice is valid; plan's 20/28 is fine but **24/24 would be marginally cleaner**. Non-blocking; raised as optional polish.

---

### Polish item verification

**3. Test directory consistency — PASS.**
`grep -n "__tests__"` against the v3 plan returns 3 hits (lines 86, 271, 555), all of which are explicit *negations* ("**No `__tests__/` directory**"). Zero stale `__tests__/grid-math.test.ts` references survived from v1/v2. Vitest config (line 86) explicitly includes only `lib/**/*.test.ts` and `scripts/**/*.test.ts`. Convention is locked.

**4. Fail-loud 503 fallback — PASS.**
Full error path is plumbed end-to-end:
- M6 route (line 312): API returns `Response.json({error:'tunnel-public-host-unavailable'}, {status:503})` on missing host header.
- M6 client helper (line 316): `lib/upload-sheet.ts` throws `TunnelHostUnavailableError` on 503.
- M6 test (line 315): asserts 503 path on missing host header.
- M7 UI (line 329): `components/TunnelHostErrorBanner.tsx` renders Korean copy when `uploadSheet` throws.
- Session machine (line 430): `'tunnel-host-error'` is a first-class state in `SessionState` union (line 422–430).
- Session machine test (line 508): asserts `tunnel-host-error` transition.
- Shared types (line 446–451): `TunnelHostUnavailableError` class exported from `lib/types.ts`.
- M8 idle-timer state-gating (line 167): `camera-priming-error` is in the eligible set; `tunnel-host-error` is **not explicitly listed but should be** — see Remaining Concern #1 below.

The error is no longer swallowed; it surfaces to the user via banner. Plumbing is real, not paper.

**5. AC-by-AC manual verification table — PASS.**
M9 §"Pre-event smoke test (T-24h)" (lines 373–391) is an 11-row table, one row per spec AC#1–AC#11. Verified by counting rows and cross-referencing AC numbers. Each row has Steps / Expected / Pass criterion columns.

**Volunteer-runnability spot-check:**
- AC#1 row: "Open `http://localhost:3000/booth` (cold). Click 시작. Expected: Camera permission prompt → grant → live video appears within 3s. Pass: Live video frame visible, no black box." — runnable by a non-developer, yes.
- AC#7 row: requires opening "the booth's running terminal/log" to inspect API response — assumes operator has terminal access and can read JSON. **Marginally developer-flavored**, but the kiosk operator at this event is the same person setting up `npm run kiosk` and `ngrok`, so they already have a terminal open. Acceptable for the actual event ops profile.
- AC#11 row: requires understanding of "gitignored" vs "on disk" persistence — this is the most developer-flavored row. The pass criterion ("Operator confirms either persistence OR wipe behavior matches expectation. Documented in README.") is more of a discussion item than a strict pass/fail. Non-blocking; the README documentation will resolve it.

Net: all 11 ACs covered, runnability is appropriate for the actual ops profile (the dev-operator at this single event).

---

### Remaining concerns

**1. Minor — `tunnel-host-error` state should be in the idle-timer eligible set.**
Line 167 lists `{idle, qr-display, camera-priming-error}` as states where the 30s idle timer fires. The new `tunnel-host-error` state (line 430) is logically equivalent to `camera-priming-error` (a terminal error blocking session continuation; user/operator must reset). Currently if the booth lands in `tunnel-host-error`, the 30s auto-reset will not fire — the operator must manually press the retry button on `TunnelHostErrorBanner`. This is probably the desired behavior (don't silently re-arm a broken booth), but the plan should be explicit one way or the other. **Non-blocking.** Recommendation: add `tunnel-host-error` to the eligible set OR add a one-line note "tunnel-host-error requires manual retry; idle timer is suppressed by design."

**2. Minor — symmetric margin alternative not explored.**
Plan locks margin_top=20, margin_bottom=28 (line 255). The alternative `margin_top=24, margin_bottom=24, row_gutter=16` gives `24 + 48 + 2304 + 24 = 2400` ✓ — also exact-integer, fully symmetric. Plan considered `gutter=18` (2px short) but did not consider `margin=24/24`. **Non-blocking;** the 8px asymmetry is below perceptual threshold, but if the team prefers symmetric margins they can swap to 24/24 with no other changes.

**3. Minor — no go/no-go gate before M0.**
Plan's M0 (line 70–93) jumps directly into `package.json` creation. There is no explicit pre-M0 verification of: Node ≥ 20, npm ≥ 10, `sharp` installable on the host platform (sharp has known issues on Apple Silicon without explicit `npm rebuild`), camera permissions on the actual event laptop, ngrok account/auth status. The verification prompt asked specifically for this gate. **Non-blocking,** but a 5-line "M-pre" subsection in M9 README or a top-level "Prerequisites" callout in the plan would prevent a 10-minute event-day surprise. Recommendation: add a "Prerequisites" subsection at the top of M0 listing the runtime version requirements.

**4. Already raised in iteration 1, still PARTIAL — title-card aspect.**
Title card is 720×900 (aspect 0.800), drawn into 512×576 cell (aspect 0.889) at line 268. Plan acknowledges this is non-uniform: horizontal scale 0.7111, vertical 0.640. Plan's mitigation is "title is text-on-pink, no faces, accept the 11% non-uniform stretch." This is documented (line 268, follow-up at line 588). The aspect-chain claim "ONE aspect ratio end-to-end" (line 248) has this acknowledged exception. **Non-blocking,** but flagged that the marketing claim is technically "ONE aspect ratio on photographic content; title card is a documented exception."

---

### v2 vs v3 contradiction sweep

Searched for stale references that didn't get cleaned up:
- All references to `540×600`, `508×576`, "lossless ratio" (v2 numbers) → **none found** in v3.
- All references to `__tests__/grid-math.test.ts` (v2 path) → **none found** as live; only the 3 explicit negations.
- All references to `NEXT_PUBLIC_TUNNEL_ORIGIN` → **none found** as live; only "DELETED" at line 330 and "Replaces the deprecated `NEXT_PUBLIC_TUNNEL_ORIGIN`" at line 291. Cleanly removed.
- Mirror policy constant `MIRROR_PREVIEW = true` → consistent at lines 128, 401.
- `lib/public-url.ts` → marked DELETED at line 330; no other references exist. Clean.
- Cover-crop math contract → consistent between M2 (line 146), M4 (line 209), tests (line 505).
- Cell dimensions 512×576 → consistent at lines 130, 132, 147, 192, 196, 203, 207, 213–217, 240–242, 252, 261, 274–278, 411, 417, 467, 498, 506–507, 602.

**No v2↔v3 contradictions.**

---

### ADR completeness check

| Section | Present? | Quality |
|---------|----------|---------|
| Decision | Yes (line 562) | Concrete: full stack + production-mode-only + atomic write + 800×900 padding + ngrok |
| Decision drivers | Yes (line 564) | 5 named drivers, each maps to a constraint |
| Alternatives considered | Yes (line 566–571) | 5 alternatives: Option B, Option C, Path A, Path B, Path C1 — all with hard reasons for invalidation/rejection |
| Why chosen | Yes (line 573) | Maps Path C1 to Principle 4 + tunnel-rebuild hazard + uniform aspect; explicit "no stack-swap escape hatch" |
| Consequences | Yes (line 575–581) | 6 named consequences (Next.js heaviness accepted; manual ngrok step; no env reload; client-side compositing; preprocess asset bloat 2MB; `next dev` forbidden; AC-indexed smoke) |
| Follow-ups | Yes (line 583–588) | 4 named: cloudflared named tunnel, --kiosk auto-launch, frame-pack module, localhost-origin guard, title-card re-author |

ADR is **complete**. All six required sections present with substance, not boilerplate. Stronger than typical — the alternatives section invalidates *both* stack alternatives (B, C) AND aspect alternatives (Paths A, B), giving Path C1's recommendation a falsifiable footing.

---

### Consensus addendum

- **Antithesis (steelman):** A reviewer arguing for ITERATE could note that the asymmetric 20/28 vertical margin is unusual aesthetically and the lossless 24/24 alternative wasn't explored. **Counter:** the 8px difference is 0.33% of total height and below perceptual threshold; both choices are exact integer fits; this is a polish nit not a blocker.

- **Tradeoff tension:** Path C1's 800×900 padding adds ~2MB of asset weight (line 579) for the benefit of a uniform 0.8889 aspect chain. The alternative — keeping frames at native 720×900 (0.800) and changing cells to 480×600 (0.800) — would have saved the asset weight but doesn't fit 4 rows × 600px in 2400px height (`24·2 + 16·3 + 600·4 = 2496 > 2400`). The trade was forced; padding is the only feasible path. This was correctly identified in the Critic's iter-1 review (Path A infeasibility) and adopted.

- **Synthesis:** Plan already represents the synthesis between "uniform aspect" (architect priority) and "feasible cell math" (critic constraint). No further synthesis available.

- **Principle violations (deliberate mode):** None. Principle 4 (event-day reliability) is held with in-stack mitigation (production-mode only, no escape hatch). Principle 5 (single asset path / one aspect) is held end-to-end on photographic content with the title-card exception explicitly documented.

---

### Final verdict

**APPROVE.** Iteration 2 is clean. Both prior blockers (cover-crop arithmetic, aspect-chain stretch) are resolved with arithmetically correct numbers verified from first principles. Three polish items (test convention, fail-loud 503, AC verification table) all land. ADR is complete. No v2/v3 contradictions. Three remaining concerns are non-blocking minors (idle-timer eligibility for `tunnel-host-error`, optional 24/24 symmetric margin, optional pre-M0 prerequisite gate).

The plan is ready for `start-work`. Recommended next step: hand off to `/oh-my-claudecode:start-work y2k-photobooth-plan`.

