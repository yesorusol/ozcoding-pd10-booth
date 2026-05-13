// M1 tests: verify processed frame PNGs are 800×900 RGBA with correct transparency.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import path from "node:path";
import { existsSync } from "node:fs";

const PROC_DIR = path.resolve("public/frames/processed");

const CHARACTER_FRAMES = [
  "burger",
  "ramen",
  "tamagotchi",
  "teeth",
  "mic",
  "cosplay",
  "waiter",
];
const ALL_FRAMES = [...CHARACTER_FRAMES, "title-card"];

describe("M1: processed frame PNGs", () => {
  it("all 8 processed files exist", () => {
    for (const name of ALL_FRAMES) {
      const p = path.join(PROC_DIR, `${name}.png`);
      expect(existsSync(p), `${name}.png should exist`).toBe(true);
    }
  });

  it("all processed frames are exactly 800×900 with alpha channel", async () => {
    for (const name of ALL_FRAMES) {
      const meta = await sharp(path.join(PROC_DIR, `${name}.png`)).metadata();
      expect(meta.width, `${name}.png width`).toBe(800);
      expect(meta.height, `${name}.png height`).toBe(900);
      expect(meta.channels, `${name}.png channels`).toBe(4);
    }
  });

  it("burger face hole pixel (400,350) is fully transparent (alpha=0)", async () => {
    // (400,350) is inside the face circle of burger.png (center of 800×900 processed)
    const { data } = await sharp(path.join(PROC_DIR, "burger.png"))
      .extract({ left: 400, top: 350, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0); // alpha channel
  });

  it("waiter face hole pixel (550,362) is fully transparent (alpha=0)", async () => {
    // waiter face hole is offset-right; center is ~(550,362) in processed coords
    const { data } = await sharp(path.join(PROC_DIR, "waiter.png"))
      .extract({ left: 550, top: 362, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it("top-left padding pixel (10,10) is transparent for all frames", async () => {
    for (const name of ALL_FRAMES) {
      const { data } = await sharp(path.join(PROC_DIR, `${name}.png`))
        .extract({ left: 10, top: 10, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[3], `${name}.png pad pixel alpha`).toBe(0);
    }
  });

  it("top-right padding pixel (790,10) is transparent for all frames", async () => {
    for (const name of ALL_FRAMES) {
      const { data } = await sharp(path.join(PROC_DIR, `${name}.png`))
        .extract({ left: 790, top: 10, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[3], `${name}.png right-pad pixel alpha`).toBe(0);
    }
  });

  it("title-card known pink pixel (360,100) is opaque (not chroma-keyed)", async () => {
    // title-card has pink rgb(255,77,143) at (360,100) in the raw 720×900 image.
    // After +40px left padding, that pixel is at x=360+40=400 in processed coords.
    const { data } = await sharp(path.join(PROC_DIR, "title-card.png"))
      .extract({ left: 400, top: 100, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Should be opaque (alpha=255) — passthrough frames are NOT chroma-keyed
    expect(data[3]).toBe(255);
    // Should still be pink-ish
    expect(data[0]).toBeGreaterThan(200); // red
    expect(data[1]).toBeLessThan(150);    // green low
  });

  it("artwork pixels (non-hole) remain opaque in character frames", async () => {
    // Frame art should be opaque outside the face hole.
    // burger split-bun design centers the top bun horizontally — sample
    // (400,80) which sits on the bun itself, well above the face hole.
    const { data } = await sharp(path.join(PROC_DIR, "burger.png"))
      .extract({ left: 400, top: 80, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBeGreaterThan(200); // should be opaque artwork
  });

  it("original 720px artwork is centered: columns 0-39 and 760-799 are transparent", async () => {
    // The 40px left pad (columns 0–39) should all be alpha=0
    // The 40px right pad (columns 760–799) should all be alpha=0
    // Sample 5 pixels from left pad and 5 from right pad across different rows
    const testFrame = "burger";
    const testRows = [50, 200, 450, 700, 880];

    for (const y of testRows) {
      for (const x of [5, 20, 39]) {
        const { data } = await sharp(path.join(PROC_DIR, `${testFrame}.png`))
          .extract({ left: x, top: y, width: 1, height: 1 })
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(data[3], `left-pad (${x},${y}) alpha`).toBe(0);
      }
      for (const x of [760, 779, 795]) {
        const { data } = await sharp(path.join(PROC_DIR, `${testFrame}.png`))
          .extract({ left: x, top: y, width: 1, height: 1 })
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(data[3], `right-pad (${x},${y}) alpha`).toBe(0);
      }
    }
  });
});
