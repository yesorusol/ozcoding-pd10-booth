/**
 * lib/__benchmarks__/themed-compose-baseline.ts
 *
 * Compose-time parity tolerance shared between `lib/sheet-composer.ts`
 * (themed, 7 cuts → 1080×2400) and `lib/overlay-composer.ts` (normal,
 * 4 cuts → 1080×1440).
 *
 * Per Architect flag #1 (round 3): the absolute themed median is NOT
 * pinned as a constant here. Instead, `lib/overlay-composer.test.ts`
 * measures BOTH themed and normal medians inside `beforeAll` of the
 * same test run and compares relatively. This eliminates CI-runner
 * variance: both medians scale together, so the ratio is robust.
 */

/** normal compose median MUST be ≤ themed median × this tolerance. */
export const PARITY_TOLERANCE = 1.2;

/** Number of samples per median measurement. */
export const SAMPLE_COUNT = 5;

/** Compute the median of an unsorted array of numbers. */
export function median(samples: ReadonlyArray<number>): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
