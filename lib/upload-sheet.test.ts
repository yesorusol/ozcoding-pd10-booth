/**
 * lib/upload-sheet.test.ts — fetch-mocked tests covering all client paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadSheet } from "./upload-sheet";
import { TunnelHostUnavailableError, type CaptureRecord } from "./types";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("uploadSheet", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("POSTs the blob with image/png Content-Type and returns the record", async () => {
    const record: CaptureRecord = {
      id: "abc-123",
      publicUrl: "https://abc.ngrok-free.app/captures/abc-123.png",
      createdAt: "2026-05-14T10:00:00.000Z",
      sizeBytes: 1234,
    };
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(record, { status: 201 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const blob = new Blob(["fake png"], { type: "image/png" });
    const result = await uploadSheet(blob);

    expect(result).toEqual(record);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/captures");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("image/png");
    expect(init.body).toBe(blob);
  });

  it("throws TunnelHostUnavailableError on 503 with the documented body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ error: "tunnel-public-host-unavailable" }, { status: 503 }),
    ) as unknown as typeof globalThis.fetch;

    const blob = new Blob([], { type: "image/png" });
    await expect(uploadSheet(blob)).rejects.toBeInstanceOf(TunnelHostUnavailableError);
  });

  it("throws a generic Error on other non-2xx responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("body too big", { status: 413 }),
    ) as unknown as typeof globalThis.fetch;

    const blob = new Blob([], { type: "image/png" });
    await expect(uploadSheet(blob)).rejects.toThrow(/HTTP 413/);
  });

  it("does NOT throw TunnelHostUnavailableError on 503 with a different body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ error: "something-else" }, { status: 503 }),
    ) as unknown as typeof globalThis.fetch;

    const blob = new Blob([], { type: "image/png" });
    await expect(uploadSheet(blob)).rejects.not.toBeInstanceOf(TunnelHostUnavailableError);
    await expect(uploadSheet(blob)).rejects.toThrow(/HTTP 503/);
  });
});
