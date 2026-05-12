/**
 * lib/sticker-assets.ts — Pixel-character + emoji sticker catalog.
 *
 * Each character sticker is its own transparent PNG under
 * `/public/stickers/chars/`, produced by `scripts/split-stickers.mjs` from
 * the two Gemini source sheets. Tight alpha bboxes — no sprite-sheet logic.
 */

export type StickerAsset = {
  /** Stable id used as React key + drag instance reference. */
  id: string;
  /** Public URL of the per-character transparent PNG. */
  src: string;
  /** Korean label shown in tooltips / aria-label. */
  label: string;
};

const CHARS_DIR = "/stickers/chars";

export const CHARACTER_STICKERS: ReadonlyArray<StickerAsset> = [
  { id: "char-01", src: `${CHARS_DIR}/char-01.png`, label: "블루캡 - 파란모자 빨간바지" },
  { id: "char-02", src: `${CHARS_DIR}/char-02.png`, label: "그린모자 - 검정티 선글라스" },
  { id: "char-03", src: `${CHARS_DIR}/char-03.png`, label: "옐로캡 - 노란모자 주황바지" },
  { id: "char-04", src: `${CHARS_DIR}/char-04.png`, label: "컬리 - 보라곱슬 분홍옷" },
  { id: "char-05", src: `${CHARS_DIR}/char-05.png`, label: "갓-그린 - 검은갓 초록후디" },
  { id: "char-06", src: `${CHARS_DIR}/char-06.png`, label: "퍼플캡 - 보라모자 분홍자켓" },
  { id: "char-07", src: `${CHARS_DIR}/char-07.png`, label: "올빼미 - 짧은머리 선글라스" },
  { id: "char-08", src: `${CHARS_DIR}/char-08.png`, label: "플레임 - 주황 불꽃머리" },
  { id: "char-09", src: `${CHARS_DIR}/char-09.png`, label: "탑낫 - 검은묶음머리 안경" },
  { id: "char-10", src: `${CHARS_DIR}/char-10.png`, label: "갓-레드 - 한복풍 빨간옷" },
];

export type EmojiSticker = {
  id: string;
  label: string;
  /** Text glyph rendered with the system emoji font when set. */
  emoji?: string;
  /**
   * Public URL of a transparent PNG. When set, the picker and final
   * composer render this image instead of the text glyph. ZEP pixel-frame
   * icons live under `/stickers/zep/`.
   */
  iconSrc?: string;
};

const PIXEL_DIR = "/stickers/pixel";

/**
 * Pixel-art emoji palette extracted from the Gemini sticker sheet via
 * `scripts/split-pixel-emoji.mjs`. 18 transparent PNGs under
 * `/public/stickers/pixel/` — composer + picker render `iconSrc` as a
 * crisp pixelated `<img>` rather than the Unicode glyph.
 *
 * The source sheet had two duplicate sparkle-stars; only one is kept
 * (emoji-06). 18 entries → 2 pages of 12 in the paginated picker.
 */
export const EMOJI_STICKERS: ReadonlyArray<EmojiSticker> = [
  { id: "em-finger-point", iconSrc: `${PIXEL_DIR}/emoji-01.png`, label: "가리키는 손" },
  { id: "em-marble", iconSrc: `${PIXEL_DIR}/emoji-02.png`, label: "파란 구슬" },
  { id: "em-baseball", iconSrc: `${PIXEL_DIR}/emoji-03.png`, label: "야구공" },
  { id: "em-heart", iconSrc: `${PIXEL_DIR}/emoji-04.png`, label: "하트" },
  { id: "em-comet", iconSrc: `${PIXEL_DIR}/emoji-05.png`, label: "혜성" },
  { id: "em-star", iconSrc: `${PIXEL_DIR}/emoji-06.png`, label: "반짝이는 별" },
  { id: "em-paw", iconSrc: `${PIXEL_DIR}/emoji-08.png`, label: "발바닥" },
  { id: "em-bubble", iconSrc: `${PIXEL_DIR}/emoji-09.png`, label: "비눗방울" },
  { id: "em-cursor", iconSrc: `${PIXEL_DIR}/emoji-10.png`, label: "커서" },
  { id: "em-key", iconSrc: `${PIXEL_DIR}/emoji-11.png`, label: "열쇠" },
  { id: "em-boot", iconSrc: `${PIXEL_DIR}/emoji-12.png`, label: "장화" },
  { id: "em-trumpet", iconSrc: `${PIXEL_DIR}/emoji-13.png`, label: "트럼펫" },
  { id: "em-ghost", iconSrc: `${PIXEL_DIR}/emoji-14.png`, label: "유령" },
  { id: "em-sparkle", iconSrc: `${PIXEL_DIR}/emoji-15.png`, label: "반짝이" },
  { id: "em-squirrel", iconSrc: `${PIXEL_DIR}/emoji-16.png`, label: "날다람쥐" },
  { id: "em-chameleon", iconSrc: `${PIXEL_DIR}/emoji-17.png`, label: "카멜레온" },
  { id: "em-watering-can", iconSrc: `${PIXEL_DIR}/emoji-18.png`, label: "물뿌리개" },
  { id: "em-hammer", iconSrc: `${PIXEL_DIR}/emoji-19.png`, label: "망치" },
];

/** Discriminated union for placed sticker instances on the photo. */
export type PlacedStickerInstance =
  | {
      kind: "character";
      instanceId: string;
      assetId: string;
      /** Horizontal center as % of photo width (0..100). */
      xPct: number;
      /** Vertical center as % of photo height (0..100). */
      yPct: number;
      /** Multiplier on the base 20%-of-canvas-width display size. */
      scale: number;
      /** Rotation in degrees (clockwise). 0 = upright. */
      rotationDeg: number;
    }
  | {
      kind: "emoji";
      instanceId: string;
      emojiId: string;
      xPct: number;
      yPct: number;
      scale: number;
      rotationDeg: number;
    }
  | {
      kind: "text";
      instanceId: string;
      /** User-typed text content. */
      text: string;
      /** CSS hex color for the rendered glyphs. */
      color: string;
      xPct: number;
      yPct: number;
      scale: number;
      rotationDeg: number;
    };

export const DEFAULT_STICKER_SCALE = 1.0;
export const MIN_STICKER_SCALE = 0.3;
export const MAX_STICKER_SCALE = 3.0;

/** Color presets shown in the text-sticker UI. */
export const TEXT_STICKER_COLORS: ReadonlyArray<{ id: string; hex: string; label: string }> = [
  { id: "white", hex: "#ffffff", label: "화이트" },
  { id: "black", hex: "#1a1a1a", label: "블랙" },
  { id: "red", hex: "#e63946", label: "레드" },
  { id: "pink", hex: "#ff6fa8", label: "핑크" },
  { id: "yellow", hex: "#fbbf24", label: "옐로" },
  { id: "mint", hex: "#4ade80", label: "민트" },
  { id: "sky", hex: "#38bdf8", label: "스카이" },
  { id: "purple", hex: "#a78bfa", label: "퍼플" },
];

export const DEFAULT_TEXT_COLOR = "#1a1a1a";
export const MAX_TEXT_LENGTH = 20;
