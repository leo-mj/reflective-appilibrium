// @vitest-environment jsdom
//
// The force simulation itself is d3's business. What this hook owns is the
// bookkeeping around it: producing a position per element, keeping positions
// stable across restarts, flipping `ready`, and tearing down cleanly.
import { vi, describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useStablePositions } from "./useStablePositions.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DIMS = { w: 800, h: 600 };

const el = (id, type = "judgment") => ({
  id,
  type,
  status: "active",
  confidence: 1,
  text: id,
  addedRound: 1,
});

const stateWith = (ids, relations = []) => ({
  topic: "t",
  round: 1,
  elements: ids.map((id) => el(id)),
  relations,
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

/** Lets d3's internal timer produce at least one tick. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

describe("useStablePositions", () => {
  it("produces a finite position for every element", async () => {
    const { result } = renderHook(() =>
      useStablePositions(stateWith(["J1", "J2", "P1"]), DIMS),
    );
    await settle();

    const { positions } = result.current;
    expect(Object.keys(positions).sort()).toEqual(["J1", "J2", "P1"]);
    for (const p of Object.values(positions)) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("keeps existing nodes near their old spot when one is added", async () => {
    // The point of the hook: adding an element restarts the simulation, and
    // previously placed nodes resume from where they were rather than being
    // scattered afresh.
    const { result, rerender } = renderHook(
      ({ state }) => useStablePositions(state, DIMS),
      { initialProps: { state: stateWith(["J1", "J2"]) } },
    );
    await settle();
    const before = { ...result.current.positions.J1 };

    rerender({ state: stateWith(["J1", "J2", "J3"]) });
    await settle();

    const after = result.current.positions.J1;
    expect(after).toBeDefined();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(300);
  });

  it("stays unready until the fallback timeout fires", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStablePositions(stateWith(["J1"]), DIMS),
    );
    expect(result.current.ready).toBe(false);

    act(() => vi.advanceTimersByTime(1499));
    expect(result.current.ready).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.ready).toBe(true);
  });

  it("clears the pending ready timer on unmount", () => {
    // Asserted on the timer rather than on `ready`: a hook's last rendered value
    // is frozen at unmount, so a leaked setState would go unnoticed there.
    vi.useFakeTimers();
    const { unmount } = renderHook(() =>
      useStablePositions(stateWith(["J1"]), DIMS),
    );
    const pendingWhileMounted = vi.getTimerCount();
    expect(pendingWhileMounted).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBeLessThan(pendingWhileMounted);
  });

  it("lays out nothing until the panel has been measured", () => {
    const { result } = renderHook(() =>
      useStablePositions(stateWith(["J1"]), { w: 0, h: 0 }),
    );
    expect(result.current.positions).toEqual({});
  });

  it("copes with an empty state", async () => {
    const { result } = renderHook(() => useStablePositions(stateWith([]), DIMS));
    await settle();
    expect(result.current.positions).toEqual({});
  });
});
