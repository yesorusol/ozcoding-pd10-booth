"use client";

/**
 * components/CabinetChrome.tsx — Wraps a screen in the blue arcade cabinet
 * shell (reference-matching style: subtle blue gradient, thin outlines, soft
 * shadows, no home icon).
 *
 * Top → bottom:
 *   1. Header bar: marquee sign + radial dots
 *   2. CRT screen: fills remaining vertical space
 *   3. Keyboard plate (left/right colored buttons + QWERTY block + colored
 *      function-key stripe on the right)
 *   4. Footer row: notes panel · LED status · output slot
 */

import type { ReactNode } from "react";
import { MarqueeSign } from "./MarqueeSign";
import { RadialDots } from "./RadialDots";
import { COPY } from "@/lib/copy";

interface CabinetChromeProps {
  children: ReactNode;
  /** Hide the bottom keyboard/footer panels for tight states like /booth */
  hideBottom?: boolean;
  /**
   * Stretch the cabinet to fill at least 100vh (default true). Set false when
   * wrapped by `<ScaleToFit>`.
   */
  fill?: boolean;
  /**
   * Override the 주의사항 panel lines. Defaults to `COPY.notes.items` (3초
   * countdown — normal 4-cut mode). Themed/challenge surfaces should pass
   * `COPY.notes.itemsThemed` (5초).
   */
  notesItems?: ReadonlyArray<string>;
}

export function CabinetChrome({
  children,
  hideBottom,
  fill = true,
  notesItems,
}: CabinetChromeProps) {
  return (
    <div
      data-testid="cabinet-chrome"
      className={`mx-auto flex w-full max-w-[720px] flex-col px-3 py-4 sm:px-4 sm:py-5 ${
        fill ? "min-h-screen" : ""
      }`}
    >
      {/* Outer cabinet frame — single rounded boundary, soft drop shadow.
          Inline gradient so the metallic grey is independent of Tailwind
          config rebuild caching during dev. */}
      <div
        className="flex flex-col overflow-hidden rounded-3xl border border-cabinet-frame shadow-cabinet"
        style={{
          background:
            "linear-gradient(180deg, #eaedf0 0%, #c5cad0 30%, #9ba0a8 65%, #6f747c 100%)",
        }}
      >
        <CabinetHeader />

        <div className="relative flex flex-col gap-3 p-3 pt-2 sm:gap-4 sm:p-4">
          <CrtScreen>{children}</CrtScreen>
          {!hideBottom ? (
            <>
              <CabinetKeyboard />
              <CabinetFooter notesItems={notesItems} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function CabinetHeader() {
  return (
    <header
      data-testid="cabinet-header"
      className="relative flex shrink-0 items-center justify-center gap-3 border-b border-cabinet-frame bg-gradient-to-b from-[#f0f2f4] to-[#d2d6dc] px-3 py-3 sm:gap-6 sm:px-6 sm:py-5"
    >
      <span aria-hidden className="hidden md:block">
        <RadialDots boxSize={64} radius={26} />
      </span>

      <MarqueeSign />

      <span aria-hidden className="hidden md:block">
        <RadialDots boxSize={64} radius={26} />
      </span>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRT screen
// ─────────────────────────────────────────────────────────────────────────────

function CrtScreen({ children }: { children: ReactNode }) {
  return (
    <section
      data-testid="cabinet-screen"
      className="relative flex flex-col overflow-hidden rounded-md border border-cabinet-frame bg-crt-cream"
    >
      <CrtBezel position="top" />
      <div
        data-testid="cabinet-screen-inner"
        className="bg-scanlines bg-crt-cream flex min-h-[20rem] flex-col px-5 py-4 sm:min-h-[25rem] sm:px-6 sm:py-5 md:min-h-[26rem]"
      >
        {children}
      </div>
      <CrtBezel position="bottom" />
    </section>
  );
}

function CrtBezel({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      aria-hidden
      data-testid={`cabinet-bezel-${position}`}
      className={`h-3 w-full shrink-0 bg-cabinet-frame ${position === "top" ? "border-b" : "border-t"} border-cabinet-frame`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, #1d2c4a 0px, #1d2c4a 2px, #2a3a66 2px, #2a3a66 4px)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard plate
// ─────────────────────────────────────────────────────────────────────────────

function CabinetKeyboard() {
  return (
    <div
      data-testid="cabinet-keyboard"
      className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-cabinet-frame px-3 py-2 sm:gap-4 sm:px-4 sm:py-3"
      style={{
        background:
          "linear-gradient(180deg, #d8dce2 0%, #b1b5bc 50%, #8a8e95 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 4px rgba(0,0,0,0.25), 0 3px 6px rgba(0,0,0,0.20)",
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <ColorButton color="bg-btn-green" />
        <ColorButton color="bg-btn-red" />
      </div>
      <FakeKeyboard />
      <div className="flex items-center gap-2 sm:gap-3">
        <ColorButton color="bg-btn-blue" />
        <ColorButton color="bg-btn-yellow" />
      </div>
    </div>
  );
}

function ColorButton({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className={`relative block h-8 w-8 rounded-full border border-cabinet-frame sm:h-9 sm:w-9 ${color}`}
      style={{
        // Top-left specular highlight + bottom-right shaded edge → 3D ball
        backgroundImage:
          "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 55%)",
        boxShadow:
          "inset 0 -2px 3px rgba(0,0,0,0.28), 0 2px 3px rgba(0,0,0,0.25)",
      }}
    />
  );
}

function FakeKeyboard() {
  const symbolRow = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"];
  const qwerty = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];
  const home = ["A", "S", "D", "F", "G", "H", "J", "K", "L", ":"];
  const numpad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div
      aria-hidden
      data-testid="fake-keyboard"
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-cabinet-frame bg-white px-2.5 py-1.5 sm:gap-4 sm:px-4 sm:py-2.5"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.18)",
      }}
    >
      <div className="flex flex-col gap-[3px]">
        <KeyRow keys={symbolRow} />
        <KeyRow keys={qwerty} />
        <KeyRow keys={home} />
      </div>
      <div className="grid grid-cols-3 gap-[3px]">
        {numpad.map((k) => (
          <KeyCap key={k}>{k}</KeyCap>
        ))}
      </div>
      <div className="flex flex-col gap-[3px]">
        <FnKey color="bg-btn-yellow">{"<"}</FnKey>
        <FnKey color="bg-btn-red">X</FnKey>
        <FnKey color="bg-btn-green">0</FnKey>
      </div>
    </div>
  );
}

function KeyRow({ keys }: { keys: ReadonlyArray<string> }) {
  return (
    <div className="flex justify-between gap-[3px]">
      {keys.map((k, i) => (
        <KeyCap key={`${k}-${i}`}>{k}</KeyCap>
      ))}
    </div>
  );
}

function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span className="block min-w-[1.2rem] rounded-sm border border-cabinet-frame bg-white px-1 text-center font-marquee text-[10px] leading-tight text-cabinet-frame sm:min-w-[1.4rem] sm:text-[11px]">
      {children}
    </span>
  );
}

function FnKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className={`block min-w-[1.2rem] rounded-sm border border-cabinet-frame px-1 text-center font-marquee text-[10px] leading-tight text-cabinet-frame sm:min-w-[1.4rem] sm:text-[11px] ${color}`}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function CabinetFooter({
  notesItems,
}: {
  notesItems?: ReadonlyArray<string>;
}) {
  return (
    <div
      data-testid="cabinet-footer"
      className="grid shrink-0 grid-cols-1 items-stretch gap-2 sm:grid-cols-[1.5fr_0.9fr_1fr] sm:gap-3"
    >
      <NotesPanel items={notesItems} />
      <StatusLeds />
      <OutputSlot />
    </div>
  );
}

function NotesPanel({ items }: { items?: ReadonlyArray<string> }) {
  const lines = items ?? COPY.notes.items;
  return (
    <div
      data-testid="cabinet-notes"
      className="relative rounded-md border border-cabinet-frame bg-white px-3 py-2"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.18)",
      }}
    >
      <div className="text-center font-marquee text-xs tracking-widest text-cabinet-frame sm:text-sm">
        {COPY.notes.title}
      </div>
      <ul className="space-y-0 font-body text-[10px] leading-snug text-cabinet-frame sm:text-[11px]">
        {lines.map((line) => (
          <li key={line} className="whitespace-nowrap">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusLeds() {
  return (
    <div
      aria-hidden
      data-testid="cabinet-leds"
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-cabinet-frame bg-white px-3 py-2"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.18)",
      }}
    >
      <div
        className="flex items-center justify-center gap-2 rounded-full border border-cabinet-frame bg-white px-3 py-0.5"
        style={{
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.18)",
        }}
      >
        <Led on={false} />
        <Led on={false} />
        <Led on={true} />
        <Led on={false} />
        <Led on={false} />
      </div>
      <div className="h-1 w-3/4 rounded-full bg-cabinet-frame/50" />
    </div>
  );
}

function Led({ on }: { on: boolean }) {
  return (
    <span
      className={`block h-2.5 w-2.5 rounded-full ${on ? "bg-btn-green" : "bg-cabinet-frame/30"}`}
      style={
        on
          ? {
              backgroundImage:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.7), transparent 60%)",
              boxShadow:
                "0 0 6px #23c93a, inset 0 -1px 1px rgba(0,0,0,0.2)",
            }
          : {
              boxShadow: "inset 0 1px 1px rgba(0,0,0,0.25)",
            }
      }
    />
  );
}

function OutputSlot() {
  return (
    <div
      data-testid="cabinet-slot"
      className="rounded-md border border-cabinet-frame bg-white px-3 py-2"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.18)",
      }}
    >
      <div className="flex items-center justify-center gap-2 font-body text-xs font-bold text-cabinet-frame sm:text-sm">
        <SlotIcon />
        <span>{COPY.slot.label}</span>
      </div>
      <div
        className="mt-1.5 h-6 rounded-sm sm:h-7"
        style={{
          background:
            "linear-gradient(180deg, #0a1426 0%, #1d2c4a 60%, #2a3a66 100%)",
          boxShadow:
            "inset 0 3px 5px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(255,255,255,0.08)",
        }}
      />
    </div>
  );
}

function SlotIcon() {
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className="text-cabinet-frame"
    >
      <rect x="1" y="1" width="18" height="12" rx="1" />
      <line x1="4" y1="5" x2="16" y2="5" />
      <line x1="4" y1="8" x2="12" y2="8" />
    </svg>
  );
}
