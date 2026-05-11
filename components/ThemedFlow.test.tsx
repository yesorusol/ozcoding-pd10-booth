/**
 * components/ThemedFlow.test.tsx — Smoke tests for the migrated booth body.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CameraStatus } from "@/lib/use-camera";

const mocks = vi.hoisted(() => {
  const cameraState: { status: CameraStatus } = { status: "requesting" };
  const startSpy = vi.fn(async () => {});
  const stopSpy = vi.fn(() => {});
  const restartSpy = vi.fn(async () => {});
  const videoRef = { current: null as HTMLVideoElement | null };
  const pushSpy = vi.fn();
  return { cameraState, startSpy, stopSpy, restartSpy, videoRef, pushSpy };
});

vi.mock("@/lib/use-camera", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/use-camera")>();
  return {
    ...actual,
    useCamera: () => ({
      videoRef: mocks.videoRef,
      status: mocks.cameraState.status,
      error: null,
      start: mocks.startSpy,
      stop: mocks.stopSpy,
      restart: mocks.restartSpy,
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.pushSpy }),
}));

vi.mock("@/lib/upload-sheet", () => ({
  uploadSheet: vi.fn(async () => ({
    id: "x",
    publicUrl: "https://example/x.png",
    createdAt: "2026-05-08T00:00:00.000Z",
    sizeBytes: 0,
  })),
}));

vi.mock("@/lib/sheet-composer", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/sheet-composer")>();
  return {
    ...actual,
    composeSheet: vi.fn(async () => new Blob(["x"], { type: "image/png" })),
  };
});

import { ThemedFlow } from "./ThemedFlow";

describe("ThemedFlow", () => {
  beforeEach(() => {
    mocks.cameraState.status = "requesting";
    mocks.startSpy.mockClear();
    mocks.stopSpy.mockClear();
    mocks.pushSpy.mockClear();
  });

  it("calls camera.start once on mount", () => {
    render(<ThemedFlow />);
    expect(mocks.startSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the priming overlay while camera status is 'requesting'", () => {
    render(<ThemedFlow />);
    expect(screen.getByTestId("priming-overlay")).toBeInTheDocument();
  });

  it("renders the LiveOverlay frame <img> (themed mode keeps the character frame)", () => {
    render(<ThemedFlow />);
    expect(screen.getByTestId("live-overlay-frame")).toBeInTheDocument();
  });

  it("surfaces the CameraDeniedBanner when camera status is 'denied'", () => {
    mocks.cameraState.status = "denied";
    render(<ThemedFlow />);
    expect(screen.getByTestId("camera-denied-banner")).toBeInTheDocument();
  });
});
