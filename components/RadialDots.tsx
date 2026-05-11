"use client";

/**
 * components/RadialDots.tsx — Decorative sunburst dot cluster used on either
 * side of the marquee plate (image #1 left/right of the sign). Inert.
 */

interface RadialDotsProps {
  /** Diameter of each dot in px */
  dotSize?: number;
  /** Number of dots in the ring */
  count?: number;
  /** Outer radius from center, in px */
  radius?: number;
  /** Total component box size in px (square) */
  boxSize?: number;
}

export function RadialDots({
  dotSize = 4,
  count = 9,
  radius = 28,
  boxSize = 72,
}: RadialDotsProps) {
  const center = boxSize / 2;
  const dots = Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return { x, y };
  });
  return (
    <svg
      aria-hidden
      data-testid="radial-dots"
      width={boxSize}
      height={boxSize}
      viewBox={`0 0 ${boxSize} ${boxSize}`}
      className="block text-cabinet-frame"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={dotSize / 2} fill="currentColor" />
      ))}
      {/* Inner short rays — small marks closer to center */}
      {dots.map((d, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const ix = center + Math.cos(angle) * (radius - 10);
        const iy = center + Math.sin(angle) * (radius - 10);
        return <circle key={`i-${i}`} cx={ix} cy={iy} r={1.2} fill="currentColor" />;
      })}
    </svg>
  );
}
