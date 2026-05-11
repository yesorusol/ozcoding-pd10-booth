/**
 * components/ModeSelect.test.tsx — 3-zone mode picker render + selection + routing.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeSelect } from "./ModeSelect";
import { COPY } from "@/lib/copy";

describe("ModeSelect — 3-zone layout", () => {
  it("renders banner with both KR and EN headlines", () => {
    render(<ModeSelect />);
    const banner = screen.getByTestId("mode-select-headline");
    expect(banner).toHaveTextContent(COPY.modeSelect.headlineKr);
    expect(banner).toHaveTextContent(COPY.modeSelect.headlineEn);
  });

  it("renders both indexed list rows with [N] + KR + EN", () => {
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-card-themed");
    const normalRow = screen.getByTestId("mode-card-normal");
    expect(themedRow).toHaveTextContent("[1]");
    expect(themedRow).toHaveTextContent(COPY.modeSelect.themedTitle);
    expect(themedRow).toHaveTextContent(COPY.modeSelect.themedTitleEn);
    expect(normalRow).toHaveTextContent("[2]");
    expect(normalRow).toHaveTextContent(COPY.modeSelect.normalTitle);
    expect(normalRow).toHaveTextContent(COPY.modeSelect.normalTitleEn);
  });

  it("rows are exposed as ARIA radios inside a radiogroup", () => {
    render(<ModeSelect />);
    const list = screen.getByTestId("mode-list");
    expect(list).toHaveAttribute("role", "radiogroup");
    expect(screen.getByTestId("mode-card-themed")).toHaveAttribute("role", "radio");
    expect(screen.getByTestId("mode-card-normal")).toHaveAttribute("role", "radio");
  });

  it("themed is the default selection on mount", () => {
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-card-themed");
    const normalRow = screen.getByTestId("mode-card-normal");
    expect(themedRow).toHaveAttribute("aria-checked", "true");
    expect(themedRow).toHaveAttribute("data-selected", "true");
    expect(themedRow.className).toMatch(/bg-btn-yellow/);
    expect(themedRow.className).toMatch(/border-2/);
    expect(normalRow).toHaveAttribute("aria-checked", "false");
    expect(normalRow).toHaveAttribute("data-selected", "false");
    expect(normalRow.className).toMatch(/bg-crt-cream/);
    expect(normalRow.className).not.toMatch(/border-2/);
  });

  it("tapping the normal row swaps the highlight to normal", async () => {
    const user = userEvent.setup();
    render(<ModeSelect />);
    const themedRow = screen.getByTestId("mode-card-themed");
    const normalRow = screen.getByTestId("mode-card-normal");
    await user.click(normalRow);
    expect(normalRow).toHaveAttribute("aria-checked", "true");
    expect(normalRow.className).toMatch(/bg-btn-yellow/);
    expect(normalRow.className).toMatch(/border-2/);
    expect(themedRow).toHaveAttribute("aria-checked", "false");
    expect(themedRow.className).toMatch(/bg-crt-cream/);
  });

  it("시작 pill href === /themed when themed selected (default)", () => {
    render(<ModeSelect />);
    const start = screen.getByTestId("mode-start");
    expect(start.tagName).toBe("A");
    expect(start.getAttribute("href")).toBe("/themed");
  });

  it("시작 pill href === /booth?mode=normal after selecting normal", async () => {
    const user = userEvent.setup();
    render(<ModeSelect />);
    await user.click(screen.getByTestId("mode-card-normal"));
    const start = screen.getByTestId("mode-start");
    expect(start.getAttribute("href")).toBe("/booth?mode=normal");
  });

  it("시작 pill is always enabled (no disabled state)", () => {
    render(<ModeSelect />);
    const start = screen.getByTestId("mode-start");
    expect(start).not.toHaveAttribute("aria-disabled", "true");
    expect(start.getAttribute("href")).toBeTruthy();
  });
});
