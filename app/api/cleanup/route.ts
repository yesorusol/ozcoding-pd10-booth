/**
 * app/api/cleanup/route.ts — Deletes capture files older than 24h.
 *
 * Triggered by a Vercel Cron Job (see vercel.json). Vercel injects an
 * `Authorization: Bearer <CRON_SECRET>` header automatically when calling
 * scheduled paths in production — we reject anything else so this can't be
 * called by random visitors.
 *
 * Failure modes are returned as JSON so the Vercel cron log shows what
 * happened on each run.
 */

import { NextResponse } from "next/server";

import {
  CAPTURES_BUCKET,
  SupabaseConfigError,
  getSupabaseAdmin,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RETENTION_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 1000;

export async function GET(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }

  const { data: files, error: listError } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .list("", { limit: LIST_LIMIT, sortBy: { column: "created_at", order: "asc" } });
  if (listError) {
    return NextResponse.json(
      { error: `list failed: ${listError.message}` },
      { status: 500 },
    );
  }

  const cutoff = Date.now() - RETENTION_MS;
  const stale = (files ?? []).filter((f) => {
    if (!f.created_at) return false;
    return new Date(f.created_at).getTime() < cutoff;
  });

  if (stale.length === 0) {
    return NextResponse.json({ scanned: files?.length ?? 0, deleted: 0 });
  }

  const names = stale.map((f) => f.name);
  const { error: removeError } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .remove(names);
  if (removeError) {
    return NextResponse.json(
      { error: `remove failed: ${removeError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    scanned: files?.length ?? 0,
    deleted: names.length,
  });
}
