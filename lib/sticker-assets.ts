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

/**
 * Basic Unicode emoji palette. Rendered as text in the picker + composer.
 * 24 entries → 2 pages of 12 in the picker (paginated via arrows).
 */
export const EMOJI_STICKERS: ReadonlyArray<EmojiSticker> = [
  { id: "em-heart-pink", emoji: "💖", label: "핫핑크 하트" },
  { id: "em-heart-red", emoji: "❤️", label: "빨강 하트" },
  { id: "em-heart-pulse", emoji: "💗", label: "분홍 하트" },
  { id: "em-heart-baby", emoji: "🩷", label: "베이비핑크 하트" },
  { id: "em-star", emoji: "⭐", label: "별" },
  { id: "em-star-glow", emoji: "🌟", label: "빛나는 별" },
  { id: "em-sparkle", emoji: "✨", label: "반짝임" },
  { id: "em-dizzy", emoji: "💫", label: "회오리 별" },
  { id: "em-rainbow", emoji: "🌈", label: "무지개" },
  { id: "em-fire", emoji: "🔥", label: "불꽃" },
  { id: "em-crown", emoji: "👑", label: "왕관" },
  { id: "em-ribbon", emoji: "🎀", label: "리본" },
  { id: "em-sunglasses", emoji: "🕶️", label: "선글라스" },
  { id: "em-glasses", emoji: "👓", label: "안경" },
  { id: "em-speech", emoji: "💬", label: "말풍선" },
  { id: "em-squirrel", emoji: "🐿️", label: "다람쥐" },
  { id: "em-baseball", emoji: "⚾", label: "야구공" },
  { id: "em-hammer", emoji: "🔨", label: "망치" },
  { id: "em-trophy", emoji: "🏆", label: "트로피" },
  { id: "em-cherry-blossom", emoji: "🌸", label: "벚꽃" },
  { id: "em-camera", emoji: "📸", label: "카메라" },
  { id: "em-party", emoji: "🎉", label: "파티" },
  { id: "em-confetti", emoji: "🎊", label: "꽃가루" },
  { id: "em-hibiscus", emoji: "🌺", label: "히비스커스" },
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
