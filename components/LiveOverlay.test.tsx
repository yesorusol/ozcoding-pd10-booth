/**
 * components/LiveOverlay.test.tsx — Renders LiveOverlay and verifies the
 * mirror policy, frame-image plumbing, and 1-based cut counter badge.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef, type RefObject } from "react";
import { LiveOverlay } from "./LiveOverlay";

function Harness(props: {
  frameSrc: string;
  frameAlt?: string;
  tagline?: string;
  cutIndex: number;
  total: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement | null>;
  return <LiveOverlay videoRef={videoRef} {...props} />;
}

describe("LiveOverlay", () => {
  it("renders the cut counter as 1-based (cutIndex 0 → '컷 1/7')", () => {
    render(<Harness frameSrc="/frames/processed/burger.png" cutIndex={0} total={7} />);
    expect(screen.getByTestId("live-overlay-badge")).toHaveTextContent("컷 1/7");
  });

  it("renders the cut counter at the last cut (cutIndex 6 → '컷 7/7')", () => {
    render(<Harness frameSrc="/frames/processed/waiter.png" cutIndex={6} total={7} />);
    expect(screen.getByTestId("live-overlay-badge")).toHaveTextContent("컷 7/7");
  });

  it("renders the frame <img> with the given src and alt", () => {
    render(
      <Harness
        frameSrc="/frames/processed/tamagotchi.png"
        frameAlt="타마고치"
        cutIndex={2}
        total={7}
      />,
    );
    const img = screen.getByTestId("live-overlay-frame") as HTMLImageElement;
    expect(img).toHaveAttribute("src", "/frames/processed/tamagotchi.png");
    expect(img).toHaveAttribute("alt", "타마고치");
    // pointer-events disabled so the <img> never intercepts clicks
    expect(img.style.pointerEvents).toBe("none");
    // cover fit (container is 720:900 = artwork aspect; cover clips the 40px
    // transparent columns of the 800×900 padded PNG with no content loss)
    expect(img.style.objectFit).toBe("cover");
  });

  it("marks frame img aria-hidden when no alt is provided (decorative)", () => {
    render(<Harness frameSrc="/frames/processed/mic.png" cutIndex={4} total={7} />);
    const img = screen.getByTestId("live-overlay-frame");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the selfie mirror (scaleX(-1)) and object-fit: cover to <video>", () => {
    render(<Harness frameSrc="/x.png" cutIndex={0} total={7} />);
    const video = screen.getByTestId("live-overlay-video") as HTMLVideoElement;
    expect(video.style.transform).toBe("scaleX(-1)");
    expect(video.style.objectFit).toBe("cover");
  });

  it("video element has autoplay/muted/playsInline so getUserMedia streams render", () => {
    render(<Harness frameSrc="/x.png" cutIndex={0} total={7} />);
    const video = screen.getByTestId("live-overlay-video") as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    // playsInline reflected as attribute in jsdom
    expect(video).toHaveAttribute("playsinline");
  });

  it("container has the 720:900 aspect ratio matching the frame artwork", () => {
    render(<Harness frameSrc="/x.png" cutIndex={0} total={7} />);
    const container = screen.getByTestId("live-overlay");
    expect(container.style.aspectRatio).toBe("720 / 900");
  });

  it("badge is an aria-live polite status region (countdown announces cut transitions)", () => {
    render(<Harness frameSrc="/x.png" cutIndex={0} total={7} />);
    // The status region is the inner Bubble, not the positioning wrapper
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("컷 1/7");
  });

  it("renders tagline bubble when a tagline prop is provided", () => {
    render(
      <Harness
        frameSrc="/frames/processed/burger.png"
        cutIndex={2}
        total={7}
        tagline="오늘의 메뉴는 바로 너!"
      />,
    );
    expect(screen.getByTestId("live-overlay-tagline")).toHaveTextContent(
      "오늘의 메뉴는 바로 너!",
    );
  });

  it("does NOT render tagline bubble when no tagline is provided", () => {
    render(<Harness frameSrc="/x.png" cutIndex={0} total={7} />);
    expect(screen.queryByTestId("live-overlay-tagline")).toBeNull();
  });
});
