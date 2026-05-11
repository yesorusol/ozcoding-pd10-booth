/**
 * components/CameraDeniedBanner.test.tsx — Verifies status-specific Korean
 * copy and that the retry button fires the onRetry handler.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CameraDeniedBanner } from "./CameraDeniedBanner";

describe("CameraDeniedBanner", () => {
  it("shows denied copy when status is 'denied'", () => {
    render(<CameraDeniedBanner status="denied" onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-status", "denied");
    expect(screen.getByText("카메라 권한이 거부되었습니다")).toBeInTheDocument();
  });

  it("shows no-device copy when status is 'no-device'", () => {
    render(<CameraDeniedBanner status="no-device" onRetry={() => {}} />);
    expect(screen.getByText("카메라를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("shows ended copy when status is 'ended'", () => {
    render(<CameraDeniedBanner status="ended" onRetry={() => {}} />);
    expect(screen.getByText("카메라 연결이 끊겼어요")).toBeInTheDocument();
  });

  it("clicking the retry button fires onRetry exactly once", () => {
    const onRetry = vi.fn();
    render(<CameraDeniedBanner status="denied" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
