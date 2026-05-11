/**
 * lib/use-camera.test.ts
 *
 * Tests for the useCamera hook.
 * navigator.mediaDevices.getUserMedia is fully mocked.
 * HTMLMediaElement.srcObject is stubbed in vitest.setup.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCamera } from "./use-camera";

// ---------------------------------------------------------------------------
// Helpers to build mock MediaStreamTrack / MediaStream / getUserMedia
// ---------------------------------------------------------------------------

function makeMockTrack(overrides?: Partial<MediaStreamTrack>): MediaStreamTrack {
  const track = {
    readyState: "live" as MediaStreamTrackState,
    stop: vi.fn(),
    onended: null as ((this: MediaStreamTrack, ev: Event) => unknown) | null,
    ...overrides,
  } as unknown as MediaStreamTrack;
  return track;
}

function makeMockStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
  } as unknown as MediaStream;
}

// Store original so we can restore it after each test.
const originalMediaDevices = Object.getOwnPropertyDescriptor(
  global.navigator,
  "mediaDevices",
);

function mockGetUserMedia(implementation: () => Promise<MediaStream>) {
  const mock = {
    getUserMedia: vi.fn(implementation),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: mock,
  });
  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCamera", () => {
  beforeEach(() => {
    // Stub HTMLMediaElement.srcObject so jsdom does not throw.
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      writable: true,
      value: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore mediaDevices to original descriptor if it existed.
    if (originalMediaDevices) {
      Object.defineProperty(global.navigator, "mediaDevices", originalMediaDevices);
    }
  });

  it("starts in idle status", () => {
    mockGetUserMedia(() => Promise.reject(new Error("not called")));
    const { result } = renderHook(() => useCamera());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("success path: status transitions idle → requesting → ready", async () => {
    const track = makeMockTrack();
    const stream = makeMockStream([track]);
    mockGetUserMedia(() => Promise.resolve(stream));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("NotAllowedError → status becomes denied", async () => {
    const err = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    mockGetUserMedia(() => Promise.reject(err));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("denied");
  });

  it("PermissionDeniedError → status becomes denied", async () => {
    const err = Object.assign(new Error("denied"), { name: "PermissionDeniedError" });
    mockGetUserMedia(() => Promise.reject(err));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("denied");
  });

  it("NotFoundError → status becomes no-device", async () => {
    const err = Object.assign(new Error("no device"), { name: "NotFoundError" });
    mockGetUserMedia(() => Promise.reject(err));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("no-device");
  });

  it("generic error → status becomes ended with error message", async () => {
    const err = Object.assign(new Error("something else"), { name: "UnknownError" });
    mockGetUserMedia(() => Promise.reject(err));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ended");
    expect(result.current.error).toBe("something else");
  });

  it("MediaStreamTrack.onended firing → status becomes ended", async () => {
    const track = makeMockTrack();
    const stream = makeMockStream([track]);
    mockGetUserMedia(() => Promise.resolve(stream));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ready");

    // Simulate camera being unplugged / permission revoked.
    await act(async () => {
      if (track.onended) {
        track.onended.call(track, new Event("ended"));
      }
    });

    expect(result.current.status).toBe("ended");
  });

  it("visibilitychange hidden → status becomes hidden; visible → restores ready", async () => {
    const track = makeMockTrack({ readyState: "live" });
    const stream = makeMockStream([track]);
    mockGetUserMedia(() => Promise.resolve(stream));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ready");

    // Simulate tab becoming hidden.
    await act(async () => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.status).toBe("hidden");

    // Simulate tab becoming visible again.
    await act(async () => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.status).toBe("ready");
  });

  it("stop() resets status to idle and calls track.stop()", async () => {
    const track = makeMockTrack();
    const stream = makeMockStream([track]);
    mockGetUserMedia(() => Promise.resolve(stream));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ready");

    act(() => {
      result.current.stop();
    });

    expect(result.current.status).toBe("idle");
    expect(track.stop).toHaveBeenCalled();
  });
});
