/**
 * lib/frames.ts — Canonical frame metadata array used everywhere in the app.
 *
 * 👉 컷별 라벨(짧은 이름) / 말풍선 카피(한 줄)는 여기서 수정합니다.
 *
 * Order corresponds to grid index 0..7 (2 cols × 4 rows, left-to-right,
 * top-to-bottom). Title-card is always at grid position 7 (bottom-right).
 *
 * TODO: Sample sheet-mockup.png visually to confirm per-frame grid order
 * matches the designer's intent. Current order is functional but may differ
 * from the exact visual sequence in the mockup reference.
 */

import type { Frame } from "./types";

export const FRAMES: ReadonlyArray<Frame> = [
  {
    id: "tamagotchi",
    src: "/frames/processed/tamagotchi.png",
    label: "텔레토비 네컷",
    labelEn: "Teletubbies group shot",
    tagline: "텔레토비 텔레토비~ 다 같이 모여라!",
    gridIndex: 0,
  },
  {
    id: "teeth",
    src: "/frames/processed/teeth.png",
    label: "입속 탐험~ 스마일~",
    labelEn: "Mouth explorer",
    tagline: "입속 탐험! 활짝 스마일~",
    gridIndex: 1,
  },
  {
    id: "burger",
    src: "/frames/processed/burger.png",
    label: "버거 타임",
    labelEn: "Burger time",
    tagline: "패티 10기~ 완성~",
    gridIndex: 2,
  },
  {
    id: "ramen",
    src: "/frames/processed/ramen.png",
    label: "라면 타임",
    labelEn: "Ramen time",
    tagline: "뜨겁다 뜨거워!!!",
    gridIndex: 3,
  },
  {
    id: "waiter",
    src: "/frames/processed/waiter.png",
    label: "오늘의 메뉴 등장!",
    labelEn: "Today's menu!",
    tagline: "오늘 등장한 주인공은 바로 당신!",
    gridIndex: 4,
  },
  {
    id: "cosplay",
    src: "/frames/processed/cosplay.png",
    label: "프린세스 10기~",
    labelEn: "Princess 10!",
    tagline: "프린세스 10기~",
    gridIndex: 5,
  },
  {
    id: "mic",
    src: "/frames/processed/mic.png",
    label: "PD 성공 인터뷰",
    labelEn: "PD success interview",
    tagline: "오늘 성공하신 PD님, 한 말씀 부탁드려요!",
    gridIndex: 6,
  },
  {
    id: "title-card",
    src: "/frames/processed/title-card.png",
    label: "PD10",
    labelEn: "PD10 Networking Day",
    tagline: "OZCODING PD10 네트워킹 데이",
    gridIndex: 7,
  },
] as const;

/** The 7 capture frames (excludes title-card). */
export const CAPTURE_FRAMES: ReadonlyArray<Frame> = FRAMES.filter(
  (f) => f.id !== "title-card",
);

/** The title card frame, always at grid position 7. */
export const TITLE_FRAME: Frame = FRAMES[7];
