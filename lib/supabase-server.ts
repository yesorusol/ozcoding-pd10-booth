/**
 * lib/supabase-server.ts — Server-only Supabase client factory.
 *
 * Uses the SERVICE_ROLE key so the API route can write into the `captures`
 * bucket regardless of the bucket's RLS policy. NEVER import this file from
 * client components.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {
  constructor(missing: string) {
    super(`Supabase env var missing: ${missing}`);
    this.name = "SupabaseConfigError";
  }
}

/**
 * Returns a memoized SupabaseClient bound to the service-role key.
 * Throws `SupabaseConfigError` if either required env var is missing — the
 * API route maps that to HTTP 503 so the kiosk surfaces a fixable error
 * instead of silently failing.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new SupabaseConfigError("SUPABASE_URL");
  if (!serviceKey) throw new SupabaseConfigError("SUPABASE_SERVICE_ROLE_KEY");
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Storage bucket name — must match what you create in Supabase Studio. */
export const CAPTURES_BUCKET = "captures";
