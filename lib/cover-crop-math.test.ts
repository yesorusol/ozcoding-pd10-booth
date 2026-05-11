import { describe, it, expect } from "vitest";
import { coverCrop } from "./cover-crop-math";

describe("coverCrop (target 512×576)", () => {
  it("landscape source 1280×720 → sx=320,sy=0,sw=640,sh=720", () => {
    expect(coverCrop(1280, 720, 512, 576)).toEqual({ sx: 320, sy: 0, sw: 640, sh: 720 });
  });

  it("portrait source 720×1280 → sx=0,sy=235,sw=720,sh=810", () => {
    const r = coverCrop(720, 1280, 512, 576);
    expect(r.sx).toBe(0);
    expect(r.sw).toBe(720);
    expect(r.sh).toBeCloseTo(810, 0);
    expect(r.sy).toBeCloseTo(235, 0);
  });

  it("square source 720×720 → sx=40,sy=0,sw=640,sh=720", () => {
    expect(coverCrop(720, 720, 512, 576)).toEqual({ sx: 40, sy: 0, sw: 640, sh: 720 });
  });

  it("Retina-doubled source 2560×1440 → sx=640,sy=0,sw=1280,sh=1440", () => {
    expect(coverCrop(2560, 1440, 512, 576)).toEqual({ sx: 640, sy: 0, sw: 1280, sh: 1440 });
  });

  it("matched-aspect source 512×576 → identity sx=0,sy=0,sw=512,sh=576", () => {
    expect(coverCrop(512, 576, 512, 576)).toEqual({ sx: 0, sy: 0, sw: 512, sh: 576 });
  });

  it("throws RangeError on zero or negative dims", () => {
    expect(() => coverCrop(0, 720, 512, 576)).toThrow(RangeError);
    expect(() => coverCrop(1280, 0, 512, 576)).toThrow(RangeError);
    expect(() => coverCrop(1280, 720, -1, 576)).toThrow(RangeError);
  });
});
