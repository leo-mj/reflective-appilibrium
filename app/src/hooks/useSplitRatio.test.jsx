// @vitest-environment jsdom
//
// The divider's position is one number read two ways: as a percentage width for
// whichever panel carries one, and as a share of the row for the graph, which
// has to size its canvas to match. jsdom lays nothing out, so the drag itself is
// the browser's to test; what is held here is the arithmetic either side of it —
// which panel the ratio is measured on, what a keypress does to it, and that it
// survives a reload.
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useSplitRatio, DEFAULT_RATIO } from "./useSplitRatio.js";

afterEach(() => {
  cleanup();
  localStorage.removeItem("workspaceSplit");
});

/** The keydown the divider answers to, as React's handler receives it. */
const arrow = (key) => ({ key, preventDefault: () => {} });

describe("useSplitRatio", () => {
  it("starts even, and reports it as the fixed panel's width", () => {
    const { result } = renderHook(() => useSplitRatio("left"));
    expect(result.current.ratio).toBe(DEFAULT_RATIO);
    expect(result.current.panelWidth).toBe("50.000%");
  });

  it("measures the ratio from the left edge whichever panel is fixed", () => {
    // The line is a position, not a panel's share: an assist tab's companion is
    // on the right of it, so its width is what the line leaves over.
    localStorage.setItem("workspaceSplit", "0.7");
    const left = renderHook(() => useSplitRatio("left"));
    expect(left.result.current.panelWidth).toBe("70.000%");
    cleanup();
    const right = renderHook(() => useSplitRatio("right"));
    expect(right.result.current.panelWidth).toBe("30.000%");
  });

  it("moves a point at a time from the keyboard, and remembers it", () => {
    const { result } = renderHook(() => useSplitRatio("left"));
    act(() => result.current.dividerProps.onKeyDown(arrow("ArrowRight")));
    expect(result.current.ratio).toBeCloseTo(0.51);
    expect(JSON.parse(localStorage.getItem("workspaceSplit"))).toBeCloseTo(
      0.51,
    );
  });

  it("ignores the arrows a vertical divider cannot answer for", () => {
    const { result } = renderHook(() => useSplitRatio("left"));
    act(() => result.current.dividerProps.onKeyDown(arrow("ArrowUp")));
    expect(result.current.ratio).toBe(DEFAULT_RATIO);
  });

  it("will not let either panel be dragged away entirely", () => {
    localStorage.setItem("workspaceSplit", "0.99");
    const { result } = renderHook(() => useSplitRatio("left"));
    expect(result.current.ratio).toBe(0.8);
  });

  it("falls back to even halves on a stored value it cannot use", () => {
    localStorage.setItem("workspaceSplit", '"most of it"');
    const { result } = renderHook(() => useSplitRatio("left"));
    expect(result.current.ratio).toBe(DEFAULT_RATIO);
  });

  it("double-click evens the panels up again", () => {
    localStorage.setItem("workspaceSplit", "0.75");
    const { result } = renderHook(() => useSplitRatio("left"));
    act(() => result.current.dividerProps.onDoubleClick());
    expect(result.current.ratio).toBe(DEFAULT_RATIO);
    expect(JSON.parse(localStorage.getItem("workspaceSplit"))).toBe(
      DEFAULT_RATIO,
    );
  });

  it("announces itself as a splitter, in the percentages the role assumes", () => {
    const { result } = renderHook(() => useSplitRatio("left"));
    const props = result.current.dividerProps;
    expect(props.role).toBe("separator");
    expect(props["aria-orientation"]).toBe("vertical");
    expect(props.tabIndex).toBe(0);
    expect(props["aria-valuenow"]).toBe(50);
    expect(props["aria-valuemin"]).toBe(20);
    expect(props["aria-valuemax"]).toBe(80);
  });
});
