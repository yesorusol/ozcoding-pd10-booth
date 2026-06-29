# 오즈코딩 네트워킹 데이 포토부스 📸

행사장에 두고 쓰는 **웹 포토부스**입니다. 태블릿/노트북 브라우저로 열어 사진을 찍고,
스티커로 꾸민 뒤 QR로 내려받을 수 있어요. (Next.js + Supabase + Vercel)

> **다른 기수 담당자분께:** 이 저장소를 복사해서 우리 기수 이름·날짜로 바꾼 뒤
> 새로 배포하면 그대로 쓸 수 있습니다. 코딩을 몰라도 아래 순서만 따라오면 돼요. 🙂

---

## 1. 새 기수용으로 복사하기

1. 이 페이지(GitHub) 오른쪽 위 **Fork** 버튼 → 내 계정으로 복사본 생성
   (또는 `git clone https://github.com/yesorusol/ozcoding-pd09-booth.git`)
2. 복사된 내 저장소를 [Vercel](https://vercel.com)에 **Import** → 자동으로 배포됨

---

## 2. 우리 기수에 맞게 문구·날짜 바꾸기

화면과 사진에 나오는 글씨는 **딱 4개 파일**만 고치면 전부 바뀝니다.
(GitHub 웹에서 파일 열고 연필 아이콘 ✏️ 으로 바로 수정 가능)

| 바꾸고 싶은 것 | 파일 | 찾을 부분 |
|---|---|---|
| 상단 사인보드 문구 (워드마크·자막) | `lib/copy.ts` | `marquee` |
| 시작 화면 헤드라인 | `lib/copy.ts` | `onboarding.headlineKr` / `headlineEn` |
| 사진에 박히는 **상단 제목** | `lib/overlay-composer.ts`, `lib/sheet-composer.ts` | `HEADLINE_KR`, `HEADLINE_EN` |
| 사진에 박히는 **날짜·해시태그** | `lib/overlay-composer.ts`, `lib/sheet-composer.ts` | `FOOTER_TEXT` (예: `"2026.06.29 ⋆ MAKE MEMORIES ⋆ #교육5팀"`) |
| 컷별 라벨·말풍선 문구 | `lib/frames.ts` | 각 프레임의 `tagline` |

> 💡 `overlay-composer.ts`(일반 4컷)와 `sheet-composer.ts`(챌린지 시트) **둘 다** 같은 값을
> 갖고 있으니, 제목/날짜를 바꿀 땐 **두 파일 모두** 똑같이 고쳐주세요.

스티커를 추가하려면: 투명 PNG를 `public/stickers/chars/` 에 넣고
`lib/sticker-assets.ts` 의 `CHARACTER_STICKERS` 목록에 한 줄 추가하면 됩니다.

---

## 3. 사진 저장소(Supabase) 연결 — 꼭 필요!

사진을 저장하려면 **본인 기수 전용** Supabase가 필요합니다. (다른 기수 것을 같이 쓰면 안 됨)

1. [Supabase](https://supabase.com) 가입 → 새 프로젝트 생성 (지역: **Northeast Asia / Seoul** 권장)
2. **Storage → New bucket** → 이름 `captures` → **Public bucket** 체크
3. **Project Settings → API** 에서 아래 값 복사
4. Vercel 프로젝트 → **Settings → Environment Variables** 에 입력:

| 환경변수 | 값 |
|---|---|
| `SUPABASE_URL` | Supabase의 "Project URL" |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" 키 (⚠️ anon 아님) |
| `CRON_SECRET` | 아무 랜덤 문자열 (24시간 뒤 사진 자동삭제용) |

> 🔒 **이 키들은 절대 코드에 직접 적지 마세요.** 반드시 Vercel 환경변수에만 넣습니다.
> (`.env.local.example` 파일에 자세한 설명이 있어요. 로컬 테스트 땐 이걸 `.env.local`로 복사해 채우세요.)

저장된 사진은 24시간 뒤 자동으로 지워집니다(개인정보 보호). 즉시 비우려면 `node scripts/wipe-captures.mjs`.

---

## 4. 직접 실행/개발해보기 (선택)

```bash
npm install        # 최초 1회 — 필요한 패키지 설치
npm run dev        # 개발 서버 → http://localhost:3000
npm run build      # 배포용 빌드 (오류 점검)
npm run kiosk      # 행사장 키오스크 모드로 실행
```

부스 화면은 `/booth`, 시작 화면은 `/` 입니다.

---

## 화면 구성

- `/` — 시작(온보딩) 화면
- `/booth` — 4컷 자동 촬영 → 스티커 꾸미기 → QR 다운로드
- `/themed` — 테마(챌린지) 모드

문구는 `lib/copy.ts`, 사진 합성은 `lib/overlay-composer.ts` · `lib/sheet-composer.ts`,
프레임 정의는 `lib/frames.ts` 에 모여 있습니다.
