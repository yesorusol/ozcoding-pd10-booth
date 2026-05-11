# Open Questions

Centralized tracker for unresolved decisions and clarifications across all plans.

## normal-mode-plan-v1 — 2026-05-08

- [ ] **Caption typo (Spec Open Item #1):** OZCODINGG vs OZCODING in the polaroid caption — Designer decision; baked into `public/overlays/normal.png`. Code does not render text.
- [ ] **Mode-select layout (Spec Open Item #2):** two-card centered (plan default) vs two-button row — UX call before merge.
- [ ] **Cell coordinates + rotation angles (Spec Open Item #3):** designer to deliver alongside overlay PNG; mock placeholders in `lib/normal-layout.ts` until then.
- [ ] **Existing idle screen fate (Spec Open Item #4):** plan picks option (b) — idle/7-cut menu removed from `/`, themed card routes straight to `/booth?mode=themed`. UX contract change — surface to user for confirmation before coding begins.
- [ ] **Regression CI gate (Spec Open Item #5):** confirm CI pipeline blocks merge if any of the 104 existing tests fail.
- [ ] **Mock-overlay asset workflow:** hand-author the placeholder PNG vs author a Node `scripts/make-mock-overlay.ts` generator — pick one before §2.7 implementation.
- [x] **`<Suspense>` boundary for `useSearchParams()`:** RESOLVED in v2 — wrap a thin `<BoothPageRouter/>` client component, not BoothPage itself. Flow components stay Suspense-free.
- [x] **`MODE_CONFIG.compose` signature:** RESOLVED in v2 — dropped. `MODE_CONFIG` is data-only (totalCuts, sheetSize, displayName). Each Flow component imports its compositor directly with full TypeScript narrowing.

## normal-mode-plan-v2 — 2026-05-08 (carry-forward + new)

- [ ] **Naming of Suspense wrapper component:** `<BoothPageRouter/>` proposed. Alternatives: `<BoothModeRouter/>`, `<BoothShell/>` — Why: clarity vs convention.
- [ ] **Default mode when `?mode` absent/unknown:** v2 defaults to `"themed"` to preserve `/booth` URL contract — Why: alternative is redirect to `/`; needs UX call.
- [ ] **Canvas transform-matrix mocking** for `overlay-composer.test.ts` rotation assertions — Why: pixel-level (preferred) vs call-recording stub; decision deferred to implementation.
- [ ] **Migration of existing `app/booth/__tests__/*` tests** to render via `<BoothPageRouter mode="themed"/>` or `<ThemedFlow/>` directly — Why: mechanical change but needs list-and-confirm before merge. *(Withdrawn in v3: directory does not exist; no migration needed.)*

## normal-mode-plan-v3 — 2026-05-08 (pre-coding gates + new follow-ups)

### Pre-coding gates (BLOCKING — must resolve before any code is written)

- [ ] **Caption text confirmation (Spec Open Item #1):** `OZCODINGG` vs `OZCODING` — Why: text is baked into `public/overlays/normal.png`; wrong choice means re-cutting the asset and re-running fixtures. Owner: designer/user.
- [ ] **`/` route ownership decision (Spec Open Item #4):** option (a) idle survives as themed pre-screen vs option (b) idle removed, themed card routes directly to `/booth?mode=themed` (plan default) — Why: changes `/` UX contract, dictates whether `IdleScreen` is relocated or deleted, and affects existing themed-flow test setup. Critic flagged this must be confirmed before code begins. Owner: user/UX.

### Deferred follow-ups (do not block coding)

- [ ] **Compose-time baseline measurement** must be performed in Phase 0 of the Migration Runbook before any `lib/overlay-composer.test.ts` benchmark assertion can run — Why: `THEMED_COMPOSE_MEDIAN_MS` constant lives in `lib/__benchmarks__/themed-compose-baseline.ts` and is empty until measured.
