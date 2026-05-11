"use client";
/**
 * lib/use-camera.ts — React hook for camera lifecycle management.
 *
 * Mirror policy: this hook manages the raw MediaStream only.
 * CSS transform: scaleX(-1) on the <video> element is applied by LiveOverlay.
 * captureCut in lib/capture.ts must NOT apply ctx.scale(-1, 1).
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "no-device"
  | "ended"
  | "hidden";

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  restart: () => Promise<void>;
}

interface UseCameraOpts {
  width?: number;
  height?: number;
  facing?: "user" | "environment";
}

export function useCamera(opts?: UseCameraOpts): UseCameraResult {
  const { width = 1280, height = 720, facing = "user" } = opts ?? {};

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Track whether the camera was ready before a visibility-change so we can
  // restore status when the tab comes back.
  const wasReadyRef = useRef(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    wasReadyRef.current = false;
    setStatus("idle");
    setError(null);
  }, []);

  const start = useCallback(async () => {
    setStatus("requesting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: facing },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Wire up track-ended listener (camera unplugged or permission revoked).
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          setStatus("ended");
          wasReadyRef.current = false;
        };
      });

      wasReadyRef.current = true;
      setStatus("ready");
    } catch (err) {
      const name = (err as Error)?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
      } else if (
        name === "NotFoundError" ||
        name === "DevicesNotFoundError" ||
        name === "OverconstrainedError"
      ) {
        setStatus("no-device");
      } else {
        setStatus("ended");
        setError((err as Error)?.message ?? String(err));
      }
    }
  }, [width, height, facing]);

  const restart = useCallback(async () => {
    stop();
    await start();
  }, [stop, start]);

  // Visibility change: set "hidden" when tab is backgrounded; restore "ready"
  // when it comes back (without restarting the stream — stream stays open).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (wasReadyRef.current) {
          setStatus("hidden");
        }
      } else {
        // Returning to tab
        if (streamRef.current) {
          const tracks = streamRef.current.getTracks();
          const allLive = tracks.length > 0 && tracks.every((t) => t.readyState === "live");
          if (allLive) {
            wasReadyRef.current = true;
            setStatus("ready");
          } else if (wasReadyRef.current) {
            // Track died while hidden — surface ended state
            setStatus("ended");
            wasReadyRef.current = false;
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Device change: log only; do not auto-switch.
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log("[useCamera] devicechange event — device list may have changed");
    };

    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
    };
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { videoRef, status, error, start, stop, restart };
}
