/**
 * lib/session-machine.ts — Reducer-based state machine driving the photobooth
 * session from camera-priming through 7 cut captures into compositing.
 *
 * State graph (locked in plan §M3):
 *   idle
 *     └─ START ──────► camera-priming
 *                         ├─ CAMERA_READY ──► countdown(cut=0, sec=3)
 *                         │                    │
 *                         │                    ├─ TICK (sec--, gated >0)
 *                         │                    └─ COUNTDOWN_DONE ──► flash
 *                         │                                            │
 *                         │                                  CAPTURE_DONE
 *                         │                                            ▼
 *                         │                                          preview
 *                         │                                            │
 *                         │                                  PREVIEW_DONE
 *                         │                                ┌───────────┴───────────┐
 *                         │                                │ cut < 6: countdown    │
 *                         │                                │ cut == 6: compositing │
 *                         │                                └─ COMPOSE_DONE ──► qr-display
 *                         └─ CAMERA_DENIED ──► camera-priming-error (manual retry → START)
 *
 *   CAMERA_LOST from any active phase → camera-priming-error.
 *   RESET from anywhere → idle.
 *
 * Idle-timer eligibility (consumed by M8) lives in `lib/types.ts` and is
 * re-exposed here via `isIdleEligible(state)`.
 */

import type { Cut, SessionState } from "./types";
import { IDLE_TIMER_ELIGIBLE_STATES } from "./types";

// ─── Constants (timing budget per plan §M3) ─────────────────────────────────

export const THEMED_CUTS = 7;
export const NORMAL_CUTS = 4;
export const TOTAL_CUTS = THEMED_CUTS;
export const COUNTDOWN_START = 3;
/** Single 200ms full-white flash. Below the 5Hz epilepsy threshold. */
export const FLASH_MS = 200;
/** Frozen captured-cut preview hold before next countdown. */
export const PREVIEW_MS = 700;
/** Prep-screen hold before the first countdown begins. */
export const PREP_MS = 3000;

// ─── Types ──────────────────────────────────────────────────────────────────

export type CameraErrorKind = "denied" | "no-device" | "ended" | "unknown";

export interface SessionMachineState {
  phase: SessionState;
  /** Index of the cut we are CURRENTLY shooting (0..6) or 7 once done. */
  cutIndex: number;
  /** Seconds remaining in the active countdown (3..0). */
  countdown: number;
  /** Captured cuts in order. Length grows from 0 → 7. */
  cuts: ReadonlyArray<Cut>;
  /** Set when phase == 'camera-priming-error'. */
  errorKind?: CameraErrorKind;
  /** Public URL of the composed sheet (M6). Set when phase == 'qr-display'. */
  publicUrl?: string;
}

export function createInitialState(
  _totalCuts: number = THEMED_CUTS,
): SessionMachineState {
  return {
    phase: "idle",
    cutIndex: 0,
    countdown: 0,
    cuts: [],
  };
}

export const initialState: SessionMachineState = createInitialState(THEMED_CUTS);

export type Action =
  | { type: "START" }
  | { type: "CAMERA_READY" }
  | { type: "CAMERA_DENIED"; kind: CameraErrorKind }
  | { type: "CAMERA_LOST" }
  | { type: "PREP_DONE" }
  | { type: "TICK" }
  | { type: "COUNTDOWN_DONE" }
  | { type: "CAPTURE_DONE"; cut: Cut }
  | { type: "PREVIEW_DONE" }
  | { type: "COMPOSE_DONE"; publicUrl: string }
  | { type: "COMPOSE_FAIL_TUNNEL" }
  | { type: "RESET" };

// ─── Reducer ────────────────────────────────────────────────────────────────

export function createReducer(totalCuts: number) {
  const baseInitial = createInitialState(totalCuts);
  return function reducerImpl(
    state: SessionMachineState,
    action: Action,
  ): SessionMachineState {
    switch (action.type) {
      case "START": {
        if (
          state.phase !== "idle" &&
          state.phase !== "camera-priming-error" &&
          state.phase !== "qr-display"
        ) {
          return state;
        }
        return { ...baseInitial, phase: "camera-priming" };
      }
      case "CAMERA_READY": {
        if (state.phase !== "camera-priming") return state;
        return {
          ...state,
          phase: "prep",
          cutIndex: 0,
          countdown: 0,
          errorKind: undefined,
        };
      }
      case "PREP_DONE": {
        if (state.phase !== "prep") return state;
        return {
          ...state,
          phase: "countdown",
          countdown: COUNTDOWN_START,
        };
      }
      case "CAMERA_DENIED": {
        return {
          ...state,
          phase: "camera-priming-error",
          errorKind: action.kind,
        };
      }
      case "CAMERA_LOST": {
        if (
          state.phase === "idle" ||
          state.phase === "qr-display" ||
          state.phase === "camera-priming-error"
        ) {
          return state;
        }
        return { ...state, phase: "camera-priming-error", errorKind: "ended" };
      }
      case "TICK": {
        if (state.phase !== "countdown") return state;
        if (state.countdown <= 0) return state;
        return { ...state, countdown: state.countdown - 1 };
      }
      case "COUNTDOWN_DONE": {
        if (state.phase !== "countdown") return state;
        return { ...state, phase: "flash", countdown: 0 };
      }
      case "CAPTURE_DONE": {
        if (state.phase !== "flash") return state;
        return {
          ...state,
          phase: "preview",
          cuts: [...state.cuts, action.cut],
        };
      }
      case "PREVIEW_DONE": {
        if (state.phase !== "preview") return state;
        const next = state.cutIndex + 1;
        if (next >= totalCuts) {
          return { ...state, phase: "compositing", cutIndex: next };
        }
        return {
          ...state,
          phase: "countdown",
          cutIndex: next,
          countdown: COUNTDOWN_START,
        };
      }
      case "COMPOSE_DONE": {
        if (state.phase !== "compositing") return state;
        return { ...state, phase: "qr-display", publicUrl: action.publicUrl };
      }
      case "COMPOSE_FAIL_TUNNEL": {
        if (state.phase !== "compositing") return state;
        return { ...state, phase: "tunnel-host-error" };
      }
      case "RESET": {
        return { ...baseInitial };
      }
    }
  };
}

export const reducer = createReducer(THEMED_CUTS);

// ─── Selectors ──────────────────────────────────────────────────────────────

/**
 * Whether the 30s no-interaction idle timer (M8) is allowed to fire RESET
 * from the current phase. Wraps the canonical set in lib/types.ts.
 */
export function isIdleEligible(state: SessionMachineState): boolean {
  return IDLE_TIMER_ELIGIBLE_STATES.has(state.phase);
}
