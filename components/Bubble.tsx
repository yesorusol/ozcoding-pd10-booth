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
        // 꼬리: SVG path로 단일 삼각형 그려서 회전+clip-path 조합의 잔여
        // 안티앨리어싱 선 / 베이스라인 단절 문제를 한 번에 해소.
        // 삼각형 윗변이 말풍선 바닥선과 자연스럽게 이어지도록 -bottom-px로
        // 1px만 겹쳐서 borders가 연결돼 보이게 함.
        <svg
          aria-hidden="true"
          data-testid="bubble-tail"
          width="22"
          height="18"
          viewBox="0 0 22 18"
          className="absolute -bottom-[17px] left-7 text-cabinet-frame"
          style={{ overflow: "visible" }}
        >
          <path
            d="M 0 0 L 22 0 L 0 18 Z"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="miter"
          />
        </svg>
      ) : null}
    </div>
  );
}
