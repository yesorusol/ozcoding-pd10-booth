# Deep Interview Spec: PD09 Booth — D-4 Stability Hardening

## Metadata
- Interview ID: pd09-d4-stability-2026-05-10
- Rounds: 5
- Final Ambiguity Score: ~13%
- Type: brownfield
- Generated: 2026-05-10
- Threshold: 20%
- Status: PASSED
- Event Date: 2026-05-14 (D-4)

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.35 | 0.322 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.85 | 0.25 | 0.213 |
| Context Clarity | 0.80 | 0.15 | 0.120 |
| **Total Clarity** | | | **0.867** |
| **Ambiguity** | | | **0.133** |

## Goal
2026-05-14 OZCODING PD09 네트워킹 이벤트 당일 부스 운영이 끊기지 않도록, 어제까지 작업한 기존 플로우(ModeSelect → ThemedFlow / NormalFlow → sheet-composer → ngrok 업로드 → QR)를 동결하고 4개 영역(카메라 / 터널 / 세션 누수 / 환경 스모크)을 D-4 기간 동안 강화·검증한다. 신규 기능 빌드는 일체 금지.

## Constraints
- 마감 D-4 (오늘 2026-05-10, 이벤트 2026-05-14)
- 신규 기능 동결 — 어제 작업물(componnts/ThemedFlow, NormalFlow, ModeSelect, BoothSideRail, prep phase 등)을 그대로 유지
- 키오스크 = 고정 노트북, 마우스/트랙패드 입력 가정
- 외부 공유는 ngrok 또는 cloudflared 터널을 통해 발급된 publicUrl 기반 QR
- 운영자가 비기술인일 가능성 → 자동 복구가 우선, 수동 개입은 명확한 안내 텍스트 동반
- 회귀 안전망: 기존 159 테스트가 100% 통과 상태 유지

## Non-Goals (Deferred to Next Event)
다음 항목은 의도적으로 이번 이벤트 범위에서 제외하며, 추후 별도 spec(`deep-interview-pd09-purikura-stickers.md` 등)으로 재진입한다:
- 모드 선택 온보딩 제거 + 순차 funnel 구조 ("챌린지 사진 찍어볼까요?" 버튼)
- 폴라로이드 → 픽셀-캐릭터 컨셉 교체 (Image #2 / Image #3 자산 통합)
- Image #4 스타일 OZCODIG PD09 네트워킹 데이 포스터 합성 출력
- 우측 패널 스티커 에디터 (프리쿠라 스타일 캐릭터·아이콘 드래그 배치)
- StickerAsset / StickerInstance / StickerEditor / FinalComposite-purikura 신규 도메인

## Acceptance Criteria

### Lane 1 — Camera Retry / Device Recovery
- [ ] 권한 거부 시 `CameraDeniedBanner`가 표시되고, 사용자 권한 재허용 후 5초 이내 라이브 피드 재개
- [ ] USB 카메라(또는 노트북 내장)가 일시 분리되었다가 재연결될 때 자동 또는 1-탭 retry로 회복
- [ ] 다른 탭/앱이 카메라를 점유했다가 해제했을 때 retry로 회복 가능
- [ ] OS 슬립/웨이크 후 라이브 피드가 멈추지 않거나, 멈췄다면 명확한 retry UI 노출
- [ ] 위 4 시나리오를 수동 시나리오 체크리스트로 문서화하여 수행 후 ✓ 기록

### Lane 2 — Tunnel Retry / Upload Recovery
- [ ] `TunnelHostUnavailableError` 발생 시 자동 재시도(지수 백오프, 최대 3회 / 약 30초 이내)
- [ ] 재시도 모두 실패 시 `tunnel-host-error` 상태로 전이하며 운영자가 알아볼 수 있는 한국어 안내(예: "ngrok / cloudflared 터널을 다시 켠 뒤 시도해주세요")
- [ ] 운영자가 터널을 재시작한 뒤 "다시 시도" 버튼 1번으로 세션이 다시 정상 동작
- [ ] 재시도 동안 사용자 사진 데이터(state.cuts, sheetBlobUrl)는 유실되지 않음

### Lane 3 — Session / Memory Leak Audit
- [ ] 같은 브라우저 탭에서 50회 연속 세션을 돌릴 때 JS 힙 증가가 50MB 이내로 안정
- [ ] `RESET` 액션 + `onNextUser`에서 `sheetBlobUrl`이 `URL.revokeObjectURL`로 정리되고, in-flight `ImageBitmap`이 close됨
- [ ] `ScaleToFit`의 `ResizeObserver`, `useCamera`의 `MediaStream`/`videoRef`, prep/countdown/flash/preview/compositing 의 `setTimeout`이 페이즈 전환·언마운트 시 누락 없이 정리됨
- [ ] DevTools Performance / Memory 탭으로 누수 측정 결과를 캡처하여 `.omc/research/d4-leak-audit.md`에 기록

### Lane 4 — Environment Smoke Test
- [ ] 실제 행사용 고정 노트북에서 1시간 연속 운영 시뮬레이션 (10세션 이상) 무중단
- [ ] 행사장 조명 시뮬레이션(형광등, 창가 역광, 어두운 조명) 각 1회 이상 캡처/QR 흐름 확인
- [ ] 행사장 네트워크 가정(현장 와이파이 + LTE 테더링 백업) 둘 다에서 ngrok URL 발급/접근 확인
- [ ] 행사 당일 사용할 노트북의 브라우저, OS 슬립 설정, 화면 밝기, 카메라 권한, 터널 자동 재시작 스크립트 등을 `.omc/research/d4-kiosk-runbook.md`로 문서화

## Assumptions Exposed & Resolved
| Assumption | Challenge (Round) | Resolution |
|------------|-------------------|------------|
| "Image #4 스타일 합성이 새 기본 출력" | Round 1 (Goal Clarity) | Image #4는 톤 레퍼런스이며 실제 출력은 사용자 사진 + 사용자가 붙인 스티커 — 단, 이번 이벤트에서 미실행으로 이월 |
| "기존 4컷 폴라로이드 sheet-composer 재활용" | Round 2 (구조) | 신규 컨셉은 1컷 + 에디터로 단순화하기로 했으나 이마저도 D-4 범위 밖으로 이연 |
| "프리쿠라 풀 조작 (resize/rotate/layer)이 표준" | Round 3 (조작 깊이) | 최소 조작(place + drag + delete)만 — 단, 이마저도 이연 |
| "신규 스티커 컨셉이 D-4에 must-ship" | **Round 4 (Contrarian)** — 이벤트 도중 운영 마비 vs 평범한 참여도 중 어느 쪽이 더 두려운가 | 사용자 답변: 운영 마비가 훨씬 두려움 → **신규 빌드 전면 동결, 안정화로 피벗** |
| "캐릭터 강화 + 터널 강화 두 항목만으로 충분" | Round 5 (강화 영역) | 사용자가 4 레인(카메라·터널·누수·환경 스모크) 모두 선택 → 안정화 범위 확정 |

## Technical Context (Brownfield)

### 어제 시점 작업물 (동결 대상)
- `app/page.tsx` + `components/ModeSelect.tsx` — 3-zone 모드 선택 (radiogroup, btn-yellow / crt-cream)
- `components/CabinetChrome.tsx` — `min-h-[20rem] sm:min-h-[25rem] md:min-h-[26rem]` 공통 floor
- `components/ThemedFlow.tsx` / `components/NormalFlow.tsx` — capture phase는 캐비닛 미적용, beige 배경 + `BoothSideRail` 좌우 풀스크린
- `components/BoothSideRail.tsx` — 메탈 그라디언트 + RadialDots + LED 컬럼
- `components/Countdown.tsx` — positionless `<span>`, beige 영역 좌측에 sibling 배치
- `lib/session-machine.ts` — `prep` 페이즈 추가(`PREP_MS=3000`, `PREP_DONE`)
- `lib/copy.ts` — `prepHeadline / prepSub / prepHint`
- 테스트: 159/159 통과, TypeScript 클린

### Lane별 주요 터치포인트
- **Lane 1 (Camera):** `lib/use-camera.ts`, `components/CameraDeniedBanner.tsx`, `*Flow.tsx`의 `cameraErrorKindFor`
- **Lane 2 (Tunnel):** `lib/upload-sheet.ts`, `lib/types.ts:TunnelHostUnavailableError`, `*Flow.tsx`의 compositing useEffect
- **Lane 3 (Leak):** `*Flow.tsx`의 `sheetBlobUrl` cleanup, `frameImagesRef`, `LiveOverlay` ResizeObserver, prep/countdown setTimeout
- **Lane 4 (Smoke):** 신규 `.omc/research/d4-kiosk-runbook.md`, `.omc/research/d4-smoke-checklist.md`

## Ontology (Key Entities — Round 5 Final)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| ExistingFlow | legacy core | { ModeSelect, ThemedFlow, NormalFlow, sheet-composer, QR, prep } | 동결 대상 — 모든 Lane이 이를 보호 |
| StabilityHardening | core domain | { lanes: 4 } | 컨테이너 |
| CameraRetry | sub-domain | { permission, device, tab-focus, sleep-wake } | extends StabilityHardening |
| TunnelRetry | sub-domain | { backoff, max-attempts, operator-ui, state-preserve } | extends StabilityHardening |
| SessionLeakAudit | sub-domain | { blob-urls, image-bitmaps, observers, timers } | extends StabilityHardening |
| SmokeTest | core domain | { lighting-matrix, network-matrix, kiosk-runbook, 1h-runtime } | 검증 게이트 |
| KioskRuntime | supporting | { laptop-profile, browser, lighting, network } | SmokeTest의 입력 환경 |
| DeferredScope | non-goal | { sticker-editor, pixel-characters, image-4-poster, funnel-button } | 차기 spec으로 이월 |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|-----------|
| 1 | 6 | 6 | - | - | N/A (1차) |
| 2 | 8 | 1 (StickerEditor) | 1 | 6 | 86% |
| 3 | 8 | 0 | 0 | 8 | 100% (수렴) |
| 4 | 4 | 4 (피벗으로 모두 신규) | - | - | **의도적 churn** (Contrarian) |
| 5 | 8 (DeferredScope 포함) | 1 (DeferredScope) | 0 | 7 | 88% (재수렴) |

Round 4의 Contrarian 모드가 의도적인 도메인 피벗을 일으켰고, Round 5에서 새 모델이 안정화됨.

## Interview Transcript

<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1 — Goal Clarity
**Q:** 새 '일반' 모드에서 픽셀 캐릭터들과 사용자가 찍은 사진은 정확히 어떻게 결합되나요?
**A:** 사진 + 캐릭터 스티커 (프리쿠라) — 캐릭터는 우측 패널의 스티커 자산
**Ambiguity:** 53% (Goal: 0.55, Constraints: 0.4, Criteria: 0.3, Context: 0.7)

### Round 2 — Goal Clarity (구조)
**Q:** 새 일반 모드의 캡처→에디터 플로우 구조는 어떻게 되나요?
**A:** 1컷 → 에디터 → QR (가장 단순)
**Ambiguity:** 46% (Goal: 0.7, Constraints: 0.45, Criteria: 0.3, Context: 0.7)

### Round 3 — Goal Clarity (조작 깊이)
**Q:** 스티커 조작 깊이는 어디까지 구현하나요?
**A:** Place + Drag + Delete (필수만)
**Ambiguity:** 40% (Goal: 0.82, Constraints: 0.55, Criteria: 0.3, Context: 0.7)

### Round 4 — **Contrarian** / Success Criteria
**Q:** 5월 14일 현장에서 둘 중 하나가 일어난다면 어느 쪽이 더 두려운가요? (a) 신규 컨셉 부재로 평범한 참여도 (b) 신규 컨셉 도입으로 인한 운영 마비
**A:** **(b)가 더 두려움** → 신규 컨셉 차기 이벤트로 이연, 어제 거 안정화 고수
**Ambiguity:** 25% (Goal: 0.85, Constraints: 0.7, Criteria: 0.7, Context: 0.7)
**효과:** Contrarian이 실질적인 도메인 피벗 유발 — 빌드 모드 → 안정화 모드

### Round 5 — Goal/Criteria
**Q:** 남은 4일 동안 우선적으로 강화·검증해야 하는 영역을 고르세요 (복수 선택).
**A:** 카메라 권한·디바이스 / ngrok 터널 단절 / 세션 누수 / 환경 스모크 — **4개 모두**
**Ambiguity:** 13% — 임계 도달
</details>

## Suggested Execution Lanes (4-Day Plan, 정보용 — 다음 단계 ralplan/autopilot에서 확정)

| Day | Lane Focus | Deliverable |
|-----|------------|-------------|
| Day 1 (오늘 5/10) | Lane 3 (Leak) 진단 | `.omc/research/d4-leak-audit.md` 첫 패스, 누수 원점 N개 식별 |
| Day 2 (5/11) | Lane 1 + Lane 2 (Camera + Tunnel) 강화 패치 | retry 로직, exponential backoff, 운영자 안내 UI |
| Day 3 (5/12) | Lane 3 누수 픽스 + 회귀 테스트 추가 | 누수 픽스 PR, 159 → 16x 테스트 |
| Day 4 (5/13) | Lane 4 (Smoke) 실기기 검증 | 실제 노트북 1시간 런 + `.omc/research/d4-kiosk-runbook.md` |
| Day-Of (5/14) | 사전 점검 30분 | 운영자 체크리스트 1회 통과 |
