# Deep Interview Spec: OZCODING PD09 Y2K/MZ 프리쿠라 포토부스

## Metadata
- Interview ID: ozcoding-pd09-booth-2026-05-06
- Rounds: 6
- Final Ambiguity Score: 9%
- Type: greenfield (assets only, no code yet)
- Generated: 2026-05-06
- Threshold: 20%
- Status: PASSED (well below threshold)

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.40 | 0.380 |
| Constraint Clarity | 0.92 | 0.30 | 0.276 |
| Success Criteria | 0.85 | 0.30 | 0.255 |
| **Total Clarity** | | | **0.911** |
| **Ambiguity** | | | **0.089 (9%)** |

## Goal
OZCODING PD09 행사(2026.05.14)에서 사용할 키오스크형 Y2K/프리쿠라 포토부스를 만든다.
사용자가 노트북(웹캠 내장 또는 USB 웹캠) 앞에 서면 7개의 Y2K/MZ 캐릭터 프레임이 라이브로
오버레이되고, 자동 카운트다운으로 7번 연속 촬영해 인생4컷의 8칸 확장형 시트(7프레임 + 1타이틀)를
즉석에서 합성한다. 결과 이미지는 화면에 QR 코드로 노출되어 사용자가 폰으로 다운로드한다.

## Constraints
- **플랫폼**: 데스크톱 키오스크 모드 (이벤트장 노트북 + 풀스크린 웹앱)
- **호스팅**: 로컬 노트북에서 자체 실행 (Next.js dev/start 또는 단일 SPA + 로컬 정적 서버)
- **외부 URL 노출**: ngrok / cloudflared / localtunnel 같은 터널로 QR 가리킬 공개 URL 생성
- **외부 클라우드 의존성**: 0 — 행사장 와이파이만 있으면 됨
- **카메라**: 노트북 내장 웹캠 또는 USB 웹캠 (`getUserMedia` 표준)
- **결과 이미지**: PNG, 1080×2400 (세로형, 폰 스토리 비율과 호환)
- **합성 방식**: 라이브 오버레이 — 카메라 영상 위에 프레임 PNG(핑크 원이 alpha=0인 투명 영역)를
  덮어 보여주고, 사용자가 직접 자기 얼굴을 원 안에 맞춤. 셔터 시점에 합성된 프레임을 캡처.
- **AI/ML 의존성**: 0 — MediaPipe, face-api, rembg 등 일절 사용하지 않음
- **흐름 시간**: 한 세션 30~60초 (자동 카운트다운, 컷 간 ~5초)
- **결과 유효 기간**: 노트북/터널 살아 있는 동안만 (행사 종료 시 자연 만료)

## Non-Goals (MVP에서 명시적 제외)
- 인쇄 / 스티커 출력
- 영구 클라우드 저장
- 사용자 계정 / 로그인
- 관리자 대시보드, 촬영 통계
- AI 얼굴 추출, 누끼 따기, 자동 정렬
- 이메일 / 카카오톡 자동 전송
- 다국어 (한국어만)
- 모바일 자체 사용 (모바일은 QR로 결과 받는 용도만)
- 컷 순서 사용자 선택 / 일부 프레임 제외 / 다시 찍기

## Acceptance Criteria
- [ ] 시작 화면(브랜드 + "시작" 버튼)에서 시작 버튼 1회 클릭 시 카메라가 활성화된다
- [ ] 카메라 활성화 후 "컷 1/7"이라는 라벨과 함께 첫 번째 프레임이 라이브 영상 위에 정확히 오버레이된다
- [ ] 프레임의 핑크 원 영역은 투명이며, 그 자리에 카메라 영상이 그대로 보인다
- [ ] 각 컷 시작 직후 3-2-1 카운트다운이 화면에 크게 표시되고, 0에서 셔터가 자동으로 동작한다
- [ ] 셔터 직후 0.5~1초 동안 방금 찍힌 컷이 미리보기로 표시되고 다음 컷으로 자동 진행된다
- [ ] 7컷이 모두 끝나면 7개 합성 사진 + title-card.png가 4×2 그리드의 한 장(1080×2400)으로 합성된다
- [ ] 합성된 결과 이미지가 PNG 파일로 로컬 임시 저장되고, 그 파일을 가리키는 공개 URL이 생성된다
- [ ] 결과 화면에 큰 QR 코드와 시트 미리보기가 함께 표시되고, 폰으로 QR을 찍으면 PNG가 다운로드된다
- [ ] 결과 화면에서 "다음 사용자" 버튼을 누르면 다시 시작 화면으로 돌아간다
- [ ] 한 세션 전체(시작→QR 노출)가 90초 이내에 완료된다
- [ ] 행사 종료 후 노트북을 끄면 모든 결과가 사라진다 (영구 저장 없음 확인)

## Assumptions Exposed & Resolved
| 가정 | 챌린지 | 해소 |
|------|--------|------|
| AI 얼굴 추출이 필요할 것이다 | 사용자가 라이브 오버레이로 직접 맞추는 게 진짜 프리쿠라 부스 동작 | ML 의존성 0, 단순 alpha 오버레이로 결정 |
| 클라우드 호스팅이 필요할 것이다 | 행사용이라 로컬 + 터널이면 충분 | Vercel/Supabase 제외, 로컬 노트북 + ngrok |
| 인쇄가 핵심 가치일 것이다 | 인스타 스토리 공유가 더 MZ스러움 | 인쇄 비목표, QR + 폰 다운로드만 |
| 사용자가 셔터를 직접 눌러야 할 것이다 | 인생4컷은 자동 카운트다운이 정통 | 자동 카운트다운 7회로 결정 |
| 프레임당 다른 사진이 들어갈 것이다 (1장→7합성) | 인생4컷은 컷마다 다른 표정/포즈 | 7번 연속 독립 촬영으로 결정 |

## Technical Context

### 자산 인벤토리 (`/Users/a1111/Desktop/ozcoding-pd09-booth/`)
| 파일 | 역할 | 크기 |
|------|------|------|
| burger.png | 프레임 1: 햄버거 안 얼굴 | 720×900, alpha 있음 |
| ramen.png | 프레임 2: 라면 안 얼굴 | 720×900, alpha 있음 |
| tamagotchi.png | 프레임 3: 타마고치 화면 | 720×900, alpha 있음 |
| teeth.png | 프레임 4: 입 안 얼굴 | 720×900, alpha 있음 |
| mic.png | 프레임 5: 마이크 기자회견 | 720×900, alpha 있음 |
| cosplay.png | 프레임 6: 코스프레/웨이터 | 720×900, alpha 있음 |
| waiter.png | 프레임 7: 광원/태양 | 720×900, alpha 있음 |
| title-card.png | 8번째 칸: OZCODING PD09 텍스트 | Y2K 핑크/노랑 픽셀 폰트 |
| sheet-mockup.png | 최종 4×2 그리드 레이아웃 참조 | — |

### 빌드 전 1회 전처리
- 7개 프레임 PNG의 핑크 원 영역이 현재 alpha=0(투명)인지 확인 필요
- 만약 핑크색으로 칠해진 상태(alpha=255)라면, 빌드 시 chroma-key 스크립트로 핑크 → 투명 변환
- 권장 도구: ImageMagick (`magick frame.png -fuzz 15% -transparent "rgb(255,150,180)" frame-out.png`) 또는 Node `sharp`
- 실행은 1회성, `scripts/preprocess-frames.ts` 같은 곳에 두고 `npm run preprocess`

### 추천 스택
- **프레임워크**: Next.js 15 App Router + React 19 + TypeScript
- **스타일**: Tailwind CSS (Y2K 스타일은 핑크/노랑/픽셀 폰트로 구현)
- **카메라**: 브라우저 표준 `getUserMedia` + `<video>` + `<canvas>`
- **합성**: Canvas 2D `drawImage` (라이브 오버레이는 CSS absolute, 캡처 시 canvas로 합성)
- **결과 시트 합성**: Canvas 2D — 1080×2400 캔버스에 4×2 그리드로 7컷 + title-card 배치
- **로컬 저장**: Next.js API route → `/tmp` 또는 `public/captures/`에 PNG 저장 후 URL 반환
- **QR 생성**: `qrcode` npm 패키지, 클라이언트에서 생성
- **외부 URL**: 사용자가 행사장에서 `ngrok http 3000` 수동 실행 (스펙 README에 명시)

### 키오스크 모드 운영
- 풀스크린 (`F11` 또는 Chromium kiosk 플래그)
- 한 세션 종료 시 자동으로 시작 화면 복귀
- "다음 사용자" 버튼 또는 30초 무응답 시 자동 리셋

## Ontology (Key Entities — 최종 라운드 기준)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| PhotoBooth | core domain | sessionId, status | hosts Session |
| Session | core domain | id, startedAt, currentCutIndex, status | belongs to PhotoBooth, has 7 Cuts, produces OutputSheet |
| Frame | core domain | id, name, imagePath, alphaMask, gridPosition | overlaid on LivePreview, baked into Cut |
| Cut | core domain | index(0-6), capturedImage, frameId | composed in Session, baked into OutputSheet |
| TitleCard | supporting | imagePath, gridPosition(7) | placed in OutputSheet |
| LiveOverlay | core domain | currentFrameId, videoStream | rendered during Session |
| Countdown | supporting | secondsRemaining, current | drives Cut capture |
| OutputSheet | core domain | id, pngPath, publicUrl, gridLayout(4x2), resolution(1080x2400) | composed of 7 Cuts + TitleCard, served via Storage |
| QRCode | supporting | targetUrl, size | rendered for OutputSheet |
| LocalServer | external system | port(3000), tmpDir | hosts OutputSheet PNGs |
| TunnelURL | external system | publicHost (ngrok/cloudflared) | resolves QRCode targetUrl |
| User | external | (anonymous) | interacts with PhotoBooth |
| Camera | external system | mediaStream(getUserMedia) | feeds LiveOverlay |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|-----------|
| 1 | 6 | 6 | - | - | N/A |
| 2 | 8 | 2 | - | 6 | 75% |
| 3 | 11 | 3 | - | 8 | 73% |
| 4 | 12 | 2 | -1(removed FaceCutout) | 10 | 83% |
| 5 | 16 | 4 | - | 12 | 75% |
| 6 | 18 | 2 | - | 16 | 89% |

도메인 모델이 6라운드만에 89% 안정도까지 수렴. AI 얼굴추출 가정이 4라운드에서 폐기된 것이 가장 큰 구조 변화였음.

## Interview Transcript

<details>
<summary>Full Q&A (6 rounds)</summary>

### Round 1
**Q:** 이 포토부스가 어디서 돌아가야 하나요? (실행 환경)
**A:** 데스크톱 키오스크/이벤트용
**Ambiguity:** 80% (Goal: 0.20, Constraints: 0.40, Criteria: 0.00)
*(촬영 흐름 질문도 함께 했으나 사용자가 플랫폼 답만 주어 다음 라운드로 이월)*

### Round 2
**Q:** 키오스크 앞에 온 사용자가 실제로 무엇을 하나요? (사진이 어떻게 만들어지는지)
**A:** 프리쿠라 스타일: 7번 연속 촬영
**Ambiguity:** 59% (Goal: 0.70, Constraints: 0.40, Criteria: 0.05)

### Round 3
**Q:** 사용자가 촬영을 마친 뒤 결과물(8칸 시트 1장)이 어떻게 손에 들어가야 하나요?
**A:** QR 코드 스캔 → 폰으로 다운로드
**Ambiguity:** 42% (Goal: 0.70, Constraints: 0.55, Criteria: 0.45)

### Round 4
**Q:** 각 프레임의 핑크 원(얼굴 자리)에 사용자 얼굴이 어떻게 들어가나요? (합성 방식)
**A:** 얼굴이 들어갈 투명 부분은 그대로 투명하게 두어서 사용자가 얼굴을 맞추게 함 → **자유 응답으로 라이브 오버레이 방식 직접 제시**
**Ambiguity:** 33% (Goal: 0.85, Constraints: 0.60, Criteria: 0.50)

### Round 5
**Q:** 7컷 촬영 중 각 컷 사이의 흐름은 어떤 식이어야 하나요? (인생4컷 느낌 그대로)
**A:** 자동 카운트다운 연속 (인생4컷 정통)
**Ambiguity:** 24% (Goal: 0.92, Constraints: 0.75, Criteria: 0.55)

### Round 6 — Simplifier Mode
**Q:** 결과물과 호스팅의 '적절한 최소 스펙'은 어디인가요? — 'MVP에서 빼도 되는 것'은?
**A:** 최소 스펙: 로컬 노트북 호스팅 + 웹용 PNG (1080×2400)
**Ambiguity:** 9% ✅ (Goal: 0.95, Constraints: 0.92, Criteria: 0.85)

</details>

## Challenge Modes Used
- ✅ Round 6: Simplifier Mode (MVP 범위 압축에 직접 효과)
- ⏸ Contrarian Mode: 사용자가 round 4에서 자발적으로 단순한 정답("AI 안 쓰고 투명 오버레이")을 제시했기에 contrarian 챌린지 불필요
- ⏸ Ontologist Mode: 모호도가 일찍 떨어져서 미사용
