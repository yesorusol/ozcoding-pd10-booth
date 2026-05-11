/**
 * components/BoothPageRouter.test.tsx — `?mode=` routing.
 *
 * Mocks ThemedFlow + PolaroidEditorFlow with marker stubs so we don't drag in
 * camera/canvas plumbing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./ThemedFlow", () => ({
  ThemedFlow: () => <div data-testid="stub-themed-flow">themed</div>,
}));
vi.mock("./PolaroidEditorFlow", () => ({
  PolaroidEditorFlow: () => <div data-testid="stub-normal-flow">normal</div>,
}));

const searchParamsMock = vi.fn<(key: string) => string | null>(() => null);

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParamsMock(key),
  }),
}));

import { BoothPageRouter } from "./BoothPageRouter";

describe("BoothPageRouter", () => {
  beforeEach(() => {
    searchParamsMock.mockReset();
  });

  it("renders ThemedFlow when ?mode is missing", () => {
    searchParamsMock.mockReturnValue(null);
    render(<BoothPageRouter />);
    expect(screen.getByTestId("stub-themed-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("stub-normal-flow")).toBeNull();
  });

  it("renders ThemedFlow when ?mode=themed", () => {
    searchParamsMock.mockReturnValue("themed");
    render(<BoothPageRouter />);
    expect(screen.getByTestId("stub-themed-flow")).toBeInTheDocument();
  });

  it("renders NormalFlow when ?mode=normal", () => {
    searchParamsMock.mockReturnValue("normal");
    render(<BoothPageRouter />);
    expect(screen.getByTestId("stub-normal-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("stub-themed-flow")).toBeNull();
  });

  it("falls back to ThemedFlow on garbage ?mode values", () => {
    searchParamsMock.mockReturnValue("garbage");
    render(<BoothPageRouter />);
    expect(screen.getByTestId("stub-themed-flow")).toBeInTheDocument();
  });
});
