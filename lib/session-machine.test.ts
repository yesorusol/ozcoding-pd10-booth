/**
 * lib/session-machine.test.ts — Reducer transition coverage.
 *
 * Tests every documented edge of the state graph plus invariants:
 *   - invalid actions are no-ops,
 *   - the 7-cut loop terminates at compositing,
 *   - idle-timer eligibility matches plan §M3.
 */

import { describe, it, expect } from "vitest";
import {
  initialState,
  reducer,
  isIdleEligible,
  TOTAL_CUTS,
  COUNTDOWN_START,
  type SessionMachineState,
  type Action,
} from "./session-machine";
import type { Cut } from "./types";

function makeStubCut(index: number): Cut {
  return {
    index,
    frameId: "burger",
    imageBitmap: null,
    capturedAt: 1_000_000 + index,
  };
}

function run(
  start: SessionMachineState,
  actions: ReadonlyArray<Action>,
): SessionMachineState {
  return actions.reduce(reducer, start);
}

describe("session-machine reducer", () => {
  it("starts in idle with no cuts", () => {
    expect(initialState.phase).toBe("idle");
    expect(initialState.cuts).toHaveLength(0);
    expect(initialState.cutIndex).toBe(0);
  });

  it("START from idle → camera-priming", () => {
    const s = reducer(initialState, { type: "START" });
    expect(s.phase).toBe("camera-priming");
  });

  it("START from camera-priming-error (retry path) → camera-priming", () => {
    const errored: SessionMachineState = {
      ...initialState,
      phase: "camera-priming-error",
      errorKind: "denied",
    };
    const s = reducer(errored, { type: "START" });
    expect(s.phase).toBe("camera-priming");
    expect(s.errorKind).toBeUndefined();
  });

  it("START from countdown is a no-op (already in session)", () => {
    const mid: SessionMachineState = {
      ...initialState,
      phase: "countdown",
      countdown: 2,
    };
    expect(reducer(mid, { type: "START" })).toBe(mid);
  });

  it("CAMERA_READY: camera-priming → prep", () => {
    const primed: SessionMachineState = {
      ...initialState,
      phase: "camera-priming",
    };
    const s = reducer(primed, { type: "CAMERA_READY" });
    expect(s.phase).toBe("prep");
    expect(s.cutIndex).toBe(0);
  });

  it("PREP_DONE: prep → countdown(0, COUNTDOWN_START)", () => {
    const prepping: SessionMachineState = {
      ...initialState,
      phase: "prep",
      cutIndex: 0,
    };
    const s = reducer(prepping, { type: "PREP_DONE" });
    expect(s.phase).toBe("countdown");
    expect(s.cutIndex).toBe(0);
    expect(s.countdown).toBe(COUNTDOWN_START);
  });

  it("PREP_DONE outside prep is a no-op", () => {
    const idle = initialState;
    expect(reducer(idle, { type: "PREP_DONE" })).toBe(idle);
  });

  it("CAMERA_READY outside camera-priming is a no-op", () => {
    const idle = initialState;
    expect(reducer(idle, { type: "CAMERA_READY" })).toBe(idle);
  });

  it("CAMERA_DENIED captures kind", () => {
    const s = reducer(
      { ...initialState, phase: "camera-priming" },
      { type: "CAMERA_DENIED", kind: "no-device" },
    );
    expect(s.phase).toBe("camera-priming-error");
    expect(s.errorKind).toBe("no-device");
  });

  it("CAMERA_LOST in mid-session → error('ended')", () => {
    const mid: SessionMachineState = {
      ...initialState,
      phase: "countdown",
      cutIndex: 3,
      countdown: 2,
    };
    const s = reducer(mid, { type: "CAMERA_LOST" });
    expect(s.phase).toBe("camera-priming-error");
    expect(s.errorKind).toBe("ended");
  });

  it("CAMERA_LOST while idle is a no-op", () => {
    expect(reducer(initialState, { type: "CAMERA_LOST" })).toBe(initialState);
  });

  it("TICK during countdown decrements seconds", () => {
    const cd: SessionMachineState = {
      ...initialState,
      phase: "countdown",
      countdown: 3,
    };
    expect(reducer(cd, { type: "TICK" }).countdown).toBe(2);
    expect(reducer({ ...cd, countdown: 1 }, { type: "TICK" }).countdown).toBe(0);
  });

  it("TICK at countdown=0 is a no-op (waits for COUNTDOWN_DONE)", () => {
    const cd: SessionMachineState = {
      ...initialState,
      phase: "countdown",
      countdown: 0,
    };
    expect(reducer(cd, { type: "TICK" })).toBe(cd);
  });

  it("TICK outside countdown is a no-op", () => {
    const flash: SessionMachineState = { ...initialState, phase: "flash" };
    expect(reducer(flash, { type: "TICK" })).toBe(flash);
  });

  it("COUNTDOWN_DONE → flash", () => {
    const cd: SessionMachineState = {
      ...initialState,
      phase: "countdown",
      countdown: 0,
    };
    expect(reducer(cd, { type: "COUNTDOWN_DONE" }).phase).toBe("flash");
  });

  it("CAPTURE_DONE appends cut and advances to preview", () => {
    const flash: SessionMachineState = { ...initialState, phase: "flash" };
    const cut = makeStubCut(0);
    const s = reducer(flash, { type: "CAPTURE_DONE", cut });
    expect(s.phase).toBe("preview");
    expect(s.cuts).toHaveLength(1);
    expect(s.cuts[0]).toBe(cut);
  });

  it("PREVIEW_DONE on cut < 6 → countdown(next, 3)", () => {
    const previewing: SessionMachineState = {
      ...initialState,
      phase: "preview",
      cutIndex: 0,
      cuts: [makeStubCut(0)],
    };
    const s = reducer(previewing, { type: "PREVIEW_DONE" });
    expect(s.phase).toBe("countdown");
    expect(s.cutIndex).toBe(1);
    expect(s.countdown).toBe(COUNTDOWN_START);
  });

  it("PREVIEW_DONE on cut == 6 → compositing", () => {
    const lastPreview: SessionMachineState = {
      ...initialState,
      phase: "preview",
      cutIndex: TOTAL_CUTS - 1,
      cuts: Array.from({ length: TOTAL_CUTS }, (_, i) => makeStubCut(i)),
    };
    const s = reducer(lastPreview, { type: "PREVIEW_DONE" });
    expect(s.phase).toBe("compositing");
    expect(s.cutIndex).toBe(TOTAL_CUTS);
  });

  it("COMPOSE_DONE → qr-display, captures publicUrl", () => {
    const composing: SessionMachineState = {
      ...initialState,
      phase: "compositing",
      cutIndex: TOTAL_CUTS,
    };
    const url = "https://abc.ngrok-free.app/captures/abc-123.png";
    const next = reducer(composing, { type: "COMPOSE_DONE", publicUrl: url });
    expect(next.phase).toBe("qr-display");
    expect(next.publicUrl).toBe(url);
  });

  it("COMPOSE_FAIL_TUNNEL during compositing → tunnel-host-error", () => {
    const composing: SessionMachineState = {
      ...initialState,
      phase: "compositing",
      cutIndex: TOTAL_CUTS,
    };
    expect(reducer(composing, { type: "COMPOSE_FAIL_TUNNEL" }).phase).toBe(
      "tunnel-host-error",
    );
  });

  it("RESET from any phase returns to idle", () => {
    const wherever: SessionMachineState = {
      ...initialState,
      phase: "qr-display",
      cuts: [makeStubCut(0), makeStubCut(1)],
    };
    expect(reducer(wherever, { type: "RESET" })).toEqual(initialState);
  });

  it("end-to-end: 7-cut full session ends at qr-display with 7 cuts", () => {
    const actions: Action[] = [
      { type: "START" },
      { type: "CAMERA_READY" },
      { type: "PREP_DONE" },
    ];

    // Per cut: (COUNTDOWN_START - 1) TICKs to drain to countdown=1, then
    // COUNTDOWN_DONE fires from countdown=1 (matching the booth page driver).
    for (let i = 0; i < TOTAL_CUTS; i++) {
      for (let s = COUNTDOWN_START; s > 1; s--) {
        actions.push({ type: "TICK" });
      }
      actions.push(
        { type: "COUNTDOWN_DONE" },
        { type: "CAPTURE_DONE", cut: makeStubCut(i) },
        { type: "PREVIEW_DONE" },
      );
    }
    actions.push({ type: "COMPOSE_DONE", publicUrl: "https://example/x.png" });

    const final = run(initialState, actions);
    expect(final.phase).toBe("qr-display");
    expect(final.cuts).toHaveLength(TOTAL_CUTS);
    expect(final.cutIndex).toBe(TOTAL_CUTS);
    expect(final.publicUrl).toBe("https://example/x.png");
  });
});

describe("isIdleEligible (state-gated reset for M8)", () => {
  it("idle is eligible", () => {
    expect(isIdleEligible(initialState)).toBe(true);
  });

  it("qr-display is eligible (next-user reset)", () => {
    expect(isIdleEligible({ ...initialState, phase: "qr-display" })).toBe(true);
  });

  it("camera-priming-error is eligible (operator must fix)", () => {
    expect(
      isIdleEligible({
        ...initialState,
        phase: "camera-priming-error",
        errorKind: "denied",
      }),
    ).toBe(true);
  });

  it("active-session phases are NOT eligible (do not eject mid-session)", () => {
    const phases = [
      "camera-priming",
      "prep",
      "countdown",
      "flash",
      "preview",
      "compositing",
    ] as const;
    for (const phase of phases) {
      expect(
        isIdleEligible({ ...initialState, phase }),
      ).toBe(false);
    }
  });
});
