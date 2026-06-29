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
        // 꼬리: 채움(fill)과 외곽선(stroke)을 분리. 채움은 1px 위쪽으로 더
        // 끌어올려 말풍선 바닥선을 가리고, 외곽선은 두 옆면만 그려서 윗변에
        // 가로 선이 보이지 않도록 함. 결과: 꼬리 입구가 말풍선과 한 몸처럼
        // 매끄럽게 이어진다.
        <svg
          aria-hidden="true"
          data-testid="bubble-tail"
          width="24"
          height="20"
          viewBox="0 0 24 20"
          className="absolute -bottom-[19px] left-6 text-cabinet-frame"
          style={{ overflow: "visible" }}
        >
          <path
            d="M 1 -1 L 23 -1 L 5 19 Z"
            fill="#ffffff"
          />
          <path
            d="M 23 0 L 5 19 L 1 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
