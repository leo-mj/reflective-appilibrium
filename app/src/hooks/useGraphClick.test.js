// @vitest-environment jsdom
//
// A mouse press on a node moves the node once it has travelled past the click
// threshold, and is a click if it has not. Everything else pans.
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGraphClick } from "./useGraphClick.js";

const J1 = { id: "J1", type: "judgment", status: "active", confidence: 1 };
const POSITIONS = { J1: { x: 100, y: 100 } };

/** A pointer event over a canvas whose top-left corner is the page's. */
const ev = (clientX, clientY, extra = {}) => ({
  clientX,
  clientY,
  pointerId: 1,
  pointerType: "mouse",
  button: 0,
  ctrlKey: false,
  metaKey: false,
  currentTarget: {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: vi.fn(),
  },
  ...extra,
});

function setup({ zoom = 1 } = {}) {
  const props = {
    panDown: vi.fn(),
    panUp: vi.fn(),
    panMove: vi.fn(),
    visibleEls: [J1],
    visRels: [],
    jointGroups: [],
    elementById: new Map([["J1", J1]]),
    edgeOffsets: new Map(),
    positions: POSITIONS,
    pan: { x: 0, y: 0 },
    zoom,
    onSelect: vi.fn(),
    onSelectRel: vi.fn(),
    setTooltip: vi.fn(),
    onCtrlNodeClick: vi.fn(),
    onNodeClick: vi.fn(),
    onNodeDragStart: vi.fn(),
    onNodeDrag: vi.fn(),
    onNodeDragEnd: vi.fn(),
  };
  const { result } = renderHook(() => useGraphClick(props));
  return { props, handlers: result.current };
}

/** Press at `from`, move through `path`, release at the last point. */
function gesture(handlers, from, path, extra) {
  handlers.onPointerDown(ev(...from, extra));
  for (const p of path) handlers.onPointerMove(ev(...p, extra));
  const end = path.at(-1) ?? from;
  handlers.onPointerUp(ev(...end, extra));
}

describe("dragging a node", () => {
  it("moves the node rather than panning, and selects nothing", () => {
    const { props, handlers } = setup();
    gesture(handlers, [100, 100], [[105, 100], [130, 110]]);

    expect(props.onNodeDragStart).toHaveBeenCalledTimes(1);
    expect(props.onNodeDragStart).toHaveBeenCalledWith(J1);
    expect(props.onNodeDrag).toHaveBeenLastCalledWith(J1, 30, 10);
    expect(props.onNodeDragEnd).toHaveBeenCalledTimes(1);
    expect(props.panDown).not.toHaveBeenCalled();
    expect(props.panMove).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("measures the move in the canvas's units, not the screen's", () => {
    const { props, handlers } = setup({ zoom: 2 });
    // J1 is at (100, 100) on the canvas: (200, 200) on screen at zoom 2.
    gesture(handlers, [200, 200], [[220, 200]]);
    expect(props.onNodeDrag).toHaveBeenLastCalledWith(J1, 10, 0);
  });

  it("is still a click until the press has travelled past the threshold", () => {
    const { props, handlers } = setup();
    gesture(handlers, [100, 100], [[103, 102]]);

    expect(props.onNodeDragStart).not.toHaveBeenCalled();
    expect(props.onNodeDrag).not.toHaveBeenCalled();
    expect(props.onNodeDragEnd).not.toHaveBeenCalled();
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it("leaves ctrl+click to build a selection, never a drag", () => {
    const { props, handlers } = setup();
    gesture(handlers, [100, 100], [[140, 100]], { ctrlKey: true });

    expect(props.onNodeDragStart).not.toHaveBeenCalled();
    expect(props.panDown).toHaveBeenCalled();
  });

  it("pans under a finger, even on a node", () => {
    const { props, handlers } = setup();
    gesture(handlers, [100, 100], [[140, 100]], { pointerType: "touch" });

    expect(props.onNodeDragStart).not.toHaveBeenCalled();
    expect(props.panDown).toHaveBeenCalled();
    expect(props.panMove).toHaveBeenCalled();
  });

  it("pans from the background", () => {
    const { props, handlers } = setup();
    gesture(handlers, [400, 400], [[440, 400]]);

    expect(props.onNodeDragStart).not.toHaveBeenCalled();
    expect(props.panDown).toHaveBeenCalled();
    expect(props.panMove).toHaveBeenCalled();
  });

  it("lets go of the node when the pointer is cancelled", () => {
    const { props, handlers } = setup();
    handlers.onPointerDown(ev(100, 100));
    handlers.onPointerMove(ev(130, 100));
    handlers.onPointerCancel(ev(130, 100));

    expect(props.onNodeDragEnd).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
