/**
 * lib/booth-mode.ts — Mode discriminator + per-mode metadata.
 *
 * `parseBoothMode` is the single source of truth for `?mode=` query
 * resolution: missing/invalid falls back to `"themed"`; only the exact
 * literal `"normal"` switches modes.
 *
 * `MODE_CONFIG` is data-only (no `compose` function field) so each
 * mode keeps its own composer import in its own flow component — see
 * `components/ThemedFlow.tsx` and `components/NormalFlow.tsx`.
 */

export type BoothMode = "themed" | "normal";

export interface ModeConfig {
  totalCuts: number;
  sheetSize: { width: number; height: number };
  displayName: string;
}

export const MODE_CONFIG: Readonly<Record<BoothMode, ModeConfig>> = {
  themed: {
    totalCuts: 7,
    sheetSize: { width: 1080, height: 2400 },
    displayName: "도전 챌린지",
  },
  normal: {
    totalCuts: 4,
    sheetSize: { width: 1080, height: 1440 },
    displayName: "폴라로이드(일반)",
  },
} as const;

export function parseBoothMode(value: string | null | undefined): BoothMode {
  if (value === "normal") return "normal";
  return "themed";
}
