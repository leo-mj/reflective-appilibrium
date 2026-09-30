// @vitest-environment jsdom
//
// One pace for every tab that plays — History and the Simulate tab's
// simulation history — so that a speed means the same on both. They used to
// keep their own: History 3.2s a step, Simulate as fast as 250ms.
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  BASE_INTERVAL_MS,
  DEFAULT_SPEED,
  SPEEDS,
  usePlayback,
} from "./usePlayback.js";

afterEach(() => vi.useRealTimers());

const playing = (options) => {
  vi.useFakeTimers();
  const hook = renderHook(() => usePlayback(10, options));
  act(() => hook.result.current.setPlaying(true));
  return hook;
};

describe("usePlayback's pace", () => {
  it("starts at the default speed, which is on the scale", () => {
    const { result } = renderHook(() => usePlayback(10));
    expect(result.current.speed).toBe(DEFAULT_SPEED);
    expect(SPEEDS).toContain(DEFAULT_SPEED);
  });

  it.each([
    ["History's glide", {}],
    ["Simulate's discrete steps", { ease: false }],
  ])("takes one step per interval at 1×, with %s", (_, options) => {
    const { result } = playing(options);
    act(() => vi.advanceTimersByTime(BASE_INTERVAL_MS - 1));
    expect(result.current.targetRound).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.targetRound).toBe(1);
  });

  it("divides the interval by the speed", () => {
    const { result } = playing({ ease: false });
    act(() => result.current.setSpeed(4));
    act(() => vi.advanceTimersByTime(BASE_INTERVAL_MS));
    expect(result.current.targetRound).toBe(4);
  });

  it("shows the target at once when it does not ease", () => {
    const { result } = playing({ ease: false });
    act(() => vi.advanceTimersByTime(BASE_INTERVAL_MS));
    expect(result.current.snappedRound).toBe(1);
  });
});
