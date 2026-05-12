// scripts/render-title-card.mjs
//
// Render the themed-mode title-card PNG that lands in the bottom-right
// cell of the sheet. Replaces the hot-magenta Y2K mockup with a card
// styled in the booth's actual palette (crt-cream background, navy
// frame outlines, marquee-yellow accents) so it slots into the rest
// of the kiosk visually.
//
// Output: public/frames/processed/title-card.png (800×900 RGBA).

import sharp from "sharp";

const W = 800;
const H = 900;

// Palette (from tailwind.config.ts)
const CREAM = "#fff8e0";
const CREAM_SHADOW = "#e6dbb0";
const NAVY = "#1d2c4a";
const YELLOW = "#ffd84d";
const MARQUEE_YELLOW = "#ffe21d";
const PINK_SOFT = "#ffd6e8"; // halftone dots
const BUBBLE_GREEN = "#7be67d";

// Four-pointed sparkle path (Y2K star) — drawn around origin, 1.0 unit.
const STAR_PATH = "M 0 -1 L 0.18 -0.18 L 1 0 L 0.18 0.18 L 0 1 L -0.18 0.18 L -1 0 L -0.18 -0.18 Z";

function star(cx, cy, size, fill, stroke) {
  return `<g transform="translate(${cx} ${cy}) scale(${size})"><path d="${STAR_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="${0.05 / size}" stroke-linejoin="round"/></g>`;
}

// Halftone dot pattern — sparse soft-pink dots over the cream background
// so the card reads as Y2K-photobooth rather than plain cream.
function halftoneDots() {
  const dots = [];
  const step = 56;
  const r = 7;
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const offset = (y / step) % 2 === 0 ? 0 : step / 2;
      dots.push(`<circle cx="${x + offset}" cy="${y}" r="${r}" fill="${PINK_SOFT}" opacity="0.7" />`);
    }
  }
  return dots.join("\n");
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Cream base -->
  <rect width="${W}" height="${H}" fill="${CREAM}" />
  <!-- Halftone polka layer for Y2K texture -->
  ${halftoneDots()}

  <!-- Corner sparkles -->
  ${star(120, 130, 32, YELLOW, NAVY)}
  ${star(680, 150, 24, MARQUEE_YELLOW, NAVY)}
  ${star(140, 770, 22, BUBBLE_GREEN, NAVY)}
  ${star(680, 760, 30, YELLOW, NAVY)}
  ${star(420, 90, 14, NAVY, NAVY)}

  <!-- OZCODING small wordmark with navy outline + yellow fill -->
  <g transform="translate(${W / 2} 280)">
    <text text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif"
          font-size="58" letter-spacing="6" fill="${YELLOW}"
          stroke="${NAVY}" stroke-width="6" paint-order="stroke fill">OZCODING</text>
  </g>

  <!-- PD09 hero — huge chunky letters, marquee yellow fill, navy double-shadow -->
  <g transform="translate(${W / 2} 470)">
    <!-- Drop shadow plate -->
    <text text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif"
          font-size="220" font-weight="900" fill="${NAVY}" opacity="0.18"
          dx="10" dy="14">PD09</text>
    <text text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif"
          font-size="220" font-weight="900" fill="${MARQUEE_YELLOW}"
          stroke="${NAVY}" stroke-width="8" paint-order="stroke fill">PD09</text>
  </g>

  <!-- MAKE MEMORIES — medium tagline, same style as OZCODING -->
  <g transform="translate(${W / 2} 680)">
    <text text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif"
          font-size="48" letter-spacing="6" fill="${YELLOW}"
          stroke="${NAVY}" stroke-width="5" paint-order="stroke fill">MAKE MEMORIES</text>
  </g>

  <!-- 2026.05.14 — body navy, clean -->
  <g transform="translate(${W / 2} 760)">
    <text text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
          font-size="40" font-weight="700" fill="${NAVY}"
          letter-spacing="3">2026.05.14</text>
  </g>

  <!-- Bottom hashtag pill -->
  <g transform="translate(${W / 2} 825)">
    <rect x="-90" y="-22" width="180" height="40" rx="20" fill="${NAVY}" />
    <text text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif"
          font-size="24" fill="${MARQUEE_YELLOW}" dy="8" letter-spacing="4">#PD09</text>
  </g>
</svg>`;

const buf = Buffer.from(svg, "utf-8");

await sharp(buf, { density: 144 })
  .resize(W, H, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile("public/frames/processed/title-card.png");

console.log("wrote public/frames/processed/title-card.png (" + W + "x" + H + ")");
