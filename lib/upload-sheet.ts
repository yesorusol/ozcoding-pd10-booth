/**
 * lib/upload-sheet.ts — Client-side helper that POSTs a composed sheet PNG
 * to `/api/captures` and returns the server's `CaptureRecord` (id, publicUrl,
 * createdAt, sizeBytes).
 *
 * Distinct error paths so the caller can route to the right state:
 *   • HTTP 503 with `{"error":"tunnel-public-host-unavailable"}` →
 *     throws `TunnelHostUnavailableError` (operator must fix ngrok).
 *   • Any other non-2xx → throws a generic `Error`.
 */

import { TunnelHostUnavailableError, type CaptureRecord } from "./types";

const ENDPOINT = "/api/captures";

export async function uploadSheet(blob: Blob): Promise<CaptureRecord> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });

  if (res.status === 503) {
    let body: { error?: string } | null = null;
    try {
      body = (await res.json()) as { error?: string };
    } catch {
      // ignore json parse errors — fall through to generic error below
    }
    if (body?.error === "tunnel-public-host-unavailable") {
      throw new TunnelHostUnavailableError();
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`uploadSheet: HTTP ${res.status} ${text}`.trim());
  }

  return (await res.json()) as CaptureRecord;
}
