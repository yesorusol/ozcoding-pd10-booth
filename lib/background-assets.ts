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
}

export interface BackgroundColor {
  id: string;
  hex: string;
  label: string;
}

export type BackgroundChoice =
  | { kind: "pattern"; patternId: string }
  | { kind: "color"; colorId: string };

/** 6 reference backgrounds dropped in /public/backgrounds/. */
export const BACKGROUND_PATTERNS: ReadonlyArray<BackgroundPattern> = [
  { id: "halftone-pink", src: "/backgrounds/halftone-pink.jpeg", label: "핑크 도트", accent: "#f9a8d4" },
  { id: "sunburst-pink", src: "/backgrounds/sunburst-pink.jpeg", label: "선버스트", accent: "#fbc4d8" },
  { id: "stars-pink", src: "/backgrounds/stars-pink.jpeg", label: "핑크 별", accent: "#f7b8d6" },
  { id: "clovers-mint", src: "/backgrounds/clovers-mint.jpeg", label: "클로버", accent: "#a7d9b6" },
  { id: "sparkles-blue", src: "/backgrounds/sparkles-blue.jpeg", label: "스파클", accent: "#86c4f7" },
  { id: "sky-clouds", src: "/backgrounds/sky-clouds.jpeg", label: "구름", accent: "#7eb6f5" },
];

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
