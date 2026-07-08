"use client";

/**
 * components/StickerEditor.tsx — Purikura-style sticker editor.
 *
 * Two-column layout:
 *   ┌──── PHOTO ────┬── PANEL ──┐
 *   │  user photo + │ char/emoji │
 *   │  placed       │ thumbnails │
 *   │  stickers     │ (tap=add)  │
 *   └───────────────┴────────────┘
 *
 * UX: tap a panel thumbnail → sticker is placed at center of photo. Drag a
 * placed sticker to reposition. Hover (or tap) a placed sticker → small ✕
 * button appears for delete.
 *
 * Sizing is anchored to the photo's actual rendered area via container-query
 * units (cqw). The photo wrapper has `containerType: inline-size` and a
 * fixed aspect ratio matching the polaroid sheet (1080:2400). Placed
 * stickers use `20cqw` (characters) / `14cqw` (emoji) so the on-screen size
 * matches the composite output produced by `lib/sticker-composer.ts` —
 * which also draws stickers at 20% / 14% of canvas width.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CHARACTER_STICKERS,
  EMOJI_STICKERS,
  DEFAULT_STICKER_SCALE,
  MIN_STICKER_SCALE,
  MAX_STICKER_SCALE,
  TEXT_STICKER_COLORS,
  DEFAULT_TEXT_COLOR,
  MAX_TEXT_LENGTH,
  type PlacedStickerInstance,
  type StickerAsset,
  type EmojiSticker,
} from "@/lib/sticker-assets";
import {
  BACKGROUND_COLORS,
  BACKGROUND_PATTERNS,
  BACKGROUND_PATTERNS_PAGE_SIZE,
  type BackgroundChoice,
} from "@/lib/background-assets";

const EMOJI_PAGE_SIZE = 12;
const EMOJI_PAGE_SIZE_SPACIOUS = 15;

/** Perceived-brightness check (ITU-R BT.601). Used to pick the check-mark
 * color on color swatches so it stays legible against any swatch fill. */
function isHexDark(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function SwatchCheck({ dark }: { dark: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      style={{ color: dark ? "#ffffff" : "#1d2c4a" }}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5,10.5 8.5,14 15,6.5" />
    </svg>
  );
}

interface StickerEditorProps {
  /** Image source for the captured photo (data URL or blob URL). */
  photoSrc: string | null;
  /** Initial placed stickers (used when revisiting from later phase). */
  initialStickers?: PlacedStickerInstance[];
  /** Aspect ratio of the photo display area (matches composite output). */
  aspectRatio?: number; // width / height
  /** Currently selected sheet background (highlighted in picker). */
  background?: BackgroundChoice;
  /** Called when user taps a background swatch. Parent re-composes. */
  onBackgroundChange?: (next: BackgroundChoice) => void;
  /**
   * Toggle the pattern grid in the bg picker. Challenge mode hides
   * patterns because they obscure the inter-cell window-frame structure;
   * normal mode keeps them visible. Defaults to true (normal mode).
   */
  showPatterns?: boolean;
  /** Called with the final list when user taps 완료. */
  onComplete: (stickers: PlacedStickerInstance[]) => void;
  /** Called when user taps 처음부터 (reset back to capture). */
  onReset: () => void;
}

const DEFAULT_ASPECT = 1080 / 1440;

export function StickerEditor({
  photoSrc,
  initialStickers,
  aspectRatio = DEFAULT_ASPECT,
  background,
  onBackgroundChange,
  showPatterns = true,
  onComplete,
  onReset,
}: StickerEditorProps) {
  const [placed, setPlaced] = useState<PlacedStickerInstance[]>(
    initialStickers ?? []
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  // Paginated picker state for backgrounds + emojis. Each section shows a
  // fixed number per page; the user steps through with ← → arrows. Kiosk is
  // touch-only so arrows are required (no hover affordance).
  const [bgPage, setBgPage] = useState(0);
  const [emojiPage, setEmojiPage] = useState(0);
  // Text-sticker composer state (draft text + selected color).
  const [textDraft, setTextDraft] = useState("");
  const [textColor, setTextColor] = useState<string>(DEFAULT_TEXT_COLOR);
  const photoRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  // Free-transform (resize + rotate) state. Set when user pointer-downs on
  // the corner handle of the selected sticker.
  type TransformStart = {
    centerXpx: number;
    centerYpx: number;
    initialMag: number;
    initialAngle: number;
    initialScale: number;
    initialRotationDeg: number;
  };
  const transformingIdRef = useRef<string | null>(null);
  const transformStartRef = useRef<TransformStart | null>(null);

  // No background section (normal mode has no bg picker anymore) → the
  // panel loses a whole block of content, so widen it and spread the
  // remaining sections (bigger gaps/padding, more sticker columns) instead
  // of leaving a cramped, mostly-empty column.
  const spacious = !onBackgroundChange;
  const emojiPageSize = spacious ? EMOJI_PAGE_SIZE_SPACIOUS : EMOJI_PAGE_SIZE;

  const addCharacter = useCallback((asset: StickerAsset) => {
    setPlaced((prev) => [
      ...prev,
      {
        kind: "character",
        instanceId: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        assetId: asset.id,
        xPct: 50,
        yPct: 50,
        scale: DEFAULT_STICKER_SCALE,
        rotationDeg: 0,
      },
    ]);
  }, []);

  const addEmoji = useCallback((emoji: EmojiSticker) => {
    setPlaced((prev) => [
      ...prev,
      {
        kind: "emoji",
        instanceId: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        emojiId: emoji.id,
        xPct: 50,
        yPct: 50,
        scale: DEFAULT_STICKER_SCALE,
        rotationDeg: 0,
      },
    ]);
  }, []);

  const addText = useCallback(() => {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    setPlaced((prev) => [
      ...prev,
      {
        kind: "text",
        instanceId: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: trimmed,
        color: textColor,
        xPct: 50,
        yPct: 50,
        scale: DEFAULT_STICKER_SCALE,
        rotationDeg: 0,
      },
    ]);
    setTextDraft("");
  }, [textDraft, textColor]);

  /**
   * Tap a color swatch:
   * - If a text sticker is currently selected on the photo, recolor it
   *   live (natural "select-then-style" flow).
   * - Either way, remember the choice as the draft color for the next
   *   `addText` so subsequent additions use it.
   */
  const handleTextColorPick = useCallback(
    (hex: string) => {
      setTextColor(hex);
      setPlaced((prev) =>
        prev.map((p) =>
          p.instanceId === selectedInstanceId && p.kind === "text"
            ? { ...p, color: hex }
            : p
        )
      );
    },
    [selectedInstanceId]
  );

  // When the user selects a placed text sticker, sync the picker's
  // textColor state so the swatch grid shows which color is currently on
  // the selected sticker.
  useEffect(() => {
    if (!selectedInstanceId) return;
    const sel = placed.find((p) => p.instanceId === selectedInstanceId);
    if (sel?.kind === "text") setTextColor(sel.color);
  }, [selectedInstanceId, placed]);

  const removeInstance = useCallback((instanceId: string) => {
    setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId));
    setSelectedInstanceId((cur) => (cur === instanceId ? null : cur));
  }, []);

  const onStickerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instanceId: string) => {
      e.stopPropagation();
      const photoEl = photoRef.current;
      if (!photoEl) return;
      const rect = photoEl.getBoundingClientRect();
      const target = placed.find((p) => p.instanceId === instanceId);
      if (!target) return;
      const stickerXpx = (target.xPct / 100) * rect.width;
      const stickerYpx = (target.yPct / 100) * rect.height;
      const pointerXpx = e.clientX - rect.left;
      const pointerYpx = e.clientY - rect.top;
      dragOffsetRef.current = {
        dx: pointerXpx - stickerXpx,
        dy: pointerYpx - stickerYpx,
      };
      draggingIdRef.current = instanceId;
      setSelectedInstanceId(instanceId);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [placed]
  );

  const onTransformPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instanceId: string) => {
      e.stopPropagation();
      const photoEl = photoRef.current;
      if (!photoEl) return;
      const rect = photoEl.getBoundingClientRect();
      const target = placed.find((p) => p.instanceId === instanceId);
      if (!target) return;
      const centerXpx = (target.xPct / 100) * rect.width;
      const centerYpx = (target.yPct / 100) * rect.height;
      const pointerXpx = e.clientX - rect.left;
      const pointerYpx = e.clientY - rect.top;
      const vx = pointerXpx - centerXpx;
      const vy = pointerYpx - centerYpx;
      const mag = Math.hypot(vx, vy);
      transformStartRef.current = {
        centerXpx,
        centerYpx,
        initialMag: mag || 1, // avoid div-by-zero
        initialAngle: Math.atan2(vy, vx),
        initialScale: target.scale,
        initialRotationDeg: target.rotationDeg,
      };
      transformingIdRef.current = instanceId;
      setSelectedInstanceId(instanceId);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [placed]
  );

  const onStickerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const photoEl = photoRef.current;
      if (!photoEl) return;
      const rect = photoEl.getBoundingClientRect();

      // Transform (resize + rotate) takes priority over body drag.
      if (transformingIdRef.current && transformStartRef.current) {
        const start = transformStartRef.current;
        const pointerXpx = e.clientX - rect.left;
        const pointerYpx = e.clientY - rect.top;
        const vx = pointerXpx - start.centerXpx;
        const vy = pointerYpx - start.centerYpx;
        const mag = Math.hypot(vx, vy);
        const angle = Math.atan2(vy, vx);
        const scaleRaw = start.initialScale * (mag / start.initialMag);
        const scale = Math.max(
          MIN_STICKER_SCALE,
          Math.min(MAX_STICKER_SCALE, scaleRaw),
        );
        const angleDeltaDeg = ((angle - start.initialAngle) * 180) / Math.PI;
        const rotationDeg = start.initialRotationDeg + angleDeltaDeg;
        const id = transformingIdRef.current;
        setPlaced((prev) =>
          prev.map((p) =>
            p.instanceId === id ? { ...p, scale, rotationDeg } : p,
          ),
        );
        return;
      }

      if (!draggingIdRef.current || !dragOffsetRef.current) return;
      const newXpx = e.clientX - rect.left - dragOffsetRef.current.dx;
      const newYpx = e.clientY - rect.top - dragOffsetRef.current.dy;
      const xPct = Math.max(0, Math.min(100, (newXpx / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, (newYpx / rect.height) * 100));
      const draggingId = draggingIdRef.current;
      setPlaced((prev) =>
        prev.map((p) => (p.instanceId === draggingId ? { ...p, xPct, yPct } : p))
      );
    },
    []
  );

  const onStickerPointerUp = useCallback(() => {
    draggingIdRef.current = null;
    dragOffsetRef.current = null;
    transformingIdRef.current = null;
    transformStartRef.current = null;
  }, []);

  // Wide-aspect sheets (challenge 2×4, aspectRatio > 1) blow past the
  // viewport when sized by height alone — clamp to width-driven sizing
  // AND scale back to 85% so the preview leaves breathing room around it.
  // Tall sheets (normal 4-cut, aspectRatio < 1) stay height-driven so
  // the photo zone fills the available vertical space.
  const photoWrapperStyle: CSSProperties = aspectRatio >= 1
    ? {
        aspectRatio: `${aspectRatio}`,
        width: "85%",
        maxWidth: "85%",
        maxHeight: "85%",
        containerType: "inline-size",
      }
    : {
        aspectRatio: `${aspectRatio}`,
        height: "100%",
        maxWidth: "100%",
        containerType: "inline-size",
      };

  return (
    <div
      data-testid="sticker-editor"
      className="flex h-screen w-screen flex-col bg-crt-cream md:flex-row"
    >
      {/* Photo zone (left / top) */}
      <section
        data-testid="sticker-editor-photo-section"
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-cabinet-frame/5 p-2 md:p-4"
      >
        <div
          ref={photoRef}
          data-testid="sticker-editor-photo"
          className="relative bg-white shadow-soft"
          style={photoWrapperStyle}
          onPointerMove={onStickerPointerMove}
          onPointerUp={onStickerPointerUp}
          onPointerCancel={onStickerPointerUp}
          onPointerLeave={onStickerPointerUp}
        >
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt="찍은 사진"
              draggable={false}
              className="h-full w-full object-cover"
              style={{ display: "block" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-cabinet-frame/40">
              <p className="font-marquee text-xl text-cabinet-frame/50 sm:text-2xl">
                사진 자리 (placeholder)
              </p>
            </div>
          )}

          {/* Placed sticker overlays */}
          {placed.map((p) => {
            if (p.kind === "character") {
              const asset = CHARACTER_STICKERS.find((c) => c.id === p.assetId);
              if (!asset) return null;
              return (
                <PlacedCharacter
                  key={p.instanceId}
                  instance={p}
                  asset={asset}
                  isSelected={selectedInstanceId === p.instanceId}
                  onPointerDown={(e) => onStickerPointerDown(e, p.instanceId)}
                  onTransformPointerDown={(e) =>
                    onTransformPointerDown(e, p.instanceId)
                  }
                  onRemove={() => removeInstance(p.instanceId)}
                />
              );
            }
            if (p.kind === "emoji") {
              const emoji = EMOJI_STICKERS.find((e) => e.id === p.emojiId);
              if (!emoji) return null;
              return (
                <PlacedEmoji
                  key={p.instanceId}
                  instance={p}
                  emoji={emoji}
                  isSelected={selectedInstanceId === p.instanceId}
                  onPointerDown={(e) => onStickerPointerDown(e, p.instanceId)}
                  onTransformPointerDown={(e) =>
                    onTransformPointerDown(e, p.instanceId)
                  }
                  onRemove={() => removeInstance(p.instanceId)}
                />
              );
            }
            return (
              <PlacedText
                key={p.instanceId}
                instance={p}
                isSelected={selectedInstanceId === p.instanceId}
                onPointerDown={(e) => onStickerPointerDown(e, p.instanceId)}
                onTransformPointerDown={(e) =>
                  onTransformPointerDown(e, p.instanceId)
                }
                onRemove={() => removeInstance(p.instanceId)}
              />
            );
          })}
        </div>
      </section>

      {/* Side panel (right / bottom) */}
      <aside
        data-testid="sticker-panel"
        className={
          spacious
            ? "flex w-full shrink-0 flex-col border-t border-cabinet-frame bg-white/80 md:h-full md:w-[26rem] md:border-l md:border-t-0"
            : "flex w-full shrink-0 flex-col border-t border-cabinet-frame bg-white/80 md:h-full md:w-80 md:border-l md:border-t-0"
        }
      >
        <header
          className={spacious ? "border-b border-cabinet-frame/30 px-6 py-3" : "border-b border-cabinet-frame/30 px-4 py-2"}
          style={{
            backgroundImage:
              "linear-gradient(180deg, #c4ecb0 0%, #d4f5c0 55%, #ecffd9 100%)",
          }}
        >
          <p className="font-marquee text-lg text-cabinet-frame">사진 꾸미기</p>
          <p className="font-body text-xs text-cabinet-frame/70">선택해서 사진을 꾸며보세요</p>
        </header>

        <div className={spacious ? "flex-1 overflow-y-auto p-6" : "flex-1 overflow-y-auto p-3"}>
          {onBackgroundChange ? (
            <>
              {showPatterns ? (() => {
                const totalBgPages = Math.max(
                  1,
                  Math.ceil(BACKGROUND_PATTERNS.length / BACKGROUND_PATTERNS_PAGE_SIZE)
                );
                const clampedPage = Math.min(bgPage, totalBgPages - 1);
                const pageStart = clampedPage * BACKGROUND_PATTERNS_PAGE_SIZE;
                const pagePatterns = BACKGROUND_PATTERNS.slice(
                  pageStart,
                  pageStart + BACKGROUND_PATTERNS_PAGE_SIZE
                );
                return (
                  <div className="group mb-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-body text-xs font-bold text-cabinet-frame">
                        배경 패턴
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setBgPage((p) => Math.max(0, p - 1))
                          }
                          disabled={clampedPage === 0}
                          aria-label="이전 페이지"
                          data-testid="background-prev"
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-cabinet-frame/40 bg-white font-marquee text-sm text-cabinet-frame shadow-soft transition active:scale-95 disabled:!opacity-30 [@media(hover:hover)]:scale-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:scale-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                        >
                          ‹
                        </button>
                        <span className="min-w-[28px] text-center font-body text-[10px] font-bold text-cabinet-frame/80">
                          {clampedPage + 1}/{totalBgPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setBgPage((p) =>
                              Math.min(totalBgPages - 1, p + 1)
                            )
                          }
                          disabled={clampedPage === totalBgPages - 1}
                          aria-label="다음 페이지"
                          data-testid="background-next"
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-cabinet-frame/40 bg-white font-marquee text-sm text-cabinet-frame shadow-soft transition active:scale-95 disabled:!opacity-30 [@media(hover:hover)]:scale-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:scale-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    <div
                      data-testid="background-pattern-grid"
                      className="grid grid-cols-3 gap-2"
                    >
                      {pagePatterns.map((p) => {
                        const isSelected =
                          background?.kind === "pattern" &&
                          background.patternId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              onBackgroundChange({
                                kind: "pattern",
                                patternId: p.id,
                              })
                            }
                            aria-label={`${p.label} 배경`}
                            aria-pressed={isSelected}
                            className="relative aspect-square overflow-hidden rounded border-2 border-cabinet-frame/30 transition active:scale-95"
                            style={{
                              backgroundImage: `url(${p.src})`,
                              backgroundSize: "cover",
                              backgroundPosition: p.thumbPosition ?? "center",
                            }}
                          >
                            {isSelected ? (
                              <span
                                aria-hidden
                                className="absolute inset-0 flex items-center justify-center"
                                style={{ backgroundColor: "rgba(40, 42, 54, 0.55)" }}
                              >
                                <SwatchCheck dark={true} />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : null}

              <p className="mb-3 mt-2 font-body text-xs font-bold text-cabinet-frame">
                배경 색상
              </p>
              <div
                data-testid="background-color-grid"
                className="mb-6 grid grid-cols-4 gap-2"
              >
                {BACKGROUND_COLORS.map((c) => {
                  const isSelected =
                    background?.kind === "color" && background.colorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        onBackgroundChange({ kind: "color", colorId: c.id })
                      }
                      aria-label={`${c.label} 색상`}
                      aria-pressed={isSelected}
                      className="relative flex aspect-square items-center justify-center rounded-full border-2 border-cabinet-frame/30 transition active:scale-95"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected ? (
                        <SwatchCheck dark={isHexDark(c.hex)} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          <p className={spacious ? "mb-4 mt-2 font-body text-sm font-bold text-cabinet-frame" : "mb-3 mt-2 font-body text-xs font-bold text-cabinet-frame"}>
            텍스트
          </p>
          <div className={spacious ? "mb-8" : "mb-6"}>
            <input
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value.slice(0, MAX_TEXT_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addText();
                }
              }}
              placeholder="우주최강 식끼!"
              maxLength={MAX_TEXT_LENGTH}
              data-testid="text-sticker-input"
              className={
                spacious
                  ? "w-full rounded border border-cabinet-frame/40 bg-white px-3 py-2 font-body text-base text-cabinet-frame outline-none focus:border-cabinet-frame"
                  : "w-full rounded border border-cabinet-frame/40 bg-white px-2 py-1 font-body text-sm text-cabinet-frame outline-none focus:border-cabinet-frame"
              }
              style={{
                fontFamily: "var(--font-pixel-display), system-ui, sans-serif",
              }}
            />
            <div
              data-testid="text-sticker-color-grid"
              className={spacious ? "mt-3 grid grid-cols-8 gap-2" : "mt-2 grid grid-cols-8 gap-1"}
            >
              {TEXT_STICKER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleTextColorPick(c.hex)}
                  aria-label={`${c.label} 색상`}
                  aria-pressed={textColor === c.hex}
                  className="relative flex aspect-square items-center justify-center rounded-full border-2 border-cabinet-frame/30 transition active:scale-95"
                  style={{ backgroundColor: c.hex }}
                >
                  {textColor === c.hex ? (
                    <SwatchCheck dark={isHexDark(c.hex)} />
                  ) : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={addText}
              disabled={!textDraft.trim()}
              data-testid="text-sticker-add"
              className={
                spacious
                  ? "mt-3 w-full rounded-full border border-cabinet-frame bg-btn-yellow py-3 font-marquee text-lg text-cabinet-frame shadow-soft transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  : "mt-2 w-full rounded-full border border-cabinet-frame bg-btn-yellow py-2 font-marquee text-base text-cabinet-frame shadow-soft transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              텍스트 추가하기
            </button>
          </div>

          {(() => {
            // Merge character stickers and emoji stickers into one paginated
            // grid labeled "이모지". Characters render via CharacterThumb;
            // emoji entries fall through to the iconSrc / glyph branch.
            type MergedItem =
              | { kind: "char"; id: string; label: string; asset: (typeof CHARACTER_STICKERS)[number] }
              | { kind: "emoji"; id: string; label: string; emoji: (typeof EMOJI_STICKERS)[number] };
            const merged: ReadonlyArray<MergedItem> = [
              ...CHARACTER_STICKERS.map((a) => ({
                kind: "char" as const,
                id: a.id,
                label: a.label,
                asset: a,
              })),
              ...EMOJI_STICKERS.map((e) => ({
                kind: "emoji" as const,
                id: e.id,
                label: e.label,
                emoji: e,
              })),
            ];
            const totalEmojiPages = Math.max(
              1,
              Math.ceil(merged.length / emojiPageSize)
            );
            const clampedPage = Math.min(emojiPage, totalEmojiPages - 1);
            const pageStart = clampedPage * emojiPageSize;
            const pageItems = merged.slice(
              pageStart,
              pageStart + emojiPageSize
            );
            return (
              <div className="group">
                <div className={spacious ? "mb-4 mt-2 flex items-center justify-between" : "mb-3 mt-2 flex items-center justify-between"}>
                  <p className={spacious ? "font-body text-sm font-bold text-cabinet-frame" : "font-body text-xs font-bold text-cabinet-frame"}>
                    이모지
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEmojiPage((p) => Math.max(0, p - 1))
                      }
                      disabled={clampedPage === 0}
                      aria-label="이전 페이지"
                      data-testid="emoji-prev"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-cabinet-frame/40 bg-white font-marquee text-sm text-cabinet-frame shadow-soft transition active:scale-95 disabled:!opacity-30 [@media(hover:hover)]:scale-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:scale-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                    >
                      ‹
                    </button>
                    <span className="min-w-[28px] text-center font-body text-[10px] font-bold text-cabinet-frame/80">
                      {clampedPage + 1}/{totalEmojiPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEmojiPage((p) =>
                          Math.min(totalEmojiPages - 1, p + 1)
                        )
                      }
                      disabled={clampedPage === totalEmojiPages - 1}
                      aria-label="다음 페이지"
                      data-testid="emoji-next"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-cabinet-frame/40 bg-white font-marquee text-sm text-cabinet-frame shadow-soft transition active:scale-95 disabled:!opacity-30 [@media(hover:hover)]:scale-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:scale-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div
                  data-testid="emoji-grid"
                  className={spacious ? "grid grid-cols-5 gap-3" : "grid grid-cols-4 gap-2"}
                >
                  {pageItems.map((item) =>
                    item.kind === "char" ? (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addCharacter(item.asset)}
                        aria-label={`${item.label} 스티커 추가`}
                        className={
                          spacious
                            ? "flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-cabinet-frame/40 bg-white p-1.5 transition active:scale-95"
                            : "flex aspect-square items-center justify-center overflow-hidden rounded border border-cabinet-frame/40 bg-white p-0.5 transition active:scale-95"
                        }
                      >
                        <CharacterThumb asset={item.asset} />
                      </button>
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addEmoji(item.emoji)}
                        aria-label={`${item.label} 스티커 추가`}
                        className={
                          spacious
                            ? "flex aspect-square items-center justify-center rounded-lg border border-cabinet-frame/40 bg-white p-2 text-3xl transition active:scale-95"
                            : "flex aspect-square items-center justify-center rounded border border-cabinet-frame/40 bg-white p-1 text-2xl transition active:scale-95"
                        }
                      >
                        {item.emoji.iconSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.emoji.iconSrc}
                            alt=""
                            aria-hidden
                            draggable={false}
                            className="h-full w-full object-contain"
                            style={{ imageRendering: "pixelated" }}
                          />
                        ) : (
                          <span aria-hidden>{item.emoji.emoji}</span>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <footer
          className="flex gap-2 border-t border-cabinet-frame/30 p-3"
          style={{ backgroundColor: "#ecffd9" }}
        >
          <button
            type="button"
            onClick={onReset}
            data-testid="sticker-editor-reset"
            className="flex-1 rounded-full border border-cabinet-frame bg-white px-4 py-3 font-marquee text-base text-cabinet-frame shadow-soft active:translate-y-px"
          >
            처음부터
          </button>
          <button
            type="button"
            onClick={() => onComplete(placed)}
            data-testid="sticker-editor-complete"
            className="flex-[2] rounded-full border border-cabinet-frame bg-btn-yellow px-4 py-3 font-marquee text-base text-cabinet-frame shadow-soft active:translate-y-px"
          >
            완료 →
          </button>
        </footer>
      </aside>
    </div>
  );
}

function CharacterThumb({ asset }: { asset: StickerAsset }) {
  // h-full forces every character thumb to share the same visual height so
  // hat-tall and stocky sprites no longer render at wildly different sizes.
  // max-w-full clamps unusually wide PNGs so they stay inside the cell.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      alt=""
      aria-hidden
      draggable={false}
      className="h-full max-w-full object-contain"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

interface PlacedCharProps {
  instance: Extract<PlacedStickerInstance, { kind: "character" }>;
  asset: StickerAsset;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTransformPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}

function PlacedCharacter({
  instance,
  asset,
  isSelected,
  onPointerDown,
  onTransformPointerDown,
  onRemove,
}: PlacedCharProps) {
  // Width anchored at 20cqw of the photo container; height auto preserves
  // the asset PNG's natural aspect ratio. scale + rotation are user-driven.
  return (
    <div
      data-testid={`placed-${instance.instanceId}`}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: `${instance.xPct}%`,
        top: `${instance.yPct}%`,
        transform: `translate(-50%, -50%) rotate(${instance.rotationDeg}deg) scale(${instance.scale})`,
        width: "20cqw",
        touchAction: "none",
        cursor: "grab",
        outline: isSelected ? "2px dashed #fbbf24" : "none",
        outlineOffset: 4,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.src}
        alt={asset.label}
        draggable={false}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          imageRendering: "pixelated",
          pointerEvents: "none",
        }}
      />
      {isSelected ? (
        <>
          <RemoveBadge onRemove={onRemove} />
          <TransformHandle onPointerDown={onTransformPointerDown} />
        </>
      ) : null}
    </div>
  );
}

interface PlacedEmojiProps {
  instance: Extract<PlacedStickerInstance, { kind: "emoji" }>;
  emoji: EmojiSticker;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTransformPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}

function PlacedEmoji({
  instance,
  emoji,
  isSelected,
  onPointerDown,
  onTransformPointerDown,
  onRemove,
}: PlacedEmojiProps) {
  return (
    <div
      data-testid={`placed-${instance.instanceId}`}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: `${instance.xPct}%`,
        top: `${instance.yPct}%`,
        transform: `translate(-50%, -50%) rotate(${instance.rotationDeg}deg) scale(${instance.scale})`,
        fontSize: "14cqw",
        lineHeight: 1,
        userSelect: "none",
        touchAction: "none",
        cursor: "grab",
        outline: isSelected ? "2px dashed #fbbf24" : "none",
        outlineOffset: 4,
      }}
    >
      {emoji.iconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={emoji.iconSrc}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            width: "14cqw",
            height: "auto",
            display: "block",
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <span aria-hidden>{emoji.emoji}</span>
      )}
      {isSelected ? (
        <>
          <RemoveBadge onRemove={onRemove} />
          <TransformHandle onPointerDown={onTransformPointerDown} />
        </>
      ) : null}
    </div>
  );
}

interface PlacedTextProps {
  instance: Extract<PlacedStickerInstance, { kind: "text" }>;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTransformPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}

function PlacedText({
  instance,
  isSelected,
  onPointerDown,
  onTransformPointerDown,
  onRemove,
}: PlacedTextProps) {
  return (
    <div
      data-testid={`placed-${instance.instanceId}`}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: `${instance.xPct}%`,
        top: `${instance.yPct}%`,
        transform: `translate(-50%, -50%) rotate(${instance.rotationDeg}deg) scale(${instance.scale})`,
        fontSize: "10cqw",
        lineHeight: 1.1,
        fontFamily: "var(--font-pixel-display), system-ui, sans-serif",
        color: instance.color,
        userSelect: "none",
        touchAction: "none",
        cursor: "grab",
        outline: isSelected ? "2px dashed #fbbf24" : "none",
        outlineOffset: 4,
        whiteSpace: "nowrap",
        // Soft dark outline so light text stays legible on busy photos.
        textShadow:
          "1px 1px 0 rgba(0,0,0,0.35), -1px 1px 0 rgba(0,0,0,0.35), 1px -1px 0 rgba(0,0,0,0.35), -1px -1px 0 rgba(0,0,0,0.35)",
      }}
    >
      <span aria-hidden>{instance.text}</span>
      {isSelected ? (
        <>
          <RemoveBadge onRemove={onRemove} />
          <TransformHandle onPointerDown={onTransformPointerDown} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Bottom-right free-transform handle. Drag to scale (distance) + rotate
 * (angle) the parent sticker simultaneously. Single-handle = single gesture
 * pattern used by most purikura / sticker editors (Snapchat, Polaroid).
 */
function TransformHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="button"
      aria-label="크기 회전 조절"
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        bottom: -10,
        right: -10,
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#fff",
        border: "2px solid #1d2c4a",
        cursor: "nwse-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        fontWeight: 700,
        color: "#1d2c4a",
        lineHeight: 1,
        touchAction: "none",
      }}
    >
      ⤡
    </div>
  );
}

function RemoveBadge({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onRemove}
      aria-label="스티커 삭제"
      style={{
        position: "absolute",
        top: -10,
        right: -10,
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#fff",
        border: "2px solid #1d2c4a",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      ✕
    </button>
  );
}
