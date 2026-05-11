/**
 * scripts/draw-zep-icons.mjs — Hand-authored pixel-art emoji icons in
 * ZEP-style tone: bold 1px outline, simple 2–3 shade fills, slight highlight.
 *
 * Each icon is a `{ palette, rows }` record where `rows[i][x]` is a single
 * character that maps to an RGBA tuple in `palette`. A '.' is transparent.
 * We render the raw pixel buffer with sharp at native pixel resolution; the
 * picker / composer scales them up with `image-rendering: pixelated` (or
 * `imageSmoothingEnabled = false` on canvas) so they stay crisp.
 *
 * Run: `node scripts/draw-zep-icons.mjs`
 */

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "stickers", "zep");
mkdirSync(OUT_DIR, { recursive: true });

// Shared colors — keep the palette tight so icons feel like one set.
const OUTLINE = [30, 30, 40, 255];
const WHITE = [255, 255, 255, 255];
const SHADOW = [60, 60, 80, 100]; // soft drop-tint, semi-transparent
const T = [0, 0, 0, 0]; // transparent

const icons = {
  // ── HEARTS ────────────────────────────────────────────────────────────
  "heart-red": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "r": [217, 30, 50, 255],
      "R": [255, 80, 100, 255],
      "H": [255, 175, 190, 255],
    },
    rows: [
      "..##....##..",
      ".#RR##.#RR#.",
      "#RHHRR#RRrr#",
      "#RHHRRRRRRr#",
      "#RRRRRRRRRr#",
      ".#RRRRRRRr#.",
      "..#RRRRRr#..",
      "...#RRRr#...",
      "....#Rr#....",
      ".....##.....",
    ],
  },
  "heart-pink": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "p": [220, 100, 160, 255],
      "P": [255, 150, 200, 255],
      "H": [255, 220, 235, 255],
    },
    rows: [
      "..##....##..",
      ".#PP##.#PP#.",
      "#PHHPP#PPpp#",
      "#PHHPPPPPPp#",
      "#PPPPPPPPPp#",
      ".#PPPPPPPp#.",
      "..#PPPPPp#..",
      "...#PPPp#...",
      "....#Pp#....",
      ".....##.....",
    ],
  },
  "heart-rainbow": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "1": [231, 71, 80, 255],  // red
      "2": [243, 156, 50, 255], // orange
      "3": [248, 222, 73, 255], // yellow
      "4": [120, 200, 90, 255], // green
      "5": [80, 165, 222, 255], // blue
      "6": [161, 110, 200, 255], // purple
    },
    rows: [
      "..##....##..",
      ".#11##.#11#.",
      "#11111#11111",
      "#22222222222",
      "#33333333333",
      ".#444444444#",
      "..#5555555#.",
      "...#66666#..",
      "....#666#...",
      ".....###....",
    ],
  },
  // ── STAR ──────────────────────────────────────────────────────────────
  "star-yellow": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "y": [240, 180, 30, 255],
      "Y": [255, 220, 70, 255],
      "H": [255, 245, 180, 255],
    },
    rows: [
      ".......##.......",
      "......#YY#......",
      "......#YH#......",
      ".#####YHHY#####.",
      "#YYYYYYHHYYYYYY#",
      "#YYYHHHHHHHHYYy#",
      ".#YYHHHHHHHYYy#.",
      "..#YYYYHHYYYy#..",
      "..#YYyYYYYYyy#..",
      ".#Yy##yyyyy##y#.",
      "#Yy#..##yy##.#y#",
      "#y#....##.....##",
      "##......#......#",
    ],
  },
  // ── SPEECH BUBBLES ────────────────────────────────────────────────────
  "speech-yellow": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "y": [225, 175, 30, 255],
      "Y": [255, 220, 70, 255],
      "H": [255, 250, 200, 255],
    },
    rows: [
      ".############.",
      "#YHHHHHHHHHHY#",
      "#YHHHHHHHHHHy#",
      "#YHHHHHHHHHHy#",
      "#YHHHHHHHHHHy#",
      "#YHHHHHHHHHHy#",
      "#YyyyyyyyyYYY#",
      ".#####yYY####.",
      "....#yY#......",
      ".....##.......",
    ],
  },
  "speech-heart": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "w": [255, 250, 250, 255],
      "W": [245, 235, 235, 255],
      "r": [217, 30, 50, 255],
      "R": [255, 80, 100, 255],
    },
    rows: [
      ".############.",
      "#wwwwwwwwwwww#",
      "#wwww##ww##ww#",
      "#www#RR##RR#w#",
      "#www#RRRRRR#W#",
      "#www#RRRRRR#W#",
      "#wwww#RRRR#WW#",
      "#wwwww#RR#WWW#",
      "#WWWWWW##WWWW#",
      ".#####WWW####.",
      "....#WW#......",
      ".....##.......",
    ],
  },
  "speech-hi": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "y": [225, 175, 30, 255],
      "Y": [255, 220, 70, 255],
      "H": [255, 250, 200, 255],
      "r": [200, 30, 40, 255],
    },
    rows: [
      ".##############.",
      "#YHHHHHHHHHHHHY#",
      "#YH#H#HHHH#HHHy#",
      "#YH###HHHH##HHy#",
      "#YH#H#HHHHH#HHy#",
      "#YH#H#HHHH#H#Hy#",
      "#YHHHHrHHHHHHHy#",
      "#YHHHHHHHHHHHHy#",
      "#YYYYYYYYYYYYYY#",
      ".######yYY######",
      "......#yY#......",
      ".......##.......",
    ],
  },
  "speech-ok": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "w": [255, 250, 250, 255],
      "W": [240, 230, 230, 255],
      "r": [200, 30, 40, 255],
    },
    rows: [
      ".##############.",
      "#wwwwwwwwwwwwww#",
      "#www##wwww#w#ww#",
      "#ww#rr#ww#r#r#w#",
      "#w#r##r#w#r#r#W#",
      "#w#r##r#w#r#r#W#",
      "#w#r##r#w#rrr#W#",
      "#ww#rr#wwww#wwW#",
      "#www##wWWWWWWWW#",
      ".#####WWW#######",
      "....#WW#........",
      ".....##.........",
    ],
  },
  // ── CROWNS ────────────────────────────────────────────────────────────
  "crown-gold": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "y": [200, 145, 25, 255],
      "Y": [240, 195, 50, 255],
      "H": [255, 235, 130, 255],
      "r": [220, 50, 70, 255],
    },
    rows: [
      "..#......#......#..",
      ".#H#....#H#....#H#.",
      "#YYY#..#YHY#..#YYY#",
      "#YHYY##YHYY##YYYY#.",
      "#YHYYYYHHYYYYYYYY#.",
      "#YHHrYYYHYYYrYYYY#.",
      "#YHrrrYYHYYrrrYYY#.",
      "#YYrrYYYHYYYrrYYY#.",
      "#yyYYyyyyyyyyyyyy#.",
      ".#################.",
    ],
  },
  "crown-silver": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "g": [150, 155, 170, 255],
      "G": [200, 205, 215, 255],
      "H": [240, 245, 250, 255],
      "p": [200, 100, 180, 255],
    },
    rows: [
      "..#......#......#..",
      ".#H#....#H#....#H#.",
      "#GGG#..#GHG#..#GGG#",
      "#GHGG##GHGG##GGGG#.",
      "#GHGGGGHHGGGGGGGG#.",
      "#GHHpGGGHGGGpGGGG#.",
      "#GHppppGHGGppppGG#.",
      "#GGppGGGHGGppGGGG#.",
      "#ggGGggggggggggggG#",
      ".#################.",
    ],
  },
  // ── SUNGLASSES ────────────────────────────────────────────────────────
  "sunglasses-blue": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "b": [50, 80, 165, 255],
      "B": [80, 130, 210, 255],
      "H": [180, 220, 255, 255],
    },
    rows: [
      "##############.##############",
      "#bbbbbbbbbbbb#.#bbbbbbbbbbbb#",
      "#bBBHHBBBBbbb###bbBBHHBBBBbb#",
      "#bBHHHBBBBbbb#.#bbBHHHBBBBbb#",
      "#bBBBBBBBbbbb#.#bbbBBBBBBBbb#",
      "#bbbbbbbbbbbb#.#bbbbbbbbbbbb#",
      "#bbbbbbbbbbbb#.#bbbbbbbbbbbb#",
      ".############...############.",
    ],
  },
  "sunglasses-heart": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "r": [220, 60, 80, 255],
      "R": [255, 110, 130, 255],
      "H": [255, 200, 215, 255],
    },
    rows: [
      "..##..##......##..##..",
      ".#RR##RR#....#RR##RR#.",
      "#RHHRRRRR#..#RHHRRRRR#",
      "#RRRRRRRR#..#RRRRRRRR#",
      ".#RRRRRR#....#RRRRRR#.",
      "..#RRRR#......#RRRR#..",
      "...#RR#........#RR#...",
      "....##..........##....",
    ],
  },
  // ── RIBBONS ───────────────────────────────────────────────────────────
  "ribbon-red": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "r": [180, 30, 40, 255],
      "R": [230, 50, 70, 255],
      "H": [255, 130, 150, 255],
    },
    rows: [
      "..####....####..",
      ".#RHHR#..#RHHR#.",
      "#RHHRRR##RRRRHR#",
      "#RHRRRR##RRRRHR#",
      "#RRRRRR##RRRRRR#",
      ".#RRRR#..#RRRR#.",
      "..####RR####...",
      "....#RHHR#......",
      "....#rRRr#......",
      ".....####.......",
    ],
  },
  "ribbon-pink-banner": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "p": [220, 100, 160, 255],
      "P": [255, 150, 200, 255],
      "H": [255, 220, 235, 255],
    },
    rows: [
      "..#######################...",
      ".#PHHPPPPPPPPPPPPPPPPPPP#...",
      "#PPPPPPPPPPPPPPPPPPPPPPP#...",
      "#ppPPPPPPPPPPPPPPPPPPPPP#...",
      ".#######################...",
      "....##......#######......##",
      "...#pp#....#PPPPPPPPP#...##",
      "..#pPp#...#PPPHPPPPPp#..##.",
      "..#pp#...#PPPHPPPPPpp#.##..",
      "...##....##########ppP##...",
      ".................########..",
    ],
  },
  // ── HAMMER ────────────────────────────────────────────────────────────
  "hammer-gold": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "y": [200, 145, 25, 255],
      "Y": [240, 195, 50, 255],
      "H": [255, 235, 130, 255],
      "r": [200, 35, 50, 255],
      "R": [240, 70, 90, 255],
    },
    rows: [
      "..##############..",
      ".#YHHHHHHHHHHHHY#.",
      "#YHHYYYYYYYYYHHYY#",
      "#YHYYY##YY##YYYYy#",
      "#YYY##YYYYYY##YYy#",
      "#YYYYYYYYYYYYYYYy#",
      ".#YYyyyyyyyyyyyy#.",
      "..######rr######..",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      "......#rRR#.......",
      ".....#rrRRR#......",
      ".....#######......",
    ],
  },
  // ── BASEBALL ──────────────────────────────────────────────────────────
  "baseball": {
    palette: {
      ".": T,
      "#": OUTLINE,
      "w": [255, 250, 245, 255],
      "W": [225, 220, 215, 255],
      "r": [200, 35, 50, 255],
    },
    rows: [
      "....######....",
      "..##wwwwww##..",
      ".#wwwrrwwwww#.",
      ".#wrrwwwwwrr#.",
      "#wwrwwwwwwwrW#",
      "#wwwwwwwwwwww#",
      "#wwwwwwwwwwww#",
      "#WwwwwwwwwwwW#",
      "#WwwrwwwwwwrW#",
      ".#WrrwwwwwrrW#",
      ".#WwwwrrWWWWW#",
      "..#WWWWWWWW#..",
      "....######....",
    ],
  },
};

function renderIcon(name, def, outFile) {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const buf = Buffer.alloc(w * h * 4, 0);
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < w; x++) {
      const ch = x < row.length ? row[x] : ".";
      const rgba = def.palette[ch] ?? T;
      const o = (y * w + x) * 4;
      buf[o] = rgba[0];
      buf[o + 1] = rgba[1];
      buf[o + 2] = rgba[2];
      buf[o + 3] = rgba[3];
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(outFile)
    .then(() => console.log(`  ${name}.png  ${w}×${h}`));
}

console.log(`drawing ${Object.keys(icons).length} ZEP-style pixel icons →`);
for (const [name, def] of Object.entries(icons)) {
  await renderIcon(name, def, join(OUT_DIR, `drawn-${name}.png`));
}
console.log("\n✅ done");
