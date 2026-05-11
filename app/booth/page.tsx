"use client";

/**
 * app/booth/page.tsx — Suspense wrapper for the booth flow router.
 *
 * The actual session logic now lives in <ThemedFlow/> and <NormalFlow/>;
 * this page only resolves `?mode` via <BoothPageRouter/> inside a
 * Suspense boundary (required by Next 15's `useSearchParams`).
 */

import { Suspense } from "react";
import { BoothPageRouter } from "@/components/BoothPageRouter";

export default function BoothPage() {
  return (
    <Suspense fallback={null}>
      <BoothPageRouter />
    </Suspense>
  );
}
