"use client";

/**
 * components/Bubble.tsx — Green-gradient speech bubble (image #3).
 *
 * Used wherever the booth speaks to the user: cut taglines, countdown
 * announcements, error banners, idle CTA. Thick black outline + chunky
 * y2k drop shadow. Optional tail for callout style; round oval otherwise.
 */

import type { ReactNode } from "react";

export interface BubbleProps {
  children: ReactNode;
  /** Adds a tail (말풍선 꼬리) on the bottom-left corner */
  tail?: boolean;
  /** Visual size preset */
  size?: "sm" | "md" | "lg";
  /** Optional extra classes for layout (margin/positioning) */
  className?: string;
  /** ARIA role override (defaults to none — Bubble is decorative wrapping) */
  role?: string;
  /** ARIA live override for status callouts */
  ariaLive?: "off" | "polite" | "assertive";
}

const sizeClasses: Record<Required<BubbleProps>["size"], string> = {
  sm: "px-4 py-2 text-base rounded-2xl",
  md: "px-6 py-3 text-xl rounded-[2rem]",
  lg: "px-10 py-6 text-3xl rounded-[3rem]",
};

export function Bubble({
  children,
  tail = false,
  size = "md",
  className = "",
  role,
  ariaLive,
}: BubbleProps) {
  return (
    <div
      role={role}
      aria-live={ariaLive}
      data-testid="bubble"
      className={[
        "relative inline-block bg-bubble-grad border border-cabinet-frame shadow-soft font-body text-cabinet-frame text-center",
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {children}
      {tail ? (
        <span
          aria-hidden="true"
          data-testid="bubble-tail"
          className="absolute -bottom-4 left-6 h-6 w-6 rotate-45 border-b border-l border-cabinet-frame"
          style={{
            background:
              "linear-gradient(135deg, transparent 0%, transparent 50%, #ffffff 50%, #ffffff 100%)",
          }}
        />
      ) : null}
    </div>
  );
}
