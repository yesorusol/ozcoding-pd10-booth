/**
 * lib/booth-mode.test.ts — parseBoothMode + MODE_CONFIG shape.
 */

import { describe, it, expect } from "vitest";
import { parseBoothMode, MODE_CONFIG } from "./booth-mode";

describe("parseBoothMode", () => {
  it("returns 'normal' for the exact string 'normal'", () => {
    expect(parseBoothMode("normal")).toBe("normal");
  });

  it("returns 'themed' for the string 'themed'", () => {
    expect(parseBoothMode("themed")).toBe("themed");
  });

  it("returns 'themed' for null", () => {
    expect(parseBoothMode(null)).toBe("themed");
  });

  it("returns 'themed' for undefined", () => {
    expect(parseBoothMode(undefined)).toBe("themed");
  });

  it("returns 'themed' for empty string", () => {
    expect(parseBoothMode("")).toBe("themed");
  });

  it("returns 'themed' for arbitrary garbage values", () => {
    expect(parseBoothMode("garbage")).toBe("themed");
    expect(parseBoothMode("Normal")).toBe("themed");
    expect(parseBoothMode("NORMAL")).toBe("themed");
    expect(parseBoothMode(" normal")).toBe("themed");
  });
});

describe("MODE_CONFIG", () => {
  it("defines themed and normal entries with cut counts", () => {
    expect(MODE_CONFIG.themed.totalCuts).toBe(7);
    expect(MODE_CONFIG.normal.totalCuts).toBe(4);
  });

  it("declares the correct sheet sizes per mode", () => {
    expect(MODE_CONFIG.themed.sheetSize).toEqual({ width: 1080, height: 2400 });
    expect(MODE_CONFIG.normal.sheetSize).toEqual({ width: 1080, height: 1440 });
  });

  it("does not include a `compose` field — composers stay in flow modules", () => {
    expect(MODE_CONFIG.themed).not.toHaveProperty("compose");
    expect(MODE_CONFIG.normal).not.toHaveProperty("compose");
  });

  it("exposes a Korean displayName per mode", () => {
    expect(MODE_CONFIG.themed.displayName).toBe("도전 챌린지");
    expect(MODE_CONFIG.normal.displayName).toBe("폴라로이드(일반)");
  });
});
