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

  it("moves the layout to a new centre on a resize rather than redoing it", async () => {
    // Going full screen used to restart the simulation at full heat, and every
    // node spent seconds on the move for a layout nothing had asked to change.
    const state = stateWith(["J1", "J2", "P1"]);
    const { result, rerender } = renderHook(
      ({ dims }) => useStablePositions(state, dims),
      { initialProps: { dims: DIMS } },
    );
    await settle();
    const before = structuredClone(result.current.positions);

    rerender({ dims: { w: 1400, h: 600 } });
    const after = result.current.positions;
    // Shifted by the move of the centre, with the shape untouched.
    for (const id of ["J1", "J2", "P1"]) {
      expect(after[id].x - before[id].x).toBeCloseTo(300);
      expect(after[id].y - before[id].y).toBeCloseTo(0);
    }
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

describe("pins and dragging", () => {
  // DIMS centres the layout on (400, 300); pins are offsets from there.
  const CENTRE = { x: 400, y: 300 };

  it("holds a pinned element exactly at its pin", async () => {
    const state = { ...stateWith(["J1", "J2"]), pins: { J1: { x: 50, y: -30 } } };
    const { result } = renderHook(() => useStablePositions(state, DIMS));
    await settle();
    expect(result.current.positions.J1).toEqual({ x: 450, y: 270 });
  });

  it("keeps it there when the layout re-runs for a new element", async () => {
    const pins = { J1: { x: 50, y: -30 } };
    const { result, rerender } = renderHook(
      ({ state }) => useStablePositions(state, DIMS),
      { initialProps: { state: { ...stateWith(["J1", "J2"]), pins } } },
    );
    await settle();
    rerender({ state: { ...stateWith(["J1", "J2", "J3"]), pins } });
    await settle();
    expect(result.current.positions.J1).toEqual({ x: 450, y: 270 });
  });

  it("applies pins that arrive without the layout re-running", async () => {
    // An import holding as many elements as the process it replaces.
    const { result, rerender } = renderHook(
      ({ state }) => useStablePositions(state, DIMS),
      { initialProps: { state: stateWith(["J1", "J2"]) } },
    );
    await settle();
    rerender({ state: { ...stateWith(["J1", "J2"]), pins: { J2: { x: -100, y: 0 } } } });
    await settle();
    expect(result.current.positions.J2).toEqual({ x: 300, y: 300 });
  });

  it("moves what is held, and only that, as the pointer goes", async () => {
    const { result } = renderHook(() =>
      useStablePositions(stateWith(["J1", "J2"]), DIMS),
    );
    await settle();
    let before;
    act(() => {
      before = structuredClone(result.current.positions);
      result.current.drag.grab(["J1"]);
      result.current.drag.moveTo(40, -20);
    });
    // Published at once — a layout at rest does not tick to show it.
    expect(result.current.positions.J1.x).toBeCloseTo(before.J1.x + 40);
    expect(result.current.positions.J1.y).toBeCloseTo(before.J1.y - 20);
    expect(result.current.positions.J2).toEqual(before.J2);
  });

  it("brings the layout to rest on a grab, so no neighbour drifts under a drag", async () => {
    // Grabbed straight after mounting, while the layout is at full heat and
    // every node is on the move: from the grab on, nothing held stays put.
    const { result } = renderHook(() =>
      useStablePositions(stateWith(["J1", "J2", "J3"]), DIMS),
    );
    await settle();
    let held;
    act(() => {
      result.current.drag.grab(["J1"]);
      held = structuredClone(result.current.positions);
    });
    await settle();
    expect(result.current.positions.J2).toEqual(held.J2);
    expect(result.current.positions.J3).toEqual(held.J3);
  });

  it("reports where it was dropped, as an offset from the centre", async () => {
    const onPin = vi.fn();
    const { result } = renderHook(() =>
      useStablePositions(stateWith(["J1", "J2"]), DIMS, onPin),
    );
    await settle();
    let start;
    act(() => {
      start = { ...result.current.positions.J1 };
      result.current.drag.grab(["J1"]);
      result.current.drag.moveTo(10, 20);
      result.current.drag.release();
    });
    const round = (v) => Math.round(v * 10) / 10;
    expect(onPin).toHaveBeenCalledWith({
      J1: {
        x: round(start.x + 10 - CENTRE.x),
        y: round(start.y + 20 - CENTRE.y),
      },
    });
  });
});
