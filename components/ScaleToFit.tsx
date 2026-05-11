"use client";

/**
 * components/ScaleToFit.tsx — Wraps content and uniformly scales it down so
 * the entire wrapped element fits inside the current viewport without
 * scrolling, clipping, or aspect-ratio distortion.
 *
 * Used by the idle/start page so the arcade cabinet appears fully visible
 * (header → CRT → keyboard → footer) on any laptop or iPad regardless of
 * window height. /booth deliberately does NOT use this — the camera should
 * claim its natural space there.
 *
 * Implementation notes:
 *   • The inner wrapper uses `width: max-content` so it sizes to the child's
 *     natural max width (e.g. CabinetChrome's `max-w-[640px]`). This avoids
 *     the cyclic-width bug where `w-full` inside a flex item with `width:
 *     auto` could collapse and distort proportions.
 *   • `useLayoutEffect` measures BEFORE the browser paints, so the user
 *     never sees a one-frame "too big" flash.
 *   • A `ResizeObserver` re-runs the calculation whenever the wrapped
 *     content changes size (font reflow, responsive breakpoints, etc.).
 *   • A `resize` listener handles viewport changes.
 *   • The applied scale is uniform (`scale(s)`) so all aspect ratios are
 *     preserved exactly.
 *   • `maxScale` (default 1) prevents up-scaling on huge displays.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface ScaleToFitProps {
  children: ReactNode;
  /** Pixel margin to leave around the scaled content. */
  padding?: number;
  /** Cap on the applied scale (default 1.0 — never up-scale). */
  maxScale?: number;
}

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ScaleToFit({
  children,
  padding = 12,
  maxScale = 1,
}: ScaleToFitProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      // offsetWidth/offsetHeight reflect the natural (pre-transform) layout
      // box because CSS transforms don't affect layout — they're a paint-stage
      // operation. scrollWidth/Height would also work but include any overflow
      // we never want to count toward the fit calculation.
      const naturalH = el.offsetHeight;
      const naturalW = el.offsetWidth;
      if (naturalH === 0 || naturalW === 0) return;
      const sH = (window.innerHeight - padding) / naturalH;
      const sW = (window.innerWidth - padding) / naturalW;
      const next = Math.min(maxScale, sH, sW);
      setScale(next > 0 ? next : 1);
    };

    compute();

    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [padding, maxScale]);

  return (
    <div
      data-testid="scale-to-fit"
      className="h-screen w-full overflow-hidden"
    >
      <div
        ref={ref}
        className="mx-auto"
        style={{
          width: "max-content",
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
