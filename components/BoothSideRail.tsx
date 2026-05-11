"use client";

/**
 * components/BoothSideRail.tsx — Vertical metal rail flanking the camera frame
 * during /booth capture phases. Mirrors the cabinet's metallic gradient and
 * uses the same RadialDots pattern as the home/themed header so the booth
 * identity carries through into shooting.
 *
 * Hidden below sm breakpoint — on narrow screens the camera area takes the
 * full width and rails would crowd the frame.
 */

import { RadialDots } from "./RadialDots";

interface BoothSideRailProps {
  position: "left" | "right";
}

export function BoothSideRail({ position }: BoothSideRailProps) {
  return (
    <aside
      aria-hidden
      data-testid={`booth-rail-${position}`}
      className="relative hidden w-[10%] min-w-[80px] max-w-[140px] shrink-0 flex-col items-center justify-between py-6 sm:flex"
      style={{
        background:
          "linear-gradient(180deg, #d8dce2 0%, #b1b5bc 50%, #8a8e95 100%)",
        boxShadow:
          position === "left"
            ? "inset -2px 0 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)"
            : "inset 2px 0 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)",
        borderRight:
          position === "left" ? "1px solid #1d2c4a" : undefined,
        borderLeft:
          position === "right" ? "1px solid #1d2c4a" : undefined,
      }}
    >
      {/* Top: speaker dot pattern matching cabinet header */}
      <RadialDots boxSize={48} radius={18} />

      {/* Middle: vertical LED column */}
      <div className="flex flex-col items-center gap-3">
        <RailLed color="bg-btn-green" on />
        <RailLed color="bg-btn-red" />
        <RailLed color="bg-btn-blue" />
        <RailLed color="bg-btn-yellow" />
      </div>

      {/* Bottom: mirrored speaker dot pattern for visual symmetry */}
      <RadialDots boxSize={48} radius={18} />
    </aside>
  );
}

function RailLed({ color, on }: { color: string; on?: boolean }) {
  return (
    <span
      className={`block h-3 w-3 rounded-full border border-cabinet-frame ${on ? color : "bg-cabinet-frame/30"}`}
      style={
        on
          ? {
              boxShadow:
                "0 0 4px currentColor, inset 0 -1px 1px rgba(0,0,0,0.2)",
            }
          : { boxShadow: "inset 0 1px 1px rgba(0,0,0,0.25)" }
      }
    />
  );
}
