/**
 * lib/captures-server.test.ts — PNG sniff + publicUrl derivation.
 */

import { describe, it, expect } from "vitest";
import { derivePublicUrl, isPng } from "./captures-server";
import { TunnelHostUnavailableError } from "./types";

describe("isPng", () => {
  it("returns true for the canonical 8-byte PNG header", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(isPng(buf)).toBe(true);
  });

  it("returns false for buffers shorter than 8 bytes", () => {
    expect(isPng(Buffer.from([0x89, 0x50]))).toBe(false);
  });

  it("returns false for non-PNG headers (e.g. JPEG)", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(isPng(jpeg)).toBe(false);
  });

  it("works on Uint8Array as well as Buffer", () => {
    const u8 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isPng(u8)).toBe(true);
  });
});

describe("derivePublicUrl", () => {
  it("uses x-forwarded-host + x-forwarded-proto when both are set (tunnel path)", () => {
    const h = new Headers({
      "x-forwarded-host": "abc.ngrok-free.app",
      "x-forwarded-proto": "https",
      host: "localhost:3000",
    });
    expect(derivePublicUrl(h, "abc-123.png")).toBe(
      "https://abc.ngrok-free.app/captures/abc-123.png",
    );
  });

  it("falls back to Host header when X-Forwarded-Host is absent", () => {
    const h = new Headers({ host: "localhost:3000" });
    expect(derivePublicUrl(h, "x.png")).toBe("http://localhost:3000/captures/x.png");
  });

  it("infers https for non-local hosts when proto header is missing", () => {
    const h = new Headers({ host: "abc.ngrok-free.app" });
    expect(derivePublicUrl(h, "x.png")).toBe("https://abc.ngrok-free.app/captures/x.png");
  });

  it("infers http for 127.0.0.1 / 192.168.* / 10.* private hosts", () => {
    expect(derivePublicUrl(new Headers({ host: "127.0.0.1:3000" }), "x.png")).toBe(
      "http://127.0.0.1:3000/captures/x.png",
    );
    expect(derivePublicUrl(new Headers({ host: "192.168.1.5:3000" }), "x.png")).toBe(
      "http://192.168.1.5:3000/captures/x.png",
    );
    expect(derivePublicUrl(new Headers({ host: "10.0.0.1:3000" }), "x.png")).toBe(
      "http://10.0.0.1:3000/captures/x.png",
    );
  });

  it("throws TunnelHostUnavailableError when no host header is present", () => {
    const h = new Headers();
    expect(() => derivePublicUrl(h, "x.png")).toThrow(TunnelHostUnavailableError);
  });
});
