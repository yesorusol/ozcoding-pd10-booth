/**
 * app/api/captures/route.ts — Stores a composed sheet PNG in Supabase Storage
 * and returns the bucket's public URL so the client can encode it into a QR.
 *
 * Flow:
 *   1. Validate Content-Type (must be `image/png`) and size (≤ 10 MB).
 *   2. Sniff the PNG magic number to reject mislabeled bodies.
 *   3. Upload `{uuid}.png` into the `captures` bucket via service-role key.
 *   4. Return the bucket's public URL for the file.
 *
 * Failure modes:
 *   • Missing env vars → 503 `tunnel-public-host-unavailable` (reuses the
 *     existing kiosk error state so the operator screen is shown).
 *   • Upload failure → 500 generic error (kiosk retries via `upload-error`).
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { isPng } from "@/lib/captures-server";
import {
  CAPTURES_BUCKET,
  SupabaseConfigError,
  getSupabaseAdmin,
} from "@/lib/supabase-server";
import { type CaptureRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/png")) {
    return NextResponse.json(
      { error: "expected Content-Type: image/png" },
      { status: 400 },
    );
  }

  const arrayBuffer = await request.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `body exceeds ${MAX_BYTES} bytes` },
      { status: 413 },
    );
  }
  if (!isPng(buffer)) {
    return NextResponse.json({ error: "not a PNG" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return NextResponse.json(
        { error: "tunnel-public-host-unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }

  const id = randomUUID();
  const filename = `${id}.png`;

  const { error: uploadError } = await supabase.storage
    .from(CAPTURES_BUCKET)
    .upload(filename, buffer, {
      contentType: "image/png",
      cacheControl: "31536000, immutable",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `supabase upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: publicData } = supabase.storage
    .from(CAPTURES_BUCKET)
    .getPublicUrl(filename);

  const record: CaptureRecord = {
    id,
    publicUrl: publicData.publicUrl,
    createdAt: new Date().toISOString(),
    sizeBytes: buffer.length,
  };
  return NextResponse.json(record, { status: 201 });
}
