/**
 * lib/captures-server.ts — Pure server-side helpers for the captures API.
 *
 * Kept side-effect-free so they can be unit-tested in isolation; the actual
 * route handler at `app/api/captures/route.ts` is a thin wrapper that
 * combines these with disk I/O.
 *
 * Architect-required behavior (M6):
 *   • The QR target URL is derived per-request from the incoming
 *     `X-Forwarded-Host` / `Host` header — NOT a build-time env var.
 *     This means restarting `ngrok` doesn't require a `next build`.
 *   • Missing host throws a `TunnelHostUnavailableError` so the route can
 *     return HTTP 503 with `{"error":"tunnel-public-host-unavailable"}`,
 *     which the client maps to `phase: "tunnel-host-error"` (idle-timer
 *     eligible — the operator must fix ngrok).
 */

import { TunnelHostUnavailableError } from "./types";

/** PNG magic number — the first 8 bytes of every PNG file. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Whether `buf` starts with the PNG magic number. */
export function isPng(buf: Uint8Array | Buffer): boolean {
  if (buf.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (buf[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Build the publicly-reachable URL for a stored capture file from request
 * headers. Prefers `X-Forwarded-Proto` / `X-Forwarded-Host` (set by tunnels
 * like ngrok / cloudflared) and falls back to `Host`.
 *
 * Throws `TunnelHostUnavailableError` if no host header is present.
 */
export function derivePublicUrl(
  headers: Headers,
  filename: string,
): string {
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  if (!host) {
    throw new TunnelHostUnavailableError();
  }
  const proto = headers.get("x-forwarded-proto") ?? inferProto(host);
  return `${proto}://${host}/captures/${filename}`;
}

function inferProto(host: string): string {
  // Default to http for localhost / private networks; https otherwise.
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.")
  ) {
    return "http";
  }
  return "https";
}
