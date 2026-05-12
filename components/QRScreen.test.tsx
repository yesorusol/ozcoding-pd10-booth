/**
 * components/QRScreen.test.tsx — Renders the two-step result screen
 * (photo → qr), mocks the `qrcode` package, and verifies copy +
 * transitions. Tests that need the QR step use the `initialStep="qr"`
 * test escape hatch to skip the photo-step click.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toDataURL = vi.fn();
vi.mock("qrcode", () => ({
  default: { toDataURL: (...args: unknown[]) => toDataURL(...args) },
}));

import { QRScreen } from "./QRScreen";

describe("QRScreen", () => {
  beforeEach(() => {
    toDataURL.mockReset();
  });

  it("photo step: renders headline + 'QR 만들기' CTA", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen
        publicUrl="https://abc.ngrok-free.app/captures/x.png"
        onNext={() => {}}
      />,
    );
    expect(screen.getByText("완성!")).toBeInTheDocument();
    expect(screen.getByText("사진이 잘 나왔는지 확인해 보세요")).toBeInTheDocument();
    expect(screen.getByTestId("make-qr-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("next-user-btn")).toBeNull();
    expect(screen.queryByTestId("qr-image")).toBeNull();
  });

  it("photo step: clicking 'QR 만들기' advances to the qr step", async () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen publicUrl="https://example.com/x.png" onNext={() => {}} />,
    );
    fireEvent.click(screen.getByTestId("make-qr-btn"));
    expect(screen.getByText("폰 카메라로 스캔")).toBeInTheDocument();
    expect(screen.getByTestId("next-user-btn")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("qr-image")).toBeInTheDocument();
    });
  });

  it("qr step: calls QRCode.toDataURL with the publicUrl and renders the data URL", async () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen
        publicUrl="https://example.com/captures/y.png"
        onNext={() => {}}
        initialStep="qr"
      />,
    );
    await waitFor(() => {
      expect(toDataURL).toHaveBeenCalled();
    });
    const args = toDataURL.mock.calls[0];
    expect(args[0]).toBe("https://example.com/captures/y.png");
    await waitFor(() => {
      const img = screen.getByTestId("qr-image") as HTMLImageElement;
      expect(img.src).toContain("fakeQR");
    });
  });

  it("qr step: shows a loading placeholder before the QR data URL resolves", async () => {
    let resolve: (v: string) => void = () => {};
    toDataURL.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );
    render(
      <QRScreen
        publicUrl="https://example.com/x.png"
        onNext={() => {}}
        initialStep="qr"
      />,
    );
    expect(screen.getByTestId("qr-loading")).toBeInTheDocument();
    resolve("data:image/png;base64,resolvedQR");
    await waitFor(() => {
      expect(screen.queryByTestId("qr-loading")).toBeNull();
    });
  });

  it("renders the sheet preview using publicUrl as the image source", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen
        publicUrl="https://example.com/x.png"
        sheetBlobUrl="blob:http://localhost/preview-1"
        onNext={() => {}}
      />,
    );
    const preview = screen.getByTestId("sheet-preview") as HTMLImageElement;
    expect(preview).toBeInTheDocument();
    expect(preview.src).toBe("https://example.com/x.png");
  });

  it("does NOT render the sheet preview when publicUrl is empty", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(<QRScreen publicUrl="" onNext={() => {}} />);
    expect(screen.queryByTestId("sheet-preview")).toBeNull();
  });

  it("qr step: clicking '처음으로 돌아가기' fires onNext exactly once", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    const onNext = vi.fn();
    render(
      <QRScreen
        publicUrl="https://example.com/x.png"
        onNext={onNext}
        initialStep="qr"
      />,
    );
    fireEvent.click(screen.getByTestId("next-user-btn"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("qr step: renders the challenge funnel Link when challengeHref is set", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen
        publicUrl="https://example.com/x.png"
        onNext={() => {}}
        challengeHref="/themed"
        initialStep="qr"
      />,
    );
    const funnel = screen.getByTestId("challenge-funnel-button") as HTMLAnchorElement;
    expect(funnel).toBeInTheDocument();
    expect(funnel.getAttribute("href")).toBe("/themed");
  });

  it("qr step: hides the challenge funnel Link when challengeHref is absent", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen
        publicUrl="https://example.com/x.png"
        onNext={() => {}}
        initialStep="qr"
      />,
    );
    expect(screen.queryByTestId("challenge-funnel-button")).toBeNull();
  });
});
