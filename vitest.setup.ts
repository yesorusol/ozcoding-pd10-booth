import "@testing-library/jest-dom";

// jsdom does not implement ResizeObserver; ScaleToFit and any other component
// that uses it will throw on mount without this polyfill.
if (typeof globalThis.ResizeObserver === "undefined") {
  class StubResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver =
    StubResizeObserver;
}
