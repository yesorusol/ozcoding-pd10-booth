# Deep Interview Spec: 폴라로이드(일반) 모드 + 모드 선택 온보딩

## Metadata
- Interview ID: normal-mode-2026-05-08
- Rounds: 5
- Final Ambiguity Score: 17.9%
- Type: brownfield (기존 OZCODING PD09 부스 확장)
- Generated: 2026-05-08
- Threshold: 20%
- Status: PASSED ✅
- Predecessor WIP: `.omc/specs/deep-interview-normal-mode-WIP.md`

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.40 | 0.380 |
| Constraint Clarity | 0.92 | 0.30 | 0.276 |
| Success Criteria | 0.55 | 0.30 | 0.165 |
| **Total Clarity** | | | **0.821** |
| **Ambiguity** | | | **0.179 (17.9%)** |

> 메모: Context Clarity는 brownfield 가중(15%)으로 따로 계산하면 0.92 수준 (CABINET 구조·카메라·세션 머신 모두 파악됨). 위 표는 호환성을 위해 greenfield 가중을 사용했지만, 둘 다 threshold 통과.

---

## Goal

기존 7컷 테마(도전 챌린지) 모드는 그대로 유지한 채, **새로운 폴라로이드(일반) 모드**를 추가한다. 부스 진입 시 **모드 선택 화면**을 가장 먼저 띄워, 사용자가 두 모드 중 하나를 선택한 뒤 각 모드의 흐름으로 분기한다.

### 모드 매핑
| 표시명 | 내부 id | 컷 수 | 촬영 중 오버레이 | 출력 비율 | 합성 방식 |
|---|---|---|---|---|---|
| **도전 챌린지** | `themed` | 7 | 캐릭터 프레임 | 1080×2400 | 기존 sheet-composer |
| **폴라로이드(일반)** | `normal` | 4 | 없음 (깨끗한 카메라) | 1080×1440 | 새 overlay-composer |

### 흐름 비교
```
[기존]
/  (idle: 7컷 메뉴 + 시작)  →  /booth (촬영)  →  QR

[신규]
/  (mode-select: 두 카드)
   ├─ 도전 챌린지 → /booth?mode=themed   (= 기존 흐름 그대로)
   └─ 폴라로이드  → /booth?mode=normal   (4컷, 오버레이 없음, 폴라로이드 시트)
                  → QR
```

---

## Constraints

### 모드 선택 화면 (신규)
- 현재 `app/page.tsx` 위치를 모드 선택 화면으로 교체
- 기존 idle(7컷 메뉴 + 시작 버튼)은 도전 챌린지 모드의 사전 화면으로 유지하거나, 모드 선택 직후 바로 `/booth?mode=themed`로 진입하는 방식 중 택일 (디자인 패스에서 결정)
- `<ScaleToFit><CabinetChrome fill={false}>` 셸 동일하게 적용
- 카피: 두 카드 위 헤드라인 “모드 선택” 같은 라인 + 각 카드에 모드 이름·설명 (Korean copy는 `lib/copy.ts`에 추가)

### 폴라로이드 모드 촬영 흐름
- **카메라 화면에 캐릭터 프레임 오버레이 없음** (깨끗한 카메라만)
- 카운트다운 5초 + 플래시 동작은 기존과 동일 (`session-machine.ts` 재사용)
- 4컷을 순차 촬영 (`TOTAL_CUTS`를 모드별 상수로 분기 또는 머신 파라미터화)
- 미리보기/CutPreview 등 UI 컴포넌트는 재사용 (오버레이 `<img>`만 비활성)

### 폴라로이드 시트 합성 (신규)
- 출력 사이즈: **1080×1440 PNG**
- 배경색: 크림/오프화이트 (구체 값은 오버레이 PNG에 포함 → 합성 캔버스는 동일 색으로 fill)
- **2×2 폴라로이드 그리드**, 각 셀이 약간씩 회전된 디자인
- 합성 순서:
  1. 캔버스 1080×1440을 배경색으로 fill
  2. 4개 셀 각각: `(x, y, width, height, rotationDeg)` 좌표에 사진을 회전·클립 후 그림 (cover-fit)
  3. **고정 오버레이 PNG** (`public/overlays/normal.png`)을 캔버스 전체에 1:1로 얹음
- 오버레이 PNG = 디자이너가 만든 단일 자산. 4개 셀 영역은 투명하게 뚫려 있고, 폴라로이드 흰 테두리·스티커·캐릭터·캡션이 모두 베이크되어 있음
- 캡션 텍스트(`♡ OZCODINGG PD09 ♡`)는 오버레이 PNG 안에 이미 그려져 있으므로 코드는 텍스트를 그리지 않음

### 자산
- 사용자가 직접 제공하는 자산: `public/overlays/normal.png` (1080×1440, 4셀 투명, 알파 채널 포함)
- 셀 좌표: 디자이너가 오버레이를 만들 때 같이 명시 (`lib/normal-layout.ts`에 상수로 박음)
- 스티커는 별도 자산 없음 (오버레이에 포함됨)

### 업로드/QR 파이프라인
- 기존 `/api/captures` 엔드포인트 그대로 사용 (PNG 매직넘버 + 호스트 도출 + atomic write 그대로)
- QR 화면(`QRScreen.tsx`) 재사용 — 시트 비율만 1080×2400 → 1080×1440로 다르게 보일 뿐, 컴포넌트 변경 최소

---

## Non-Goals

- 폴라로이드 모드에 캐릭터 프레임 오버레이 추가 (X — 깨끗한 카메라가 핵심 요건)
- 폴라로이드 모드에 랜덤 스티커 엔진 (X — 고정 오버레이로 단순화됨)
- 폴라로이드 모드에서 사용자가 셀 회전·위치를 커스터마이즈 (X — 디자이너가 정한 레이아웃 고정)
- 두 모드 간 출력 사이즈 통일 (X — 1080×1440 vs 1080×2400 분리 유지)
- 캔버스 위 동적 텍스트 렌더링 (X — 캡션은 오버레이에 베이크)
- 컷 수가 달라지는 다른 모드 추가 (X — 이번 범위는 두 모드뿐)

---

## Acceptance Criteria

### 라우팅·상태
- [ ] `/`로 진입하면 모드 선택 화면이 보이고, 기존 7컷 메뉴는 더 이상 첫 화면이 아니다.
- [ ] 모드 선택에서 “도전 챌린지” 선택 시 결과 흐름이 기존 7컷 흐름과 100% 동일하다 (회귀 없음).
- [ ] “폴라로이드(일반)” 선택 시 4컷 촬영 흐름으로 진입한다.
- [ ] 두 모드 모두 카메라 권한 거부 → `CameraDeniedBanner` → 모드 선택 화면으로 복귀가 가능하다.

### 폴라로이드 촬영
- [ ] 폴라로이드 모드에서는 카메라 위에 캐릭터 프레임 `<img>`가 렌더되지 않는다.
- [ ] 카운트다운 5초 → 플래시 → 미리보기 사이클이 4번 반복된 뒤 합성 단계로 넘어간다.
- [ ] 4컷이 모두 캡처될 때까지 카메라 스트림이 끊기지 않는다 (`useCamera` lifecycle 재사용 검증).

### 폴라로이드 합성
- [ ] 합성 결과 PNG의 사이즈가 정확히 1080×1440이다.
- [ ] 합성 PNG에 정확히 4개의 사진 영역이 디자이너가 지정한 좌표/회전으로 배치된다 (좌표는 `lib/normal-layout.ts` 상수로 검증).
- [ ] 오버레이 PNG가 4컷 위에 정상적으로 알파 합성되어 폴라로이드 테두리·스티커·캡션이 보인다.
- [ ] 4컷의 투명한 셀 영역이 빈 검정/빈 알파가 아니라 실제 사진으로 채워져 있다 (검은 픽셀 비율 임계치로 검증 가능).
- [ ] 합성 시간이 도전 챌린지 모드(7컷)와 동등하거나 더 짧다.

### 업로드·QR
- [ ] 폴라로이드 시트도 `/api/captures`로 업로드되고, 응답의 `publicUrl`이 QR로 표시된다.
- [ ] QR 화면에 sheet 미리보기가 1080×1440 비율로 깨지지 않고 보인다.
- [ ] “처음으로 돌아가기” 버튼이 모드 선택 화면(`/`)으로 돌려보낸다.

### 테스트
- [ ] `lib/overlay-composer.ts` 단위 테스트: 4개 ImageBitmap + overlay HTMLImageElement → 1080×1440 PNG Blob.
- [ ] `lib/normal-layout.ts` 좌표 상수가 합리적 범위 안 (0 ≤ x+w ≤ 1080, 0 ≤ y+h ≤ 1440).
- [ ] 모드 선택 페이지 렌더 테스트: 두 카드 노출, 클릭 시 올바른 라우팅.
- [ ] 도전 챌린지 모드 회귀 테스트 (기존 104개 테스트가 그대로 통과하는지).

---

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|---|---|---|
| 일반 모드도 오버레이가 있어야 한다 | 옵션 A "깨끗한 카메라만" 채택 | 촬영 중 오버레이 없음, 합성 단계에서만 폴라로이드 데코 추가 |
| 두 모드가 같은 출력 비율을 써야 한다 | Round 4 Contrarian: 1080×2400 유지 vs 폴라로이드 전용 비율 | 1080×1440 채택 (이미지 레퍼런스 기반); 인프라는 PNG 스트림이라 비율 분기 영향 적음 |
| 스티커는 세션마다 랜덤이어야 한다 | Round 5 Simplifier: 고정 vs 랜덤 | 고정 오버레이 PNG 채택 → 랜덤 엔진/스티커 자산 카탈로그 전부 제거됨 |
| 폴라로이드 캡션은 코드에서 그린다 | "캡션이 오버레이에 베이크되어 있으면 코드 단순화" | 오버레이 PNG에 캡션 포함, 코드는 텍스트 렌더링 책임 없음 |
| 모드 선택은 idle 화면 안의 토글로 충분하다 | 사용자가 명시적으로 "처음 온보딩 앞에 새 화면" 요청 | 별도 모드 선택 화면을 idle 앞에 추가 |

---

## Technical Context (Brownfield Findings)

### 재사용 가능한 자산
- `components/CabinetChrome.tsx` — 두 모드 + 모드 선택 화면 모두 동일 셸
- `components/ScaleToFit.tsx` — 모드 선택 화면도 같은 viewport-fit 적용
- `lib/use-camera.ts` — 두 모드 공통 카메라 lifecycle
- `lib/session-machine.ts` — `TOTAL_CUTS`를 머신 파라미터로 빼면 그대로 재사용 가능 (또는 새로 reducer 분리)
- `lib/capture.ts` (`captureCut`) — frameImg 인자가 optional이 되도록 확장하면 재사용 가능. 폴라로이드 모드는 frameImg 없이 video만 cover-fit으로 캡처
- `app/api/captures/route.ts` — 변경 불필요 (PNG 받기만 하면 됨)
- `lib/upload-sheet.ts` — 변경 불필요
- `components/QRScreen.tsx` — 비율 차이만 처리 (사진 컨테이너에 aspect-ratio 동적 적용)

### 신규 작성 모듈
- `app/page.tsx` — 모드 선택 화면으로 교체 (현재 idle 콘텐츠는 별도 화면 또는 themed 모드 진입 직전 단계로 이동)
- `app/themed/page.tsx` 또는 `/booth?mode=themed` 라우팅 — 기존 idle/booth 분리 결정 필요
- `lib/booth-mode.ts` — `BoothMode = "themed" | "normal"` 타입 + 모드별 상수 (cuts, sheet size)
- `lib/normal-layout.ts` — 4셀 좌표 + 회전 상수
- `lib/overlay-composer.ts` — 새 합성기 (오버레이 PNG 합성 로직)
- `components/ModeSelect.tsx` — 두 카드 렌더링 (또는 두 버튼 — 디자인 패스 결정)
- `lib/copy.ts` — `COPY.modeSelect` 추가
- `public/overlays/normal.png` — 디자이너가 제공할 자산 (1080×1440)

### 모드 분기 전략
- 라우팅: `/booth?mode=themed|normal` 쿼리 파라미터 (단순)
- 또는 라우트 분리: `/booth/themed`, `/booth/normal` (명시적, 코드 분기 없이 페이지 분리 가능)
- 권장: 쿼리 파라미터 방식 — 페이지 코드 1개에서 모드별 reducer/캡처 헬퍼만 분기

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| `BoothMode` | core | `id: "themed" \| "normal"`, `displayName`, `totalCuts`, `sheetSize` | OnboardingScreen에서 선택 |
| `OnboardingScreen` (= ModeSelect) | core | 두 카드 렌더 | BoothMode 선택 → ThemedFlow / NormalFlow |
| `ThemedFlow` | core domain | 7컷 + frame overlay (기존) | TitleCard + 7 ThemedCut → 1080×2400 sheet |
| `NormalFlow` | core domain (신규) | 4컷, no overlay | 4 NormalCut → 1080×1440 PolaroidSheet |
| `NormalCut` | core | 576×720 ImageBitmap (오버레이 없음) | 4개가 PolaroidSheet에 합성 |
| `PolaroidSheet` | core | 1080×1440 PNG, 4 cell rect+rotation, 1 overlay PNG | NormalFlow 출력 |
| `OverlayAsset` | supporting | `public/overlays/normal.png`, 알파 채널 포함 | PolaroidSheet 합성 시 최상단 레이어 |
| `Caption` | supporting | `♡ OZCODINGG PD09 ♡` (오버레이에 베이크) | OverlayAsset에 포함 |

Ontology stability: Round 4 → 5 = 100% (랜덤 스티커 관련 entity 3개 제거되며 단순화 + 안정화)

---

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|---|---|---|---|---|---|
| 1 | 5 | 5 | - | - | N/A |
| 2 | 8 | 3 | 0 | 5 | 75% |
| 3 | 9 (Sticker* 추가) | 1 | 0 | 8 | 89% |
| 4 | 11 (Cell, Avatar, Doodle, Compositor) | 4 | 1 (Caption text 변경) | 6 | 91% |
| 5 (final) | **8** (Sticker* 3개 제거, Compositor 단순화) | 0 | 1 (LayeredCompositor → OverlayCompositor) | 7 | **100%** |

**Convergence event**: Round 5의 Simplifier 결정("고정 오버레이")으로 entity 수가 11 → 8로 감소하면서 동시에 안정화. 단순화가 곧 수렴이었음.

---

## Open Items (Implementation Time)

다음 항목은 spec 통과 기준에는 영향이 없지만 구현 시작 전 또는 도중에 한 번 확인 필요:

1. **캡션 표기 확정**: 레퍼런스 이미지의 `♡ OZCODINGG PD09 ♡`는 G가 두 개. 오타라면 `OZCODING`, 의도라면 `OZCODINGG`. → 디자이너에게 확인 후 오버레이 PNG에 반영.
2. **모드 선택 화면 레이아웃**: 두 카드(가운데 정렬) vs 두 버튼(가로 나란히) — `ModeSelect.tsx` 디자인 패스에서 결정.
3. **셀 좌표·회전 각도**: 디자이너가 오버레이 PNG 만들 때 함께 측정해서 `lib/normal-layout.ts`에 박기. 측정 단위는 1080×1440 캔버스 기준 픽셀.
4. **기존 idle 화면 운명**: 모드 선택 → "도전 챌린지" 직후 (a) 기존 idle(7컷 메뉴+시작 버튼)을 보여주고 → /booth로 가는 2단계 흐름인지, (b) 곧장 /booth로 가는 1단계 흐름인지. (현재 코드 구조상 (a)가 작은 변경, (b)는 idle 컴포넌트 제거 필요)
5. **회귀 테스트 보강**: 도전 챌린지 모드가 모드 선택을 거쳐도 종전 104개 테스트가 모두 통과하는지 CI에서 확인.

---

## Interview Transcript

<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1 (WIP에 기록)
**Q:** 일반 모드의 촬영 흐름은? (테마 오버레이 유지 vs 깨끗한 카메라)
**A:** 깨끗한 카메라만 (옵션 A)
**Ambiguity:** 100% → 51%

### Round 2 (WIP에 기록)
**Q:** 컷 수와 결과물 형태 정리
**A:** 4컷, 폴라로이드 2×2, 흰 테두리 + `♡ OZCODING PD09 ♡` 캡션 (당시 표기), 스티커 랜덤
**Ambiguity:** 51% → 38%

### Round 3
**Q:** 스티커 자산 출처는?
**A:** 직접 PNG/SVG 제공 (`public/stickers/normal/`)
**Ambiguity:** 38% → 37.5% (Constraints 0.55 → 0.75; Criteria 여전히 0.20)

### Round 4 (Contrarian Mode)
**Q:** 폴라로이드 시트의 출력 비율은? (1080×2400 유지가 정말 안 되나?)
**A:** 레퍼런스 이미지 첨부 → 1080×1440 (3:4) 영역, 2×2 회전 폴라로이드 + 픽셀 캐릭터 + 키치 도듬, 크림 배경, 캡션 `♡ OZCODINGG PD09 ♡`
**Ambiguity:** 37.5% → 28.7%

### Round 5 (Simplifier 효과)
**Q:** 매 세션 스티커 변화 규칙은? (고정 오버레이 vs 카테고리 랜덤 vs 완전 랜덤 vs 고정 세트 중 1)
**A:** 고정 오버레이 (옵션 A)
**Ambiguity:** 28.7% → **17.9%** ✅ Threshold 통과

</details>
