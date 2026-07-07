/**
 * scripts/generate-normal-overlay.ts — Placeholder normal-mode overlay PNG.
 *
 * Builds `public/overlays/normal.png` (1080×1440) by composing an SVG with
 * `sharp`. The SVG paints:
 *   • A cream `#f8f4e8` background.
 *   • Four white polaroid frames (one per cell in `lib/normal-layout.ts`),
 *     each rotated, with a thicker bottom border classic-polaroid style.
 *     The cell's photo area is `transparent` so composited photos show
 *     through under runtime composition.
 *   • A `♡ OZCODING PD10 ♡` caption at the bottom-center.
 *
 * Designer is expected to replace this asset with the final artwork.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SHEET_WIDTH = 1080;
const SHEET_HEIGHT = 1440;
const BACKGROUND = "#f8f4e8";
const CAPTION = "♡ OZCODING PD10 ♡";
const CAPTION_COLOR = "#9b8e76";

interface PolaroidCell {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
}

const CELLS: PolaroidCell[] = [
  { x: 90, y: 80, width: 440, height: 525, rotationDeg: -3 },
  { x: 550, y: 80, width: 440, height: 525, rotationDeg: 2 },
  { x: 90, y: 810, width: 440, height: 525, rotationDeg: -1.5 },
  { x: 550, y: 810, width: 440, height: 525, rotationDeg: 2.5 },
];

const FRAME_PADDING = 22;
const FRAME_BOTTOM_PADDING = 80;

function polaroidRect(cell: PolaroidCell): string {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  return `
    <g transform="translate(${cx} ${cy}) rotate(${cell.rotationDeg})">
      <rect
        x="${-cell.width / 2}"
        y="${-cell.height / 2}"
        width="${cell.width}"
        height="${cell.height}"
        fill="white"
        stroke="#cdbfa3"
        stroke-width="2"
      />
      <rect
        x="${-cell.width / 2 + FRAME_PADDING}"
        y="${-cell.height / 2 + FRAME_PADDING}"
        width="${cell.width - 2 * FRAME_PADDING}"
        height="${cell.height - FRAME_PADDING - FRAME_BOTTOM_PADDING}"
        fill="transparent"
      />
    </g>`;
}

function buildSvg(): string {
  const cells = CELLS.map(polaroidRect).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}" viewBox="0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}">
  <rect width="100%" height="100%" fill="${BACKGROUND}"/>
  ${cells}
  <text
    x="${SHEET_WIDTH / 2}"
    y="${SHEET_HEIGHT - 60}"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="44"
    fill="${CAPTION_COLOR}"
  >${CAPTION}</text>
</svg>`;
}

async function main() {
  const outDir = path.resolve(process.cwd(), "public/overlays");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "normal.png");

  const svg = buildSvg();
  const png = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
  await writeFile(outPath, png);

  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
