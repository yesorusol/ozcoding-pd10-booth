/**
 * components/QRScreen.test.tsx — Renders the result screen, mocks the
 * `qrcode` package, and verifies copy + interactions.
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

  it("renders headline + subline", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen
        publicUrl="https://abc.ngrok-free.app/captures/x.png"
        onNext={() => {}}
      />,
    );
    expect(screen.getByText("완성!")).toBeInTheDocument();
    expect(screen.getByText("폰 카메라로 스캔")).toBeInTheDocument();
  });

  it("calls QRCode.toDataURL with the publicUrl and renders the data URL", async () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    render(
      <QRScreen publicUrl="https://example.com/captures/y.png" onNext={() => {}} />,
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

  it("shows a loading placeholder before the QR data URL resolves", async () => {
    let resolve: (v: string) => void = () => {};
    toDataURL.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );
    render(
      <QRScreen publicUrl="https://example.com/x.png" onNext={() => {}} />,
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

  it("clicking '다음 사용자' fires onNext exactly once", () => {
    toDataURL.mockResolvedValue("data:image/png;base64,fakeQR");
    const onNext = vi.fn();
    render(<QRScreen publicUrl="https://example.com/x.png" onNext={onNext} />);
    fireEvent.click(screen.getByTestId("next-user-btn"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
