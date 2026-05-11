# Y2K/MZ Photobooth — Implementation Plan (Revision 2)

**Plan ID:** y2k-photobooth-plan
**Source spec:** `.omc/specs/deep-interview-y2k-photobooth.md` (ambiguity 9%, PASSED)
**Mode:** `--direct --consensus` (Architect + Critic ITERATE x2 → revised)
**Event date:** 2026-05-14 (8 days from plan generation)
**Working dir:** `/Users/a1111/Desktop/ozcoding-pd09-booth/`
**Revision:** 2/5 — fixes 2 hard blockers (cover-crop arithmetic, aspect-chain stretch) + 3 polish items (test conventions, fail-loud host, AC verification table)

---

## 1. RALPLAN-DR Summary

### Principles (5)

1. **Local-first, zero cloud dependency.** Laptop + venue Wi‑Fi + a manually-run tunnel is the entire production stack. No Vercel deploy, no Supabase, no S3 in the MVP path.
2. **No AI/ML.** Per spec round 4, face cutout is solved by *the user physically aligning into a transparent hole* in the frame. We will reject any temptation to add MediaPipe/face-api/rembg later.
3. **Client-side compositing is the source of truth.** Canvas 2D draws (video + frame PNG) per cut and (7 cuts + title) for the sheet. The "server" only persists the already-finished PNG and serves it back.
4. **Event-day reliability over polish — production-mode runtime only.** The booth runs `next build && next start` (production mode) at the event. `next dev` is forbidden during any rehearsal that touches the camera (HMR is a known camera-stream hazard). The mitigation lives *inside* the chosen stack — there is no stack-swap escape hatch.
5. **Single static asset path; one aspect ratio end-to-end.** Frame PNGs live in `public/frames/processed/` with a typed metadata table. Pre-processing pads frames to 800×900 (aspect 0.8889) so the entire pipeline (frame → cut → cell) runs at one aspect ratio with sub-pixel residuals only.

### Decision Drivers (top 3)

1. **Setup time vs. flexibility.** ~8 days, one event. Choose stacks that minimize unknowns — Next.js scaffolding + Tailwind + Canvas 2D are paths the team knows.
2. **Event-day failure surface.** Each added moving part (DB, external API, websocket, service worker, build-time env) is one more thing to debug at 2pm on event day. Minimize moving parts; keep all tunable values runtime-resolved.
3. **QR-target reachability.** The QR code must point at a URL a phone on either venue Wi‑Fi *or* cellular can hit. This forces a public tunnel — and the tunnel hostname must be discoverable at *request time*, not bake-time.

### Viable Options

#### Option A — Next.js 15 App Router full-stack, production mode only (RECOMMENDED)

Single Next.js project. Pages render the kiosk UI; a single `POST /api/captures` route writes the composed PNG to `public/captures/{uuid}.png` and returns `{ id, url, publicUrl }` where `publicUrl` is derived **at request time** from the incoming `Host` header. Operator runs `npm run kiosk` (= `next build && next start`) on the laptop and `ngrok http 3000` separately. **No `next dev` at the event.**

**Pros**
- One package, one production command (`npm run kiosk`).
- API route + static serving from one origin — QR target URL is just `${publicProto}://${host}/captures/${id}.png`.
- TypeScript + React 19 + Tailwind out of the box; matches spec recommendation.
- Server-side request inspection lets us read `Host`/`X-Forwarded-Host` per request (no rebuild on tunnel restart).

**Cons**
- Heavier than strictly necessary (RSC machinery for what is effectively a client-rendered SPA). Mitigated by `dynamic = 'force-dynamic'` on the one API route.
- App Router caching defaults can bite if mishandled — guarded by explicit `dynamic = 'force-dynamic'` and `revalidate = 0`.

#### Option B — Vite SPA + Bun.serve static + API

Vite + React for the UI; Bun.serve for `POST /captures` and `/captures/*`. Same `lib/*` files (capture, sheet-composer, session-machine) — framework-portable.

**Pros**
- Smaller surface (no RSC, no caching layer).
- Bun.serve is a single file; trivial to reason about request inspection.

**Cons**
- Two build pipelines (Vite for client, Bun for server) or hand-rolled combined script.
- Diverges from spec recommendation; we'd reinvent multipart upload.

#### Option C — Pure client-side + `data:` URL QR

**Invalidated.** QR Version 40 binary capacity ≈ 2.9 KB; a 1080×2400 PNG base64-encodes to ~1–3 MB. Spec AC#7 hard-requires a public URL. Cannot satisfy.

### Recommendation: **Option A (Next.js 15 full-stack, production mode only)**

Risk #7 is mitigated *in-stack* by mandating `next start` (never `next dev`) and explicit `dynamic = 'force-dynamic'` on the one API route. Option B remains documented for completeness but is not a fallback path.

---

## 2. Implementation Plan

> **Existing state:** Working directory contains only the 9 PNG assets and `.omc/` metadata. No `package.json`, no `node_modules`. M0 starts from an empty repo.

### M0 — Repo bootstrap (S, ~0.5 day)

**Goal:** Runnable Next.js 15 + TS + Tailwind project at `next dev` (development) and `next start` (production-mode kiosk runtime), with assets relocated.

**Files to create:**
- `/Users/a1111/Desktop/ozcoding-pd09-booth/package.json` — name, scripts:
  - `dev` (development only — never used at event)
  - `build` (`next build`)
  - `start` (`next start`)
  - `kiosk` (`next build && next start` — the event-day command)
  - `lint`, `preprocess`, `test`
  - Deps: `next@15`, `react@19`, `react-dom@19`, `qrcode`. DevDeps: `sharp`, `typescript`, `@types/react`, `@types/node`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `eslint-config-next`, `vitest`, `@vitest/ui`, `jsdom`, `tsx`.
- `tsconfig.json` — strict, App Router defaults.
- `next.config.mjs` — minimal.
- `tailwind.config.ts` — Y2K palette (pink/yellow), pixel font family, `>=200pt` countdown size class.
- `postcss.config.mjs`, `.eslintrc.json`.
- `vitest.config.ts` — co-located test convention: `include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts']`. **No `__tests__/` directory.**
- `.gitignore` — `node_modules`, `.next`, `public/captures/`, `.env*`, `.DS_Store`.
- `app/layout.tsx`, `app/globals.css`, `app/page.tsx`.
- `public/frames/raw/{burger,ramen,tamagotchi,teeth,mic,cosplay,waiter,title-card,sheet-mockup}.png` — moved from repo root.
- `README.md` — placeholder, expanded in M9.

**Acceptance criteria satisfied:** none directly; foundation for all.

---

### M1 — Frame preprocessing script (S, ~0.5 day)

**Goal:** Verify alpha=0 in face-hole regions; chroma-key any frames still solid pink. **Pad each 720×900 frame to 800×900 with transparent margin** so the entire downstream pipeline runs at aspect 0.8889. Output 800×900 RGBA PNGs to `public/frames/processed/`.

**Why pad to 800×900 (not resample):** Frame artwork at native 720×900 has aspect 0.800; cut canvas + cell must run at aspect 0.8889 for uniform-scale sheet composition (see M5 aspect-chain proof). Padding (NOT resampling) preserves all frame pixels at native resolution and adds 40px transparent columns on each side. Face-hole pixel positions stay byte-exact; no resampling artifacts on Y2K bling.

**Files to create:**
- `scripts/preprocess-frames.ts` — Node script via `tsx`, uses `sharp`:
  1. For each of 7 frames: load 720×900 PNG, sample center-region pixels.
  2. If alpha=0 in face-hole region → keep as-is.
  3. If solid pink (target `rgb(255, 150, 180)` ± 15% fuzz) → set those pixels' alpha to 0.
  4. Pad to 800×900 with transparent (alpha=0) margin: 40px left, 40px right, 0px top, 0px bottom.
  5. Write to `public/frames/processed/{name}.png` (800×900, RGBA).
  6. Copy `title-card.png` and `sheet-mockup.png` (reference-only, see M5) through unmodified.
  7. Log per-frame report including final dimensions and padding bytes.
- `scripts/sample-frame-alpha.ts` — diagnostic that prints alpha histograms.
- `scripts/preprocess-frames.test.ts` — fixture PNG with known pink area and known dimensions → asserts (a) output is 800×900, (b) alpha=0 in keyed pixels, (c) original 720-wide artwork is centered-padded with 40px transparent each side.

**npm script:** `"preprocess": "tsx scripts/preprocess-frames.ts"`.

**Acceptance criteria satisfied:** AC#3.

---

### M2 — Camera + LiveOverlay component (M, ~1.5 days)

**Goal:** Render the camera feed full-bleed with the active frame PNG on top, plus "컷 N/7" label. Mirror the live preview but *not* the captured cut. Handle full camera lifecycle.

**Mirror policy (locked here, used by M4):**
- Live `<video>` element receives CSS `transform: scaleX(-1)` (preview is mirrored — selfie convention).
- Captured cut from `drawImage(video, …)` is **un-mirrored** (raw camera pixels). M4 does NOT apply `ctx.scale(-1, 1)` — saved photo reads correctly (text on shirts).
- Constant `MIRROR_PREVIEW = true` in `lib/types.ts`. Document at top of `LiveOverlay.tsx` and `lib/capture.ts`.

**DPR + `object-fit: cover` crop alignment (locked here, used by M4):**
- `<video>` is sized by CSS to fill a fixed-aspect container. The container CSS aspect is **512/576 = 0.8889** to match the cut canvas and frame PNG. It uses `object-fit: cover`, so visible-pixels = a centered crop of the source `videoWidth × videoHeight`.
- M4's `drawImage` must reproduce that exact crop using `sx, sy, sw, sh` from raw video coords (see `lib/cover-crop-math.ts` below).
- Backing canvas is fixed at 512×576 (per-cut output, see M4) — independent of `window.devicePixelRatio`. We never read display-pixels; we always read source-stream pixels and let the cover-crop helper translate.

**Camera lifecycle (4 events):**
| Event | Recovery action | User-visible state |
|-------|-----------------|--------------------|
| `document.visibilitychange` (tab hidden) | Pause countdown; keep stream open; resume on visible | Countdown freezes; "탭으로 돌아오면 계속됩니다" toast |
| `MediaStreamTrack.onended` (camera unplugged / stolen) | Tear down stream; route to `CameraDeniedBanner` | "카메라가 끊겼습니다. 다시 연결 후 새로고침하세요." |
| `permissions.query({name:'camera'})` revoked (poll on focus) | Same as `onended` | Same banner |
| `navigator.mediaDevices.ondevicechange` (USB swap) | Re-enumerate; re-acquire if current track ended | Brief "카메라 전환 중…" then back to live |

**Files to create:**
- `lib/types.ts` — shared TS types (Cut, Frame, SessionState, OutputSheet, CaptureRecord). See §3 below.
- `lib/frames.ts` — `FRAMES` const array of 7 entries `{ id, name, src, gridIndex, label }` plus title-card record (`gridIndex: 7`). Single source of truth.
- `lib/camera.ts` — `requestCamera()` wrapper around `getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })`. `releaseCamera(stream)`. Permission-denied error class. Lifecycle event wiring helpers (`onTrackEnded`, `onDeviceChange`, `onVisibilityChange`, `pollPermissionRevoke`).
- `lib/cover-crop-math.ts` — pure helper: `coverCrop({ srcW, srcH, dstW, dstH }) → { sx, sy, sw, sh }`. Replicates CSS `object-fit: cover` exactly. Uses formula `scale = max(dstW/srcW, dstH/srcH); sw = dstW/scale; sh = dstH/scale; sx = (srcW-sw)/2; sy = (srcH-sh)/2`. Unit-testable, used by M4.
- `components/LiveOverlay.tsx` — client component. Props: `frameSrc`, `cutIndex`, `total`. Container: fixed aspect 512:576 (e.g., 512px × 576px CSS, can scale up via media queries while preserving aspect). Children: `<video autoPlay muted playsInline style={{ transform: 'scaleX(-1)', objectFit: 'cover' }}>`, `<img>` of frame on top with `pointer-events:none` and matching `object-fit: contain` (frame is already padded to the right aspect — `contain` is exact 1:1), badge "컷 {cutIndex+1}/{total}".
- `components/CameraDeniedBanner.tsx` — fallback UI with retry button + Korean instructions.

**Acceptance criteria satisfied:** AC#1, AC#2, AC#3.

---

### M3 — Session state machine + Countdown UI (M, ~1.5 days)

**Goal:** Drive the full state graph deterministically with a 3‑2‑1 countdown rendered very large.

**State graph (locked):**
```
idle → camera-priming → countdown → flash → preview → (countdown for next cut | composing) → qr-display → idle
                ↓                                                                                       ↑
                camera-priming-error  ─────────────────────────────── (manual retry)  ──────────────────┘
```

**Idle-timer state-gating (used by M8):**
- 30s no-interaction timer fires `RESET` only when state ∈ `{idle, qr-display, camera-priming-error}`.
- Never fires during `camera-priming`, `countdown`, `flash`, `preview`, `composing` — the user is mid-session and must not be ejected.
- Implementation: `useEffect` deps include current state; timer is `clearTimeout`'d on every transition out of an idle-eligible state.

**Accessibility floor:**
- Countdown numeral ≥200pt, white text on a 60% black scrim, contrast ratio ≥7:1 against the camera feed.
- No flashing element exceeds 3Hz (epilepsy safety) — the "flash" state is a single 200ms full-white overlay (5Hz threshold not approached).
- Optional `aria-live="polite"` region announces "컷 {n}/7" on each transition.

**Files to create:**
- `lib/session-machine.ts` — `useReducer`-based machine. Exports `initialState`, `reducer`, action types: `START`, `CAMERA_READY`, `CAMERA_DENIED`, `CAMERA_LOST`, `TICK`, `CAPTURE_DONE`, `PREVIEW_DONE`, `COMPOSE_DONE`, `RESET`.
- `lib/session-machine.test.ts` — every transition; idle-timer state-gating (timer only fires from `idle | qr-display | camera-priming-error`).
- `components/Countdown.tsx` — receives `seconds: 3 | 2 | 1 | 0`, renders huge centered numeral with Y2K glow (≥200pt, ≥7:1 contrast).
- `components/CutPreview.tsx` — shows the just-captured composite frozen 700ms before advancing.
- `app/booth/page.tsx` — the orchestrating page. Holds `useReducer`, drives countdown via `setInterval`, glues LiveOverlay + Countdown + CutPreview + Composer + QRScreen.

**Timing budget per cut:** 3s countdown + 0.2s flash + 0.7s preview ≈ 3.9s × 7 = ~27s + ~1s start + ~2s compose = ~30s — well under 90s.

**Acceptance criteria satisfied:** AC#4, AC#5, AC#10.

---

### M4 — Cut capture (S, ~1 day)

**Goal:** At each shutter, draw the current video frame plus the active frame PNG onto a **512×576** canvas to produce one composited cut image — un-mirrored, with `object-fit: cover` crop math reproduced exactly, and **uniform-scale frame draw** (no non-uniform stretch).

**Per-cut resolution (locked):** Each cut canvas is **512×576 pixels** (aspect 0.8889; matches M5 grid cell exactly so M5 never upscales or non-uniformly resizes). `drawImage` source rect from the raw video stream; destination is the full 512×576 canvas.

**Mirror policy (enforced):** Captured cut is **un-mirrored**. Live preview is mirrored via CSS only. `captureCut` does NOT apply any horizontal flip.

**Frame draw (uniform-scale, no stretch):** Frame PNG was preprocessed to 800×900 (aspect 0.8889) in M1. Cut canvas is 512×576 (same aspect 0.8889). Therefore `drawImage(frameImg, 0, 0, 512, 576)` applies horizontal scale 512/800 = 0.640 and vertical scale 576/900 = 0.640 — **uniform**. No non-uniform stretch on Y2K artwork; face-hole alignment between live preview and saved cut is guaranteed pixel-faithful (same scale factor in both axes).

**Files to create:**
- `lib/capture.ts` — `captureCut(video: HTMLVideoElement, frameImg: HTMLImageElement): Promise<ImageBitmap>`. Steps:
  1. Create offscreen canvas at 512×576 (matches M5 cell exactly, matches frame aspect exactly).
  2. Compute `coverCrop({ srcW: video.videoWidth, srcH: video.videoHeight, dstW: 512, dstH: 576 })` → `{ sx, sy, sw, sh }`.
  3. `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 512, 576)` — un-mirrored.
  4. `ctx.drawImage(frameImg, 0, 0, 512, 576)` — frame on top, uniform downscale 0.640× from 800×900.
  5. Return `canvas.transferToImageBitmap()`.
- `lib/capture.test.ts` — unit tests:
  - **Mirror invariant:** Stub video where pixel `(10, 0)` is red and `(500, 0)` is blue. Captured canvas pixel `(10, 0)` must remain red (NOT swapped). Asserts no horizontal flip.
  - Verifies cover-crop math produces correct `sx,sy,sw,sh` for landscape 1280×720 source into 512×576 portrait dest (sx=320, sy=0, sw=640, sh=720 — see fixtures below).
  - Asserts frame draw scale is uniform 0.640× both axes (assert by drawing a frame fixture with marker pixels at `(0,0)`, `(799,0)`, `(0,899)`, `(799,899)` and reading them back at expected positions on the 512×576 canvas with sub-pixel tolerance).
- `lib/cover-crop-math.test.ts` — table-driven tests, **all derived from first principles** using `scale = max(dstW/srcW, dstH/srcH); sw = dstW/scale; sh = dstH/scale; sx = (srcW-sw)/2; sy = (srcH-sh)/2`. **Target dest is always 512×576 (aspect 0.8889).**

| # | Source | Dest | scale | sx | sy | sw | sh |
|---|--------|------|-------|----|----|----|----|
| 1 | 1280×720 (landscape webcam) | 512×576 | max(0.400, 0.800) = 0.800 | 320 | 0 | 640 | 720 |
| 2 | 720×1280 (portrait phone fixture) | 512×576 | max(0.7111, 0.450) = 0.7111 | 0 | 235 | 720 | 810 |
| 3 | 720×720 (square source) | 512×576 | max(0.7111, 0.800) = 0.800 | 40 | 0 | 640 | 720 |
| 4 | 2560×1440 (Retina @ DPR=2) | 512×576 | max(0.200, 0.400) = 0.400 | 640 | 0 | 1280 | 1440 |
| 5 | 512×576 (identity) | 512×576 | 1.0 | 0 | 0 | 512 | 576 |

Test 2 sy is `(1280-810)/2 = 235`. Test 4 confirms DPR-doubled source produces a doubled crop region (640 vs 320 sx) — proves the helper reads source-stream pixels regardless of the displayed CSS pixel size.

Edge case: source smaller than dest → still produces valid `sx≥0, sw>0` (e.g., 256×288 → 256×288, sx=sy=0).

**Acceptance criteria satisfied:** AC#5, AC#6 (input pipeline).

---

### M5 — Sheet composer (M, ~1 day)

**Goal:** After 7 cuts, compose them + `title-card.png` into a 1080×2400 PNG in a 4×2 grid (2 cols × 4 rows; cuts in positions 0–6, title in position 7), with **one aspect ratio end-to-end** and **zero non-uniform scale**.

**Aspect resolution (locked):** Independently verified `sheet-mockup.png` is 720×1800 (aspect 0.40); spec mandates 1080×2400 (aspect 0.45). **Spec wins. Output is 1080×2400.** `sheet-mockup.png` is reference-only for *visual intent* (frame style, gap proportions, background color) — NOT for exact aspect or pixel dimensions. Documented in `lib/sheet-composer.ts` JSDoc and in M9 README.

**Aspect-chain proof (explicit, asserted in tests):**

```
                                          aspect       scale to next stage
Source video stream:  1280×720             1.778        cover-crop (lossy by design — crops, never stretches)
Cover-crop output:    640×720 (test 1)     0.889        uniform downscale 0.800× to fill cut canvas
Cut canvas:           512×576              0.8889       1:1 placement onto cell (no scale)
Frame PNG (padded):   800×900              0.8889       uniform downscale 0.640× onto cut canvas
Sheet cell:           512×576              0.8889       cuts placed 1:1 (no scale)
Sheet output:         1080×2400 PNG        0.45         (cells laid out within margin/gutter math below)
```

- Cover-crop is the only scale operation that touches video pixels; it's uniform-scale by definition (`scale = max(dstW/srcW, dstH/srcH)` applied to both axes equally).
- Frame draw is uniform 0.640× both axes (800/512 = 900/576 = 1.5625× upscale ratio identically).
- Cut → cell is 1:1 (both 512×576). **No scale.**
- **End-to-end: ONE aspect ratio (0.8889) on the photographic content. Sub-pixel residuals only.**

**Cell math (locked, asserted in tests):**

Goal: 2 cols × 4 rows of 512×576 cells inside 1080×2400 with consistent margin/gutter.

- **Width arithmetic:** `2·margin + 1·col_gutter + 2·512 = 1080` → `2·margin + col_gutter = 56`. Pick **margin=20, col_gutter=16**: `40 + 16 + 1024 = 1080` ✓
- **Height arithmetic:** `margin_top + 3·row_gutter + 4·576 + margin_bottom = 2400` → `margin_top + margin_bottom + 3·row_gutter = 96`. Pick **margin_top=20, row_gutter=16, margin_bottom=28**: `20 + 48 + 2304 + 28 = 2400` ✓

Asymmetric vertical margin (20 top / 28 bottom) is the cleanest exact integer fit at gutter=16 with cell=576. Alternative `margin_top=20, row_gutter=18, margin_bottom=20` gives `20 + 54 + 2304 + 20 = 2398` (2px short). Documented in JSDoc.

- Cell origins (col, row) where `col = gridIndex % 2`, `row = floor(gridIndex / 2)`:
  - `x = 20 + col * (512 + 16)` → col 0: x=20, col 1: x=548
  - `y = 20 + row * (576 + 16)` → row 0: y=20, row 1: y=612, row 2: y=1204, row 3: y=1796
- Bounds check: `x_max + cellW = 548 + 512 = 1060 ≤ 1080` ✓; `y_max + cellH = 1796 + 576 = 2372`, plus `margin_bottom=28` → `2372 + 28 = 2400` ✓

**Files to create:**
- `lib/sheet-composer.ts` — `composeSheet(cuts: ImageBitmap[], titleImg: HTMLImageElement): Promise<Blob>`:
  - Canvas 1080×2400, fill background (Y2K pink/yellow per mockup intent).
  - For `i in 0..6`: drawImage(cuts[i], cellX[i], cellY[i], 512, 576) — **1:1 placement, no scale**.
  - For position 7: drawImage(titleImg, cellX[7], cellY[7], 512, 576). (Title card is RGB 720×900 — same aspect family if pre-processed; otherwise document the lone exception in JSDoc and accept the title-card stretch since it's text-on-pink with no faces.)
  - Optional 4px Y2K-pink inner border per cell.
  - Export via `canvas.convertToBlob({ type: 'image/png' })` — PNG, lossless.
- `lib/sheet-composer.test.ts` (co-located convention; **no `__tests__/` directory**) — asserts:
  - `cellOrigin(0) === { x: 20, y: 20 }`
  - `cellOrigin(1) === { x: 548, y: 20 }`
  - `cellOrigin(6) === { x: 20, y: 1796 }`
  - `cellOrigin(7) === { x: 548, y: 1796 }`
  - All 8 cells lie fully within 1080×2400 with margin (20,28) and gutter (16) constants honored.
  - Width sum: `20 + 512 + 16 + 512 + 20 === 1080`
  - Height sum: `20 + 4·576 + 3·16 + 28 === 2400`
  - **Frame uniformity:** assert that 800/512 - 900/576 < 1e-9 (proof that cut/cell/frame share aspect).

**Image format / size budget:** PNG (lossless), 1080×2400, photographic content + frame overlays. Estimated **2–5 MB**. Acceptable for QR-tunnel transfer over ngrok free tier (~5 Mbps egress = 4–8s download to phone). Documented in M9 troubleshooting.

**Acceptance criteria satisfied:** AC#6.

---

### M6 — Local PNG storage API + server-derived public URL (S, ~0.5 day)

**Goal:** Persist composed PNG atomically; return both relative URL and the **runtime-derived absolute public URL** that the QR will encode.

**Server-derived `publicUrl` (locked):** Replaces the deprecated `NEXT_PUBLIC_TUNNEL_ORIGIN` build-time env. The route inspects request headers per request — no rebuild on tunnel restart.

**Header resolution priority:**
1. `X-Forwarded-Host` (set by ngrok/cloudflared) → use as host.
2. `X-Forwarded-Proto` → use as protocol.
3. Falls back to `request.headers.get('host')` and protocol inferred from `X-Forwarded-Proto || 'https'` (ngrok always proxies HTTPS).
4. **Fail-loud fallback:** If neither `X-Forwarded-Host` nor `Host` is present (extreme edge case behind certain proxies), respond with HTTP **503** and body `{"error": "tunnel-public-host-unavailable"}`. The client renders a blocker banner ("터널 공개 호스트를 확인할 수 없습니다 — ngrok 상태와 새로고침 후 다시 시도하세요"). **No silent localhost fallback.**

**Why fail loud:** Silent fallback to `localhost:3000` produces QR codes that work for nobody — phones can't reach `localhost`, and the operator wouldn't notice for 5–10 minutes (until the first user complains). HTTP 503 surfaces the failure in <5 seconds: the booth's UI breaks immediately, the operator restarts ngrok, and only one user (instead of dozens) sees a broken QR. Documented in this milestone and in M9 troubleshooting.

**Atomic write (locked):**
- Write to `public/captures/{uuid}.tmp.png`.
- After write completes, `await fs.rename(tmpPath, finalPath)` — atomic on same filesystem.
- A concurrent reader either gets 404 (before rename) or the complete file (after rename). Never a partial PNG.

**Files to create:**
- `app/api/captures/route.ts` — `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const revalidate = 0;`
  - `POST` handler: accept `multipart/form-data` field `file`. Reject non-PNG or >10 MB.
  - Generate UUIDv4 filename.
  - Atomic write (`.tmp.png` → `fs.rename` to `.png`).
  - Resolve `host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')`.
  - **If `host` is null/empty: return `Response.json({error:'tunnel-public-host-unavailable'}, {status:503})`. Do NOT fall back to localhost.**
  - Resolve `proto = request.headers.get('x-forwarded-proto') ?? (host?.includes('ngrok') ? 'https' : 'http')`.
  - Return `{ id, url: '/captures/{uuid}.png', publicUrl: '${proto}://${host}/captures/{uuid}.png' }`.
- `app/api/captures/route.test.ts` (or `lib/upload-sheet.test.ts` testing the route via fetch) — asserts 503 path on missing host header.
- `lib/upload-sheet.ts` — client helper: `uploadSheet(blob: Blob): Promise<{ id, url, publicUrl }>` posting to the route. On 503: throws `TunnelHostUnavailableError` for the caller (M7 / booth page) to render the banner.
- `public/captures/.gitkeep` — keep dir; ignored otherwise.

**Acceptance criteria satisfied:** AC#7.

---

### M7 — QR display screen (S, ~0.5 day)

**Goal:** On `/booth` after compose, show the QR + sheet preview + "다음 사용자" button.

**Files to create:**
- `components/QRScreen.tsx` — props `{ sheetUrl, publicUrl, onReset }`. Uses `qrcode` to render `publicUrl` into a `<canvas>` at ~480px. Shows the sheet thumbnail next to it. Renders the short `publicUrl` *as text* below the QR (fallback for users without QR-reader apps). Big "다음 사용자" button.
- `components/TunnelHostErrorBanner.tsx` — full-screen error UI shown when `uploadSheet` throws `TunnelHostUnavailableError`. Korean copy: "터널 공개 호스트를 확인할 수 없습니다 — ngrok 상태와 새로고침 후 다시 시도하세요". Retry button.
- `lib/public-url.ts` — DELETED. Public URL is now server-derived in M6 and passed through to the client. No env var needed.

**Acceptance criteria satisfied:** AC#8, AC#9.

---

### M8 — Kiosk polish (M, ~1 day)

**Goal:** Survivable in event conditions. State-gated idle reset, fullscreen, expanded camera lifecycle wiring.

**Files to create/modify:**
- `components/FullscreenButton.tsx` — wraps `document.documentElement.requestFullscreen()` on first user gesture.
- `lib/idle-timer.ts` — 30s no-interaction timer. **State-gated**: only runs when current `SessionState ∈ {idle, qr-display, camera-priming-error}`. Pass current state into the hook; `clearTimeout` on every transition out of an idle-eligible state. Unit-tested.
- `lib/idle-timer.test.ts` — never fires from `countdown | flash | preview | composing`.
- `components/CameraDeniedBanner.tsx` — already in M2; expand with retry button + Korean instructions for the browser permission dialog.
- Update `app/booth/page.tsx` — guard: don't allow `START` while previous session is composing. Clean up `MediaStream` on unmount and on reset. Wire all 4 camera lifecycle events from M2.
- `components/StartScreen.tsx` — landing with brand + 시작 button. Disabled until first user gesture (so fullscreen works). Countdown text in StartScreen also obeys the ≥7:1 contrast / ≥200pt floor where applicable.

**Accessibility (locked, also covered by M3):** All countdown / large numerals ≥200pt, ≥7:1 contrast, no flash >3Hz. `aria-live="polite"` on the cut counter is optional.

**Acceptance criteria satisfied:** AC#1, AC#9, AC#10, AC#11.

---

### M9 — README + event-day runbook (S, ~0.5 day)

**Goal:** Anyone (operator on event day) can boot the booth from a cold laptop in <10 minutes; recover from a mid-event crash in <2 minutes; verify all 11 ACs T-24h before the event.

**Files to create:**
- `README.md` — sections:
  - Hardware checklist (laptop, USB webcam optional, charger, backup hotspot).
  - First-time setup (`npm i`, `npm run preprocess`).
  - Event-day boot (`npm run kiosk` (= `next build && next start`); separately `ngrok http 3000`; copy ngrok URL — **no rebuild needed**, the server reads it from each request's `Host` header). Open Chrome at `http://localhost:3000/booth`. F11 fullscreen.
  - macOS power: `caffeinate -dimsu &` to block display sleep.
  - Pin Chromium to `localhost:3000/booth` (camera permissions are per-origin; granting on `localhost` does not transfer to ngrok).
  - **Crash recovery:** "If the booth crashes mid-session: there is no in-progress recovery by design — the user starts a fresh session. To restart the server: kill any running `next start`, then `npm run kiosk` again. Previously-completed PNGs in `public/captures/` survive the restart (UUID filenames are stable), so QRs handed out earlier still resolve. Power-off DOES wipe everything (gitignored)."
  - **Tunnel host failure recovery:** "If you see `터널 공개 호스트를 확인할 수 없습니다`: your ngrok tunnel dropped or is misconfigured. Restart `ngrok http 3000`, copy the new URL, hit the booth at `http://localhost:3000/booth` again. The server reads the new hostname automatically — no rebuild."
  - Troubleshooting: camera denied → reset Chrome site permission; QR not loading on phone → check tunnel still alive AND that `Host` header on a sample request shows the ngrok hostname; black video → check macOS Camera privacy.
  - Sheet aspect note: `sheet-mockup.png` is reference-only (720×1800). Output PNG is canonically 1080×2400 per spec.
  - Post-event teardown: close laptop, OR `rm -rf public/captures/*` to wipe immediately.
  - **Pre-event smoke test (NEW, see below).**
- `.env.local.example` — empty (no `NEXT_PUBLIC_*` env vars needed in this revision; tunnel hostname is request-derived).

**Pre-event smoke test (T-24h, indexed by AC):**

A new section in `README.md` titled `## Pre-event smoke test (T-24h)`. Operator runs through this on the actual event laptop, using the actual webcam, in venue-equivalent lighting. Each row is one acceptance criterion; pass criterion is unambiguous.

| AC# | Steps to verify | Expected | Pass criterion |
|-----|-----------------|----------|----------------|
| 1 | Open `http://localhost:3000/booth` (cold). Click 시작. | Camera permission prompt → grant → live video appears within 3s. | Live video frame visible, no black box. |
| 2 | After camera activates, observe top-left badge and overlay. | Badge reads "컷 1/7"; first frame (e.g., burger.png) is overlaid on the video at full opacity except face hole. | Both badge text and frame artwork visible without overlap of face hole. |
| 3 | Move face into the pink-circle area of the first frame. | Pink-circle area is transparent — your face shows through; frame artwork surrounds it. | No solid pink area where your face should be. |
| 4 | After 시작 click, watch for countdown. | "3" → "2" → "1" each ~1s, then auto-shutter. | Countdown numerals ≥200pt, white-on-scrim, readable from 2m. Shutter fires at "0" without operator input. |
| 5 | Immediately after shutter. | Captured cut shown frozen 0.5–1s, then auto-advances to next countdown. | Preview image is the captured cut (with frame), not live video. Auto-advance happens within 1s. |
| 6 | Complete all 7 cuts. | After cut 7, ~1–2s composing delay, then sheet PNG appears 1080×2400 with 4×2 grid (7 cuts + title in position 7). | Sheet has 8 cells: cuts in positions 0–6 (top-left to bottom-left), title-card in position 7 (bottom-right). Aspect is portrait. |
| 7 | Open the booth's running terminal/log. | API call to `POST /api/captures` returned 200 with `{id, url, publicUrl}`. PNG exists at `public/captures/{id}.png`. | Both file exists AND `publicUrl` contains the ngrok hostname (not `localhost`). |
| 8 | Scan the on-screen QR with a phone (cellular, Wi-Fi off). | Phone opens the PNG; image downloads or displays. | PNG loads on phone within 10s; image is recognizable as the same sheet. |
| 9 | After QR appears, click "다음 사용자". | Returns to start screen with brand + 시작 button. | UI matches initial cold-boot state. |
| 10 | Time the entire flow from 시작 click to QR appearance with a stopwatch. | ≤90s total. | Stopwatch reads ≤90s. |
| 11 | After event simulation: close laptop, reboot, reopen at `http://localhost:3000/booth` (without re-running `npm run kiosk`). | Server is not running (expected). After running `npm run kiosk` again, `public/captures/` is empty (was gitignored, wiped on power-off if `/tmp` mounted, OR survives if on disk — verify operator preference). | Operator confirms either persistence OR wipe behavior matches expectation. Documented in README. |

**Failure isolation:** Each row is independently runnable. If row 7 fails (ngrok host missing), the operator sees the 503 banner immediately (per M6 fail-loud), can fix ngrok, and re-run that row alone.

**Acceptance criteria satisfied:** none directly; supports AC#1–#11 operationally.

---

## 3. Shared Types (`lib/types.ts`) — referenced by every milestone

```ts
// lib/types.ts
export const MIRROR_PREVIEW = true; // CSS-only; capture is un-mirrored.

export type FrameId =
  | 'burger' | 'ramen' | 'tamagotchi' | 'teeth'
  | 'mic' | 'cosplay' | 'waiter' | 'title';

export interface Frame {
  id: FrameId;
  name: string;     // Korean label
  src: string;      // /frames/processed/{id}.png (800×900 RGBA after M1)
  gridIndex: number; // 0–6 for cuts; 7 for title
}

export interface Cut {
  index: 0|1|2|3|4|5|6;
  frameId: FrameId;
  bitmap: ImageBitmap; // 512×576 (locked aspect 0.8889)
  capturedAt: number;
}

export type SessionState =
  | 'idle'
  | 'camera-priming'
  | 'camera-priming-error'
  | 'countdown'
  | 'flash'
  | 'preview'
  | 'composing'
  | 'qr-display'
  | 'tunnel-host-error'; // M6 503 fail-loud state

export interface OutputSheet {
  id: string;        // UUIDv4
  blob: Blob;        // 1080×2400 PNG
  url: string;       // /captures/{id}.png (relative)
  publicUrl: string; // server-derived absolute URL (QR target)
}

export interface CaptureRecord {
  id: string;
  url: string;
  publicUrl: string;
  createdAt: number;
}

export class TunnelHostUnavailableError extends Error {
  constructor() {
    super('tunnel-public-host-unavailable');
    this.name = 'TunnelHostUnavailableError';
  }
}
```

Referenced by: M2 (`Frame`, `MIRROR_PREVIEW`), M3 (`SessionState`), M4 (`Cut`), M5 (`OutputSheet`), M6 (`CaptureRecord`, `OutputSheet`, `TunnelHostUnavailableError`), M7 (`OutputSheet`, `TunnelHostUnavailableError`).

---

## 4. Acceptance Criteria → Implementation Map

| # | Acceptance Criterion | Milestone(s) | Primary File(s) |
|---|----------------------|--------------|-----------------|
| 1 | Start screen → 시작 click activates camera | M2, M8 | `components/StartScreen.tsx`, `lib/camera.ts`, `app/booth/page.tsx` |
| 2 | "컷 1/7" + first frame overlaid on live video | M2, M3 | `components/LiveOverlay.tsx`, `lib/frames.ts` |
| 3 | Pink-circle area transparent → camera shows through | M1, M2 | `scripts/preprocess-frames.ts`, `public/frames/processed/*.png` (800×900), `components/LiveOverlay.tsx` |
| 4 | 3-2-1 countdown displayed large; auto-shutter at 0 | M3 | `lib/session-machine.ts`, `components/Countdown.tsx` |
| 5 | 0.5–1s preview after shutter; auto-advance | M3, M4 | `components/CutPreview.tsx`, `lib/capture.ts`, `app/booth/page.tsx` |
| 6 | After 7 cuts → 4×2 grid 1080×2400 sheet | M4, M5 | `lib/sheet-composer.ts`, `lib/sheet-composer.test.ts`, `lib/frames.ts` |
| 7 | Composed PNG saved locally + public URL | M6 | `app/api/captures/route.ts`, `lib/upload-sheet.ts` |
| 8 | Result screen: QR + sheet preview; phone download | M7 | `components/QRScreen.tsx` |
| 9 | "다음 사용자" returns to start | M3, M7, M8 | `components/QRScreen.tsx`, `lib/session-machine.ts` (`RESET`), `lib/idle-timer.ts` |
| 10 | Whole session ≤ 90s | M3, M4, M5 | `lib/session-machine.ts`, timing budget |
| 11 | Laptop off → all results gone | M0 (.gitignore), M6, M9 | `.gitignore`, `public/captures/.gitkeep`, README teardown |

---

## 5. Risks & Mitigations

1. **Camera permission denied at event.** *Mitigation:* `CameraDeniedBanner` with Korean retry instructions. Pre-event: pin Chrome to `localhost:3000/booth` and grant camera permission there once. Test 24h before with the actual event laptop.

2. **Pink → transparent chroma-key edge artifacts.** *Mitigation:* M1 first checks if frames already ship with `alpha=0`. If keying is needed, fuzz 8–15%, eyeball each output. Worst case, hand-touch in an editor.

3. **Low FPS overlay on cheap kiosk laptops.** *Mitigation:* `<video>` + `<img>` is GPU-composited, nearly free. If FPS drops, downscale video constraints from 1280×720 to 960×540. Test on the actual event laptop in M8.

4. **QR target URL unreachable from phone.** *Mitigation:* Tunnel bypasses NAT. Phone hits tunnel over cellular if Wi‑Fi blocks it. Runbook: test from a phone *on cellular* before doors open. Backup: pre-paid hotspot.

5. **Tunnel session drops mid-event.** *Mitigation:* Server-derived `publicUrl` from `Host` header means restarting `ngrok` is a 60-second operation: kill ngrok, restart `ngrok http 3000`, copy new URL — **no rebuild, no env reload, no `npm restart`**. The very next API request will encode the new hostname into the next QR. **If host header is missing entirely, M6 returns HTTP 503 (fail-loud) so the operator notices in <5 seconds rather than handing out broken QRs for minutes.**

6. **`public/captures/` ballooning.** *Mitigation:* PNGs ~2–5 MB each (1080×2400 PNG with photographic + frame content). 500 sessions ≈ 1.5 GB on a modern SSD — fine for one event. Files persist for entire event lifetime by design (per spec line 38: 결과 유효 기간 = 노트북/터널 살아 있는 동안). No per-session cleanup.

7. **Next.js production-mode camera-stream stability.** *Mitigation:* Production mode (`next start`) only — never `next dev` for any rehearsal involving the camera. The one API route is locked to `dynamic = 'force-dynamic'` so route caching cannot interfere. T-24h smoke includes 5 back-to-back sessions on `next start` to confirm camera stream survives multiple session resets without HMR-style reloads. **No stack-swap escape hatch** (Principle 4).

8. **macOS App Nap / display sleep mid-event.** *Mitigation:* Runbook step `caffeinate -dimsu &` before opening Chrome.

9. **Concurrent tunnel visitor uploads filling disk.** *Mitigation:* M6 rejects non-PNG and >10 MB. Optional follow-up: bind API to localhost-origin requests (the kiosk is the only legitimate caller). Out of scope for MVP.

10. **Mid-event Node crash.** *Mitigation:* M9 README crash-recovery section. No in-progress recovery; user restarts session. Previously-completed PNGs survive (UUID filenames stable, files on disk persist across `npm run kiosk` restarts).

11. **Aspect-chain stretch (NEW, fixed in v3).** *Status:* RESOLVED. M1 pads frames to 800×900 (aspect 0.8889). M4 cut canvas is 512×576 (aspect 0.8889). M5 cell is 512×576 (aspect 0.8889). Frame draw is uniform 0.640× both axes. Cut → cell is 1:1. Zero non-uniform stretch on photographic content. Asserted in `lib/sheet-composer.test.ts`.

---

## 6. Test Plan

### Unit (Vitest, jsdom + node-canvas) — co-located convention `lib/*.test.ts`
- `lib/cover-crop-math.test.ts` — table-driven cover-crop for 5 source shapes (1280×720 landscape, 720×1280 portrait, 720×720 square, 2560×1440 Retina-DPR, 512×576 identity) into 512×576 dest. **Numbers derived from first principles in M4 fixture table; no hand-coded approximations.**
- `lib/capture.test.ts` — mirror invariant (saved canvas is NOT mirrored even when preview is); cover-crop integration; uniform-frame-draw assertion (frame corner pixels at expected positions on 512×576).
- `lib/sheet-composer.test.ts` — cell origin asserts for indices 0–7; layout fits 1080×2400 with margin (20,28) gutter (16); aspect uniformity assertion (`abs(800/512 - 900/576) < 1e-9`).
- `lib/session-machine.test.ts` — every transition; idle-timer state-gating (timer only fires from `idle | qr-display | camera-priming-error`); `tunnel-host-error` transition.
- `lib/idle-timer.test.ts` — never fires from `countdown | flash | preview | composing`.
- `app/api/captures/route.test.ts` — returns 503 with `{error:'tunnel-public-host-unavailable'}` on missing host header; returns 200 with valid `publicUrl` containing X-Forwarded-Host on the happy path.
- `scripts/preprocess-frames.test.ts` — fixture PNG with known pink area → asserts output is 800×900, alpha=0 in keyed pixels, original artwork centered with 40px transparent margin each side.

### Integration (Playwright, optional, T-3day if time)
- Mock `getUserMedia` to a static MP4. Walk full session: 시작 → 7 countdowns → assert QR canvas rendered + `/captures/*.png` returns 200 + response includes `publicUrl` matching the test request's `Host` header.
- Idle reset: start session, abandon for 30s in `qr-display` state → returns to start.
- Idle non-reset: in `countdown` state for 30s → does NOT reset.
- Tunnel-host-missing: send `POST /api/captures` with no host header → assert 503 + UI banner.

### Manual smoke (event-day checklist, T-24h)

See M9 §"Pre-event smoke test" — AC-by-AC table indexed against AC#1–#11.

In addition, the operator runs:
- [ ] Cold-boot the actual event laptop. `npm i && npm run preprocess && npm run kiosk`.
- [ ] Run `ngrok http 3000`. **No `.env.local` edit, no rebuild needed.**
- [ ] Open Chrome at `http://localhost:3000/booth`. F11.
- [ ] Walk all 11 AC rows of the M9 smoke table.
- [ ] Verify saved PNG is **un-mirrored** (text on shirt reads correctly) while live preview was mirrored.
- [ ] Walk away mid-session in `countdown` state for 60s — must NOT reset. Then walk away in `qr-display` for 30s — MUST reset.
- [ ] Deny camera prompt; confirm fallback banner.
- [ ] Run 5 sessions back-to-back on `next start`; confirm camera stream survives.
- [ ] Restart ngrok mid-session: old QRs from before-restart fail (expected); new sessions get the new hostname — **no rebuild needed**.
- [ ] Forcibly send `POST /api/captures` with `curl -H 'Host:'` (or strip headers via proxy) → confirm 503 + banner.
- [ ] After event: close laptop, reboot, confirm `public/captures/` behavior matches operator expectation.

---

## 7. Out of Scope

**Mirrored from spec Non-Goals:** print/sticker, cloud storage, user accounts, admin dashboard, AI face cutout, auto-email/Kakao, non-Korean languages, mobile-as-booth, user-selectable cut order or retake.

**Plan-internal scope cuts:**
- No retake / no skip-cut UI. Linear state machine.
- No analytics / observability beyond `console.log`.
- No service worker / offline mode.
- No tests for fs writes beyond smoke check.
- No design system / shadcn / Radix.
- No i18n framework.
- No dark/light theme.
- Fullscreen via in-app button only; Chromium `--kiosk` flag documented but not auto-launched.
- No multi-camera selector. Default `facingMode: 'user'`.
- **No `next dev` at the event.** Production mode only.
- **No build-time env vars for tunnel.** Tunnel hostname is request-time only (M6).
- **No silent localhost fallback** when host header is missing — fail loud with HTTP 503 (M6).
- **No `__tests__/` directory.** Co-located `lib/*.test.ts` convention only.
- No localhost-origin guard on API route. Out-of-scope follow-up if rehearsal shows abuse.

---

## ADR — Architecture Decision Record

**Decision:** Build the photobooth as a single Next.js 15 App Router project, **production mode only** (`next build && next start`, command `npm run kiosk`), with a single `POST /api/captures` route that derives the QR target URL from the incoming request's `Host` header at request time and persists composed PNGs atomically (`.tmp.png` → `fs.rename`) to `public/captures/`. Frame PNGs are pre-padded to 800×900 (aspect 0.8889) so the entire compositing pipeline runs at one aspect ratio with uniform-scale draws only. Operator-run ngrok tunnel.

**Decision drivers:** (1) shortest path to event-day reliability in 8 days; (2) minimum moving parts under pressure; (3) QR target *must* be a real HTTP URL; (4) tunnel hostname must survive ngrok restarts without rebuilding (request-time resolution, not `NEXT_PUBLIC_*`); (5) zero non-uniform stretch on photographic content (uniform aspect chain).

**Alternatives considered:**
- Vite SPA + Bun.serve (Option B) — viable, leaner, but two pipelines + diverges from spec recommendation. Not the chosen path; not a fallback.
- Pure client-side `data:` URL QR (Option C) — invalidated: QR Version 40 ≈ 2.9 KB cannot carry a 2–5 MB PNG; AC#7 hard-requires public URL.
- Aspect chain Path A (collapse to frame-native 0.800) — invalidated: 4 rows × 600px cells exceed 2400 height (`2496 > 2400`).
- Aspect chain Path B (letterbox frame inside 540×600 cut) — rejected: shrinks usable face-hole region by 11% horizontal, visibly cuts Y2K bling.
- **Aspect chain Path C1 (chosen)** — pad frames to 800×900 in M1; cell + cut canvas at 512×576; uniform 0.640× scale on frame draw; 1:1 cut→cell.

**Why chosen:** Option A maps 1:1 onto the spec's recommended stack. Production-mode-only mandate eliminates the dev-mode HMR camera hazard *in-stack* (no Principle-4-violating stack swap). Server-side request inspection eliminates the build-time-env tunnel rebuild hazard. Path C1 yields a single end-to-end aspect ratio (0.8889) with sub-pixel residuals only — no visible stretch on Y2K artwork or faces. One `npm run kiosk` command on event day.

**Consequences:**
- We accept the heavier Next.js boot in exchange for unified dev/prod story and runtime header inspection.
- We accept the manual ngrok step (operator runs `ngrok http 3000` and reads the URL) — but **no env-var or rebuild step** follows. Single human-in-the-loop action.
- Compositing is client-side; server is a dumb atomic file-write sink with fail-loud host validation. API surface = exactly one route.
- Frame preprocessing is a one-time padding operation (800×900 output) — slight asset-size increase (40px × 900 × 4 bytes × 2 sides = 288KB extra per frame, ~2MB total across 7 frames). Acceptable.
- Production mode only; `next dev` is never used at the event or in camera rehearsals.
- M9 README includes AC-indexed pre-event smoke test runnable T-24h by anyone.

**Follow-ups (post-MVP):**
- Cloudflared named tunnel for stability.
- Optional `--kiosk` Chromium auto-launch script.
- If a second event reuses the booth, factor `lib/sheet-composer.ts` + `lib/frames.ts` into a "frame-pack" module for theme swaps.
- Localhost-origin guard or session-token-gate uploads if rehearsal shows tunnel-visitor abuse.
- Title-card: optionally re-author at 800×900 to fully unify aspect chain (currently 720×900 — only non-photographic exception, accepted).

---

## Plan Summary

**Plan saved to:** `.omc/plans/y2k-photobooth-plan.md`

**Scope:** 9 milestones (M0–M9), ~34 files across `app/`, `components/`, `lib/`, `scripts/`, `public/frames/processed/`, `public/captures/`. Estimated complexity: **MEDIUM**. Day-budget total: ~8 days, matches event timeline.

**Key Deliverables:**
1. Runnable Next.js kiosk app at `http://localhost:3000/booth`, production mode.
2. Preprocessed 7 frame PNGs **padded to 800×900** with verified transparent face holes (aspect 0.8889 unifies the pipeline).
3. Full 7-cut session ≤ 90s with state-gated idle reset, mirrored preview + un-mirrored capture, full camera-lifecycle handling.
4. 1080×2400 PNG sheet composed at locked cell math (margin 20/28, gutter 16, cell 512×576), persisted atomically, served via runtime-derived public URL with fail-loud 503 on missing host.
5. Event-day README + crash-recovery + AC-indexed pre-event smoke test table.

**Consensus mode:**
- RALPLAN-DR: 5 principles, top-3 drivers, 3 viable options (C invalidated with explicit rationale; aspect chain Paths A/B also invalidated in ADR).
- ADR: Decision, drivers, alternatives, why-chosen, consequences, follow-ups all populated.
- Revision 2/5: addresses 2 hard blockers (cover-crop arithmetic, aspect-chain stretch) + 3 polish items (test convention, fail-loud host, AC verification table).

**Does this plan capture intent?**
- "proceed" → hand off to `/oh-my-claudecode:start-work y2k-photobooth-plan`.
- "iterate" → next consensus revision pass.
- "restart" → discard.
