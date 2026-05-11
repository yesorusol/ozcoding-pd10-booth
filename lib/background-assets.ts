/**
 * lib/background-assets.ts — Sheet background choices for the editor.
 *
 * The user can pick either a pattern (image) or a solid color. The choice
 * is plumbed through the editor down to `composeOverlaySheet` so the
 * preview re-composites live and the final burn includes the same bg.
 */

export interface BackgroundPattern {
  id: string;
  src: string;
  label: string;
  /** Hint hex for the swatch thumbnail border / accent (cosmetic). */
  accent: string;
  /**
   * Optional CSS background-position override for the picker thumbnail.
   * Defaults to "center". Useful for patterns whose visual interest sits
   * at the edges (e.g., border-frame styles where the center is empty).
   */
  thumbPosition?: string;
}

export interface BackgroundColor {
  id: string;
  hex: string;
  label: string;
}

export type BackgroundChoice =
  | { kind: "pattern"; patternId: string }
  | { kind: "color"; colorId: string };

/**
 * Reference backgrounds dropped in /public/backgrounds/.
 * Order matters: the first BACKGROUND_PATTERNS_DEFAULT_VISIBLE entries render
 * in the picker by default; the rest reveal when the user hovers the row or
 * taps "더보기".
 */
export const BACKGROUND_PATTERNS: ReadonlyArray<BackgroundPattern> = [
  // Default-visible set — the original 6 launch patterns.
  { id: "halftone-pink", src: "/backgrounds/halftone-pink.jpeg", label: "핑크 도트", accent: "#f9a8d4" },
  { id: "sunburst-pink", src: "/backgrounds/sunburst-pink.jpeg", label: "선버스트", accent: "#fbc4d8" },
  { id: "stars-pink", src: "/backgrounds/stars-pink.jpeg", label: "핑크 별", accent: "#f7b8d6" },
  { id: "clovers-mint", src: "/backgrounds/clovers-mint.jpeg", label: "클로버", accent: "#a7d9b6" },
  { id: "sparkles-blue", src: "/backgrounds/sparkles-blue.jpeg", label: "스파클", accent: "#86c4f7" },
  // Reveal-on-hover extras (from /Users/a1111/Desktop/Photo_background).
  { id: "extra-45", src: "/backgrounds/extra-45.jpeg", label: "픽셀 하트", accent: "#a8e8d5" },
  { id: "extra-45b", src: "/backgrounds/extra-45b.jpeg", label: "네온 타탄", accent: "#ff6fa8" },
  { id: "extra-48", src: "/backgrounds/extra-48.jpeg", label: "별 체크", accent: "#7ea7d8" },
  { id: "extra-48b", src: "/backgrounds/extra-48b.jpeg", label: "그린 도트", accent: "#9bd84a" },
  { id: "extra-49", src: "/backgrounds/extra-49.jpeg", label: "별 타탄", accent: "#7aa56a" },
  { id: "extra-62", src: "/backgrounds/extra-62.jpeg", label: "베이퍼웨이브", accent: "#ff4fa8" },
  { id: "extra-63", src: "/backgrounds/extra-63.jpeg", label: "키티 프룻", accent: "#ffb8d0" },
  { id: "extra-64", src: "/backgrounds/extra-64.jpeg", label: "네온 별", accent: "#2ca7ff", thumbPosition: "top" },
  { id: "extra-68", src: "/backgrounds/extra-68.jpeg", label: "파스텔 무지개", accent: "#ffb8e6" },
  { id: "extra-68b", src: "/backgrounds/extra-68b.jpeg", label: "핑크 줄무늬", accent: "#ff9ec7" },
  { id: "extra-71", src: "/backgrounds/extra-71.jpeg", label: "별 가루", accent: "#ff7eb5" },
  { id: "extra-76", src: "/backgrounds/extra-76.jpeg", label: "핑크 별", accent: "#ff8fc3" },
  { id: "extra-77", src: "/backgrounds/extra-77.jpeg", label: "핑크 소용돌이", accent: "#ff6fa8" },
  { id: "extra-78", src: "/backgrounds/extra-78.jpeg", label: "홀로그램", accent: "#a8e8ff" },
  { id: "chat-bubble", src: "/backgrounds/chat-bubble.jpeg", label: "블루 체크", accent: "#6492ff" },
  { id: "magic-in-the-air", src: "/backgrounds/magic-in-the-air.jpeg", label: "민트 마블", accent: "#7ddccf" },
  { id: "printable-pattern", src: "/backgrounds/printable-pattern.jpeg", label: "딸기 체크", accent: "#e63946" },
  { id: "swirle", src: "/backgrounds/swirle.jpeg", label: "옐로 소용돌이", accent: "#ffc94d" },
];

/** Patterns rendered per page in the editor picker (paginated with arrows). */
export const BACKGROUND_PATTERNS_PAGE_SIZE = 6;

export const BACKGROUND_COLORS: ReadonlyArray<BackgroundColor> = [
  { id: "cream", hex: "#fff5e6", label: "크림" },
  { id: "blush", hex: "#ffd8e6", label: "블러시" },
  { id: "butter", hex: "#fff36b", label: "버터" },
  { id: "mint", hex: "#d4f5e8", label: "민트" },
  { id: "sky", hex: "#cfe8ff", label: "스카이" },
  { id: "lavender", hex: "#e8e0ff", label: "라벤더" },
  { id: "navy", hex: "#1d2c4a", label: "네이비" },
  { id: "white", hex: "#ffffff", label: "화이트" },
];

export const DEFAULT_BACKGROUND: BackgroundChoice = {
  kind: "pattern",
  patternId: "halftone-pink",
};

export function findBackgroundPattern(id: string): BackgroundPattern | undefined {
  return BACKGROUND_PATTERNS.find((p) => p.id === id);
}

export function findBackgroundColor(id: string): BackgroundColor | undefined {
  return BACKGROUND_COLORS.find((c) => c.id === id);
}

/** Resolve a choice to a CSS-friendly background spec for the editor preview. */
export function backgroundToCss(choice: BackgroundChoice): {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
} {
  if (choice.kind === "color") {
    const color = findBackgroundColor(choice.colorId);
    return { backgroundColor: color?.hex ?? "#ffffff" };
  }
  const pattern = findBackgroundPattern(choice.patternId);
  if (!pattern) return { backgroundColor: "#ffffff" };
  return {
    backgroundImage: `url(${pattern.src})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}
