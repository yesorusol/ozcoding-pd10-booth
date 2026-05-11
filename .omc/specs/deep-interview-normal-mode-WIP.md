# Deep Interview WIP: 일반(폴라로이드) 모드 추가

**Status**: ✅ SUPERSEDED — interview completed 2026-05-08
**Final spec**: [`deep-interview-normal-mode.md`](./deep-interview-normal-mode.md) (ambiguity 17.9%, threshold 통과)
**Last updated**: 2026-05-07 night → resumed and finalized 2026-05-08
**Project type**: brownfield (기존 OZCODING PD09 부스 확장)

---

## 합의된 사실 (Round 1 + Round 2)

### 일반(폴라로이드) 모드 정의
- **테마 모드**(기존 7컷) 그대로 유지하면서 **일반 모드**를 새로 추가
- 처음 온보딩 화면에서 사용자가 두 모드 중 선택
- 결과물: 레퍼런스 이미지처럼 **폴라로이드 2×2 4컷 시트** + 데코 스티커
  - 각 컷마다 흰 폴라로이드 테두리 + `♡ OZCODING PD09 ♡` 캡션 (고정)
  - 스티커는 **세션마다 랜덤 배치**

### 촬영 흐름 (옵션 A 선택됨)
- 일반 모드 촬영 중에는 **깨끗한 카메라만** 보임 (캐릭터/프레임 오버레이 없음)
- 카운트다운 + 플래시 동작은 동일
- 4컷 촬영 후 **합성 단계에서**:
  - 폴라로이드 흰 테두리 + 캡션 추가
  - 랜덤 스티커 데코 추가

### 컷 수
- 테마 모드: 7컷 (현재 그대로)
- 일반 모드: **4컷** (2×2 그리드)

---

## Round별 모호도

| Round | Goal | Constraints | Criteria | Context | **Ambiguity** |
|---|---|---|---|---|---|
| 0 (init) | 0.30 | 0.10 | 0.10 | 0.85 | 75% |
| 1 후 | 0.65 | 0.30 | 0.20 | 0.90 | 51% |
| 2 후 | **0.85** | **0.55** | 0.20 | 0.90 | **38%** |

**Threshold**: 20% (아직 18pt 더 떨어뜨려야 spec 작성 가능)

---

## Ontology (Round 2 기준)

| Entity | Type | 비고 |
|---|---|---|
| BoothMode | core | "themed" \| "normal" enum |
| OnboardingScreen | core | 두 모드 중 선택 (UI 미정) |
| ThemedFlow | core domain | 기존 7컷 흐름 (그대로) |
| NormalFlow | core domain | 신규 4컷 흐름 |
| PolaroidSheet | core | 4컷 + 테두리 + 캡션 + 스티커 합성 출력물 |
| NormalCut | core | 일반 모드 단일 캡처 (576×720 ImageBitmap, 오버레이 없음) |
| RandomStickerPick | core | 세션 시작/합성 시 랜덤으로 뽑은 스티커 세트 |
| Caption | supporting | 고정 텍스트 `♡ OZCODING PD09 ♡` |

Stability: round1→round2 = 75% (6 stable + 2 new), 다음 라운드에서 90%+ 노리는 중

---

## 미해결 질문 (Round 3+)

### Round 3 (PENDING — 내일 답변 받을 차례)
**메인**: 스티커 자산은 어디서 와?
- A. 본인이 SVG/PNG 직접 제공 (예: `public/stickers/normal/`)
- B. 내가 단순 형태(별·하트·음표) SVG로 코드에서 직접 그림
- C. 오픈 라이선스 셋 사용 (Twemoji, Open Doodles 등 출처 명시)
- D. 이모지/유니코드만 (`★ ♥ ♪ ✦`)
- E. 직접 설명

**보조 1**: 시트 출력 비율
- a) 1080×1440 (3:4, 2×2 적합)
- b) 1080×2400 그대로 (테마 모드와 동일)
- c) 다른 — 지정

**보조 2**: 온보딩 모드 선택 UI
- a) 두 큰 카드 (가운데 정렬)
- b) 토글/탭
- c) 두 시작 버튼 가로 나란히
- d) 다른

### Round 4+ (Success Criteria 차원, 현재 0.20)
- 일반 모드가 "잘 동작한다"의 acceptance criteria 정의 필요
- 자동 테스트 가능한 기준 (예: 4컷 촬영 후 폴라로이드 시트 PNG 생성 확인)
- 스티커 랜덤 배치 검증 방법

### Challenge Modes (활성화 대기)
- Round 4: Contrarian Mode 발동 가능 ("4컷이 아니라 6컷? 정사각 1×4? 다른 구조 가능성?")
- Round 6: Simplifier Mode ("스티커 없이 폴라로이드 테두리만 있는 더 단순한 버전이 충분?")

---

## 내일 시작하는 법

1. 이 파일 다시 읽기 (`.omc/specs/deep-interview-normal-mode-WIP.md`)
2. **Round 3 질문에 답** (스티커 자산 옵션 A/B/C/D, 시트 비율, 온보딩 UI)
3. 모호도 ≤ 20% 떨어지면 → 본 spec 파일 (`deep-interview-normal-mode.md`) 작성 → ralplan/autopilot으로 넘김
4. 또는 명령어 그대로: `/oh-my-claudecode:deep-interview` 호출하면 자동 resume됨
