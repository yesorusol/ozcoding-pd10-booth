"use client";

/**
 * components/BoothPageRouter.tsx — Mode discriminator for `/booth`.
 *
 * Reads `?mode=` via `useSearchParams()` and renders the matching flow.
 * Missing/invalid `?mode` defaults to themed (preserves existing entry).
 *
 * Wrapped in a `<Suspense>` boundary by the page so Next 15's
 * `useSearchParams` doesn't bail out at build time.
 */

import { useSearchParams } from "next/navigation";
import { parseBoothMode } from "@/lib/booth-mode";
import { parseNormalFrameId } from "@/lib/normal-layout";
import { ThemedFlow } from "./ThemedFlow";
import { PolaroidEditorFlow } from "./PolaroidEditorFlow";

export function BoothPageRouter() {
  const searchParams = useSearchParams();
  const mode = parseBoothMode(searchParams.get("mode"));
  const frameId = parseNormalFrameId(searchParams.get("frame"));
  if (mode === "normal") return <PolaroidEditorFlow frameId={frameId} />;
  return <ThemedFlow />;
}
