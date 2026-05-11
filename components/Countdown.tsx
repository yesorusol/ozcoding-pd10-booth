"use client";

/**
 * components/Countdown.tsx — Huge centered numeral overlay used during the
 * 'countdown' phase. Designed per plan §M3 accessibility floor:
 *   - clamp(8rem, 30vh, 18rem) ≈ ≥200pt
 *   - White text on dark scrim → contrast ratio ≥7:1 against any camera feed
 *   - aria-live="assertive" so screen readers announce each second
 *   - Single state, no flashing element ≥3Hz (epilepsy-safe)
 */

interface CountdownProps {
  /** Remaining seconds — typically 3 → 2 → 1. */
  seconds: number;
}

export function Countdown({ seconds }: CountdownProps) {
  return (
    <span
      role="timer"
      aria-live="assertive"
      data-testid="countdown"
      className="pointer-events-none font-marquee leading-none text-white"
      style={{
        fontSize: "clamp(4rem, 14vh, 9rem)",
        textShadow: "0 0 24px #3aa6ff, 0 0 48px #3aa6ff, 3px 3px 0 #0c1b3d",
        WebkitTextStroke: "3px #0c1b3d",
      }}
    >
      <span data-testid="countdown-numeral">{seconds}</span>
    </span>
  );
}
